from __future__ import annotations

import json
import math
from typing import Literal, Optional

import httpx

from app.core.config import get_settings


EmbeddingTaskType = Literal["RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"]
settings = get_settings()
GEMINI_MAX_BATCH_ITEMS = 8
GEMINI_MAX_BATCH_TEXT_BYTES = 7000
GEMINI_MAX_ITEM_TEXT_BYTES = 6000


class EmbeddingProviderUnavailable(RuntimeError):
    pass


def _response_error(response: httpx.Response) -> RuntimeError:
    try:
        detail = response.json()
    except ValueError:
        detail = response.text
    return RuntimeError(f"{response.status_code} {response.reason_phrase}: {detail}")


def _raise_for_status(response: httpx.Response) -> None:
    if response.is_error:
        raise _response_error(response)


def _trim_for_embedding(text: str, max_bytes: int = GEMINI_MAX_ITEM_TEXT_BYTES) -> str:
    encoded = text.encode("utf-8")
    if len(encoded) <= max_bytes:
        return text
    return encoded[:max_bytes].decode("utf-8", errors="ignore").rstrip()


def _gemini_batches(texts: list[str]) -> list[list[str]]:
    batches: list[list[str]] = []
    current: list[str] = []
    current_bytes = 0

    for text in texts:
        prepared = _trim_for_embedding(text)
        text_bytes = len(prepared.encode("utf-8"))
        would_exceed_size = current and current_bytes + text_bytes > GEMINI_MAX_BATCH_TEXT_BYTES
        would_exceed_count = len(current) >= GEMINI_MAX_BATCH_ITEMS
        if would_exceed_size or would_exceed_count:
            batches.append(current)
            current = []
            current_bytes = 0

        current.append(prepared)
        current_bytes += text_bytes

    if current:
        batches.append(current)
    return batches


def _embed_with_gemini(
    texts: list[str],
    task_type: EmbeddingTaskType,
) -> Optional[tuple[list[list[float]], str]]:
    if not settings.gemini_api_key:
        return None

    def embed_single(text: str) -> Optional[list[float]]:
        prepared = _trim_for_embedding(text)
        response = httpx.post(
            f"{settings.gemini_base_url}/models/{settings.gemini_embedding_model}:embedContent",
            headers={
                "x-goog-api-key": settings.gemini_api_key,
                "Content-Type": "application/json",
            },
            json={
                "model": f"models/{settings.gemini_embedding_model}",
                "content": {"parts": [{"text": prepared}]},
                "taskType": task_type,
            },
            timeout=60.0,
        )
        _raise_for_status(response)
        payload = response.json()
        values = payload.get("embedding", {}).get("values", [])
        if not values:
            return None
        return [float(value) for value in values]

    if len(texts) == 1:
        vector = embed_single(texts[0])
        if vector:
            return [vector], settings.gemini_embedding_model
        return None

    vectors: list[list[float]] = []
    for batch in _gemini_batches(texts):
        try:
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
                        for text in batch
                    ]
                },
                timeout=60.0,
            )
            _raise_for_status(response)
            payload = response.json()
            batch_vectors = [
                [float(value) for value in item.get("values", [])]
                for item in payload.get("embeddings", [])
                if item.get("values")
            ]
            if len(batch_vectors) != len(batch):
                raise RuntimeError("Gemini batch embedding returned an unexpected vector count.")
        except Exception:
            batch_vectors = []
            for text in batch:
                vector = embed_single(text)
                if vector is None:
                    raise RuntimeError("Gemini single embedding returned no vector.")
                batch_vectors.append(vector)
        vectors.extend(batch_vectors)

    if vectors:
        return vectors, settings.gemini_embedding_model
    return None


def _embed_with_openai(texts: list[str]) -> Optional[tuple[list[list[float]], str]]:
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
    _raise_for_status(response)
    payload = response.json()
    vectors = [[float(value) for value in item["embedding"]] for item in payload["data"]]
    return vectors, settings.openai_embedding_model


def embed_texts(
    texts: list[str],
    task_type: EmbeddingTaskType = "RETRIEVAL_DOCUMENT",
) -> tuple[list[list[float]], str]:
    if not texts:
        return [], ""

    last_error: Optional[Exception] = None
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


def deserialize_vector(payload: Optional[str]) -> list[float]:
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
