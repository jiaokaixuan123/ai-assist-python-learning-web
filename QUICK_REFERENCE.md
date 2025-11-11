# 📌 Pyodide & Monaco 文件管理 - 3 分钟速查

## 🎯 核心答案

```
┌─────────────────────────────────────────────────────────────┐
│  问题              答案           理由                        │
├─────────────────────────────────────────────────────────────┤
│  本地需要吗？      ✅ 建议有      离线开发、调试方便          │
│  上传 Git 吗？     ❌ 不要上传    350MB 太大                  │
│  生产部署？        🌐 用 CDN      教学网站流量大              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 快速开始（3 步）

```bash
# 步骤 1：克隆项目
git clone <你的仓库>
cd monaco-ai-assist-web

# 步骤 2：安装依赖（自动复制 Monaco）
npm install

# 步骤 3：下载 Pyodide（可选 - 离线开发需要）
npm run download:pyodide

# 启动开发
npm run dev
```

---

## 📦 文件说明

### Pyodide（~300 MB）
- **位置**: `public/pyodide/`
- **用途**: Python 运行时
- **获取**: `npm run download:pyodide`
- **Git**: ❌ 已排除（太大）

### Monaco Editor（~50 MB）
- **位置**: `public/vs/`
- **用途**: 代码编辑器
- **获取**: `npm install`（自动）
- **Git**: ❌ 已排除（可重建）

---

## 🌐 生产部署选择

### 选项 A：CDN（推荐 - 教学网站）⭐

```typescript
// 配置使用 CDN
const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.29.0/full/';
```

**优势**：
- ✅ 节省带宽（350MB）
- ✅ 全球加速
- ✅ 学生访问快
- ✅ 零部署成本

### 选项 B：本地部署（内网教学）

```bash
# 下载所有文件
npm run download:pyodide
npm run copy:monaco

# 构建并上传
npm run build
# 上传 dist/ + public/pyodide/ + public/vs/ 到服务器
```

**适用**：
- 企业内网
- 无法访问外网
- 需要特定版本

---

## 🔧 可用命令

```bash
npm run dev                # 启动开发服务器
npm run build              # 构建生产版本
npm run download:pyodide   # 下载 Pyodide 文件
npm run copy:monaco        # 复制 Monaco 文件（install 自动执行）
```

---

## 📁 .gitignore 配置

已自动排除以下文件：

```gitignore
# 大文件已排除
public/pyodide/    # ~300 MB
public/vs/         # ~50 MB

# 保留配置文件
!public/pyodide/README.md
!public/pyodide/package.json
!public/vs/README.md
```

---

## 🎓 教学网站推荐配置

### 开发环境
```bash
# .env.development
VITE_USE_CDN=false          # 使用本地文件
VITE_PYODIDE_URL=/pyodide/  # 本地路径
```

### 生产环境
```bash
# .env.production
VITE_USE_CDN=true           # 使用 CDN
VITE_PYODIDE_URL=https://cdn.jsdelivr.net/pyodide/v0.29.0/full/
```

### 国内镜像（可选）
```typescript
// 降级备用
const PYODIDE_SOURCES = [
  'https://cdn.npmmirror.com/pyodide/v0.29.0/full/',    // 国内
  'https://cdn.jsdelivr.net/pyodide/v0.29.0/full/',     // 国际
  '/pyodide/'                                            // 本地
];
```

---

## ⚠️ 常见问题

### Q1: 为什么不上传到 Git？
**A**: 文件太大（350MB），GitHub 限制单文件 100MB

### Q2: 其他人克隆后怎么办？
**A**: 运行 `npm install`（自动）+ `npm run download:pyodide`（可选）

### Q3: 生产部署必须用 CDN 吗？
**A**: 不是，但教学网站推荐 CDN（节省成本、提升速度）

### Q4: CDN 会不会失效？
**A**: jsdelivr 很稳定，可配置多个备用源（见上方降级配置）

### Q5: 本地文件占用空间太大？
**A**: 开发需要，不影响 Git。可随时删除并重新下载

---

## 📚 详细文档

- 📖 [完整部署指南](./DEPLOYMENT.md) - 详细配置和高级用法
- 📋 [文件管理 FAQ](./FILE_MANAGEMENT_FAQ.md) - 深入解答
- 🔧 [Git 提交指南](./Git提交指南.md) - 工作流程
- 📦 [Pyodide 目录说明](./public/pyodide/README.md)
- 🎨 [Monaco 目录说明](./public/vs/README.md)

---

## ✅ 检查清单

提交代码前确认：

- [ ] ✅ `.gitignore` 已排除 `public/pyodide/` 和 `public/vs/`
- [ ] ✅ `package.json` 包含自动化脚本
- [ ] ✅ `scripts/` 目录包含下载脚本
- [ ] ✅ README.md 已说明如何获取文件
- [ ] ✅ 本地可以正常运行 `npm run dev`

部署到生产前确认：

- [ ] ✅ 已选择部署方案（CDN 或本地）
- [ ] ✅ 环境变量已正确配置
- [ ] ✅ 已测试 Pyodide 加载
- [ ] ✅ 已测试 Monaco Editor 加载

---

**记住口诀：本地开发用文件，Git 不上传，生产用 CDN！** 🎯

---

*生成时间: 2025-11-11*  
*项目: Monaco AI Assist Web*  
*版本: v1.0.0*
