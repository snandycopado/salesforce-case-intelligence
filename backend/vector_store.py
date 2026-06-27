import chromadb
from sentence_transformers import SentenceTransformer
import structlog

from config import settings

log = structlog.get_logger()


class VectorStore:
    def __init__(self):
        self.client = chromadb.PersistentClient(path=str(settings.vector_store_dir))
        self.collection = self.client.get_or_create_collection(
            name="knowledge_articles",
            metadata={"hnsw:space": "cosine"},
        )
        self.embedder = SentenceTransformer(settings.embedding_model)

    def add_article(self, article_id: str, content: str, metadata: dict):
        embedding = self.embedder.encode(content).tolist()
        self.collection.upsert(
            ids=[article_id],
            embeddings=[embedding],
            documents=[content],
            metadatas=[metadata],
        )

    def search(self, query: str, top_k: int | None = None) -> list[dict]:
        k = top_k or settings.vector_search_top_k
        embedding = self.embedder.encode(query).tolist()
        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=k,
            include=["documents", "metadatas", "distances"],
        )

        articles = []
        for i in range(len(results["ids"][0])):
            articles.append({
                "id": results["ids"][0][i],
                "content": results["documents"][0][i],
                "metadata": results["metadatas"][0][i],
                "similarity": 1 - results["distances"][0][i],
            })

        log.info("vector_search", query_preview=query[:80], results=len(articles))
        return articles

    def get_article_count(self) -> int:
        return self.collection.count()
