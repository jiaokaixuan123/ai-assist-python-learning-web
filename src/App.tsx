import { useState, useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor'

// 使用 Vite 的 worker 导入方式配置 Monaco Editor
// @ts-ignore
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
// @ts-ignore
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
// @ts-ignore
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
// @ts-ignore
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
// @ts-ignore
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

self.MonacoEnvironment = {
  getWorker(_: any, label: string) {
    if (label === 'json') {
      return new jsonWorker()
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker()
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker()
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker()
    }
    return new editorWorker()
  }
}

// 直接加载 Pyodide 为 Web Worker 方式，避免与 Monaco AMD define 冲突
interface PyWorkerMessage {
  id: number
  type: string
  result?: string
  error?: string
}

function usePyodideWorker() {
  const workerRef = useRef<Worker | null>(null)
  const reqIdRef = useRef(0)
  const pendingRef = useRef<Map<number, (res: { result?: string; error?: string }) => void>>(new Map())
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    console.log('🔧 初始化 Pyodide Worker...')
    const worker = new Worker(new URL('./workers/pyodideWorker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    
    worker.onmessage = (e: MessageEvent<PyWorkerMessage>) => {
      const { id, type, result, error } = e.data
      console.log('📨 Worker 消息:', { id, type, hasResult: !!result, hasError: !!error })
      
      if (type === 'ready') {
        console.log('✅ Pyodide 已就绪!')
        setIsReady(true)
        return
      }
      const resolver = pendingRef.current.get(id)
      if (resolver) {
        resolver({ result, error })
        pendingRef.current.delete(id)
      } else {
        console.warn('⚠️ 未找到对应的 resolver，id:', id)
      }
    }
    
    worker.onerror = (err) => {
      console.error('❌ Worker 错误:', {
        message: err.message,
        filename: err.filename,
        lineno: err.lineno,
        colno: err.colno
      })
      setIsReady(false)
    }
    
    // 仅发送 ping
    console.log('📤 发送 ping 消息...')
    worker.postMessage({ id: -1, type: 'ping' })
    
    return () => {
      console.log('🛑 终止 Worker')
      worker.terminate()
    }
  }, [])

  const callWorker = (type: string, code: string) => {
    return new Promise<{ result?: string; error?: string }>((resolve) => {
      if (!workerRef.current) {
        console.error('❌ Worker 未初始化')
        resolve({ error: 'Worker 未初始化' })
        return
      }
      const id = reqIdRef.current++
      pendingRef.current.set(id, resolve)
      console.log('📤 发送消息到 Worker:', { id, type, codeLength: code.length })
      workerRef.current.postMessage({ id, type, code })
      
      setTimeout(() => {
        if (pendingRef.current.has(id)) {
          console.error('⏱️ Worker 响应超时，id:', id)
          resolve({ error: '执行超时（60秒）' })
          pendingRef.current.delete(id)
        }
      }, 60000)
    })
  }

  const runCode = async (code: string) => {
    const start = performance.now();
    const res = await callWorker('run', code);
    console.log('⏱️ run 耗时(ms):', performance.now() - start);
    return res;
  }
  const formatCode = async (code: string) => callWorker('format', code)
  const analyzeCodeWorker = async (code: string) => callWorker('analyze', code)
  const syntaxCheckWorker = async (code: string) => callWorker('syntax', code)

  return { isReady, runCode, formatCode, analyzeCodeWorker, syntaxCheckWorker }
}

import Header from './components/layout/Header'
import OutputPanel from './components/layout/OutputPanel'
import EditorPane from './components/Editor/EditorPane'
import Sidebar from './components/Sidebar/Sidebar'
import StatusBar from './components/StatusBar/StatusBar'
import { useAutoSave } from './hooks/useAutoSave'
import { useSelection } from './hooks/useSelection'
import { useCodeIntel } from './hooks/useCodeIntel'

// Pyodide 类型定义
interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<any>
  loadPackage: (packages: string[]) => Promise<void>
  FS: any
  globals: any
}

declare global {
  interface Window {
    loadPyodide: (config: { indexURL: string }) => Promise<PyodideInterface>
  }
}

function App() {
  // 💾 从 localStorage 恢复状态
  const getInitialCode = () => {
    const saved = localStorage.getItem('monaco-editor-code')  // localStorage 直接在浏览器存储数据
    return saved || '# 在这里编写 Python 代码\nprint("Hello, Monaco!")\n\nfor i in range(5):\n    print(f"Count: {i}")'
  }
  
  const getInitialOutput = () => {
    const saved = localStorage.getItem('monaco-editor-output')
    return saved || ''
  }
  
  const getInitialSettings = () => {
    const saved = localStorage.getItem('monaco-editor-settings')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return { autoComplete: true, syntaxCheck: true, semanticHighlight: true }
      }
    }
    return { autoComplete: true, syntaxCheck: true, semanticHighlight: true }
  }
  
  const initialSettings = getInitialSettings()
  
  const [code, setCode] = useState(getInitialCode())
  const [output, setOutput] = useState(getInitialOutput())
  const { isReady, runCode, formatCode: formatWithPyodide, analyzeCodeWorker, syntaxCheckWorker } = usePyodideWorker()
  const loadingStatus = isReady ? 'Python 环境已加载' : '正在加载 Python 环境...'
  // 不再直接使用 pyodide ref（已通过 worker 提供分析与语法检查）
  const [isRunning, setIsRunning] = useState(false)
  // 重新声明用户符号 ref（仅用于补全与悬停）
  const userSymbolsRef = useRef<Array<{name: string, type: string, detail?: string}>>([])

  // 🎛️ 功能开关
  const [enableAutoComplete, setEnableAutoComplete] = useState(initialSettings.autoComplete)
  const [enableSyntaxCheck, setEnableSyntaxCheck] = useState(initialSettings.syntaxCheck)
  const [enableSemanticHighlight, setEnableSemanticHighlight] = useState(initialSettings.semanticHighlight)
  const [showSettings, setShowSettings] = useState(false)
  
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof monaco | null>(null)
  const decorationsRef = useRef<string[]>([])  // 存储装饰器ID
  const autoCompleteEnabledRef = useRef(true)  // 用于补全提供器

  // ⚡ 功能2：代码格式化 (使用 worker)
  const formatCodeLocal = async () => {
    if (!isReady || !code.trim()) return
    const { result, error } = await formatWithPyodide(code)
    if (error) { setOutput(`⚠️ 格式化失败: ${error}`); return }
    if (result) { setCode(result); setOutput('✓ 代码格式化完成') }
  }

  const handleRunCode = async () => {
    if (!isReady) { setOutput('⚠️ Python 环境还未加载完成，请稍候...'); return }
    if (!code.trim()) { setOutput('⚠️ 请先输入代码'); return }
    setIsRunning(true)
    setOutput('正在执行...\n')
    try {
      const { result, error } = await runCode(code)
      if (error) setOutput(`❌ 运行错误:\n${error}`)
      else if (result) setOutput(result)
    } catch (e: any) {
      setOutput('❌ 调用失败: ' + (e.message || String(e)))
    } finally {
      setIsRunning(false)
    }
  }

  // 🎨 功能3：Monaco Editor 挂载时的配置
  const { selectedCode, attachSelectionListener } = useSelection()

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, m: typeof monaco) => {
    editorRef.current = editor
    monacoRef.current = m
    attachSelectionListener(editor)
    // 使用 Monaco 内置的 vs-dark 主题
    monaco.editor.setTheme('vs-dark')
    editor.updateOptions({ theme: 'vs-dark' })

    // 📝 功能4：注册 Python 代码补全（内置 + 用户定义）
    const completionProvider = monaco.languages.registerCompletionItemProvider('python', {
      provideCompletionItems: (model: monaco.editor.ITextModel, position: monaco.Position) => {
        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        }

        const suggestions: any[] = []

        // ⚠️ 关键修复：使用 ref 访问最新的状态，避免闭包问题
        const isAutoCompleteEnabled = autoCompleteEnabledRef.current

        console.log('💡 补全触发 - 当前用户符号数:', '自动补全开启:', isAutoCompleteEnabled)

        // 如果启用了自动补全，添加内置函数和用户定义
        if (isAutoCompleteEnabled) {
          // Python 内置函数
          const builtIns = [
            { label: 'print', kind: monaco.languages.CompletionItemKind.Function, insertText: 'print(${1:})', doc: '打印输出' },
            { label: 'input', kind: monaco.languages.CompletionItemKind.Function, insertText: 'input(${1:})', doc: '获取用户输入' },
            { label: 'len', kind: monaco.languages.CompletionItemKind.Function, insertText: 'len(${1:})', doc: '返回长度' },
            { label: 'range', kind: monaco.languages.CompletionItemKind.Function, insertText: 'range(${1:})', doc: '数字序列' },
            { label: 'str', kind: monaco.languages.CompletionItemKind.Function, insertText: 'str(${1:})', doc: '转字符串' },
            { label: 'int', kind: monaco.languages.CompletionItemKind.Function, insertText: 'int(${1:})', doc: '转整数' },
            { label: 'float', kind: monaco.languages.CompletionItemKind.Function, insertText: 'float(${1:})', doc: '转浮点数' },
            { label: 'list', kind: monaco.languages.CompletionItemKind.Function, insertText: 'list(${1:})', doc: '创建列表' },
            { label: 'dict', kind: monaco.languages.CompletionItemKind.Function, insertText: 'dict(${1:})', doc: '创建字典' },
            { label: 'sum', kind: monaco.languages.CompletionItemKind.Function, insertText: 'sum(${1:})', doc: '求和' },
            { label: 'max', kind: monaco.languages.CompletionItemKind.Function, insertText: 'max(${1:})', doc: '最大值' },
            { label: 'min', kind: monaco.languages.CompletionItemKind.Function, insertText: 'min(${1:})', doc: '最小值' },
          ]

          builtIns.forEach(item => {
            suggestions.push({
              label: item.label,
              kind: item.kind,
              insertText: item.insertText,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: item.doc,
              range,
              sortText: `0_${item.label}` // 内置函数排在前面
            })
          })

          // 代码片段
          const snippets = [
            { label: 'for', text: 'for ${1:item} in ${2:iterable}:\n    ${3:pass}', doc: 'for 循环' },
            { label: 'while', text: 'while ${1:condition}:\n    ${2:pass}', doc: 'while 循环' },
            { label: 'if', text: 'if ${1:condition}:\n    ${2:pass}', doc: 'if 条件' },
            { label: 'def', text: 'def ${1:name}(${2:}):\n    ${3:pass}', doc: '定义函数' },
            { label: 'class', text: 'class ${1:Name}:\n    def __init__(self${2:}):\n        ${3:pass}', doc: '定义类' },
          ]

          snippets.forEach(snip => {
            suggestions.push({
              label: snip.label,
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: snip.text,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: snip.doc,
              range,
              sortText: `2_${snip.label}` // 片段排在最后
            })
          })
        }

        console.log('✅ 返回补全建议数量:', suggestions.length)
        return { suggestions }
      },
      triggerCharacters: ['.', ' ']
    })

    // 🔍 功能5：注册悬停提示（Hover Provider）
    const hoverProvider = monaco.languages.registerHoverProvider('python', {
      provideHover: (model: monaco.editor.ITextModel, position: monaco.Position) => {
        const word = model.getWordAtPosition(position)
        if (!word) return null

        const hoveredWord = word.word
        console.log('🖱️ 悬停在:', hoveredWord)

        // 检查是否是用户定义的符号
        const currentSymbols = userSymbolsRef.current
        const symbol = currentSymbols.find(s => s.name === hoveredWord)

        if (symbol) {
          let contents: any[] = []
          
          // 根据类型显示不同的信息
          if (symbol.type === 'function') {
            contents = [
              { value: '**🔧 用户定义的函数**' },
              { value: `\`\`\`python\n${symbol.detail}\n\`\`\`` },
              { value: '---' },
              { value: '**说明：**' },
              { value: `函数 \`${symbol.name}\` 在您的代码中定义` },
              { value: '' },
              { value: '**使用方式：**' },
              { value: `在代码中直接调用 \`${symbol.name}()\` 并传入所需参数` },
              { value: '' },
              { value: '_💡 提示：按 F12 可跳转到定义（即将支持）_' }
            ]
          } else if (symbol.type === 'class') {
            contents = [
              { value: '**📦 用户定义的类**' },
              { value: `\`\`\`python\n${symbol.detail}\n\`\`\`` },
              { value: '---' },
              { value: '**说明：**' },
              { value: `类 \`${symbol.name}\` 是一个自定义的 Python 类` },
              { value: '' },
              { value: '**使用方式：**' },
              { value: `创建实例：\`obj = ${symbol.name}()\`` },
              { value: `访问方法：\`obj.method()\`` },
              { value: `访问属性：\`obj.attribute\`` },
              { value: '' },
              { value: '_💡 提示：可以通过 \`__init__` 方法初始化对象_' }
            ]
          } else if (symbol.type === 'variable') {
            contents = [
              { value: '**📌 用户定义的变量**' },
              { value: `\`\`\`python\n${symbol.detail}\n\`\`\`` },
              { value: '---' },
              { value: '**说明：**' },
              { value: `变量 \`${symbol.name}\` 存储了您定义的数据` },
              { value: '' },
              { value: '**使用方式：**' },
              { value: `直接在表达式中使用：\`result = ${symbol.name}\`` },
              { value: `作为函数参数：\`function(${symbol.name})\`` },
              { value: `修改值：\`${symbol.name} = new_value\`` },
              { value: '' },
              { value: '_💡 提示：Python 变量是动态类型，可以随时改变类型_' }
            ]
          }

          console.log('✅ 显示悬停提示:', symbol.name, symbol.type)

          return {
            contents,
            range: new monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              word.endColumn
            )
          }
        }

        // 检查是否是 Python 内置函数
        const builtIns: { [key: string]: string } = {
          'print': '内置函数\n\nprint(*objects, sep=" ", end="\\n", file=sys.stdout, flush=False)\n\n打印输出到控制台',
          'len': '内置函数\n\nlen(s)\n\n返回对象的长度（元素个数）',
          'range': '内置函数\n\nrange(stop)\nrange(start, stop[, step])\n\n生成一个数字序列',
          'str': '内置类型\n\nstr(object="")\n\n将对象转换为字符串',
          'int': '内置类型\n\nint(x=0)\nint(x, base=10)\n\n将对象转换为整数',
          'float': '内置类型\n\nfloat(x=0.0)\n\n将对象转换为浮点数',
          'list': '内置类型\n\nlist(iterable=[])\n\n创建一个列表',
          'dict': '内置类型\n\ndict(**kwargs)\n\n创建一个字典',
          'tuple': '内置类型\n\ntuple(iterable=())\n\n创建一个元组',
          'set': '内置类型\n\nset(iterable=set())\n\n创建一个集合',
          'sum': '内置函数\n\nsum(iterable, start=0)\n\n对序列中的元素求和',
          'max': '内置函数\n\nmax(iterable, *[, key, default])\n\n返回最大值',
          'min': '内置函数\n\nmin(iterable, *[, key, default])\n\n返回最小值',
          'abs': '内置函数\n\nabs(x)\n\n返回数字的绝对值',
          'input': '内置函数\n\ninput(prompt="")\n\n从标准输入读取一行',
          'open': '内置函数\n\nopen(file, mode="r", ...)\n\n打开文件并返回文件对象',
          'type': '内置函数\n\ntype(object)\n\n返回对象的类型',
          'isinstance': '内置函数\n\nisinstance(object, classinfo)\n\n检查对象是否是指定类型的实例',
          'enumerate': '内置函数\n\nenumerate(iterable, start=0)\n\n返回枚举对象',
          'zip': '内置函数\n\nzip(*iterables)\n\n将多个可迭代对象打包成元组',
          'map': '内置函数\n\nmap(function, iterable, ...)\n\n对序列中的每个元素应用函数',
          'filter': '内置函数\n\nfilter(function, iterable)\n\n过滤序列中的元素'
        }

        if (builtIns[hoveredWord]) {
          console.log('✅ 显示内置函数提示:', hoveredWord)
          const parts = builtIns[hoveredWord].split('\n\n')
          const typeInfo = parts[0]  // "内置函数" 或 "内置类型"
          const signature = parts[1]  // 函数签名
          const description = parts[2]  // 说明文字
          
          return {
            contents: [
              { value: `**🐍 Python ${typeInfo}**` },
              { value: `\`\`\`python\n${signature}\n\`\`\`` },
              { value: '---' },
              { value: '**说明：**' },
              { value: description },
              { value: '' },
              { value: '_📚 这是 Python 的内置功能，无需导入即可使用_' }
            ]
          }
        }

        console.log('⚠️ 未找到悬停信息')
        return null
      }
    })

    // ⌨️ 功能6：快捷键 Ctrl+Enter 运行代码
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRunCode()
    })

    // ⌨️ 快捷键 Ctrl+Shift+F 格式化代码
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      formatCodeLocal()
    })

    // ⌨️ 快捷键 Ctrl+S 保存（阻止浏览器默认行为）
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      // 手动触发保存
      const currentCode = editor.getValue()
      localStorage.setItem('monaco-editor-code', currentCode)
      setOutput('💾 代码已保存到浏览器本地存储\n\n刷新页面后代码会自动恢复。')
    })

    // 保存 provider 以便后续清理
    return () => {
      completionProvider.dispose()
      hoverProvider.dispose()
    }
  }

  // Attach auto-save hook
  useAutoSave(code, output, { autoComplete: enableAutoComplete, syntaxCheck: enableSyntaxCheck, semanticHighlight: enableSemanticHighlight })

  // Sync flag ref
  useEffect(() => { autoCompleteEnabledRef.current = enableAutoComplete }, [enableAutoComplete])

  // Use code intel hook
  useCodeIntel({
    code,
    isReady,
    flags: { enableAutoComplete, enableSyntaxCheck, enableSemanticHighlight },
    analyzeCodeWorker,
    syntaxCheckWorker,
    monacoRef,
    editorRef,
    userSymbolsRef,
    decorationsRef
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1e1e1e', color: '#d4d4d4' }}>
      <Header
        isReady={isReady}
        loadingStatus={loadingStatus}
        code={code}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        onFormat={formatCodeLocal}
        onRun={handleRunCode}
        isRunning={isRunning}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ flex: 1 }}>
            <EditorPane code={code} onChange={(v) => setCode(v)} onMount={handleEditorDidMount} enableAutoComplete={enableAutoComplete} />
          </div>
          <OutputPanel output={output} onClear={() => setOutput('')} />
        </div>
        <Sidebar
          showSettings={showSettings}
          code={code}
          selectedCode={selectedCode}
          enableAutoComplete={enableAutoComplete}
          enableSyntaxCheck={enableSyntaxCheck}
          enableSemanticHighlight={enableSemanticHighlight}
          setEnableAutoComplete={setEnableAutoComplete}
          setEnableSyntaxCheck={setEnableSyntaxCheck}
          setEnableSemanticHighlight={setEnableSemanticHighlight}
        />
      </div>
      {/* 状态栏 - 显示 Python 版本及加载状态 */}
      <StatusBar isReady={isReady} status={{ message: isReady ? 'Python 3.11 | Monaco Editor' : loadingStatus, type: isReady ? 'success' : 'loading' }} />
    </div>
  )
}

export default App