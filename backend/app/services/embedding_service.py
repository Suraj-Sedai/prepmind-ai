import hashlib
import json
import math
from collections import Counter

import httpx

from app.core.config import get_settings

settings = get_settings()
LOCAL_DIMENSIONS = 256


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


def embed_texts(texts: list[str]) -> tuple[list[list[float]], str]:
    if not texts:
        return [], "local-hash-v1"

    if settings.openai_api_key:
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
            pass

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
