# PrepMind AI

Initial project scaffold for the April 2026 technical specification. This first milestone establishes a local-first FastAPI + React workspace with:

- document upload and ingestion
- chunking plus lightweight topic extraction
- dashboard, progress, and recommendation APIs
- a grounded "Ask AI" flow that works without external model keys
- frontend pages matching the documented product areas

## Project Layout

- `backend/`: FastAPI application, SQLite persistence, document processing pipeline
- `frontend/`: React + TypeScript client for dashboard, upload, study, and progress views

## What Is Implemented

- `POST /api/documents/upload`
- `GET /api/documents`
- `GET /api/dashboard`
- `GET /api/progress`
- `GET /api/recommendations`
- `POST /api/ask`
- `POST /api/auth/register`
- `POST /api/auth/login`

The current backend uses heuristic retrieval and grounded response composition so the app is usable before model credentials are available.

## What I Still Need From You

- An OpenAI or Gemini API key when you're ready for real generation and embeddings
- Your preferred deployment target later on: local only, Render, Railway, Vercel, AWS, etc.
- Whether you want authentication to stay simple or move to JWT/session auth in the next pass

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

The Vite dev server is configured to proxy `/api` requests to `http://127.0.0.1:8000`.
