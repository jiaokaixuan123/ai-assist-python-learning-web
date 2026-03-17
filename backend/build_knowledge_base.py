"""
知识库向量化方案

1. 安装依赖：
pip install sentence-transformers chromadb

2. 向量化课程内容并存储到向量数据库
"""
from sentence_transformers import SentenceTransformer
import chromadb
from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URL = "mongodb://localhost:27017"
DB_NAME = "python_edu"


async def build_knowledge_base():
    """将课程内容向量化存入 ChromaDB"""
    # 初始化向量模型
    model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

    # 初始化向量数据库
    chroma_client = chromadb.PersistentClient(path="./chroma_db")
    collection = chroma_client.get_or_create_collection("course_knowledge")

    # 从 MongoDB 读取课程
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    courses = await db.courses.find({}).to_list(None)

    documents = []
    metadatas = []
    ids = []

    for course in courses:
        for lesson in course.get("lessons", []):
            doc_id = f"{course['_id']}_{lesson['id']}"
            documents.append(lesson["content"])
            metadatas.append({
                "course_id": str(course["_id"]),
                "course_title": course["title"],
                "lesson_id": lesson["id"],
                "lesson_title": lesson["title"]
            })
            ids.append(doc_id)

    # 向量化并存储
    embeddings = model.encode(documents).tolist()
    collection.add(
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )

    print(f"✓ 已向量化 {len(documents)} 个章节")
    client.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(build_knowledge_base())
