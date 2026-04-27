import httpx

from app.core.config import get_settings
from app.schemas.study import CitationItem

settings = get_settings()


def _extract_gemini_text(payload: dict) -> str | None:
    candidates = payload.get("candidates", [])
    if not candidates:
        return None
    parts = candidates[0].get("content", {}).get("parts", [])
    texts = [part.get("text", "") for part in parts if part.get("text")]
    joined = "\n".join(texts).strip()
    return joined or None


def _generate_with_gemini(prompt: str) -> str | None:
    if not settings.gemini_api_key:
        return None

    try:
        response = httpx.post(
            f"{settings.gemini_base_url}/models/{settings.gemini_chat_model}:generateContent",
            headers={
                "x-goog-api-key": settings.gemini_api_key,
                "Content-Type": "application/json",
            },
            json={
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": prompt}],
                    }
                ]
            },
            timeout=60.0,
        )
        response.raise_for_status()
        return _extract_gemini_text(response.json())
    except Exception:
        return None


def _generate_with_openai(prompt: str) -> str | None:
    if not settings.openai_api_key:
        return None

    try:
        response = httpx.post(
            f"{settings.openai_base_url}/responses",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.openai_chat_model,
                "input": prompt,
            },
            timeout=60.0,
        )
        response.raise_for_status()
        payload = response.json()
        return payload.get("output_text")
    except Exception:
        return None


def _generate_response(prompt: str) -> str | None:
    return _generate_with_gemini(prompt) or _generate_with_openai(prompt)


def generate_grounded_answer(question: str, citations: list[CitationItem]) -> str | None:
    if not citations:
        return None

    context_blocks = [
        f"Source: {citation.document_name}\nTopic: {citation.topic_label}\nSnippet: {citation.snippet}"
        for citation in citations
    ]
    prompt = (
        "You are PrepMind AI, a grounded study assistant.\n"
        "Answer the student's question using only the provided study material.\n"
        "Do not invent facts outside the provided notes.\n"
        "Be concise, clear, and structured.\n\n"
        f"Question: {question}\n\n"
        "Study material:\n"
        + "\n\n".join(context_blocks)
    )
    return _generate_response(prompt)


def generate_general_answer(question: str) -> str | None:
    prompt = (
        "You are PrepMind AI, a helpful study assistant.\n"
        "Answer the student's question clearly and concisely.\n"
        "If useful, explain in simple steps.\n\n"
        f"Question: {question}"
    )
    return _generate_response(prompt)
