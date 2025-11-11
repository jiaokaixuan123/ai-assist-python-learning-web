import { useEffect, useRef } from 'react'
import type * as monaco from 'monaco-editor'

interface Flags {
  enableAutoComplete: boolean
  enableSyntaxCheck: boolean
  enableSemanticHighlight: boolean
}

interface UseCodeIntelParams {
  code: string
  isReady: boolean
  flags: Flags
  analyzeCodeWorker: (code: string) => Promise<{ result?: string; error?: string }>
  syntaxCheckWorker: (code: string) => Promise<{ result?: string; error?: string }>
  monacoRef: React.MutableRefObject<typeof monaco | null>
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>
  userSymbolsRef: React.MutableRefObject<Array<{name: string, type: string, detail?: string}>>
  decorationsRef: React.MutableRefObject<string[]>
}

export function useCodeIntel({ code, isReady, flags, analyzeCodeWorker, syntaxCheckWorker, monacoRef, editorRef, userSymbolsRef, decorationsRef }: UseCodeIntelParams) {
  const timerRef = useRef<any>(null)

  const applySemanticHighlight = (symbols: Array<{name: string, type: string, detail?: string}>) => {
    if (!editorRef.current || !flags.enableSemanticHighlight) return
    const model = editorRef.current.getModel(); if (!model) return
    const decorations: any[] = []
    const lines = model.getValue().split('\n')
    symbols.forEach(symbol => {
      lines.forEach((line, i) => {
        const regex = new RegExp(`\\b${symbol.name}\\b`, 'g'); let match
        while ((match = regex.exec(line)) !== null) {
          decorations.push({
            range: { startLineNumber: i + 1, startColumn: match.index + 1, endLineNumber: i + 1, endColumn: match.index + 1 + symbol.name.length },
            options: { inlineClassName: symbol.type === 'function' ? 'user-defined-function' : symbol.type === 'class' ? 'user-defined-class' : 'user-defined-variable' }
          })
        }
      })
    })
    decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, decorations)
  }

  const analyzeCode = async (text: string) => {
    const { result, error } = await analyzeCodeWorker(text)
    if (error || !result) { userSymbolsRef.current = []; return }
    try {
      const parsed = JSON.parse(result)
      userSymbolsRef.current = parsed
      if (flags.enableSemanticHighlight) applySemanticHighlight(parsed)
    } catch { userSymbolsRef.current = [] }
  }

  const checkSyntax = async (text: string) => {
    if (!monacoRef.current || !editorRef.current) return
    const model = editorRef.current.getModel(); if (!model) return
    if (!flags.enableSyntaxCheck) { monacoRef.current.editor.setModelMarkers(model, 'python', []); return }
    const { result, error } = await syntaxCheckWorker(text)
    if (error || !result) { return }
    try {
      const parsed = JSON.parse(result)
      if (parsed.ok) { monacoRef.current.editor.setModelMarkers(model, 'python', []); return }
      if (parsed.line && parsed.msg) {
        const lineNumber = Number(parsed.line)
        monacoRef.current.editor.setModelMarkers(model, 'python', [{
          startLineNumber: lineNumber, startColumn: 1,
          endLineNumber: lineNumber, endColumn: model.getLineMaxColumn(lineNumber),
          message: `语法错误: ${parsed.msg}`,
          severity: monacoRef.current.MarkerSeverity.Error
        }])
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!isReady || !code) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (flags.enableAutoComplete || flags.enableSemanticHighlight) analyzeCode(code)
      if (flags.enableSyntaxCheck) checkSyntax(code)
    }, 800)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [code, isReady, flags.enableAutoComplete, flags.enableSemanticHighlight, flags.enableSyntaxCheck])
}
