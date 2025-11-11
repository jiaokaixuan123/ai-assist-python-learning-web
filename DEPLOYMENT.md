# 🚀 部署指南 - Monaco AI Assist Web

## 📦 文件管理策略

### **Pyodide 和 Monaco Editor 文件处理**

这两个库的文件**不会上传到 Git 仓库**，原因：
- Pyodide: ~300 MB
- Monaco Editor: ~50 MB
- **总计 350+ MB** - 超出 GitHub 合理范围

---

## 🛠️ 开发环境配置

### **初次克隆项目后**

```bash
# 1. 安装依赖
npm install

# 2. 下载 Pyodide 文件（可选 - 如果需要完全离线）
npm run download:pyodide

# 3. 复制 Monaco Editor 文件（可选 - npm install 已包含）
npm run copy:monaco

# 4. 启动开发服务器
npm run dev
```

### **package.json 脚本配置**

在 `package.json` 中添加：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "download:pyodide": "node scripts/downloadPyodide.mjs",
    "copy:monaco": "node scripts/copyMonaco.mjs",
    "postinstall": "npm run copy:monaco"
  }
}
```

---

## 🌐 生产环境部署

### **方案 1：使用 CDN（推荐 - 教学网站）**

**优点：**
- ✅ 无需上传大文件
- ✅ 全球 CDN 加速
- ✅ 自动缓存
- ✅ 降低服务器带宽成本

**配置示例：**

```typescript
// src/workers/pyodideWorker.ts
const PYODIDE_URL = import.meta.env.PROD 
  ? 'https://cdn.jsdelivr.net/pyodide/v0.29.0/full/'
  : '/pyodide/';

const pyodide = await loadPyodide({
  indexURL: PYODIDE_URL
});
```

```typescript
// vite.config.ts
export default defineConfig({
  define: {
    'process.env.PYODIDE_CDN': JSON.stringify('https://cdn.jsdelivr.net/pyodide/v0.29.0/full/')
  }
});
```

### **方案 2：本地部署（私有网络/离线环境）**

**适用场景：**
- 企业内网教学
- 无法访问外网
- 需要特定版本控制

**步骤：**

1. **下载文件到本地**
```bash
npm run download:pyodide
npm run copy:monaco
```

2. **部署到静态文件服务器**
```bash
# 构建生产版本
npm run build

# 上传到服务器（包含 public/ 目录）
rsync -avz dist/ user@server:/var/www/html/
rsync -avz public/pyodide/ user@server:/var/www/html/pyodide/
rsync -avz public/vs/ user@server:/var/www/html/vs/
```

3. **配置 Nginx/Apache**
```nginx
# nginx.conf
location /pyodide/ {
    alias /var/www/html/pyodide/;
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location /vs/ {
    alias /var/www/html/vs/;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### **方案 3：混合部署（推荐）**

```typescript
// 动态选择加载源
const PYODIDE_SOURCES = [
  '/pyodide/',                                    // 优先本地
  'https://cdn.jsdelivr.net/pyodide/v0.29.0/full/', // CDN 备用
  'https://cdn.npmmirror.com/pyodide/v0.29.0/full/' // 国内镜像
];

async function loadPyodideWithFallback() {
  for (const source of PYODIDE_SOURCES) {
    try {
      return await loadPyodide({ indexURL: source });
    } catch (err) {
      console.warn(`Failed to load from ${source}, trying next...`);
    }
  }
  throw new Error('All Pyodide sources failed');
}
```

---

## 📋 针对 Python 教学网站的建议

### **推荐配置**

```typescript
// .env.production
VITE_USE_CDN=true
VITE_PYODIDE_URL=https://cdn.jsdelivr.net/pyodide/v0.29.0/full/
VITE_MONACO_URL=https://cdn.jsdelivr.net/npm/monaco-editor@0.54.0/

// .env.development
VITE_USE_CDN=false
VITE_PYODIDE_URL=/pyodide/
VITE_MONACO_URL=/vs/
```

### **为什么这样配置？**

1. **开发环境用本地文件**
   - 离线开发
   - 调试方便
   - 加载速度快

2. **生产环境用 CDN**
   - 降低服务器成本
   - 提升用户体验
   - 减少部署复杂度

3. **教学网站特点**
   - 学生访问量大
   - 并发请求多
   - CDN 能有效分流

---

## 🔧 自动化脚本

### **下载 Pyodide**

创建 `scripts/downloadPyodide.mjs`:

```javascript
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYODIDE_VERSION = '0.29.0';
const BASE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const OUTPUT_DIR = path.join(__dirname, '../public/pyodide');

// 下载核心文件
const coreFiles = [
  'pyodide.js',
  'pyodide.mjs',
  'pyodide.asm.js',
  'pyodide.asm.wasm',
  'pyodide-lock.json',
  'python_stdlib.zip'
];

console.log('开始下载 Pyodide 文件...');
// ... 实现下载逻辑
```

### **复制 Monaco Editor**

创建 `scripts/copyMonaco.mjs`:

```javascript
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(__dirname, '../node_modules/monaco-editor/min/vs');
const DEST = path.join(__dirname, '../public/vs');

console.log('复制 Monaco Editor 文件...');
await fs.copy(SOURCE, DEST);
console.log('✅ Monaco Editor 文件已复制到 public/vs/');
```

---

## 📝 README 说明

在 `public/pyodide/README.md` 和 `public/vs/README.md` 中添加：

```markdown
# Pyodide 文件目录

此目录包含 Pyodide Python 运行时文件（~300 MB）。

## 获取文件

这些文件**不在 Git 仓库中**，请通过以下方式获取：

### 方法 1：自动下载（推荐）
\`\`\`bash
npm run download:pyodide
\`\`\`

### 方法 2：手动下载
访问 https://github.com/pyodide/pyodide/releases
下载 v0.29.0 并解压到此目录

### 方法 3：使用 CDN（生产环境）
无需下载，配置环境变量 VITE_USE_CDN=true
```

---

## ✅ 最终答案

### **开发时需要吗？**
- ✅ **需要本地文件** - 方便离线开发和调试
- ✅ 通过 `npm run download:pyodide` 自动获取
- ✅ 不影响 Git 仓库大小

### **上传代码时需要吗？**
- ❌ **不要上传到 Git** - 文件太大，没有必要
- ✅ 在 `.gitignore` 中已排除
- ✅ 其他开发者克隆后自动下载

### **生产部署时需要吗？**
- **Python 教学网站推荐用 CDN** ⭐
- 国内可用 jsdelivr 或 npmmirror
- 节省带宽，提升速度
- 特殊情况（内网）才需要本地部署

---

## 🎓 教学网站专属优化

### **预加载常用包**

```python
# 在应用启动时预加载
await pyodide.loadPackage(['numpy', 'pandas', 'matplotlib']);
```

### **缓存策略**

```typescript
// Service Worker 缓存 Pyodide
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('pyodide-v0.29.0').then((cache) => {
      return cache.addAll([
        '/pyodide/pyodide.js',
        '/pyodide/python_stdlib.zip'
      ]);
    })
  );
});
```

### **进度提示**

```typescript
// 显示加载进度
pyodide.loadPackage('numpy', {
  messageCallback: (msg) => console.log(msg),
  errorCallback: (err) => console.error(err)
});
```

---

**总结：不上传到 Git，但保持本地部署，生产环境优先 CDN！** 🎯
