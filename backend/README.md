# Python 教学平台 - 后端扩展指南

## 系统架构

```
backend/
├── routers/
│   ├── auth.py          # 用户认证
│   ├── courses.py       # 课程管理
│   ├── exercises.py     # 练习题管理
│   ├── progress.py      # 学习进度
│   ├── admin.py         # 管理 API（新增）
│   ├── judge.py         # 服务端判题（新增）
│   └── knowledge.py     # 知识库 RAG（新增）
├── models/
│   ├── course.py        # 课程数据模型
│   ├── exercise.py      # 练习题数据模型
│   └── user.py          # 用户数据模型
├── core/
│   ├── database.py      # MongoDB 连接
│   └── auth.py          # JWT 认证
├── seed.py              # 种子数据脚本
├── build_knowledge_base.py  # 构建向量知识库（新增）
└── docs/
    └── 如何添加课程和练习.md
```

## 新增功能

### 1. 管理 API (`/api/admin`)

用于动态添加课程和练习题，无需修改代码。

**端点：**
- `POST /api/admin/courses` - 创建课程
- `POST /api/admin/courses/{id}/lessons` - 添加章节
- `POST /api/admin/exercises` - 创建练习题

**使用示例：**
```bash
# 创建课程
curl -X POST http://localhost:8000/api/admin/courses \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Python 高级特性",
    "description": "装饰器、生成器、上下文管理器",
    "difficulty": "advanced",
    "tags": ["高级", "装饰器"]
  }'
```

### 2. 服务端判题 (`/api/judge`)

解决前端可伪造通过状态的问题，使用沙箱执行用户代码。

**端点：**
- `POST /api/judge/submit` - 提交代码判题

**安全特性：**
- 受限的 `__builtins__`（只允许安全函数）
- 无文件系统访问
- 无网络访问
- 捕获所有异常

**使用示例：**
```bash
curl -X POST http://localhost:8000/api/judge/submit \
  -H "Content-Type: application/json" \
  -d '{
    "exercise_id": "507f1f77bcf86cd799439011",
    "code": "def add(a, b):\n    return a + b\n\nprint(add(3, 5))"
  }'
```

**响应：**
```json
{
  "passed": true,
  "passed_count": 3,
  "total": 3,
  "results": [
    {
      "input": "3 5",
      "expected": "8",
      "actual": "8",
      "passed": true
    }
  ]
}
```

### 3. 知识库 RAG (`/api/knowledge`)

将课程内容向量化，支持语义检索和 AI 问答。

**端点：**
- `POST /api/knowledge/search` - 检索相关知识
- `POST /api/knowledge/ask` - 基于知识库问答

**工作流程：**

1. **构建知识库：**
```bash
cd backend
pip install sentence-transformers chromadb openai
python build_knowledge_base.py
```

2. **检索知识：**
```bash
curl -X POST http://localhost:8000/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "如何使用列表推导式",
    "top_k": 3
  }'
```

3. **AI 问答：**
```bash
curl -X POST http://localhost:8000/api/knowledge/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Python 中如何反转字符串？",
    "model_api_key": "sk-..."
  }'
```

## 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt

# 如果需要知识库功能（可选）
pip install sentence-transformers chromadb openai
```

### 2. 启动 MongoDB

```bash
# Docker 方式
docker run -d -p 27017:27017 --name mongodb mongo:latest

# 或使用本地安装的 MongoDB
mongod --dbpath /path/to/data
```

### 3. 初始化数据

```bash
python seed.py
```

### 4. 启动服务

```bash
uvicorn main:app --reload --port 8000
```

### 5. 访问 API 文档

打开浏览器访问：http://localhost:8000/docs

## 添加课程和练习

详见 [如何添加课程和练习.md](./docs/如何添加课程和练习.md)

### 方式一：修改 seed.py（批量初始化）

编辑 `seed.py` 中的 `COURSES` 和 `EXERCISES` 列表，然后运行：

```bash
python seed.py
```

### 方式二：使用管理 API（动态添加）

通过 HTTP 请求动态添加，适合后台管理界面。

### 方式三：直接操作 MongoDB（高级）

使用 MongoDB 客户端或脚本直接操作数据库。

## 知识库集成

### 架构

```
用户提问 → 向量化 → 检索相关课程内容 → 构建 Prompt → 调用 LLM → 返回答案
```

### 向量模型

默认使用 `paraphrase-multilingual-MiniLM-L12-v2`（支持中文）。

可替换为其他模型：
- `text-embedding-ada-002`（OpenAI，需 API key）
- `m3e-base`（中文优化）

### 更新知识库

每次添加新课程后，重新运行：

```bash
python build_knowledge_base.py
```

## API 端点总览

### 认证
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录

### 课程
- `GET /api/courses` - 课程列表
- `GET /api/courses/{id}` - 课程详情
- `GET /api/courses/{id}/lessons/{lesson_id}` - 章节详情

### 练习
- `GET /api/exercises` - 练习列表
- `GET /api/exercises/{id}` - 练习详情
- `POST /api/exercises/submissions` - 提交答案（前端判题）

### 管理（需认证）
- `POST /api/admin/courses` - 创建课程
- `POST /api/admin/courses/{id}/lessons` - 添加章节
- `POST /api/admin/exercises` - 创建练习题

### 判题
- `POST /api/judge/submit` - 服务端判题

### 知识库
- `POST /api/knowledge/search` - 检索知识
- `POST /api/knowledge/ask` - AI 问答

### 进度
- `GET /api/progress` - 获取学习进度
- `POST /api/progress/lessons` - 标记章节完成

## 数据模型

### 课程（Course）

```python
{
    "_id": ObjectId,
    "title": str,
    "description": str,
    "difficulty": "beginner" | "intermediate" | "advanced",
    "tags": List[str],
    "cover": str,
    "lesson_count": int,
    "created_at": datetime,
    "lessons": [
        {
            "id": str,
            "title": str,
            "content": str,  # Markdown
            "starter_code": str,
            "order": int
        }
    ]
}
```

### 练习题（Exercise）

```python
{
    "_id": ObjectId,
    "title": str,
    "description": str,  # Markdown
    "difficulty": "easy" | "medium" | "hard",
    "tags": List[str],
    "starter_code": str,
    "hint": str,
    "test_cases": [
        {
            "input": str,
            "expected_output": str
        }
    ]
}
```

## 安全注意事项

### 判题沙箱限制

当前沙箱实现了基本的安全限制，但仍需注意：

1. **不允许的操作：**
   - 文件系统访问（`open`, `os`, `sys.exit`）
   - 网络访问（`socket`, `urllib`, `requests`）
   - 危险函数（`eval`, `exec`, `compile` 已被限制）

2. **允许的操作：**
   - 基本数据类型和内置函数
   - 数学运算
   - 字符串、列表、字典操作

3. **生产环境建议：**
   - 使用 Docker 容器隔离
   - 设置 CPU/内存限制
   - 使用专业沙箱（如 PyPy sandbox）

## 扩展建议

### 1. 前端集成

在前端调用新 API：

```typescript
// 服务端判题
const result = await fetch('/api/judge/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    exercise_id: exerciseId,
    code: userCode
  })
});

// 知识库检索
const knowledge = await fetch('/api/knowledge/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: '列表推导式',
    top_k: 3
  })
});
```

### 2. 管理后台

创建管理界面，使用 `/api/admin` 端点：
- 课程编辑器（Markdown + 代码编辑器）
- 练习题管理（测试用例编辑）
- 用户管理

### 3. AI 助教

基于知识库实现智能助教：
- 实时答疑
- 代码解释
- 错误诊断
- 学习路径推荐

## 常见问题

### Q: 知识库启动失败？

A: 确保已安装依赖并运行过 `build_knowledge_base.py`：

```bash
pip install sentence-transformers chromadb
python build_knowledge_base.py
```

### Q: 判题结果不准确？

A: 检查测试用例的 `expected_output` 是否与实际输出完全匹配（包括空格、换行）。

### Q: 如何支持更多 Python 库？

A: 修改 `judge.py` 中的 `exec_globals`，添加允许的模块：

```python
exec_globals = {
    "__builtins__": {...},
    "math": math,
    "random": random,
    # 添加更多...
}
```

## 贡献

欢迎提交 Issue 和 PR！

## 许可

MIT License
