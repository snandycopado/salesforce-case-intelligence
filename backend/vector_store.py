import hashlib
import json
from pathlib import Path

import httpx
import structlog

from config import settings

log = structlog.get_logger()


class VectorStore:
    """Lightweight vector store using local JSON + cosine similarity.
    No heavy dependencies — works within 512MB memory."""

    def __init__(self):
        self.store_path = Path(settings.vector_store_dir) / "articles.json"
        self.store_path.parent.mkdir(parents=True, exist_ok=True)
        self._articles: dict[str, dict] = {}
        self._load()

    def _load(self):
        if self.store_path.exists():
            data = json.loads(self.store_path.read_text(encoding="utf-8"))
            self._articles = data
        log.info("vector_store_loaded", articles=len(self._articles))

    def _save(self):
        self.store_path.write_text(
            json.dumps(self._articles, ensure_ascii=False), encoding="utf-8"
        )

    def _get_embedding(self, text: str) -> list[float]:
        text = text[:8000]
        response = httpx.post(
            "https://api.voyageai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {settings.voyage_api_key}"},
            json={"input": [text], "model": "voyage-3-lite"},
            timeout=30,
        )
        if response.status_code == 200:
            return response.json()["data"][0]["embedding"]

        # Fallback: simple hash-based embedding for when API is unavailable
        log.warning("voyage_api_failed", status=response.status_code)
        return self._fallback_embedding(text)

    @staticmethod
    def _fallback_embedding(text: str) -> list[float]:
        """Simple TF-based embedding as fallback. Not great but functional."""
        words = text.lower().split()
        vec = [0.0] * 256
        for w in words:
            h = int(hashlib.md5(w.encode()).hexdigest(), 16)
            for i in range(256):
                vec[i] += ((h >> i) & 1) * 2 - 1
        norm = max(sum(v * v for v in vec) ** 0.5, 1e-10)
        return [v / norm for v in vec]

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def add_article(self, article_id: str, content: str, metadata: dict):
        embedding = self._get_embedding(content)
        self._articles[article_id] = {
            "content": content,
            "metadata": metadata,
            "embedding": embedding,
        }
        self._save()

    def search(self, query: str, top_k: int | None = None) -> list[dict]:
        k = top_k or settings.vector_search_top_k
        if not self._articles:
            return []

        query_embedding = self._get_embedding(query)

        scored = []
        for article_id, article in self._articles.items():
            similarity = self._cosine_similarity(query_embedding, article["embedding"])
            scored.append({
                "id": article_id,
                "content": article["content"],
                "metadata": article["metadata"],
                "similarity": similarity,
            })

        scored.sort(key=lambda x: x["similarity"], reverse=True)
        results = scored[:k]
        log.info("vector_search", query_preview=query[:80], results=len(results))
        return results

    def get_article_count(self) -> int:
        return len(self._articles)
