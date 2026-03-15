# Python 教学网站 - 项目架构文档

## 技术栈

### 后端
- **FastAPI** - 异步 Web 框架
- **MongoDB + Motor** - 异步数据库驱动
- **JWT + bcrypt** - 身份认证与密码加密
- **Python 3.10+**

### 前端
- **React 18 + TypeScript** - UI 框架
- **Vite** - 构建工具
- **Monaco Editor** - 代码编辑器
- **Pyodide** - 浏览器端 Python 运行时
- **react-router-dom v6** - 路由管理
- **Axios** - HTTP 客户端

---

## 目录结构

```
monaco-ai-assist-web/
├── backend/                    # 后端服务
│   ├── main.py                # FastAPI 入口
│   ├── core/
│   │   ├── database.py        # MongoDB 连接配置
│   │   └── auth.py            # JWT 认证逻辑
│   ├── routers/               # API 路由模块
│   │   ├── auth.py            # 用户注册/登录
│   │   ├── courses.py         # 课程管理
│   │   ├── exercises.py       # 练习题管理
│   │   └── progress.py        # 学习进度追踪
│   ├── seed.py                # 数据库种子数据
│   ├── test_api.py            # 自动化测试
│   └── requirements.txt
│
├── src/                       # 前端源码
│   ├── main.tsx               # 入口文件
│   ├── App.tsx                # 路由配置
│   ├── contexts/
│   │   └── AuthContext.tsx    # 全局认证状态
│   ├── api/
│   │   └── index.ts           # API 封装 + Axios 拦截器
│   ├── pages/                 # 页面组件
│   │   ├── HomePage.tsx       # 首页
│   │   ├── LoginPage.tsx      # 登录
│   │   ├── RegisterPage.tsx   # 注册
│   │   ├── CoursesPage.tsx    # 课程列表
│   │   ├── CourseDetailPage.tsx  # 课程详情
│   │   ├── LearnPage.tsx      # 课程学习（Markdown + 编辑器）
│   │   ├── ExercisesPage.tsx  # 练习题列表
│   │   ├── ExerciseDetailPage.tsx # 练习题详情 + 判题
│   │   └── EditorPage.tsx     # 独立编辑器
│   ├── components/
│   │   └── learn/
│   │       ├── NavBar.tsx     # 导航栏
│   │       └── PyEditorPanel.tsx  # Python 编辑器 + 可视化
│   ├── workers/
│   │   └── pyodideWorker.ts   # Pyodide Web Worker
│   └── styles/
│       └── global.css
│
└── TEST_CHECKLIST.md          # 测试清单
```

---

## 核心功能模块

### 1. 用户系统
- **注册/登录**: bcrypt 密码哈希 + JWT Token
- **权限控制**: Axios 拦截器自动附加 Token
- **进度追踪**: 记录已完成课程/练习、学习时长

### 2. 课程学习
- **Markdown 渲染**: react-markdown + 语法高亮
- **代码编辑器**: Monaco Editor（VS Code 同款）
- **代码执行**: Pyodide 在浏览器运行 Python
- **执行可视化**: sys.settrace() 逐行追踪变量状态

### 3. 练习判题
- **自动评测**: Pyodide 运行用户代码 + 测试用例对比
- **实时反馈**: 显示通过/失败用例
- **提交记录**: 保存用户答案和通过状态

### 4. 数据库设计
```javascript
// MongoDB Collections
users: {
  _id, username, email, hashed_password, created_at
}

courses: {
  _id, title, description, difficulty, lessons: [
    { id, title, order, content, starter_code }
  ]
}

exercises: {
  _id, title, description, difficulty, starter_code,
  test_cases: [{ input, expected_output }]
}

progress: {
  _id, user_id, completed_lessons: [], completed_exercises: [],
  total_study_time, last_active
}

submissions: {
  _id, user_id, exercise_id, code, passed, submitted_at
}
```

---

## 后期扩展方向

### 🎯 用户行为数据分析（推荐优先级：高）

#### 1. 数据采集层
**新增 Collection: `user_events`**
```javascript
{
  _id: ObjectId,
  user_id: string,
  event_type: string,  // 'page_view', 'code_run', 'exercise_submit', 'lesson_complete'
  event_data: {
    page: string,
    course_id?: string,
    lesson_id?: string,
    exercise_id?: string,
    code_length?: number,
    run_time?: number,
    error?: string
  },
  timestamp: datetime,
  session_id: string,
  ip_address: string,
  user_agent: string
}
```

**前端埋点**
```typescript
// src/utils/analytics.ts
export const trackEvent = (eventType: string, data: any) => {
  analyticsApi.track({
    event_type: eventType,
    event_data: data,
    session_id: getSessionId(),
    timestamp: new Date().toISOString()
  })
}

// 使用示例
trackEvent('code_run', { lesson_id, code_length: code.length, run_time: 1234 })
trackEvent('exercise_submit', { exercise_id, passed: true, attempts: 3 })
```

**后端 API**
```python
# backend/routers/analytics.py
@router.post("/track")
async def track_event(event: EventSchema, user: User = Depends(get_current_user)):
    await db.user_events.insert_one({
        "user_id": user.id,
        "event_type": event.event_type,
        "event_data": event.event_data,
        "timestamp": datetime.utcnow(),
        "session_id": event.session_id
    })
    return {"status": "ok"}

@router.get("/dashboard")
async def get_analytics_dashboard():
    # 聚合查询示例
    pipeline = [
        {"$match": {"event_type": "code_run"}},
        {"$group": {
            "_id": "$event_data.lesson_id",
            "total_runs": {"$sum": 1},
            "avg_run_time": {"$avg": "$event_data.run_time"}
        }}
    ]
    return await db.user_events.aggregate(pipeline).to_list(None)
```

#### 2. 分析维度
- **学习路径分析**: 用户在课程间的跳转流
- **代码运行热力图**: 哪些章节代码运行次数最多
- **错误分析**: 常见错误类型、错误率最高的练习题
- **学习时长分布**: 每节课平均学习时间、完成率
- **留存分析**: 日活/周活、用户流失节点

#### 3. 可视化面板
**新增页面: `/admin/analytics`**
- 使用 **Recharts** 或 **Apache ECharts** 绘制图表
- 实时数据看板（今日活跃用户、代码运行次数）
- 课程完成漏斗图
- 用户行为时间线

---

### 🚀 其他扩展方向

#### A. AI 教学助手（已规划）
- **集成 LLM API**: OpenAI / Claude / 本地模型
- **智能答疑**: 根据用户代码错误提供修改建议
- **代码审查**: 自动检测代码风格、性能问题
- **个性化推荐**: 根据学习进度推荐下一步内容

**实现方案**:
```python
# backend/routers/ai.py
@router.post("/ask")
async def ai_assistant(question: str, code: str, user: User = Depends(...)):
    prompt = f"用户代码:\n{code}\n\n问题: {question}\n请给出建议。"
    response = await openai_client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )
    return {"answer": response.choices[0].message.content}
```

#### B. 社区功能
- **讨论区**: 每节课/练习题下的评论区
- **代码分享**: 用户可分享优秀解法
- **排行榜**: 练习题通过速度、代码简洁度排名
- **徽章系统**: 完成里程碑获得成就徽章

**新增 Collections**:
```javascript
comments: { _id, user_id, lesson_id, content, created_at, likes }
shared_code: { _id, user_id, exercise_id, code, description, upvotes }
achievements: { _id, user_id, badge_type, earned_at }
```

#### C. 多语言支持
- 扩展到 JavaScript、Java、C++ 等语言
- 使用 **Judge0 API** 或 **Piston API** 进行多语言判题
- 前端切换语言时动态加载对应的 Monaco 语法高亮

#### D. 移动端适配
- 响应式布局优化（当前主要适配桌面端）
- 考虑使用 **React Native** 开发独立 App
- 代码编辑器在移动端的交互优化

#### E. 实时协作
- **WebSocket**: 多人同时编辑代码（类似 Google Docs）
- **在线教室**: 老师直播讲课 + 学生实时提问
- 使用 **Socket.IO** 或 **WebRTC**

#### F. 数据导出与报告
- 学习进度 PDF 报告生成
- 管理员导出用户数据（CSV/Excel）
- 课程完成证书自动生成

---

## 技术债务与优化建议

### 性能优化
1. **前端**:
   - 代码分割（React.lazy + Suspense）
   - Monaco Editor 按需加载
   - Pyodide Worker 池化（避免重复初始化）

2. **后端**:
   - MongoDB 索引优化（user_id, course_id 等字段）
   - Redis 缓存热门课程数据
   - API 响应分页（当前课程/练习列表未分页）

### 安全加固
- 代码执行沙箱增强（限制 Pyodide 可访问的模块）
- API 速率限制（防止暴力破解、刷题作弊）
- XSS 防护（Markdown 渲染需过滤危险标签）

### 测试覆盖
- 前端单元测试（Vitest + React Testing Library）
- E2E 测试（Playwright）
- 后端集成测试扩展（当前仅 10 个基础测试）

---

## 部署建议

### 开发环境
```bash
# 后端
cd backend && pip install -r requirements.txt
python seed.py  # 初始化数据
uvicorn main:app --reload

# 前端
npm install && npm run dev
```

### 生产环境
- **后端**: Docker + Gunicorn + Nginx 反向代理
- **前端**: Vercel / Netlify 静态托管
- **数据库**: MongoDB Atlas（云托管）
- **CDN**: 静态资源加速（Monaco Editor、Pyodide）

---

## 竞赛评分要点对照

✅ **B/S 架构**: FastAPI 后端 + React 前端
✅ **数据库交互**: MongoDB 存储用户、课程、进度数据
✅ **前后端分离**: RESTful API + JWT 认证
✅ **核心功能完整**: 用户系统、课程学习、练习判题、进度追踪
✅ **技术亮点**:
  - 代码执行可视化（sys.settrace 动态追踪）
  - 浏览器端 Python 运行（Pyodide）
  - Monaco Editor 专业代码编辑体验

**建议补充**:
- 完善测试覆盖率（前端 E2E 测试）
- 添加部署文档和 Docker 配置
- 实现用户行为分析模块（体现数据驱动思维）
- 录制功能演示视频
