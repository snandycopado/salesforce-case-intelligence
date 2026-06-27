# AI-Powered Salesforce Case Intelligence & Auto Resolution Platform

Connects to any Salesforce org, generates a RAG-powered knowledge base from historical cases, and uses Claude AI with multi-agent execution to automatically resolve new cases.

## Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────────┐
│   Salesforce     │────▶│  Backend (FastAPI + Python)               │
│   - Cases        │◀────│  - Resolution Engine (Claude AI + RAG)    │
│   - Users        │     │  - Knowledge Generator                   │
│   - Comments     │     │  - Multi-Agent Executor (MCP Tools)      │
│   - Emails       │     │  - Vector Store (ChromaDB)               │
└─────────────────┘     └──────────────────────────────────────────┘
                                          ▲
                                          │
                        ┌─────────────────┴──────────────────┐
                        │  Frontend (React)                   │
                        │  - Dashboard                        │
                        │  - Case Validator                   │
                        │  - Knowledge Base Viewer            │
                        │  - Agent Decision Panel             │
                        └─────────────────────────────────────┘
```

## Features

- **Knowledge Base Generation** — Analyzes historical closed cases, groups by type, generates structured articles
- **AI Case Resolution** — RAG-powered resolution with company knowledge guidelines
- **Agent Feedback Loop** — Execute / Partially Correct / Not Right with auto-revision
- **Multi-Agent Execution** — Claude autonomously executes approved steps via MCP tools
- **Knowledge Learning** — Updates knowledge base from agent corrections
- **Word Document Export** — Knowledge articles generated as .docx files

## Project Structure

```
├── backend/
│   ├── app.py                    # FastAPI server
│   ├── config.py                 # Settings from .env
│   ├── salesforce_client.py      # Salesforce API client
│   ├── vector_store.py           # ChromaDB vector store
│   ├── knowledge_generator.py    # AI knowledge article generator
│   ├── resolution_engine.py      # Case resolution with RAG
│   ├── agent_executor.py         # Multi-agent step executor
│   ├── mcp_tools.py              # Salesforce action tools
│   ├── company_knowledge_loader.py
│   ├── company_knowledge/        # Standard resolution guidelines
│   ├── knowledge_base/           # Generated articles + vectors
│   ├── requirements.txt
│   └── Dockerfile
├── frontend-react/
│   ├── src/
│   │   ├── App.js
│   │   ├── components/
│   │   │   ├── Dashboard.js
│   │   │   ├── CaseValidator.js
│   │   │   ├── CaseResolution.js
│   │   │   ├── KnowledgeBase.js
│   │   │   └── CompanyKnowledge.js
│   │   └── services/api.js
│   └── package.json
├── render.yaml                   # Render.com deployment config
└── README.md
```

## Setup (Local)

### Backend
```bash
cd backend
cp .env.example .env    # Fill in credentials
pip install -r requirements.txt
python app.py           # Runs on http://localhost:8000
```

### Frontend
```bash
cd frontend-react
npm install
npm start               # Runs on http://localhost:3000
```

### Environment Variables
| Variable | Description |
|----------|-------------|
| SF_USERNAME | Salesforce username |
| SF_PASSWORD | Salesforce password |
| SF_SECURITY_TOKEN | Salesforce security token |
| SF_DOMAIN | `login` for production, `test` for sandbox |
| ANTHROPIC_API_KEY | Claude API key |
| ANTHROPIC_MODEL | Claude model (default: claude-sonnet-4-6) |

## Deployment (Render.com)

1. Push to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. New → Blueprint → Connect your repo
4. Render reads `render.yaml` and creates both services
5. Add environment variables in Render dashboard
6. Set `REACT_APP_API_URL` to your backend URL

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /resolve | AI case resolution |
| POST | /agent-action | Execute/revise resolution |
| GET | /api/case-by-number/{num} | Fetch case by number |
| GET | /api/articles | List knowledge articles |
| GET | /generate-knowledge-sync | Generate knowledge base |

## Resolution Flow

1. Case created → `POST /resolve` → AI proposes resolution
2. Agent reviews → 3 options:
   - **Execute AI Steps** → Multi-agent executes on Salesforce
   - **Partially Correct** → AI revises, keeps correct parts
   - **Not Right** → AI rethinks entirely
3. Knowledge base updated with agent corrections
4. Future cases benefit from learned corrections
