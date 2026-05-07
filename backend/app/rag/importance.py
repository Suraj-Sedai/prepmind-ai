import re
from collections import Counter

from app.rag.clean_text import is_junk_text
from app.rag.schemas import ContentImportance


STOPWORDS = {
    "about",
    "after",
    "again",
    "against",
    "because",
    "before",
    "between",
    "could",
    "their",
    "there",
    "these",
    "those",
    "through",
    "under",
    "which",
    "while",
    "with",
    "would",
    "study",
    "student",
    "system",
    "using",
    "from",
    "into",
    "that",
    "this",
    "have",
    "your",
    "will",
    "been",
    "also",
    "than",
    "them",
    "they",
    "over",
    "only",
}

IMPORTANT_PATTERNS = [
    (re.compile(r"\b(is|are|means|refers to|defined as|definition)\b", re.IGNORECASE), "definition"),
    (re.compile(r"\b(example|for instance|such as)\b", re.IGNORECASE), "example"),
    (re.compile(r"\b(cause|causes|effect|symptom|treatment|diagnosis|risk)\b", re.IGNORECASE), "clinical_or_causal"),
    (re.compile(r"\b(compare|contrast|difference|similarity|versus|vs\.)\b", re.IGNORECASE), "comparison"),
    (re.compile(r"\b(formula|equation|calculate|=|->|<=|>=)\b", re.IGNORECASE), "formula"),
    (re.compile(r"\b(learning objective|objective|key concept|exam|review question)\b", re.IGNORECASE), "study_guide"),
]


def _tokens(text: str) -> list[str]:
    return [token for token in re.findall(r"[A-Za-z][A-Za-z\-]{3,}", text.lower()) if token not in STOPWORDS]


def _topic_from_text(text: str, fallback: str = "General") -> str:
    lines = [line.strip(":- ") for line in text.splitlines() if line.strip()]
    for line in lines[:5]:
        words = line.split()
        if 2 <= len(words) <= 12 and len(line) <= 100 and not line.endswith("."):
            return line[:120]

    keyword_match = re.search(r"Keywords?:\s*([^.\n]+)", text, flags=re.IGNORECASE)
    if keyword_match:
        first_keyword = keyword_match.group(1).split(",")[0].strip()
        if first_keyword:
            return first_keyword.title()[:120]

    counts = Counter(_tokens(text))
    if counts:
        return counts.most_common(1)[0][0].title()[:120]
    return fallback


def detect_important_content(text: str, section_heading: str | None = None) -> ContentImportance:
    if is_junk_text(text):
        return ContentImportance("junk_content", 0.0, section_heading or "General", "junk", "empty or boilerplate text")

    words = text.split()
    alpha_tokens = _tokens(text)
    pattern_hits = [content_type for pattern, content_type in IMPORTANT_PATTERNS if pattern.search(text)]
    bullet_count = len(re.findall(r"(?m)^\s*[-*]\s+\S+", text))
    question_count = text.count("?")
    sentence_count = len(re.findall(r"[.!?](?:\s|$)", text))

    score = 0.25
    if len(words) >= 45:
        score += 0.18
    if len(words) >= 120:
        score += 0.1
    if pattern_hits:
        score += min(0.32, 0.16 * len(pattern_hits))
    if bullet_count >= 2:
        score += 0.12
    if question_count:
        score += 0.08
    if sentence_count >= 2:
        score += 0.08
    if len(alpha_tokens) < 8 and not pattern_hits:
        score -= 0.22
    if len(words) < 8 and not pattern_hits and question_count == 0:
        score -= 0.35

    score = max(0.0, min(1.0, score))
    topic = (section_heading or _topic_from_text(text)).strip()[:120] or "General"
    content_type = pattern_hits[0] if pattern_hits else ("review_question" if question_count else "supporting_content")

    if score >= 0.68:
        label = "important_content"
    elif score >= 0.38:
        label = "supporting_content"
    elif score >= 0.2:
        label = "low_value_content"
    else:
        label = "junk_content"

    reason = "matched study-content heuristics" if pattern_hits else "scored by length, structure, and token quality"
    return ContentImportance(label, score, topic, content_type, reason)


def extract_topics_from_chunks(chunks: list[tuple[str, str]], limit: int = 5) -> list[str]:
    topics: list[str] = []
    for text, section_heading in chunks:
        topic = _topic_from_text(text, section_heading or "General")
        if topic and topic not in topics:
            topics.append(topic)
        if len(topics) >= limit:
            return topics
    return topics or ["General"]

