import httpx

from app.core.config import get_settings
from app.schemas.study import CitationItem

settings = get_settings()


def _generate_response(prompt: str) -> str | None:
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


def generate_grounded_answer(question: str, citations: list[CitationItem]) -> str | None:
    if not citations:
        return None

    context_blocks = [
        f"Source: {citation.document_name}\nTopic: {citation.topic_label}\nSnippet: {citation.snippet}"
        for citation in citations
    ]
    prompt = (
        "Answer the student's question using only the provided study material. "
        "Be concise, structured, and explicitly grounded in the sources.\n\n"
        f"Question: {question}\n\n"
        "Study material:\n"
        + "\n\n".join(context_blocks)
    )
    return _generate_response(prompt)


def generate_general_answer(question: str) -> str | None:
    prompt = (
        "You are a helpful study assistant. Answer the student's question clearly and concisely. "
        "If the question is broad, give a practical explanation with a few key points.\n\n"
        f"Question: {question}"
    )
    return _generate_response(prompt)
