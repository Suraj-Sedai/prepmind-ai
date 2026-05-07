import tempfile
import unittest
from pathlib import Path

from app.rag.chunking import process_document
from app.rag.clean_text import clean_extracted_units
from app.rag.importance import detect_important_content
from app.rag.schemas import ExtractedTextUnit


class RagPipelineTests(unittest.TestCase):
    def test_repeated_headers_and_page_numbers_are_removed(self) -> None:
        units = [
            ExtractedTextUnit(1, None, "Page 1", "Biology 101\nPhotosynthesis converts light energy.\n1"),
            ExtractedTextUnit(2, None, "Page 2", "Biology 101\nChlorophyll absorbs light in plants.\n2"),
            ExtractedTextUnit(3, None, "Page 3", "Biology 101\nGlucose stores chemical energy.\n3"),
        ]

        cleaned = clean_extracted_units(units)

        self.assertNotIn("Biology 101", "\n".join(unit.cleaned_text for unit in cleaned))
        self.assertIn("Photosynthesis converts light energy.", cleaned[0].cleaned_text)

    def test_important_definition_is_not_marked_as_junk(self) -> None:
        result = detect_important_content("Photosynthesis is the process plants use to convert light energy into glucose.")

        self.assertIn(result.label, {"important_content", "supporting_content"})
        self.assertGreater(result.score, 0.35)
        self.assertEqual(result.content_type, "definition")

    def test_process_document_skips_toc_and_keeps_sources(self) -> None:
        text = """Table of Contents
Chapter One ........ 1
Chapter Two ........ 7
Chapter Three ...... 14
Chapter Four ....... 22

\f
Photosynthesis
Photosynthesis is the process plants use to convert light energy into chemical energy.
Chlorophyll absorbs light, and glucose stores the resulting chemical energy for the plant.
This concept explains how producers introduce energy into many ecosystems.
"""
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "biology.txt"
            path.write_text(text, encoding="utf-8")

            processed = process_document(path)

        self.assertGreaterEqual(processed.word_count, 25)
        self.assertGreaterEqual(processed.skipped_junk_count, 1)
        self.assertTrue(processed.chunks)
        self.assertEqual(processed.chunks[0].page_start, 2)


if __name__ == "__main__":
    unittest.main()

