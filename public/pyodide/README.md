# Pyodide 文件目录

此目录包含 **Pyodide Python 运行时文件**（约 300 MB）。

## ⚠️ 重要说明

这些文件**不在 Git 仓库中**（已被 `.gitignore` 排除），因为：
- 文件体积过大（300+ MB）
- 超出 GitHub 单文件 100 MB 限制
- 不需要版本控制

## 📥 如何获取文件

### 方法 1：自动下载（推荐）

```bash
npm run download:pyodide
```

可选：同时下载常用科学计算包
```bash
npm run download:pyodide -- --with-packages
```

### 方法 2：手动下载

1. 访问 [Pyodide Releases](https://github.com/pyodide/pyodide/releases/tag/0.29.0)
2. 下载 `pyodide-0.29.0.tar.bz2`
3. 解压到此目录

### 方法 3：使用 CDN（生产环境推荐）

无需下载，在生产环境配置使用 CDN：

```bash
# .env.production
VITE_USE_CDN=true
VITE_PYODIDE_URL=https://cdn.jsdelivr.net/pyodide/v0.29.0/full/
```

## 📋 核心文件列表

必需文件：
- ✅ `pyodide.js` / `pyodide.mjs` - 主入口
- ✅ `pyodide.asm.js` / `pyodide.asm.wasm` - WebAssembly 核心
- ✅ `python_stdlib.zip` - Python 标准库
- ✅ `pyodide-lock.json` - 包依赖清单

可选文件（按需下载）：
- 📦 `*.whl` - Python 包（numpy, pandas 等）
- 📦 `*.tar` - 测试文件

## 🌐 CDN 源

国际：
- https://cdn.jsdelivr.net/pyodide/v0.29.0/full/
- https://unpkg.com/pyodide@0.29.0/

国内镜像：
- https://cdn.npmmirror.com/pyodide/v0.29.0/full/

## 📖 更多信息

- [Pyodide 官方文档](https://pyodide.org/)
- [部署指南](../DEPLOYMENT.md)
