import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

// 配置 @monaco-editor/react 使用本地 Monaco 文件而不是 CDN
loader.config({ monaco })

interface EditorPaneProps {
  code: string
  onChange: (code: string) => void
  onMount: (editor: monaco.editor.IStandaloneCodeEditor, m: typeof monaco) => void
  enableAutoComplete: boolean
}

export function EditorPane({ code, onChange, onMount, enableAutoComplete }: EditorPaneProps) {
  return (
    <div style={{ height: '100%', width: '100%', background: '#1e1e1e' }}>
      <Editor
        height="100%"
        language="python"
        value={code}
        onChange={(v) => onChange(v || '')}
        onMount={(e, m) => onMount(e, m)}
        theme="vs-dark"
        options={{
        minimap: { enabled: true },
        fontSize: 14,
        lineNumbers: 'on',
        automaticLayout: true,
        tabSize: 4,
        wordWrap: 'on',
        folding: true,
        foldingStrategy: 'indentation',
        matchBrackets: 'always',
        bracketPairColorization: { enabled: true },
        suggestOnTriggerCharacters: true,
        quickSuggestions: enableAutoComplete ? { other: true, comments: false, strings: false } : false,
        wordBasedSuggestions: 'off',
        acceptSuggestionOnEnter: 'on',
        tabCompletion: 'on',
        snippetSuggestions: 'top',
        suggest: { showWords: false, showFunctions: true, showVariables: true, showClasses: true }
      }}
    />
    </div>
  )
}

export default EditorPane
