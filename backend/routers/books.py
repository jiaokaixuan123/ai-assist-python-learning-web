import os
import shutil
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from bson import ObjectId
from datetime import datetime
from typing import Optional
from core.database import get_db
from core.auth import require_teacher

router = APIRouter(prefix="/api/books", tags=["books"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "books")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".epub", ".txt"}


def fmt(doc) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


# ── 文本提取 ──────────────────────────────────────────────────────────────────

def extract_text(path: str, ext: str) -> str:
    """从 PDF / EPUB / TXT 中提取纯文本"""
    if ext == ".pdf":
        try:
            import fitz  # pymupdf
            doc = fitz.open(path)
            pages_text = [page.get_text() for page in doc]
            full_text = "\n".join(pages_text)
            # 扫描版 PDF 检测：提取内容几乎全是空白
            meaningful = full_text.replace("\n", "").replace(" ", "").strip()
            if doc.page_count > 0 and len(meaningful) < 100:
                page_count = doc.page_count
                raise HTTPException(
                    400,
                    f"该 PDF 共 {page_count} 页，但仅提取到 {len(meaningful)} 个有效字符，"
                    "判断为扫描版（图片型）PDF。PyMuPDF 无法识别图片中的文字，无法建立文本索引。\n"
                    "解决方法：①上传可复制文字的 PDF；②将书籍转换为 TXT 格式上传。",
                )
            return full_text
        except HTTPException:
            raise
        except ImportError:
            raise HTTPException(500, "请先安装 pymupdf: pip install pymupdf")

    elif ext == ".epub":
        try:
            import ebooklib
            from ebooklib import epub
            from html.parser import HTMLParser

            class _StripHTML(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.parts: list[str] = []

                def handle_data(self, data: str):
                    self.parts.append(data)

            book = epub.read_epub(path)
            texts = []
            for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
                parser = _StripHTML()
                parser.feed(item.get_content().decode("utf-8", errors="ignore"))
                texts.append("".join(parser.parts))
            return "\n".join(texts)
        except ImportError:
            raise HTTPException(500, "请先安装 ebooklib: pip install ebooklib")

    elif ext == ".txt":
        with open(path, encoding="utf-8", errors="ignore") as f:
            return f.read()

    raise HTTPException(400, f"不支持的文件格式: {ext}")


def split_text(text: str, chunk_size: int = 400, overlap: int = 60) -> list[str]:
    """按字符分块（适合中文），保留上下文重叠"""
    text = text.strip()
    if not text:
        return []
    chunks = []
    step = chunk_size - overlap
    for i in range(0, len(text), step):
        chunk = text[i: i + chunk_size].strip()
        if len(chunk) > 50:  # 过滤过短的碎片
            chunks.append(chunk)
    return chunks


# ── 向量库工具 ────────────────────────────────────────────────────────────────

# 全局单例，避免每次建索引都重新加载模型（耗时 + 触发网络检查）
_embedding_model = None
_chroma_collection = None

MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
# HF 缓存内的子目录名（点号替换为双横线）
_HF_CACHE_SUBDIR = "models--sentence-transformers--paraphrase-multilingual-MiniLM-L12-v2"


def _find_local_model_path() -> str | None:
    """返回本地 HuggingFace 缓存中最新快照路径，找不到返回 None"""
    from pathlib import Path
    try:
        from huggingface_hub import constants
        cache_root = Path(constants.HF_HUB_CACHE)
    except Exception:
        cache_root = Path.home() / ".cache" / "huggingface" / "hub"

    snaps_dir = cache_root / _HF_CACHE_SUBDIR / "snapshots"
    if not snaps_dir.exists():
        return None
    # 取最新的快照目录（按 mtime 排序）
    snaps = sorted(snaps_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
    for snap in snaps:
        if (snap / "config.json").exists():
            return str(snap)
    return None


def _get_chroma_collection():
    global _chroma_collection
    if _chroma_collection is None:
        import chromadb
        client = chromadb.PersistentClient(path="./chroma_db")
        _chroma_collection = client.get_or_create_collection("course_knowledge")
    return _chroma_collection


def _get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        local_path = _find_local_model_path()
        if local_path:
            # 直接加载本地快照，完全不联网
            _embedding_model = SentenceTransformer(local_path)
        else:
            # 首次使用：联网下载
            _embedding_model = SentenceTransformer(MODEL_NAME)
    return _embedding_model


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("")
async def list_books():
    db = get_db()
    books = await db.books.find({}).to_list(200)
    for b in books:
        b["id"] = str(b.pop("_id"))
    return books


@router.get("/{book_id}")
async def get_book(book_id: str):
    db = get_db()
    try:
        doc = await db.books.find_one({"_id": ObjectId(book_id)})
    except Exception:
        raise HTTPException(400, "无效的书籍ID")
    if not doc:
        raise HTTPException(404, "书籍不存在")
    return fmt(doc)


@router.post("")
async def create_book(
    title: str = Form(...),
    author: str = Form(""),
    description: str = Form(""),
    difficulty: str = Form("beginner"),
    tags: str = Form(""),
    cover: str = Form(""),
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(require_teacher),
):
    db = get_db()

    file_path = None
    file_name = None
    if file and file.filename:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, f"不支持的文件格式，仅支持 {', '.join(ALLOWED_EXTENSIONS)}")
        safe_name = f"{ObjectId()}_{file.filename}"
        dest = os.path.join(UPLOAD_DIR, safe_name)
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
        file_path = f"/uploads/books/{safe_name}"
        file_name = file.filename

    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    doc = {
        "title": title,
        "author": author,
        "description": description,
        "difficulty": difficulty,
        "tags": tag_list,
        "cover": cover or None,
        "file_path": file_path,
        "file_name": file_name,
        "indexed": False,
        "chunk_count": 0,
        "created_at": datetime.utcnow(),
    }
    result = await db.books.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.put("/{book_id}")
async def update_book(
    book_id: str,
    title: str = Form(...),
    author: str = Form(""),
    description: str = Form(""),
    difficulty: str = Form("beginner"),
    tags: str = Form(""),
    cover: str = Form(""),
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(require_teacher),
):
    db = get_db()
    try:
        oid = ObjectId(book_id)
    except Exception:
        raise HTTPException(400, "无效的书籍ID")

    existing = await db.books.find_one({"_id": oid})
    if not existing:
        raise HTTPException(404, "书籍不存在")

    update: dict = {
        "title": title,
        "author": author,
        "description": description,
        "difficulty": difficulty,
        "tags": [t.strip() for t in tags.split(",") if t.strip()],
        "cover": cover or None,
    }

    if file and file.filename:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, f"不支持的文件格式，仅支持 {', '.join(ALLOWED_EXTENSIONS)}")
        if existing.get("file_path"):
            old_name = existing["file_path"].split("/")[-1]
            old_path = os.path.join(UPLOAD_DIR, old_name)
            if os.path.exists(old_path):
                os.remove(old_path)
        safe_name = f"{ObjectId()}_{file.filename}"
        dest = os.path.join(UPLOAD_DIR, safe_name)
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
        update["file_path"] = f"/uploads/books/{safe_name}"
        update["file_name"] = file.filename
        update["indexed"] = False
        update["chunk_count"] = 0

    await db.books.update_one({"_id": oid}, {"$set": update})
    updated = await db.books.find_one({"_id": oid})
    return fmt(updated)


@router.delete("/{book_id}")
async def delete_book(
    book_id: str,
    current_user: dict = Depends(require_teacher),
):
    db = get_db()
    try:
        oid = ObjectId(book_id)
    except Exception:
        raise HTTPException(400, "无效的书籍ID")
    existing = await db.books.find_one({"_id": oid})
    if not existing:
        raise HTTPException(404, "书籍不存在")

    # 删除磁盘文件
    if existing.get("file_path"):
        old_name = existing["file_path"].split("/")[-1]
        old_path = os.path.join(UPLOAD_DIR, old_name)
        if os.path.exists(old_path):
            os.remove(old_path)

    # 删除向量库中的索引
    try:
        collection = _get_chroma_collection()
        collection.delete(where={"book_id": book_id})
    except Exception:
        pass  # 未索引时忽略

    await db.books.delete_one({"_id": oid})
    return {"ok": True}


# ── RAG 索引 ──────────────────────────────────────────────────────────────────

@router.post("/{book_id}/index")
async def index_book(
    book_id: str,
    current_user: dict = Depends(require_teacher),
):
    """提取书籍文本 → 分块 → 向量化 → 写入 ChromaDB"""
    db = get_db()
    try:
        oid = ObjectId(book_id)
    except Exception:
        raise HTTPException(400, "无效的书籍ID")

    doc = await db.books.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "书籍不存在")
    if not doc.get("file_path"):
        raise HTTPException(400, "该书籍尚未上传文件，无法建立索引")

    # 定位文件
    file_name = doc["file_path"].split("/")[-1]
    abs_path = os.path.join(UPLOAD_DIR, file_name)
    if not os.path.exists(abs_path):
        raise HTTPException(404, "文件不存在，请重新上传")

    ext = os.path.splitext(file_name)[1].lower()

    # 1. 提取文本（扫描版 PDF 检测在 extract_text 内完成）
    text = extract_text(abs_path, ext)
    if not text.strip():
        raise HTTPException(400, "无法从文件中提取文本，请检查文件内容")

    # 2. 分块
    chunks = split_text(text)
    if not chunks:
        raise HTTPException(400, "文本分块结果为空，请检查文件内容")

    # 3. 向量化并写入 ChromaDB（分批处理，避免内存溢出）
    model = _get_embedding_model()
    collection = _get_chroma_collection()

    # 删除该书籍的旧向量（支持重新索引）
    try:
        collection.delete(where={"book_id": book_id})
    except Exception:
        pass

    batch_size = 64
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i: i + batch_size]
        ids = [f"{book_id}_{i + j}" for j in range(len(batch))]
        embeddings = model.encode(batch, show_progress_bar=False).tolist()
        metadatas = [
            {
                "book_id": book_id,
                "book_title": doc["title"],
                "author": doc.get("author", ""),
                "difficulty": doc.get("difficulty", ""),
                "chunk_index": i + j,
                "source_type": "book",  # 区分书籍 vs 课程
            }
            for j in range(len(batch))
        ]
        collection.add(
            ids=ids,
            documents=batch,
            embeddings=embeddings,
            metadatas=metadatas,
        )

    # 4. 更新数据库标记
    await db.books.update_one(
        {"_id": oid},
        {"$set": {"indexed": True, "chunk_count": len(chunks)}},
    )

    return {
        "ok": True,
        "book": doc["title"],
        "chunks": len(chunks),
        "message": f"✅ 已成功建立索引，共 {len(chunks)} 个文本块",
    }


@router.delete("/{book_id}/index")
async def remove_book_index(
    book_id: str,
    current_user: dict = Depends(require_teacher),
):
    """清除书籍向量索引（不删除原始文件）"""
    db = get_db()
    try:
        oid = ObjectId(book_id)
    except Exception:
        raise HTTPException(400, "无效的书籍ID")

    try:
        collection = _get_chroma_collection()
        collection.delete(where={"book_id": book_id})
    except Exception:
        pass

    await db.books.update_one(
        {"_id": oid},
        {"$set": {"indexed": False, "chunk_count": 0}},
    )
    return {"ok": True, "message": "索引已清除"}
