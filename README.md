# PrepMind AI

PrepMind AI is a local-first study app with a deliberately simple core flow:

- upload notes in `PDF`, `TXT`, and `DOCX`
- ask questions in the built-in AI chat
- generate flashcards from uploaded material
- generate quizzes from uploaded material

The current UI keeps chat available globally at the bottom of the app, so users can ask questions from any section without leaving their current workflow.

## Project Layout

- `backend/`: FastAPI app, SQLite persistence, document processing, retrieval, and study services
- `frontend/`: React + TypeScript client for auth, uploads, flashcards, quizzes, and the global chat dock

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

- document text is extracted, cleaned, chunked, and topic-labeled
- chunk embeddings are stored with each uploaded document
- retrieval uses vector similarity plus token overlap
- answers are grounded in uploaded notes when relevant citations are found
- if no relevant notes are found, chat falls back to general-answer mode

If an OpenAI API key is configured, the backend can use OpenAI embeddings and model-backed answers. Without that key, it falls back to local embeddings and local synthesis.

## Document Pipeline

- per-user upload directories
- file type and size validation
- duplicate protection with optional replace
- delete support
- processing states: `processing`, `processed`, `failed`

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

- split the large frontend app shell into smaller components
- add persistent multi-turn chat history instead of only the latest exchange
- optionally remove backend endpoints that are no longer part of the simplified visible product

## Google Cloud Deployment

This repo now includes Google Cloud deployment files for Cloud Run:

- [Dockerfile](C:\Users\suraj\OneDrive\Documents\Playground\prepmind-ai\Dockerfile)
- [cloudbuild.yaml](C:\Users\suraj\OneDrive\Documents\Playground\prepmind-ai\cloudbuild.yaml)
- [DEPLOY_GOOGLE_CLOUD.md](C:\Users\suraj\OneDrive\Documents\Playground\prepmind-ai\DEPLOY_GOOGLE_CLOUD.md)

The recommended production path is:

- Cloud Run for the app
- Cloud SQL for PostgreSQL for the database
- Cloud Storage bucket mounts for uploads
