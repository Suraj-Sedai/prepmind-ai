# PrepMind AI

PrepMind AI is a local-first study companion built from the April 2026 technical specification. The current MVP covers the full study loop:

- account registration, login, logout, and persistent cookie sessions
- private document upload and processing for `PDF`, `TXT`, and `DOCX`
- chunking, topic extraction, and per-user study memory
- grounded question answering with citations
- flashcard generation and difficulty rating
- quiz generation, grading, and weak-topic detection
- exam mode with timed sessions and readiness scoring
- dashboard and progress tracking
- clean React UI with light and dark theme toggle

## Project Layout

- `backend/`: FastAPI app, SQLite persistence, document processing, study services
- `frontend/`: React + TypeScript client for auth, upload, retrieval, review, quiz, exam, and progress

## Implemented API Surface

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
- `GET /api/dashboard`
- `GET /api/progress`
- `GET /api/recommendations`
- `GET /api/flashcards`
- `POST /api/flashcards/generate`
- `POST /api/flashcards/{id}/rate`
- `POST /api/quiz/generate`
- `POST /api/quiz/submit`
- `POST /api/exam/start`
- `POST /api/exam/submit`

## Current Retrieval / Generation Strategy

The app works end to end without an external model key. The present MVP uses:

- persisted chunk embeddings with vector-style similarity ranking
- lexical retrieval with weighted token overlap
- grounded synthesis from indexed chunks
- heuristic flashcard and assessment generation
- mastery updates from question answering, flashcards, quizzes, and exams

If an OpenAI API key is configured, the backend can also use OpenAI embeddings and model-backed grounded answers. Without a key, it falls back to local embeddings plus heuristic synthesis.

## Document Pipeline Features

- per-user upload directories
- upload size and file-type validation
- duplicate protection with optional replace
- document delete support
- processing states: `processing`, `processed`, `failed`
- indexed metadata: file size, extracted word count, and topic summary

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

## Verified During Development

- `npm run lint`
- `npm run build`
- backend smoke tests covering:
  - auth session flow
  - upload, duplicate replace, delete
  - ask flow
  - flashcard generation and rating
  - quiz generation and submit
  - exam start and submit
  - progress and dashboard refresh

## Strongest Remaining Upgrades

- move from local persisted vectors to a dedicated vector store such as ChromaDB or FAISS
- extend model-backed generation beyond answers into flashcards, quizzes, and exam feedback
- add OCR, PowerPoint parsing, and background ingestion jobs for larger documents
