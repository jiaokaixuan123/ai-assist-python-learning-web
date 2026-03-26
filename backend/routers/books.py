import os
import shutil
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from bson import ObjectId
from datetime import datetime
from typing import List, Optional
from core.database import get_db
from core.auth import get_current_user, require_teacher

router = APIRouter(prefix="/api/books", tags=["books"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "books")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".epub", ".txt"}


def fmt(doc) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


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
        file_path = f"/api/books/file/{safe_name}"
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
        # 删除旧文件
        if existing.get("file_path"):
            old_name = existing["file_path"].split("/")[-1]
            old_path = os.path.join(UPLOAD_DIR, old_name)
            if os.path.exists(old_path):
                os.remove(old_path)
        safe_name = f"{ObjectId()}_{file.filename}"
        dest = os.path.join(UPLOAD_DIR, safe_name)
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
        update["file_path"] = f"/api/books/file/{safe_name}"
        update["file_name"] = file.filename
        update["indexed"] = False

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
    if existing.get("file_path"):
        old_name = existing["file_path"].split("/")[-1]
        old_path = os.path.join(UPLOAD_DIR, old_name)
        if os.path.exists(old_path):
            os.remove(old_path)
    await db.books.delete_one({"_id": oid})
    return {"ok": True}


@router.get("/file/{filename}")
async def serve_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(404, "文件不存在")
    return FileResponse(file_path)
