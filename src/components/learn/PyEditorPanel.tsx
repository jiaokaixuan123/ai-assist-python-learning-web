/**
 * PyEditorPanel —— 课程学习页右侧的轻量编辑器面板
 * 包含：代码编辑 + 本地执行可视化（基于 Pyodide sys.settrace）
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { getModelClient } from '../../services/modelClient'
import styles from './PyEditorPanel.module.css'

// ─── Pyodide Worker ───────────────────────────────────────
interface PyWorkerMessage {
  id: number; type: string; result?: string; error?: string
}
function usePyWorker() {
  const workerRef = useRef<Worker | null>(null)
  const reqIdRef = useRef(0)
  const pendingRef = useRef<Map<number, (r: { result?: string; error?: string }) => void>>(new Map())
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const worker = new Worker(new URL('../../workers/pyodideWorker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = (e: MessageEvent<PyWorkerMessage>) => {
      const { id, type, result, error } = e.data
      if (type === 'ready') { setIsReady(true); return }
      const cb = pendingRef.current.get(id)
      if (cb) { cb({ result, error }); pendingRef.current.delete(id) }
    }
    worker.onerror = () => setIsReady(false)
    worker.postMessage({ id: -1, type: 'ping' })
    return () => worker.terminate()
  }, [])

  const send = (type: string, code: string) => new Promise<{ result?: string; error?: string }>(resolve => {
    if (!workerRef.current) { resolve({ error: 'Worker 未就绪' }); return }
    const id = reqIdRef.current++
    pendingRef.current.set(id, resolve)
    workerRef.current.postMessage({ id, type, code })
    setTimeout(() => {
      if (pendingRef.current.has(id)) { resolve({ error: '执行超时' }); pendingRef.current.delete(id) }
    }, 30000)
  })

  return { isReady, run: (c: string) => send('run', c), trace: (c: string) => send('trace', c) }
}

// ─── 类型 ─────────────────────────────────────────────────
interface TraceStep {
  line: number
  vars: Record<string, any>
  output: string
}

// ─── 代码可视化子组件 ─────────────────────────────────────
function CodeViz({ code, steps, cur, onCur }: {
  code: string
  steps: TraceStep[]
  cur: number
  onCur: (n: number) => void
}) {
  const lines = code.split('\n')
  const step = steps[cur] ?? { line: -1, vars: {}, output: '' }
  const max = steps.length - 1

  // 在当前 output 中找出本步新增的输出（相对上一步）
  const prevOutput = cur > 0 ? steps[cur - 1].output : ''
  const newOutput = step.output.slice(prevOutput.length)

  return (
    <div className={styles.viz}>
      {/* 顶部控制栏 */}
      <div className={styles.vizBar}>
        <span className={styles.vizTitle}>📊 代码执行可视化</span>
        <div className={styles.vizControls}>
          <button type="button" onClick={() => onCur(0)} disabled={cur === 0} title="跳到开始">⏮</button>
          <button type="button" onClick={() => onCur(Math.max(0, cur - 1))} disabled={cur === 0} title="上一步">◀</button>
          <span className={styles.vizStep}>{cur + 1} / {steps.length}</span>
          <button type="button" onClick={() => onCur(Math.min(max, cur + 1))} disabled={cur === max} title="下一步">▶</button>
          <button type="button" onClick={() => onCur(max)} disabled={cur === max} title="跳到结束">⏭</button>
        </div>
      </div>

      <div className={styles.vizBody}>
        {/* 左：代码行高亮 */}
        <div className={styles.vizCode}>
          <div className={styles.vizCodeLabel}>执行过程</div>
          <div className={styles.vizCodeLines}>
            {lines.map((line, i) => {
              const isActive = i === step.line
              const isPast = steps.slice(0, cur).some(s => s.line === i)
              return (
                <div key={i} className={`${styles.vizLine}${isActive ? ' ' + styles.vizLineActive : isPast ? ' ' + styles.vizLinePast : ''}`}>
                  <span className={styles.vizLineNo}>{i + 1}</span>
                  {isActive && <span className={styles.vizArrow}>▶</span>}
                  <span className={styles.vizLineCode}>{line || ' '}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 右：变量面板 */}
        <div className={styles.vizVars}>
          <div className={styles.vizCodeLabel}>变量状态</div>
          {Object.keys(step.vars).length === 0 ? (
            <div className={styles.vizEmpty}>暂无变量</div>
          ) : (
            <div className={styles.vizVarList}>
              {Object.entries(step.vars).map(([k, v]) => (
                <div key={k} className={styles.vizVarRow}>
                  <span className={styles.vizVarName}>{k}</span>
                  <span className={styles.vizVarEq}>=</span>
                  <span className={styles.vizVarVal}>{JSON.stringify(v)}</span>
                </div>
              ))}
            </div>
          )}

          {/* 本步输出 */}
          {step.output && (
            <div className={styles.vizOutSection}>
              <div className={styles.vizCodeLabel}>累计输出</div>
              <pre className={styles.vizOut}>{step.output}</pre>
              {newOutput && <div className={styles.vizNewOut}>↑ 本步新增：{newOutput}</div>}
            </div>
          )}
        </div>
      </div>

      {/* 进度条 */}
      <div className={styles.vizProgress}>
        <div className={styles.vizProgressFill} style={{ width: `${((cur + 1) / steps.length) * 100}%` }} />
      </div>
    </div>
  )
}

// ─── 主组件 ───────────────────────────────────────────────
interface Props { starterCode?: string }

export default function PyEditorPanel({ starterCode = '' }: Props) {
  const { isReady, run, trace } = usePyWorker()
  const [code, setCode] = useState(starterCode)
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'editor' | 'viz'>('editor')
  const [traceSteps, setTraceSteps] = useState<TraceStep[]>([])
  const [traceCur, setTraceCur] = useState(0)
  const [tracing, setTracing] = useState(false)
  const [traceError, setTraceError] = useState('')
  // 自动播放
  const [playing, setPlaying] = useState(false)
  const playTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { setCode(starterCode); setOutput(''); setViewMode('editor'); setTraceSteps([]) }, [starterCode])

  // ── 运行代码 ──
  const handleRun = async () => {
    if (!isReady) { setOutput('⏳ Python 环境加载中...'); return }
    setRunning(true); setOutput('运行中...')
    const { result, error } = await run(code)
    setOutput(error ? `❌ ${error}` : result ?? '')
    setRunning(false)
  }

  // ── AI 解释 ──
  const handleAIExplain = async () => {
    if (!code.trim()) return
    setAiLoading(true); setOutput('🤖 AI 正在解释...')
    try {
      let acc = ''
      await getModelClient().streamChat(
        { messages: [{ role: 'user', content: `请简要解释以下 Python 代码的作用（中文）：\n\n${code}` }], temperature: 0.4, maxTokens: 500 },
        d => { acc += d; setOutput('🤖 ' + acc) }
      )
    } catch (e: any) { setOutput('❌ AI 失败: ' + e.message) }
    finally { setAiLoading(false) }
  }

  // ── 进入可视化 ──
  const handleTrace = async () => {
    if (!isReady) return
    setTracing(true); setTraceError(''); setTraceSteps([]); setTraceCur(0)
    setViewMode('viz')
    const { result, error } = await trace(code)
    setTracing(false)
    if (error) { setTraceError(error); return }
    try {
      const parsed = JSON.parse(result ?? '{}')
      if (parsed.error) setTraceError(parsed.error)
      const steps: TraceStep[] = parsed.steps ?? []
      if (steps.length === 0) setTraceError('没有可追踪的执行步骤（代码可能没有可执行语句）')
      setTraceSteps(steps)
    } catch { setTraceError('解析执行步骤失败') }
  }

  // ── 自动播放 ──
  const handlePlay = useCallback(() => {
    if (playing) {
      clearInterval(playTimer.current!)
      setPlaying(false)
      return
    }
    if (traceCur >= traceSteps.length - 1) setTraceCur(0)
    setPlaying(true)
    playTimer.current = setInterval(() => {
      setTraceCur(c => {
        if (c >= traceSteps.length - 1) {
          clearInterval(playTimer.current!); setPlaying(false); return c
        }
        return c + 1
      })
    }, 600)
  }, [playing, traceCur, traceSteps.length])

  useEffect(() => () => { if (playTimer.current) clearInterval(playTimer.current) }, [])

  return (
    <div className={styles.panel}>
      {/* ── 工具栏 ── */}
      <div className={styles.toolbar}>
        <span className={styles.label}>{isReady ? '🟢 Python 就绪' : '⏳ 加载中...'}</span>
        <div className={styles.actions}>
          <button type="button" className={styles.btnSecondary} onClick={() => { setCode(starterCode); setOutput('') }}>↺ 重置</button>
          <button type="button" className={styles.btnAi} onClick={handleAIExplain} disabled={aiLoading}>🤖 解释</button>
          <button type="button" className={styles.btnRun} onClick={handleRun} disabled={running || !isReady}>
            {running ? '运行中...' : '▶ 运行'}
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className={styles.tabs}>
        <button type="button" className={`${styles.tab} ${viewMode === 'editor' ? styles.tabActive : ''}`}
          onClick={() => setViewMode('editor')}>代码编辑</button>
        <button type="button" className={`${styles.tab} ${viewMode === 'viz' ? styles.tabActive : ''}`}
          onClick={handleTrace} disabled={!isReady || tracing}>
          {tracing ? '⏳ 分析中...' : '📊 执行可视化'}
        </button>
        {viewMode === 'viz' && traceSteps.length > 0 && (
          <button type="button" className={`${styles.tab} ${styles.playBtn}`} onClick={handlePlay}>
            {playing ? '⏸ 暂停' : '▶ 自动播放'}
          </button>
        )}
      </div>

      {/* ── 编辑器模式 ── */}
      {viewMode === 'editor' && (
        <>
          <div className={styles.editorWrap}>
            <Editor height="100%" defaultLanguage="python" value={code}
              onChange={v => setCode(v ?? '')} theme="vs-dark"
              options={{ fontSize: 13, minimap: { enabled: false }, tabSize: 4, wordWrap: 'on', scrollBeyondLastLine: false, padding: { top: 8 } }}
            />
          </div>
          <div className={styles.outputArea}>
            <div className={styles.outputHeader}>
              <span>输出</span>
              <button type="button" className={styles.clearBtn} onClick={() => setOutput('')}>清空</button>
            </div>
            <pre className={styles.outputPre}>{output || '点击「运行」执行代码...'}</pre>
          </div>
        </>
      )}

      {/* ── 可视化模式 ── */}
      {viewMode === 'viz' && (
        <div className={styles.vizWrapper}>
          {tracing && <div className={styles.vizLoading}>⏳ 正在分析执行步骤...</div>}
          {traceError && (
            <div className={styles.vizError}>
              <div>❌ {traceError}</div>
              <button type="button" onClick={() => setViewMode('editor')}>← 返回编辑</button>
            </div>
          )}
          {!tracing && !traceError && traceSteps.length > 0 && (
            <CodeViz code={code} steps={traceSteps} cur={traceCur} onCur={setTraceCur} />
          )}
        </div>
      )}
    </div>
  )
}
