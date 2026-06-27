from pathlib import Path

import structlog
from docx import Document as DocxDocument

from config import settings

log = structlog.get_logger()


class CompanyKnowledgeLoader:
    def __init__(self):
        self.knowledge_dir = settings.company_knowledge_dir
        self._cache: dict[str, str] = {}
        self._load_all()

    def _load_all(self):
        if not self.knowledge_dir.exists():
            log.warning("company_knowledge_dir_not_found", path=str(self.knowledge_dir))
            return

        for f in self.knowledge_dir.iterdir():
            try:
                if f.suffix in (".md", ".txt"):
                    key = f.stem.lower().replace("_", " ").replace("-", " ")
                    self._cache[key] = f.read_text(encoding="utf-8")
                elif f.suffix == ".docx":
                    key = f.stem.lower().replace("_", " ").replace("-", " ")
                    self._cache[key] = self._read_docx(f)
            except Exception as e:
                log.warning("failed_to_load_company_kb", file=str(f), error=str(e))

        log.info("company_knowledge_loaded", articles=len(self._cache), files=list(self._cache.keys()))

    @staticmethod
    def _read_docx(path: Path) -> str:
        doc = DocxDocument(str(path))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())

    def get_for_case_type(self, case_type: str) -> str:
        parts = []
        normalized = (case_type or "").lower().replace("_", " ").replace("-", " ")

        # Include ALL company knowledge files — they all provide resolution context
        for key, content in self._cache.items():
            if key == "readme":
                continue
            parts.append(f"[{key.title()}]\n{content}")

        if not parts:
            return ""

        log.info("company_knowledge_matched", case_type=case_type, articles=len(parts))
        return "\n\n--- Company Standard Guidelines ---\n\n".join(parts)

    def _get_general(self) -> str:
        return self._cache.get("general", "")
