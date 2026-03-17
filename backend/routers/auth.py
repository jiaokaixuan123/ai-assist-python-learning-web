from fastapi import APIRouter, HTTPException, status
from datetime import datetime
from bson import ObjectId
from core.database import get_db
from core.auth import hash_password, verify_password, create_access_token
from models.user import UserRegister, UserLogin

router = APIRouter(prefix="/api/auth", tags=["auth"])


# 注册路由
@router.post("/register")
async def register(body: UserRegister):
    db = get_db()
    if await db.users.find_one({"username": body.username}):
        raise HTTPException(status_code=400, detail="用户名已存在")
    user = {
        "username": body.username,
        "password": hash_password(body.password),
        "email": body.email,
        "role": body.role,
        "avatar": None,
        "created_at": datetime.utcnow(),
    }
    # 将新用户插入数据库表
    result = await db.users.insert_one(user)
    # 生成 JWT token
    token = create_access_token({"sub": str(result.inserted_id)})
    return {"access_token": token, "token_type": "bearer", "username": body.username}


# 登陆路由
@router.post("/login")
async def login(body: UserLogin):
    db = get_db()
    user = await db.users.find_one({"username": body.username})
    if not user or not verify_password(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_access_token({"sub": str(user["_id"])})
    return {"access_token": token, "token_type": "bearer", "username": user["username"]}


@router.get("/me")
async def me(current_user: dict = __import__('fastapi').Depends(__import__('core.auth', fromlist=['get_current_user']).get_current_user)):
    return {
        "id": str(current_user["_id"]),
        "username": current_user["username"],
        "email": current_user.get("email"),
        "avatar": current_user.get("avatar"),
        "role": current_user.get("role", "student"),
        "created_at": current_user["created_at"],
    }
