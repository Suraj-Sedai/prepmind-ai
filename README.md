# PrepMind AI
https://prepmind-ai-875743593015.europe-west1.run.app/ 

PrepMind AI is a local-first study app with a deliberately simple core flow:

- upload notes in `PDF`, `TXT`, `MD`, and `DOCX`
- ask questions in the built-in AI chat
- generate flashcards from uploaded material
- generate quizzes from uploaded material

The current UI is a simple MVP study workspace with these sections: Dashboard, Materials, AI Chat, Flashcards, Quizzes, Progress, and Settings.

## Project Layout

- `backend/`: FastAPI app, SQLite persistence, document processing, retrieval, and study services
- `frontend/`: React + TypeScript client for auth, uploads, AI chat, flashcards, quizzes, progress, and settings

## Active API Surface

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/auth/me`

Documents:

- `POST /api/documents/upload`
- `GET /api/documents`
- `GET /api/documents/{id}`
- `DELETE /api/documents/{id}`

Study:

- `POST /api/ask`
- `GET /api/flashcards`
- `POST /api/flashcards/generate`
- `POST /api/flashcards/{id}/rate`
- `POST /api/quiz/generate`
- `POST /api/quiz/submit`

## Retrieval and Answering

The app works without an external model key.

Current behavior:

- document text is extracted page-by-page or section-by-section, cleaned, chunked, topic-labeled, and scored for importance
- junk content such as table-of-contents pages, page numbers, repeated headers/footers, and empty fragments is skipped
- chunk embeddings are created once at upload time and stored with metadata, source location, content type, and importance score
- retrieval is filtered by `user_id` and optionally by the selected document, then ranked with vector similarity, keyword overlap, and importance
- answers return structured status: `answered_from_documents`, `not_found_in_documents`, or `general_ai_fallback`
- document-grounded answers include real retrieved sources; general AI fallback is clearly labeled as not from uploaded materials
- the implementation follows the RAG requirements in `prompt/rag1.md`; runtime answer prompts live in `backend/app/rag/prompts.py`

Configure either `PREPMIND_GEMINI_API_KEY` or `PREPMIND_OPENAI_API_KEY` before uploading materials. The app no longer stores local hash or placeholder embeddings; missing embedding credentials produce a clear upload error instead of fake vectors.

## Document Pipeline

- per-user upload directories
- file type and size validation
- duplicate protection with optional replace
- delete support
- processing states: `uploaded`, `processing`, `ready`, `failed`
- scanned PDFs without extractable text fail clearly because OCR is not implemented yet

## Run The Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Run The Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

The Vite dev server proxies `/api` requests to `http://127.0.0.1:8000`.

## Current Priorities

The best next improvements are:

- split the remaining large `App.tsx` page logic into focused screen components
- add persistent multi-turn chat history instead of session-only chat exchanges
- add richer import support if PPT or image processing becomes a product requirement

## Google Cloud Deployment

This repo now includes Google Cloud deployment files for Cloud Run:

- [Dockerfile](C:\Users\suraj\OneDrive\Documents\Playground\prepmind-ai\Dockerfile)
- [cloudbuild.yaml](C:\Users\suraj\OneDrive\Documents\Playground\prepmind-ai\cloudbuild.yaml)
- [DEPLOY_GOOGLE_CLOUD.md](C:\Users\suraj\OneDrive\Documents\Playground\prepmind-ai\DEPLOY_GOOGLE_CLOUD.md)

The recommended production path is:

- Cloud Run for the app
- Cloud SQL for PostgreSQL for the database
- Cloud Storage bucket mounts for uploads
