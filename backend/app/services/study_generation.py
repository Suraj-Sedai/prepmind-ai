from __future__ import annotations

import json
import re
from typing import Any, Optional, Union

from app.models.document import DocumentChunk
from app.rag.llm import generate_model_text


DIFFICULTIES = {"easy", "medium", "hard"}
CARD_TYPES = {"concept", "cloze", "definition", "application"}
QUESTION_TYPES = {"multiple_choice", "true_false", "fill_blank", "short_answer"}


def _compact(text: str, max_chars: int = 420) -> str:
    value = " ".join(str(text).split())
    if len(value) <= max_chars:
        return value
    return value[: max_chars - 3].rstrip() + "..."


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def repair_or_extract_json(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned).strip()

    for start_char, end_char in (("{", "}"), ("[", "]")):
        start = cleaned.find(start_char)
        end = cleaned.rfind(end_char)
        if start >= 0 and end > start:
            return cleaned[start : end + 1]
    return cleaned


def parse_json_object_or_array(text: str) -> Union[dict[str, Any], list[Any]]:
    payload = json.loads(repair_or_extract_json(text))
    if not isinstance(payload, (dict, list)):
        raise ValueError("AI response must be a JSON object or array.")
    return payload


def _context_blocks(chunks: list[DocumentChunk], max_chunks: int = 8, max_words: int = 130) -> str:
    blocks: list[str] = []
    for index, chunk in enumerate(chunks[:max_chunks], start=1):
        words = chunk.chunk_text.split()
        excerpt = " ".join(words[:max_words])
        if len(words) > max_words:
            excerpt += "..."
        location = f"Page {chunk.page_start}" if chunk.page_start else "Location unknown"
        blocks.append(
            "\n".join(
                [
                    f"[{index}] Source: {chunk.document.document_name}",
                    f"Topic: {chunk.topic_label}",
                    f"Location: {location}",
                    f"Excerpt: {excerpt}",
                ]
            )
        )
    return "\n\n".join(blocks)


def _source_chunk_for_topic(chunks: list[DocumentChunk], topic_name: str) -> Optional[DocumentChunk]:
    normalized_topic = _normalize(topic_name)
    for chunk in chunks:
        if _normalize(chunk.topic_label) == normalized_topic:
            return chunk
    for chunk in chunks:
        if normalized_topic and normalized_topic in _normalize(chunk.topic_label):
            return chunk
    return chunks[0] if chunks else None


def _source_payload(chunk: Optional[DocumentChunk]) -> dict[str, Any]:
    if chunk is None:
        return {
            "source_document_name": None,
            "source_page_start": None,
            "source_snippet": None,
        }
    return {
        "source_document_name": chunk.document.document_name,
        "source_page_start": chunk.page_start,
        "source_snippet": _compact(chunk.chunk_text, 320),
    }


def _items_from_payload(payload: Union[dict[str, Any], list[Any]], key: str) -> list[Any]:
    if isinstance(payload, list):
        return payload
    items = payload.get(key, [])
    return items if isinstance(items, list) else []


def validate_flashcard_payload(
    payload: Union[dict[str, Any], list[Any]],
    requested_difficulty: str = "medium",
    chunks: Optional[list[DocumentChunk]] = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    valid_items: list[dict[str, Any]] = []
    seen: set[str] = set()
    source_chunks = chunks or []

    for item in _items_from_payload(payload, "flashcards"):
        if not isinstance(item, dict):
            continue
        question = str(item.get("question") or "").strip()
        answer = str(item.get("answer") or "").strip()
        topic_name = str(item.get("topic_name") or "").strip()
        if not question or not answer or not topic_name:
            continue

        difficulty = str(item.get("difficulty") or requested_difficulty or "medium").strip().lower()
        if difficulty not in DIFFICULTIES:
            difficulty = requested_difficulty if requested_difficulty in DIFFICULTIES else "medium"
        card_type = str(item.get("card_type") or "concept").strip().lower()
        if card_type not in CARD_TYPES:
            card_type = "concept"

        key = f"{_normalize(question)}::{_normalize(answer)}"
        if key in seen:
            continue
        seen.add(key)

        source = _source_payload(_source_chunk_for_topic(source_chunks, topic_name))
        valid_items.append(
            {
                "question": question[:500],
                "answer": answer[:1200],
                "topic_name": topic_name[:120],
                "difficulty": difficulty,
                "card_type": card_type,
                "source_hint": str(item.get("source_hint") or "").strip()[:240],
                **source,
            }
        )
        if len(valid_items) >= limit:
            break

    return valid_items


def validate_quiz_payload(
    payload: Union[dict[str, Any], list[Any]],
    requested_difficulty: str = "medium",
    chunks: Optional[list[DocumentChunk]] = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    valid_items: list[dict[str, Any]] = []
    seen: set[str] = set()
    source_chunks = chunks or []

    for item in _items_from_payload(payload, "questions"):
        if not isinstance(item, dict):
            continue
        prompt = str(item.get("prompt") or "").strip()
        question_type = str(item.get("question_type") or "").strip().lower()
        topic_name = str(item.get("topic_name") or "").strip()
        if not prompt or question_type not in QUESTION_TYPES or not topic_name:
            continue

        difficulty = str(item.get("difficulty") or requested_difficulty or "medium").strip().lower()
        if difficulty not in DIFFICULTIES:
            difficulty = requested_difficulty if requested_difficulty in DIFFICULTIES else "medium"

        options: list[dict[str, str]] = []
        correct_answer = str(item.get("correct_answer") or "").strip()
        if question_type == "multiple_choice":
            raw_options = item.get("options") if isinstance(item.get("options"), list) else []
            for option in raw_options:
                if not isinstance(option, dict):
                    continue
                option_id = str(option.get("id") or "").strip()
                label = str(option.get("label") or "").strip()
                if option_id and label:
                    options.append({"id": option_id[:12], "label": label[:300]})
            option_ids = {option["id"] for option in options}
            if len(options) < 2 or correct_answer not in option_ids:
                continue
        elif question_type == "true_false":
            normalized_answer = correct_answer.lower()
            if normalized_answer not in {"true", "false"}:
                continue
            correct_answer = normalized_answer
            options = [{"id": "true", "label": "True"}, {"id": "false", "label": "False"}]
        elif not correct_answer:
            continue

        key = _normalize(prompt)
        if key in seen:
            continue
        seen.add(key)

        explanation = str(item.get("explanation") or "").strip()
        if not explanation:
            explanation = "Review the source snippet for this concept."
        source = _source_payload(_source_chunk_for_topic(source_chunks, topic_name))
        valid_items.append(
            {
                "prompt": prompt[:800],
                "question_type": question_type,
                "topic_name": topic_name[:120],
                "difficulty": difficulty,
                "options": options,
                "correct_answer": correct_answer[:500],
                "explanation": explanation[:1200],
                "source_hint": str(item.get("source_hint") or "").strip()[:240],
                **source,
            }
        )
        if len(valid_items) >= limit:
            break

    return valid_items


def _flashcard_prompt(chunks: list[DocumentChunk], count: int, difficulty: str, topic: Optional[str]) -> str:
    return f"""You are generating high-quality study flashcards for PrepMind AI.

Use only the provided study context. Do not invent facts, source names, page numbers, or topics that are absent from the context.
Return strict JSON only. Do not use markdown fences. Do not add commentary.

Generate {count} flashcards. Preferred difficulty: {difficulty}. Focus topic: {topic or "best exam-useful concepts across the context"}.

Quality rules:
- Prefer concepts that are useful for exams.
- Mix concept, cloze, definition, and application cards when possible.
- Questions must be clear and student-facing.
- Answers must be concise but complete.
- Avoid duplicate or trivial cards.

JSON shape:
{{
  "flashcards": [
    {{
      "question": "Clear student-facing question",
      "answer": "Accurate answer based only on the provided context",
      "topic_name": "Topic label",
      "difficulty": "easy | medium | hard",
      "card_type": "concept | cloze | definition | application",
      "source_hint": "Short source clue from the context"
    }}
  ]
}}

Study context:
{_context_blocks(chunks)}
"""


def _quiz_prompt(chunks: list[DocumentChunk], question_count: int, difficulty: str, topic: Optional[str]) -> str:
    return f"""You are generating a high-quality study quiz for PrepMind AI.

Use only the provided study context. Do not invent facts, source names, page numbers, or topics that are absent from the context.
Return strict JSON only. Do not use markdown fences. Do not add commentary.

Generate {question_count} questions. Preferred difficulty: {difficulty}. Focus topic: {topic or "best exam-useful concepts across the context"}.

Quality rules:
- Include a useful mix of multiple_choice, true_false, fill_blank, and short_answer when possible.
- Avoid trivial questions.
- Multiple-choice distractors must be plausible but clearly wrong.
- Every item must include a grounded explanation.
- For multiple-choice, correct_answer must be one of the option ids.
- For true_false, correct_answer must be "true" or "false".

JSON shape:
{{
  "questions": [
    {{
      "prompt": "Question text",
      "question_type": "multiple_choice | true_false | fill_blank | short_answer",
      "topic_name": "Topic label",
      "difficulty": "easy | medium | hard",
      "options": [
        {{ "id": "A", "label": "Option A" }},
        {{ "id": "B", "label": "Option B" }},
        {{ "id": "C", "label": "Option C" }},
        {{ "id": "D", "label": "Option D" }}
      ],
      "correct_answer": "A",
      "explanation": "Why the correct answer is correct, grounded in context",
      "source_hint": "Short source clue from the context"
    }}
  ]
}}

Study context:
{_context_blocks(chunks)}
"""


def generate_flashcards_with_ai(
    chunks: list[DocumentChunk],
    count: int,
    difficulty: str,
    topic: Optional[str],
) -> list[dict[str, Any]]:
    if not chunks:
        return []
    text = generate_model_text(_flashcard_prompt(chunks, count, difficulty, topic))
    if not text:
        return []
    try:
        payload = parse_json_object_or_array(text)
    except (json.JSONDecodeError, ValueError):
        return []
    return validate_flashcard_payload(payload, difficulty, chunks, count)


def generate_quiz_with_ai(
    chunks: list[DocumentChunk],
    question_count: int,
    difficulty: str,
    topic: Optional[str],
) -> list[dict[str, Any]]:
    if not chunks:
        return []
    text = generate_model_text(_quiz_prompt(chunks, question_count, difficulty, topic))
    if not text:
        return []
    try:
        payload = parse_json_object_or_array(text)
    except (json.JSONDecodeError, ValueError):
        return []
    return validate_quiz_payload(payload, difficulty, chunks, question_count)
