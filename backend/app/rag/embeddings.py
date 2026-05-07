import json
import math
from typing import Literal

import httpx

from app.core.config import get_settings


EmbeddingTaskType = Literal["RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"]
settings = get_settings()


class EmbeddingProviderUnavailable(RuntimeError):
    pass


def _embed_with_gemini(
    texts: list[str],
    task_type: EmbeddingTaskType,
) -> tuple[list[list[float]], str] | None:
    if not settings.gemini_api_key:
        return None

    if len(texts) == 1:
        response = httpx.post(
            f"{settings.gemini_base_url}/models/{settings.gemini_embedding_model}:embedContent",
            headers={
                "x-goog-api-key": settings.gemini_api_key,
                "Content-Type": "application/json",
            },
            json={
                "model": f"models/{settings.gemini_embedding_model}",
                "content": {"parts": [{"text": texts[0]}]},
                "taskType": task_type,
            },
            timeout=60.0,
        )
        response.raise_for_status()
        payload = response.json()
        values = payload.get("embedding", {}).get("values", [])
        if values:
            return [[float(value) for value in values]], settings.gemini_embedding_model
        return None

    response = httpx.post(
        f"{settings.gemini_base_url}/models/{settings.gemini_embedding_model}:batchEmbedContents",
        headers={
            "x-goog-api-key": settings.gemini_api_key,
            "Content-Type": "application/json",
        },
        json={
            "requests": [
                {
                    "model": f"models/{settings.gemini_embedding_model}",
                    "content": {"parts": [{"text": text}]},
                    "taskType": task_type,
                }
                for text in texts
            ]
        },
        timeout=60.0,
    )
    response.raise_for_status()
    payload = response.json()
    vectors = [
        [float(value) for value in item.get("values", [])]
        for item in payload.get("embeddings", [])
        if item.get("values")
    ]
    if vectors:
        return vectors, settings.gemini_embedding_model
    return None


def _embed_with_openai(texts: list[str]) -> tuple[list[list[float]], str] | None:
    if not settings.openai_api_key:
        return None

    response = httpx.post(
        f"{settings.openai_base_url}/embeddings",
        headers={
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": settings.openai_embedding_model,
            "input": texts,
            "encoding_format": "float",
        },
        timeout=60.0,
    )
    response.raise_for_status()
    payload = response.json()
    vectors = [[float(value) for value in item["embedding"]] for item in payload["data"]]
    return vectors, settings.openai_embedding_model


def embed_texts(
    texts: list[str],
    task_type: EmbeddingTaskType = "RETRIEVAL_DOCUMENT",
) -> tuple[list[list[float]], str]:
    if not texts:
        return [], ""

    last_error: Exception | None = None
    for embedder in (
        lambda: _embed_with_gemini(texts, task_type),
        lambda: _embed_with_openai(texts),
    ):
        try:
            result = embedder()
        except Exception as exc:
            last_error = exc
            continue
        if result is None:
            continue
        vectors, model = result
        if len(vectors) != len(texts):
            last_error = RuntimeError("Embedding provider returned an unexpected vector count.")
            continue
        return vectors, model

    message = "Configure PREPMIND_GEMINI_API_KEY or PREPMIND_OPENAI_API_KEY to create real embeddings."
    if last_error is not None:
        message = f"{message} Last provider error: {last_error}"
    raise EmbeddingProviderUnavailable(message)


def serialize_vector(vector: list[float]) -> str:
    return json.dumps(vector)


def deserialize_vector(payload: str | None) -> list[float]:
    if not payload:
        return []
    return [float(value) for value in json.loads(payload)]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return sum(a * b for a, b in zip(left, right)) / (left_norm * right_norm)

