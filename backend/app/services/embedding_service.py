import hashlib
import json
import math
from collections import Counter
from typing import Literal

import httpx

from app.core.config import get_settings

settings = get_settings()
LOCAL_DIMENSIONS = 256
EmbeddingTaskType = Literal["RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"]


def _tokenize(text: str) -> list[str]:
    return [token for token in text.lower().split() if token]


def _normalize(values: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in values))
    if norm == 0:
        return values
    return [value / norm for value in values]


def _local_embedding(text: str) -> list[float]:
    vector = [0.0] * LOCAL_DIMENSIONS
    counts = Counter(_tokenize(text))
    for token, weight in counts.items():
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:2], "big") % LOCAL_DIMENSIONS
        sign = -1.0 if digest[2] % 2 else 1.0
        vector[index] += sign * float(weight)
    return _normalize(vector)


def _embed_with_gemini(
    texts: list[str],
    task_type: EmbeddingTaskType,
) -> tuple[list[list[float]], str] | None:
    if not settings.gemini_api_key:
        return None

    try:
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
            embedding = payload.get("embedding", {}).get("values", [])
            if embedding:
                return [[float(value) for value in embedding]], settings.gemini_embedding_model
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
        embeddings = []
        for item in payload.get("embeddings", []):
            values = item.get("values", [])
            embeddings.append([float(value) for value in values])
        if embeddings:
            return embeddings, settings.gemini_embedding_model
    except Exception:
        return None

    return None


def _embed_with_openai(texts: list[str]) -> tuple[list[list[float]], str] | None:
    if not settings.openai_api_key:
        return None

    try:
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
        vectors = [item["embedding"] for item in payload["data"]]
        return vectors, settings.openai_embedding_model
    except Exception:
        return None


def embed_texts(
    texts: list[str],
    task_type: EmbeddingTaskType = "RETRIEVAL_DOCUMENT",
) -> tuple[list[list[float]], str]:
    if not texts:
        return [], "local-hash-v1"

    gemini_result = _embed_with_gemini(texts, task_type)
    if gemini_result is not None:
        return gemini_result

    openai_result = _embed_with_openai(texts)
    if openai_result is not None:
        return openai_result

    return [_local_embedding(text) for text in texts], "local-hash-v1"


def serialize_vector(vector: list[float]) -> str:
    return json.dumps(vector)


def deserialize_vector(payload: str | None) -> list[float]:
    if not payload:
        return []
    return [float(value) for value in json.loads(payload)]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    return sum(a * b for a, b in zip(left, right))
