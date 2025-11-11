# 🎯 快速答案：Pyodide 和 Monaco 文件管理

## ❓ 开发时需要本地文件吗？

**✅ 是的，建议保留本地文件**

**原因：**
- 🚀 开发速度快（不依赖网络）
- 🔧 方便调试和测试
- 💻 支持离线开发

**如何获取：**
```bash
# 克隆项目后运行
npm install                 # 自动复制 Monaco Editor
npm run download:pyodide    # 下载 Pyodide（可选）
```

---

## ❓ 上传代码到 Git 需要这些文件吗？

**❌ 不需要，也不应该上传**

**原因：**
- 📦 文件太大（350+ MB）
- 🚫 GitHub 限制单文件 100 MB
- ♻️ 可以自动重新生成
- 📊 让仓库保持精简

**已配置：**
```gitignore
# .gitignore 已排除
public/pyodide/    # ~300 MB
public/vs/         # ~50 MB
```

---

## ❓ 生产部署需要这些文件吗？

**🌐 Python 教学网站 → 推荐使用 CDN**

### 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **CDN（推荐）** | ✅ 全球加速<br>✅ 节省带宽<br>✅ 自动缓存 | ⚠️ 依赖网络 | 公开教学网站<br>学生访问量大 |
| **本地部署** | ✅ 完全可控<br>✅ 离线可用 | ❌ 占用存储<br>❌ 带宽成本高 | 企业内网<br>私有部署 |
| **混合部署** | ✅ 最佳体验<br>✅ 降级备用 | ⚠️ 配置复杂 | 追求极致性能 |

### 推荐配置

```typescript
// 生产环境配置
const PYODIDE_URL = import.meta.env.PROD 
  ? 'https://cdn.jsdelivr.net/pyodide/v0.29.0/full/'  // CDN
  : '/pyodide/';                                       // 本地

const pyodide = await loadPyodide({
  indexURL: PYODIDE_URL
});
```

---

## 📋 完整工作流程

### 1️⃣ **首次开发**
```bash
git clone https://github.com/your-repo/monaco-ai-assist-web.git
cd monaco-ai-assist-web
npm install              # ✅ 自动复制 Monaco
npm run download:pyodide # ✅ 下载 Pyodide（可选）
npm run dev              # 🚀 启动开发
```

### 2️⃣ **日常开发**
```bash
# 正常开发，public/pyodide/ 和 public/vs/ 被 .gitignore 排除
git add .
git commit -m "feat: add new feature"
git push
```

### 3️⃣ **其他人克隆**
```bash
git clone https://github.com/your-repo/monaco-ai-assist-web.git
cd monaco-ai-assist-web
npm install              # ✅ 自动获取 Monaco
npm run download:pyodide # ✅ 手动下载 Pyodide（如需离线开发）
npm run dev
```

### 4️⃣ **生产部署**

**选项 A：使用 CDN（推荐）**
```bash
npm run build
# 部署 dist/ 目录，无需 public/pyodide/ 和 public/vs/
```

**选项 B：本地部署**
```bash
npm run download:pyodide
npm run copy:monaco
npm run build
# 部署 dist/ + public/pyodide/ + public/vs/
```

---

## 🎓 教学网站专属建议

### **为什么选择 CDN？**

1. **学生访问量大**
   - 数百上千并发请求
   - CDN 自动分流，降低服务器压力

2. **全球访问**
   - jsdelivr CDN 覆盖全球
   - 国内可用 npmmirror 镜像

3. **成本优化**
   - 节省 300+ MB 带宽费用
   - 减少服务器存储成本

4. **自动缓存**
   - 浏览器缓存 Pyodide 文件
   - 学生二次访问极快

### **国内 CDN 镜像**

```typescript
const PYODIDE_SOURCES = [
  'https://cdn.npmmirror.com/pyodide/v0.29.0/full/',     // 国内首选
  'https://cdn.jsdelivr.net/pyodide/v0.29.0/full/',      // 国际备用
  '/pyodide/'                                             // 本地降级
];
```

---

## ✅ 最终答案总结

| 问题 | 答案 | 原因 |
|------|------|------|
| **开发时需要本地文件吗？** | ✅ **建议有** | 离线开发、调试方便 |
| **上传到 Git 需要吗？** | ❌ **不需要** | 文件太大、可自动获取 |
| **生产部署需要吗？** | 🌐 **CDN 优先** | 教学网站流量大、CDN 最优 |
| **内网部署怎么办？** | 💾 **本地部署** | 无网络环境的特殊情况 |

---

## 🚀 立即开始

```bash
# 1. 更新 package.json 和脚本
npm install fs-extra --save-dev

# 2. 配置自动化
# ✅ 已创建 scripts/downloadPyodide.mjs
# ✅ 已创建 scripts/copyMonaco.mjs
# ✅ 已更新 .gitignore

# 3. 测试工作流
npm install              # 自动复制 Monaco
npm run download:pyodide # 下载 Pyodide
npm run dev              # 启动开发

# 4. 提交代码（不包含大文件）
git add .
git commit -m "docs: add deployment guide and automation scripts"
git push
```

---

## 📚 相关文档

- 📖 [完整部署指南](./DEPLOYMENT.md)
- 📦 [Pyodide 目录说明](./public/pyodide/README.md)
- 🎨 [Monaco 目录说明](./public/vs/README.md)
- 🔧 [Git 提交指南](./Git提交指南.md)

---

**记住：本地开发用文件，Git 不上传，生产用 CDN！** 🎯
