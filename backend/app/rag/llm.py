from __future__ import annotations

from typing import Optional

import httpx

from app.core.config import get_settings


settings = get_settings()


def extract_gemini_text(payload: dict) -> Optional[str]:
    candidates = payload.get("candidates", [])
    if not candidates:
        return None
    parts = candidates[0].get("content", {}).get("parts", [])
    text = "\n".join(part.get("text", "") for part in parts if part.get("text")).strip()
    return text or None


def generate_with_gemini(prompt: str) -> Optional[str]:
    if not settings.gemini_api_key:
        return None
    response = httpx.post(
        f"{settings.gemini_base_url}/models/{settings.gemini_chat_model}:generateContent",
        headers={
            "x-goog-api-key": settings.gemini_api_key,
            "Content-Type": "application/json",
        },
        json={"contents": [{"role": "user", "parts": [{"text": prompt}]}]},
        timeout=60.0,
    )
    response.raise_for_status()
    return extract_gemini_text(response.json())


def generate_with_openai(prompt: str) -> Optional[str]:
    if not settings.openai_api_key:
        return None
    response = httpx.post(
        f"{settings.openai_base_url}/responses",
        headers={
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        },
        json={"model": settings.openai_chat_model, "input": prompt},
        timeout=60.0,
    )
    response.raise_for_status()
    payload = response.json()
    return payload.get("output_text")


def generate_model_text(prompt: str) -> Optional[str]:
    for generator in (generate_with_gemini, generate_with_openai):
        try:
            text = generator(prompt)
        except Exception:
            continue
        if text:
            return text.strip().replace("\r\n", "\n")
    return None
