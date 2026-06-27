import json
from contextlib import asynccontextmanager
from pathlib import Path

import logging

import structlog
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel

from config import settings
from salesforce_client import SalesforceClient
from vector_store import VectorStore
from knowledge_generator import KnowledgeGenerator
from resolution_engine import ResolutionEngine
from agent_executor import AgentExecutor
from company_knowledge_loader import CompanyKnowledgeLoader

logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(logging, settings.log_level.upper(), logging.INFO)
    ),
)
log = structlog.get_logger()

sf_client: SalesforceClient | None = None
vector_store: VectorStore | None = None
knowledge_gen: KnowledgeGenerator | None = None
resolution_eng: ResolutionEngine | None = None
agent_executor: AgentExecutor | None = None
company_kb: CompanyKnowledgeLoader | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global sf_client, vector_store, knowledge_gen, resolution_eng, agent_executor, company_kb
    log.info("initializing_services")
    sf_client = SalesforceClient()
    vector_store = VectorStore()
    knowledge_gen = KnowledgeGenerator(sf_client, vector_store)
    resolution_eng = ResolutionEngine(sf_client, vector_store)
    agent_executor = AgentExecutor(sf_client, vector_store)
    company_kb = CompanyKnowledgeLoader()
    log.info("services_ready", articles_in_store=vector_store.get_article_count())
    yield
    log.info("shutting_down")


app = FastAPI(
    title="Salesforce Case Intelligence Platform",
    description="AI-Powered Case Resolution with RAG",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CaseRequest(BaseModel):
    case_id: str


class ResolutionResponse(BaseModel):
    case_id: str
    issue_summary: str
    root_cause: str
    recommended_action: str
    resolution_steps: list[str]
    resolution_notes: str
    requires_human: bool
    route_to_team: str | None = None
    customer_email_subject: str
    customer_email_body: str
    can_auto_close: bool
    confidence_score: float
    reasoning: str


class KnowledgeGenResponse(BaseModel):
    status: str
    articles_generated: int | None = None
    message: str


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "articles_in_store": vector_store.get_article_count() if vector_store else 0,
    }


@app.post("/resolve", response_model=ResolutionResponse)
def resolve_case(req: CaseRequest):
    if not resolution_eng:
        raise HTTPException(status_code=503, detail="Service not initialized")

    try:
        result = resolution_eng.resolve_case(req.case_id)
        return ResolutionResponse(case_id=req.case_id, **result.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        log.error("resolution_failed", case_id=req.case_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"Resolution failed: {e}")


class AgentActionRequest(BaseModel):
    case_id: str
    action: str  # "execute" | "partially_correct" | "not_right"
    comments: str = ""
    previous_resolution: dict = {}


@app.post("/agent-action")
def agent_action(req: AgentActionRequest):
    if not agent_executor or not vector_store or not company_kb:
        raise HTTPException(status_code=503, detail="Service not initialized")

    try:
        if req.action == "execute":
            steps = req.previous_resolution.get("resolution_steps", [])
            if not steps:
                raise HTTPException(status_code=400, detail="No resolution steps to execute")

            result = agent_executor.execute_steps(
                case_id=req.case_id,
                resolution_steps=steps,
                resolution_data=req.previous_resolution,
            )
            return result

        elif req.action in ("partially_correct", "not_right"):
            if not req.comments:
                raise HTTPException(status_code=400, detail="Comments required for feedback")

            case = sf_client.get_case_by_id(req.case_id)
            search_query = f"{case.get('Subject', '')} {case.get('Description', '')}"
            articles = vector_store.search(search_query)
            knowledge_text = resolution_eng._format_articles(articles)
            company_knowledge = company_kb.get_for_case_type(case.get("Type", ""))

            revised = agent_executor.revise_resolution(
                case_id=req.case_id,
                agent_action=req.action,
                agent_comments=req.comments,
                previous_resolution=req.previous_resolution,
                knowledge_text=knowledge_text,
                company_knowledge=company_knowledge,
            )
            return {"status": "revised", "case_id": req.case_id, "resolution": revised}

        else:
            raise HTTPException(status_code=400, detail=f"Invalid action: {req.action}")

    except HTTPException:
        raise
    except Exception as e:
        log.error("agent_action_failed", case_id=req.case_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/case-by-number/{case_number}")
def get_case_by_number(case_number: str):
    if not sf_client:
        raise HTTPException(status_code=503, detail="Service not initialized")

    try:
        soql = f"""
            SELECT Id, CaseNumber, Subject, Description, Status, Type,
                   Priority, Origin, CreatedDate, ClosedDate,
                   Contact.Name, Contact.Email, Owner.Name
            FROM Case
            WHERE CaseNumber = '{case_number}'
        """
        cases = sf_client.query(soql)
        if not cases:
            raise HTTPException(status_code=404, detail=f"Case #{case_number} not found")

        case = cases[0]
        case_id = case["Id"]
        comments = sf_client._safe_query(sf_client._get_comments, case_id)

        contact = case.get("Contact") or {}
        owner = case.get("Owner") or {}

        result = {
            "Id": case_id,
            "CaseNumber": case.get("CaseNumber", ""),
            "Subject": case.get("Subject", ""),
            "Description": case.get("Description", ""),
            "Status": case.get("Status", ""),
            "Type": case.get("Type", ""),
            "Priority": case.get("Priority", ""),
            "Origin": case.get("Origin", ""),
            "CreatedDate": case.get("CreatedDate", ""),
            "ClosedDate": case.get("ClosedDate", ""),
            "ContactName": contact.get("Name", ""),
            "ContactEmail": contact.get("Email", ""),
            "OwnerName": owner.get("Name", ""),
            "Comments": [
                {"CommentBody": c.get("CommentBody", ""), "CreatedDate": c.get("CreatedDate", "")}
                for c in comments
            ],
        }

        # Try to fetch AI custom fields
        try:
            ai_fields = sf_client.query(
                f"SELECT AI_Resolution_Notes__c, AI_Resolution_Status__c, "
                f"AI_Confidence_Score__c, AI_Recommended_Action__c "
                f"FROM Case WHERE Id = '{case_id}'"
            )
            if ai_fields:
                af = ai_fields[0]
                result["AI_Resolution_Notes"] = af.get("AI_Resolution_Notes__c", "")
                result["AI_Resolution_Status"] = af.get("AI_Resolution_Status__c", "")
                result["AI_Confidence_Score"] = af.get("AI_Confidence_Score__c", "")
                result["AI_Recommended_Action"] = af.get("AI_Recommended_Action__c", "")
        except Exception:
            pass

        return result
    except HTTPException:
        raise
    except Exception as e:
        log.error("get_case_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/generate-knowledge", response_model=KnowledgeGenResponse)
def generate_knowledge(background_tasks: BackgroundTasks):
    if not knowledge_gen:
        raise HTTPException(status_code=503, detail="Service not initialized")

    def run():
        try:
            count = knowledge_gen.generate_knowledge_base()
            log.info("knowledge_generation_done", articles=count)
        except Exception as e:
            log.error("knowledge_generation_failed", error=str(e))

    background_tasks.add_task(run)
    return KnowledgeGenResponse(
        status="started",
        message="Knowledge generation started in background. Check logs for progress.",
    )


@app.get("/generate-knowledge-sync", response_model=KnowledgeGenResponse)
def generate_knowledge_sync():
    if not knowledge_gen:
        raise HTTPException(status_code=503, detail="Service not initialized")

    try:
        count = knowledge_gen.generate_knowledge_base()
        return KnowledgeGenResponse(
            status="completed",
            articles_generated=count,
            message=f"Generated {count} knowledge articles.",
        )
    except Exception as e:
        log.error("knowledge_generation_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/articles")
def list_articles():
    articles_dir = settings.knowledge_base_dir
    if not articles_dir.exists():
        return {"articles": []}

    articles = []
    for meta_file in sorted(articles_dir.glob("*.meta.json")):
        meta = json.loads(meta_file.read_text(encoding="utf-8"))
        article_id = meta_file.stem.replace(".meta", "")
        md_file = articles_dir / f"{article_id}.md"
        docx_file = articles_dir / f"{article_id}.docx"
        articles.append({
            "id": article_id,
            "case_type": meta.get("case_type", ""),
            "sub_type": meta.get("sub_type", ""),
            "case_count": meta.get("case_count", 0),
            "case_numbers": meta.get("case_numbers", []),
            "has_md": md_file.exists(),
            "has_docx": docx_file.exists(),
        })
    return {"articles": articles}


@app.get("/api/articles/{article_id}")
def get_article(article_id: str):
    md_path = settings.knowledge_base_dir / f"{article_id}.md"
    if not md_path.exists():
        raise HTTPException(status_code=404, detail="Article not found")
    return {"id": article_id, "content": md_path.read_text(encoding="utf-8")}


@app.get("/api/articles/{article_id}/download")
def download_article(article_id: str):
    docx_path = settings.knowledge_base_dir / f"{article_id}.docx"
    if not docx_path.exists():
        md_path = settings.knowledge_base_dir / f"{article_id}.md"
        if not md_path.exists():
            raise HTTPException(status_code=404, detail="Article not found")
        return FileResponse(str(md_path), filename=f"{article_id}.md")
    return FileResponse(str(docx_path), filename=f"{article_id}.docx")


@app.get("/api/company-knowledge")
def list_company_knowledge():
    kb_dir = settings.company_knowledge_dir
    if not kb_dir.exists():
        return {"files": []}
    files = []
    for f in sorted(kb_dir.iterdir()):
        if f.suffix in (".md", ".txt", ".docx") and f.stem.lower() != "readme":
            files.append({"name": f.stem, "filename": f.name, "type": f.suffix})
    return {"files": files}


@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    frontend_path = Path(__file__).parent / "frontend" / "index.html"
    return HTMLResponse(frontend_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host=settings.host, port=settings.port, reload=True)
