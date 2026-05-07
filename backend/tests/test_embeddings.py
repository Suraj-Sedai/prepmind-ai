import unittest
from unittest.mock import patch

import httpx

from app.rag import embeddings


def _response(status_code: int, payload: dict) -> httpx.Response:
    return httpx.Response(
        status_code,
        json=payload,
        request=httpx.Request("POST", "https://example.test"),
    )


class EmbeddingTests(unittest.TestCase):
    def test_gemini_batch_failure_falls_back_to_single_embeddings(self) -> None:
        responses = [
            _response(400, {"error": {"message": "bad batch"}}),
            _response(200, {"embedding": {"values": [1, 0]}}),
            _response(200, {"embedding": {"values": [0, 1]}}),
        ]

        with patch.object(embeddings.settings, "gemini_api_key", "test-key"):
            with patch("app.rag.embeddings.httpx.post", side_effect=responses) as post:
                vectors, model = embeddings._embed_with_gemini(
                    ["first chunk", "second chunk"],
                    "RETRIEVAL_DOCUMENT",
                )

        self.assertEqual(model, embeddings.settings.gemini_embedding_model)
        self.assertEqual(vectors, [[1.0, 0.0], [0.0, 1.0]])
        self.assertIn("batchEmbedContents", post.call_args_list[0].args[0])
        self.assertIn("embedContent", post.call_args_list[1].args[0])
        self.assertIn("embedContent", post.call_args_list[2].args[0])

    def test_provider_error_includes_response_body(self) -> None:
        error = embeddings._response_error(
            _response(400, {"error": {"status": "INVALID_ARGUMENT", "message": "bad request"}})
        )

        self.assertIn("INVALID_ARGUMENT", str(error))
        self.assertIn("bad request", str(error))


if __name__ == "__main__":
    unittest.main()

