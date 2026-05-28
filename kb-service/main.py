"""
TaskforceAI Knowledge Base service.

Owns each agent's knowledge base as a markdown document and converts
uploaded PDFs into markdown that gets appended to it. The Next.js app
talks to this service via the KB_API_URL environment variable.

Endpoints
---------
GET    /health
GET    /kb/{agent_id}            -> {"agent_id", "content"}
PUT    /kb/{agent_id}            body {"content"} -> persists, returns content
POST   /kb/{agent_id}/upload     multipart file=<pdf> -> converts & appends

Auth
----
If KB_API_KEY is set, every request (except /health) must send
`Authorization: Bearer <KB_API_KEY>`.

Storage
-------
Markdown files live under KB_STORE_DIR (default ./kb_store). Swap this
for S3 / a database when you outgrow local disk.
"""

import os
import tempfile
from pathlib import Path

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    import pymupdf4llm  # high-quality PDF -> Markdown
except ImportError:  # pragma: no cover
    pymupdf4llm = None

KB_DIR = Path(os.environ.get("KB_STORE_DIR", "kb_store"))
KB_DIR.mkdir(parents=True, exist_ok=True)
API_KEY = os.environ.get("KB_API_KEY")

app = FastAPI(title="TaskforceAI KB Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_key(authorization: str | None = Header(default=None)) -> None:
    if API_KEY and authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def kb_path(agent_id: str) -> Path:
    safe = "".join(c for c in agent_id if c.isalnum() or c in ("-", "_")) or "default"
    return KB_DIR / f"{safe}.md"


def read_kb(agent_id: str) -> str:
    p = kb_path(agent_id)
    return p.read_text(encoding="utf-8") if p.exists() else ""


def write_kb(agent_id: str, content: str) -> None:
    kb_path(agent_id).write_text(content, encoding="utf-8")


class KbBody(BaseModel):
    content: str


@app.get("/health")
def health() -> dict:
    return {"ok": True, "converter": "pymupdf4llm" if pymupdf4llm else "unavailable"}


@app.get("/kb/{agent_id}", dependencies=[Depends(require_key)])
def get_kb(agent_id: str) -> dict:
    return {"agent_id": agent_id, "content": read_kb(agent_id)}


@app.put("/kb/{agent_id}", dependencies=[Depends(require_key)])
def put_kb(agent_id: str, body: KbBody) -> dict:
    write_kb(agent_id, body.content)
    return {
        "agent_id": agent_id,
        "content": body.content,
        "bytes": len(body.content.encode("utf-8")),
    }


@app.post("/kb/{agent_id}/upload", dependencies=[Depends(require_key)])
async def upload_pdf(agent_id: str, file: UploadFile = File(...)) -> dict:
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    if pymupdf4llm is None:
        raise HTTPException(
            status_code=500,
            detail="pymupdf4llm is not installed on the server",
        )

    data = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".pdf") as tmp:
        tmp.write(data)
        tmp.flush()
        try:
            markdown = pymupdf4llm.to_markdown(tmp.name)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=422, detail=f"Failed to convert PDF: {exc}")

    markdown = markdown.strip()
    existing = read_kb(agent_id).rstrip()
    heading = f"## Imported from {file.filename}"
    block = f"{heading}\n\n{markdown}\n"
    combined = f"{existing}\n\n{block}" if existing else block
    write_kb(agent_id, combined)

    return {
        "agent_id": agent_id,
        "filename": file.filename,
        "markdown": markdown,
        "content": combined,
    }
