from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])

# 惰性初始化（避免启动时崩溃）
_model = None
_collection = None


def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
    return _model


def get_collection():
    global _collection
    if _collection is None:
        import chromadb
        chroma_client = chromadb.PersistentClient(path="./chroma_db")
        try:
            _collection = chroma_client.get_collection("course_knowledge")
        except Exception:
            raise HTTPException(500, "知识库未初始化，请先运行 build_knowledge_base.py")
    return _collection


class SearchRequest(BaseModel):
    query: str
    top_k: int = 3


class AskRequest(BaseModel):
    question: str
    api_key: str


@router.post("/search")
async def search_knowledge(req: SearchRequest):
    """检索相关知识"""
    model = get_model()
    collection = get_collection()

    query_embedding = model.encode([req.query])[0].tolist()

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=req.top_k
    )

    return {
        "query": req.query,
        "results": [
            {
                "content": doc,
                "metadata": meta,
                "distance": dist
            }
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0]
            )
        ]
    }


@router.post("/ask")
async def ask_with_context(req: AskRequest):
    """基于知识库回答问题"""
    model = get_model()
    collection = get_collection()

    # 1. 检索相关内容
    query_embedding = model.encode([req.question])[0].tolist()
    results = collection.query(query_embeddings=[query_embedding], n_results=3)

    context = "\n\n".join(results["documents"][0])

    # 2. 构建 prompt
    prompt = f"""基于以下课程内容回答问题：

{context}

问题：{req.question}

请用简洁易懂的语言回答，并给出代码示例。"""

    # 3. 调用大模型（示例使用 OpenAI API）
    try:
        from openai import OpenAI
        client = OpenAI(api_key=req.api_key)

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}]
        )

        answer = response.choices[0].message.content
    except ImportError:
        raise HTTPException(500, "OpenAI 库未安装，请运行: pip install openai")
    except Exception as e:
        raise HTTPException(500, f"调用 OpenAI API 失败: {str(e)}")

    return {
        "answer": answer,
        "sources": [m["lesson_title"] for m in results["metadatas"][0]]
    }
