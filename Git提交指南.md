# Git 提交到 GitHub 指南

## 📋 提交前检查清单

在提交代码到 GitHub 之前，请确认：

- ✅ `.gitignore` 文件已创建
- ✅ `node_modules/` 目录被忽略
- ✅ 大文件（Pyodide, Monaco）根据需求处理
- ✅ 代码已测试并正常工作
- ✅ README.md 已完善

## 🚀 首次提交到 GitHub

### 步骤 1: 初始化 Git 仓库

```powershell
# 在项目根目录执行
git init
```

### 步骤 2: 添加文件到暂存区

```powershell
# 添加所有文件（.gitignore 会自动排除不需要的文件）
git add .

# 或者分步添加
git add package.json
git add package-lock.json
git add src/
git add public/
git add index.html
git add vite.config.ts
git add tsconfig.json
git add README.md
git add .gitignore
```

### 步骤 3: 查看将要提交的文件

```powershell
# 查看暂存区的文件
git status

# 确认 node_modules/ 和其他不需要的文件没有被添加
```

### 步骤 4: 创建首次提交

```powershell
git commit -m "Initial commit: Monaco AI 编程助手

- 基于 Monaco Editor 和 Pyodide 的在线 Python 编程环境
- 支持代码编辑、运行、智能补全和语法检查
- 完全本地化，支持离线使用
- React + TypeScript + Vite"
```

### 步骤 5: 在 GitHub 创建仓库

1. 访问 [GitHub](https://github.com/)
2. 点击右上角的 `+` → `New repository`
3. 填写信息：
   - **Repository name**: `monaco-ai-assist-web`（或其他名称）
   - **Description**: `基于 Monaco Editor 和 Pyodide 的在线 Python 编程助手`
   - **Public** 或 **Private**: 根据需求选择
   - **不要勾选** "Add a README file"（我们已经有了）
   - **不要勾选** "Add .gitignore"（我们已经有了）
4. 点击 `Create repository`

### 步骤 6: 关联远程仓库

```powershell
# 将 YOUR-USERNAME 替换为你的 GitHub 用户名
git remote add origin https://github.com/YOUR-USERNAME/monaco-ai-assist-web.git

# 验证远程仓库
git remote -v
```

### 步骤 7: 推送到 GitHub

```powershell
# 推送主分支（首次推送需要 -u 参数）
git branch -M main
git push -u origin main
```

如果遇到认证问题，可能需要：
- 使用 Personal Access Token（推荐）
- 或配置 SSH Key

## 🔐 GitHub 认证设置

### 方法 1: Personal Access Token（推荐）

1. 访问 GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 点击 `Generate new token (classic)`
3. 勾选权限：
   - ✅ `repo`（完整仓库访问）
4. 生成并**复制 token**（只显示一次！）
5. 推送时使用 token 作为密码

### 方法 2: SSH Key

```powershell
# 生成 SSH Key
ssh-keygen -t ed25519 -C "your_email@example.com"

# 复制公钥
Get-Content ~/.ssh/id_ed25519.pub | clip

# 在 GitHub Settings → SSH and GPG keys 中添加
```

然后修改远程仓库 URL：
```powershell
git remote set-url origin git@github.com:YOUR-USERNAME/monaco-ai-assist-web.git
```

## 📦 关于大文件的处理

### 选项 1: 不提交 Pyodide 和 Monaco 文件（推荐）

在 `.gitignore` 中取消注释以下行：
```
public/pyodide/*.whl
public/pyodide/*.tar
public/pyodide/*.zip
public/pyodide/*.js
public/pyodide/*.wasm
public/pyodide/*.data
```

然后在 README.md 中说明：
```markdown
## 🔧 安装说明

克隆仓库后，需要准备 Pyodide 文件：

\`\`\`bash
npm install
npm run prepare:pyodide
\`\`\`
```

**优点**：仓库体积小，克隆快速  
**缺点**：使用者需要额外步骤

### 选项 2: 使用 Git LFS（大文件存储）

```powershell
# 安装 Git LFS
# 从 https://git-lfs.github.com/ 下载安装

# 初始化 LFS
git lfs install

# 追踪大文件
git lfs track "public/pyodide/*.whl"
git lfs track "public/pyodide/*.wasm"
git lfs track "public/pyodide/*.data"

# 添加 .gitattributes
git add .gitattributes
git commit -m "Add Git LFS tracking"
```

**优点**：完整克隆即可使用  
**缺点**：需要 Git LFS，GitHub 有存储限制

### 选项 3: 提交所有文件（不推荐）

直接提交所有文件，仓库会很大（~100MB+）

## 📝 后续提交

日常开发后提交代码：

```powershell
# 查看修改
git status

# 添加修改的文件
git add .

# 提交
git commit -m "描述你的修改"

# 推送
git push
```

### 提交信息规范

建议使用清晰的提交信息：

```
feat: 添加新功能
fix: 修复 bug
docs: 更新文档
style: 代码格式调整
refactor: 重构代码
perf: 性能优化
test: 添加测试
chore: 构建/工具配置
```

例如：
```powershell
git commit -m "feat: 添加代码导出功能"
git commit -m "fix: 修复语法检查的性能问题"
git commit -m "docs: 更新 README 安装说明"
```

## 🌳 分支管理

### 创建功能分支

```powershell
# 创建并切换到新分支
git checkout -b feature/new-feature

# 开发完成后提交
git add .
git commit -m "feat: 实现新功能"

# 推送到远程
git push -u origin feature/new-feature
```

### 合并到主分支

```powershell
# 切换回主分支
git checkout main

# 合并功能分支
git merge feature/new-feature

# 推送
git push
```

## 🔄 克隆和使用

其他人克隆你的仓库：

```powershell
# 克隆仓库
git clone https://github.com/YOUR-USERNAME/monaco-ai-assist-web.git

# 进入目录
cd monaco-ai-assist-web

# 安装依赖
npm install

# 准备 Pyodide（如果没有提交 Pyodide 文件）
npm run prepare:pyodide

# 运行
npm run dev
```

## 📊 推荐的 .gitignore 配置

根据你的需求选择：

### 配置 1: 最小仓库（推荐）

忽略所有大文件，让用户自己构建：
- ✅ 仓库小
- ✅ 克隆快
- ❌ 需要额外步骤

### 配置 2: 完整仓库

提交所有必需文件：
- ✅ 克隆即用
- ❌ 仓库大
- ❌ 克隆慢

### 配置 3: Git LFS

使用 Git LFS 管理大文件：
- ✅ 克隆即用
- ✅ 仓库元数据小
- ❌ 需要 LFS
- ❌ GitHub 有存储限制

## 🎯 建议

对于开源项目，建议：
1. **不提交** `public/pyodide/` 和 `public/vs/` 中的二进制文件
2. 在 README.md 中明确说明如何准备这些文件
3. 提供 `npm run prepare:pyodide` 脚本自动化准备过程
4. 仓库保持轻量，专注于源代码

对于私人项目，可以全部提交以便快速部署。

---

**现在你可以开始提交了！** 🚀

记住先运行 `git status` 检查将要提交的文件，确保没有不需要的文件被包含。
