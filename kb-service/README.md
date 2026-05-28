# KB Service (Python)

FastAPI service that stores each agent's knowledge base as markdown and
converts uploaded PDFs to markdown using
[`pymupdf4llm`](https://pymupdf.readthedocs.io/en/latest/pymupdf4llm/).

The Next.js portal proxies to this service — it never calls it from the
browser. Point the portal at it with `KB_API_URL`.

## Run locally

```bash
cd kb-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Service is now at `http://localhost:8000`. In the portal's `.env.local`:

```
KB_API_URL=http://localhost:8000
# KB_API_KEY=some-shared-secret   # optional; must match on both sides
```

## Run with Docker

```bash
cd kb-service
docker build -t kb-service .
docker run -p 8000:8000 -v "$PWD/data:/data" kb-service
```

## API

| Method | Path                    | Body / form           | Returns                         |
| ------ | ----------------------- | --------------------- | ------------------------------- |
| GET    | `/health`               | —                     | `{ ok, converter }`             |
| GET    | `/kb/{agent_id}`        | —                     | `{ agent_id, content }`         |
| PUT    | `/kb/{agent_id}`        | `{ "content": "…" }`  | `{ agent_id, content, bytes }`  |
| POST   | `/kb/{agent_id}/upload` | `file=<pdf>`          | `{ filename, markdown, content }` |

`content` is the full markdown KB; on upload the converted markdown is
appended to it under an `## Imported from <file>` heading.

### Quick test

```bash
curl http://localhost:8000/health
curl -X PUT http://localhost:8000/kb/kavya \
  -H 'content-type: application/json' \
  -d '{"content":"# Hello\n\nKavya knows this."}'
curl -F 'file=@pricing.pdf' http://localhost:8000/kb/kavya/upload
```

## Auth

Set `KB_API_KEY` to require `Authorization: Bearer <key>` on every request
(except `/health`). Set the same value as `KB_API_KEY` in the portal.

## Deploy

Any container host works (Render, Railway, Fly.io, Cloud Run, a VM). Mount
a persistent volume at `/data` so the markdown survives restarts, then set
`KB_API_URL` (and `KB_API_KEY`) in the portal's environment.
