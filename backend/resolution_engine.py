import anthropic
import structlog
from pydantic import BaseModel

from config import settings
from salesforce_client import SalesforceClient
from vector_store import VectorStore
from company_knowledge_loader import CompanyKnowledgeLoader

log = structlog.get_logger()

RESOLUTION_PROMPT = """\
You are an AI-powered Salesforce Case Resolution Engine.

Analyze the current case and the historical resolution knowledge provided below.
Determine the best course of action and provide a structured recommendation.

=== SECTION 1: CURRENT CASE DETAILS ===
Case Number: {case_number}
Subject: {subject}
Description: {description}
Type: {case_type}
Priority: {priority}
Origin: {origin}
Contact: {contact_name} ({contact_email})
Owner: {owner_name}
Created: {created_date}

Comments:
{comments}

Emails:
{emails}

=== SECTION 2: HISTORICAL RESOLUTION DATA ===

--- Company Standard Knowledge Guidelines ---
This knowledge is the fine tune latest knowledge for resolution. 
This knowledge instrcution and Priority is high. 
{company_knowledge}

--- AI-Generated Knowledge Articles (from similar resolved cases) ---
{knowledge_articles}

=== SECTION 3: PROPOSED RESOLUTION MODEL ===
IMPORTANT: Your resolution MUST align with the Company Standard Knowledge Guidelines above.
Use the standard procedures, email templates, contacts, and escalation paths defined there.

CASE CATEGORY CLASSIFICATION (do this first — sets the Case Type field):
Classify the case into EXACTLY ONE of these four categories:
- "User Management" — login, password, lockout, user access issues. Identified by email/username.
- "Account Management" — company/account-level data changes. Identified by an Employee ID. Uses Employee_Id__c on the Account object.
- "Financial Transaction Issues" — billing, payments, charges, refunds, transaction discrepancies.
- "HR" — employee records, leave, payroll, internal HR policy questions (not customer-facing account data).

OBJECT ROUTING CHECK (do this before drafting steps):
- If category is "Account Management" -> Resolution steps must use Employee_Id__c to look up and
  update the Account object (e.g., "Update Account Phone field using Employee_Id__c").
- If category is "User Management" -> Resolution steps must use the email to look up and update the
  User object (e.g., "Unlock User record using email").
- NEVER use an Employee ID against the User object, and NEVER use an email/username against the Account object.

Based on the case details and historical data, determine:

1. ISSUE IDENTIFICATION: What specific issue is the customer facing?
2. AUTOMATED ACTION: Can this be resolved automatically without human intervention?
3. HUMAN INTERVENTION: Is a human agent required? If so, which team?
4. ROUTING: Should this case be routed to another team/department?
5. CUSTOMER EMAIL: Draft the appropriate email response to the customer.
6. AUTO-CLOSE: Can this case be automatically closed after sending the resolution?
7. CONFIDENCE: Rate your confidence in this recommendation (0.0 to 1.0).

IMPORTANT RULES FOR RESPONSE:
- Be CONCISE. No filler text, no verbose explanations.
- issue_summary: 1 sentence max.
- root_cause: 1 sentence max.
- resolution_steps: Each step must be a SHORT actionable instruction (under 15 words).
  Example: "Send password reset email to customer" NOT "The first step would be to send an email to the customer requesting them to reset their password by clicking the link provided"
- resolution_notes: 2-3 sentences max summarizing the resolution.
- customer_email_body: Keep professional but brief (under 100 words).
- reasoning: 1 sentence max.

Respond in the following JSON format ONLY (no markdown, no extra text):
{{
    "case_category": "User Management | Account Management | Financial Transaction Issues | HR",
    "issue_summary": "...",
    "root_cause": "...",
    "recommended_action": "auto_resolve | escalate | route | request_info",
    "resolution_steps": ["short step 1", "short step 2"],
    "resolution_notes": "Brief resolution summary",
    "requires_human": true/false,
    "route_to_team": "team name or null",
    "customer_email_subject": "...",
    "customer_email_body": "...",
    "can_auto_close": true/false,
    "confidence_score": 0.0-1.0,
    "reasoning": "Brief reason"
}}
"""

VALID_CASE_CATEGORIES = {
    "User Management",
    "Account Management",
    "Financial Transaction Issues",
    "HR",
}


class ResolutionResult(BaseModel):
    case_category: str
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


class ResolutionEngine:
    def __init__(self, sf_client: SalesforceClient, vector_store: VectorStore):
        self.sf = sf_client
        self.vector_store = vector_store
        self.llm = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.company_kb = CompanyKnowledgeLoader()

    def resolve_case(self, case_id: str) -> ResolutionResult:
        log.info("resolving_case", case_id=case_id)

        case = self.sf.get_case_by_id(case_id)
        search_query = f"{case.get('Subject', '')} {case.get('Description', '')}"
        articles = self.vector_store.search(search_query)
        knowledge_text = self._format_articles(articles)

        company_knowledge = self.company_kb.get_for_case_type(case.get("Type", ""))
        result = self._get_ai_recommendation(case, knowledge_text, company_knowledge)

        self._update_salesforce(case_id, result)

        log.info(
            "case_resolved",
            case_id=case_id,
            action=result.recommended_action,
            confidence=result.confidence_score,
        )
        return result

    def _format_articles(self, articles: list[dict]) -> str:
        if not articles:
            return "No relevant historical knowledge found."

        parts = []
        for i, article in enumerate(articles, 1):
            parts.append(
                f"--- Article {i} (Similarity: {article['similarity']:.2f}) ---\n"
                f"Type: {article['metadata'].get('case_type', 'N/A')} / "
                f"{article['metadata'].get('sub_type', 'N/A')}\n\n"
                f"{article['content'][:2000]}\n"
            )
        return "\n".join(parts)

    def _get_ai_recommendation(
        self, case: dict, knowledge_text: str, company_knowledge: str = ""
    ) -> ResolutionResult:
        comments = "\n".join(
            f"[{c.get('CreatedDate', '')}] {c.get('CommentBody', '')}"
            for c in case.get("Comments", [])
        )
        emails = "\n".join(
            f"[{e.get('CreatedDate', '')}] From:{e.get('FromAddress', '')} "
            f"Subject:{e.get('Subject', '')} Body:{(e.get('TextBody') or '')[:300]}"
            for e in case.get("Emails", [])
        )

        contact = case.get("Contact") or {}
        owner = case.get("Owner") or {}

        prompt = RESOLUTION_PROMPT.format(
            case_number=case.get("CaseNumber", ""),
            subject=case.get("Subject", ""),
            description=case.get("Description", ""),
            case_type=case.get("Type", ""),
            priority=case.get("Priority", ""),
            origin=case.get("Origin", ""),
            contact_name=contact.get("Name", ""),
            contact_email=contact.get("Email", ""),
            owner_name=owner.get("Name", ""),
            created_date=case.get("CreatedDate", ""),
            comments=comments or "None",
            emails=emails or "None",
            company_knowledge=company_knowledge or "No company standard guidelines available.",
            knowledge_articles=knowledge_text,
        )

        response = self.llm.messages.create(
            model=settings.anthropic_model,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )

        import json
        import re

        raw = response.content[0].text.strip()
        match = re.search(r'\{[\s\S]*\}', raw)
        if not match:
            raise ValueError(f"No JSON found in AI response: {raw[:200]}")
        data = json.loads(match.group())

        if data.get("case_category") not in VALID_CASE_CATEGORIES:
            log.warning("invalid_case_category", value=data.get("case_category"))
            data["case_category"] = "User Management"

        return ResolutionResult(**data)

    def _build_rich_text_notes(self, result: ResolutionResult) -> str:
        steps_html = "".join(f"<li>{s}</li>" for s in result.resolution_steps)
        return (
            f"<h2>AI Resolution Summary</h2>"
            f"<p><b>Issue:</b> {result.issue_summary}</p>"
            f"<p><b>Root Cause:</b> {result.root_cause}</p>"
            f"<p><b>Confidence:</b> {result.confidence_score * 100:.0f}%</p>"
            f"<h3>Resolution Steps</h3>"
            f"<ol>{steps_html}</ol>"
            f"<h3>Resolution Notes</h3>"
            f"<p>{result.resolution_notes}</p>"
            f"<h3>Customer Email</h3>"
            f"<p><b>Subject:</b> {result.customer_email_subject}</p>"
            f"<p>{result.customer_email_body.replace(chr(10), '<br/>')}</p>"
        )

    def _update_salesforce(self, case_id: str, result: ResolutionResult):
        rich_notes = self._build_rich_text_notes(result)
        update_data = {
            "Type": result.case_category,
            "AI_Resolution_Notes__c": rich_notes,
            "AI_Confidence_Score__c": result.confidence_score,
            "AI_Recommended_Action__c": result.recommended_action,
            "AI_Resolution_Status__c": "Pending",
        }

        try:
            self.sf.update_case(case_id, update_data)
        except Exception:
            log.warning(
                "sf_update_failed_full",
                case_id=case_id,
                msg="Retrying without Type field, then falling back to comment",
            )
            try:
                update_data.pop("Type", None)
                self.sf.update_case(case_id, update_data)
            except Exception:
                self.sf.sf.CaseComment.create({
                    "ParentId": case_id,
                    "CommentBody": f"[AI Resolution - Pending Review]\nCategory: {result.case_category}\n{result.resolution_notes}",
                    "IsPublished": False,
                })
