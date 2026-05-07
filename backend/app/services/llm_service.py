from pathlib import Path

import httpx

from app.core.config import get_settings
from app.schemas.study import CitationItem

settings = get_settings()
PROJECT_ROOT = Path(__file__).resolve().parents[3]
RAG_PROMPT_PATH = PROJECT_ROOT / "prompt" / "rag1.md"
FALLBACK_RAG_PROMPT = """# Prepmind.ai Master RAG Prompt

You are Prepmind.ai, an elite academic tutor and study assistant.
Answer questions using ONLY the provided source context inside <sources>.
If the sources do not contain the answer, state: "I'm sorry, but based on your currently uploaded materials, I don't have information on [topic]. Would you like me to provide a general explanation instead?"
Never invent facts or use external knowledge unless specifically asked for a general explanation.
Use short paragraphs, standard Markdown bullets or numbered lists, and cite source names and pages for facts.
Do not use Markdown tables or code fences.
"""


def _load_rag_prompt() -> str:
    try:
        return RAG_PROMPT_PATH.read_text(encoding="utf-8").strip()
    except OSError:
        return FALLBACK_RAG_PROMPT.strip()


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


def _clean_model_text(text: str | None) -> str | None:
    if not text:
        return None
    return text.strip().replace("\r\n", "\n")


def generate_grounded_answer(
    question: str,
    citations: list[CitationItem],
    context_blocks: list[str] | None = None,
) -> str | None:
    if not citations and not context_blocks:
        return None

    source_blocks = context_blocks or [
        "\n".join(
            [
                f"Source: {citation.document_name}",
                f"Topic: {citation.topic_label}",
                (
                    f"Pages: {citation.page_start}-{citation.page_end}"
                    if citation.page_start and citation.page_end and citation.page_start != citation.page_end
                    else f"Page: {citation.page_start or 'unknown'}"
                ),
                f"Snippet: {citation.snippet}",
            ]
        )
        for citation in citations
    ]
    prompt = (
        _load_rag_prompt()
        + "\n\n"
        f"<question>\n{question}\n</question>\n\n"
        "<sources>\n"
        + "\n\n---\n\n".join(source_blocks)
        + "\n</sources>\n\n"
        "Answer for the student now. Follow the master RAG prompt exactly."
    )
    return _clean_model_text(_generate_response(prompt))


def generate_general_answer(question: str) -> str | None:
    prompt = (
        "You are Prepmind.ai, a helpful study assistant.\n"
        "Answer the student's question accurately, clearly, and in plain text.\n"
        "Start with a direct answer.\n"
        "Then give a short explanation.\n"
        "If useful, use numbered steps, short bullets, or a simple example.\n"
        "Do not use markdown tables or code fences.\n"
        "If you are uncertain, say so briefly rather than pretending.\n\n"
        f"Question: {question}"
    )
    return _clean_model_text(_generate_response(prompt))
