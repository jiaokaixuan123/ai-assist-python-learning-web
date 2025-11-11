import { useRef } from 'react'
import Editor, { OnMount, loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

// 配置 @monaco-editor/react 使用本地 Monaco 文件而不是 CDN
loader.config({ monaco })

interface MonacoEditorProps {
  value: string // 编辑器内容
  onChange: (value: string) => void // 内容变化时的回调
  language?: string // 编程语言
  readOnly?: boolean // 是否只读
}

// MonacoEditor 组件实现
function MonacoEditor({ value, onChange, language = 'python', readOnly = false }: MonacoEditorProps) {
  const editorRef = useRef<any>(null)

  // 在组件加载时就注入全局样式，确保编辑器背景始终是深色
  if (!document.getElementById('monaco-dark-fix')) {
    const style = document.createElement('style')
    style.id = 'monaco-dark-fix'
    style.textContent = `
      .monaco-editor,
      .monaco-editor .margin,
      .monaco-editor-background,
      .monaco-editor .inputarea.ime-input,
      .monaco-editor .view-lines,
      .monaco-editor .view-line,
      .monaco-editor .overflow-guard,
      .monaco-editor .lines-content,
      .monaco-editor .monaco-scrollable-element {
        background-color: #1e1e1e !important;
      }
    `
    document.head.appendChild(style)
  }

  // 编辑器挂载时的处理函数
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    // 立即设置深色主题 - 使用内置的 vs-dark
    monaco.editor.setTheme('vs-dark')
  }

  // 组件渲染
  return (
    <div style={{ height: '100%', width: '100%', background: '#1e1e1e' }}>
      <Editor
        height="100%"
        language={language}
        value={value}
        onChange={(v) => onChange(v || '')}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        loading={<div style={{ color: '#d4d4d4', padding: '20px' }}>Loading editor...</div>}
        options={{
          readOnly,
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: 'on',
          automaticLayout: true,
          tabSize: 4,
          wordWrap: 'on'
        }}
      />
    </div>
  )
}

export default MonacoEditor
