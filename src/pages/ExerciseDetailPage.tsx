/**
 * 题目详情页：左侧 Markdown 题目 + 右侧 Monaco 编辑器 + 自动判题
 * 判题策略：用 Pyodide 在浏览器端执行用户代码并对比期望输出（无需服务端沙箱）
 */
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import Editor from '@monaco-editor/react'
import { exerciseApi } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { getModelClient } from '../services/modelClient'
import NavBar from '../components/learn/NavBar'
import styles from './ExerciseDetailPage.module.css'

interface TestCase { input: string; expected_output: string }
interface Exercise {
  id: string
  title: string
  description: string
  difficulty: string
  tags: string[]
  starter_code: string
  hint?: string
  test_cases: TestCase[]
}

interface CaseResult { input: string; expected: string; actual: string; passed: boolean }

/* ─── Pyodide Worker hook（与 PyEditorPanel 同款轻量版） ─── */
interface PyMsg { id: number; type: string; result?: string; error?: string }
function usePyWorker() {
  const wRef = useRef<Worker | null>(null)
  const reqRef = useRef(0)
  const pending = useRef<Map<number, (r: { result?: string; error?: string }) => void>>(new Map())
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const w = new Worker(new URL('../workers/pyodideWorker.ts', import.meta.url), { type: 'module' })
    wRef.current = w
    w.onmessage = (e: MessageEvent<PyMsg>) => {
      const { id, type, result, error } = e.data
      if (type === 'ready') { setReady(true); return }
      const cb = pending.current.get(id)
      if (cb) { cb({ result, error }); pending.current.delete(id) }
    }
    w.onerror = () => setReady(false)
    w.postMessage({ id: -1, type: 'ping' })
    return () => w.terminate()
  }, [])
  const run = (code: string) => new Promise<{ result?: string; error?: string }>(resolve => {
    if (!wRef.current) { resolve({ error: 'Worker 未就绪' }); return }
    const id = reqRef.current++
    pending.current.set(id, resolve)
    wRef.current.postMessage({ id, type: 'run', code })
    setTimeout(() => { if (pending.current.has(id)) { resolve({ error: '执行超时' }); pending.current.delete(id) } }, 30000)
  })
  return { ready, run }
}

const DIFF_COLOR: Record<string, string> = { easy: '#3fb950', medium: '#d29922', hard: '#f85149' }
const DIFF_LABEL: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' }

export default function ExerciseDetailPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const { user } = useAuth()
  const { ready, run } = usePyWorker()

  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [code, setCode] = useState('')
  const [results, setResults] = useState<CaseResult[]>([])
  const [judging, setJudging] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [aiOutput, setAiOutput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [allPassed, setAllPassed] = useState(false)

  useEffect(() => {
    if (!exerciseId) return
    exerciseApi.get(exerciseId).then(r => {
      setExercise(r.data)
      setCode(r.data.starter_code ?? '')
    })
  }, [exerciseId])

  /* ── 判题 ── */
  const handleJudge = async () => {
    if (!exercise || !ready) return
    setJudging(true)
    setResults([])
    setAiOutput('')

    const caseResults: CaseResult[] = []
    for (const tc of exercise.test_cases) {
      // 构造：将 stdin 输入通过 sys.stdin 模拟注入
      const wrappedCode = tc.input
        ? `import sys\nsys.stdin = __import__('io').StringIO(${JSON.stringify(tc.input + '\n')})\n${code}`
        : code
      const { result, error } = await run(wrappedCode)
      const actual = (error ?? result ?? '').trim()
      const expected = tc.expected_output.trim()
      caseResults.push({ input: tc.input, expected, actual, passed: actual === expected })
    }

    setResults(caseResults)
    const passed = caseResults.every(r => r.passed)
    setAllPassed(passed)
    setSubmitted(true)
    setJudging(false)

    // 提交记录到后端
    if (user) {
      exerciseApi.submit({
        exercise_id: exercise.id,
        code,
        passed,
        result: passed ? '全部通过' : `${caseResults.filter(r => r.passed).length}/${caseResults.length} 用例通过`,
      }).catch(() => {})
    }
  }

  /* ── AI 提示 ── */
  const handleAIHint = async () => {
    if (!exercise) return
    setAiLoading(true)
    setAiOutput('🤖 AI 正在分析...')
    try {
      let acc = ''
      const failedCases = results.filter(r => !r.passed)
      const prompt = failedCases.length
        ? `我在解以下 Python 题目时，有 ${failedCases.length} 个测试用例未通过：\n\n题目：${exercise.title}\n${exercise.description}\n\n我的代码：\n${code}\n\n未通过的用例（期望输出 vs 实际输出）：\n${failedCases.map(c => `输入: ${c.input || '无'}\n期望: ${c.expected}\n实际: ${c.actual}`).join('\n\n')}\n\n请给我提示思路，不要直接给出完整答案。`
        : `请给以下 Python 题目一个解题思路提示（不要给完整代码）：\n\n${exercise.title}\n${exercise.description}`
      await getModelClient().streamChat(
        { messages: [{ role: 'user', content: prompt }], temperature: 0.5, maxTokens: 600 },
        delta => { acc += delta; setAiOutput('🤖 ' + acc) }
      )
    } catch (e: any) {
      setAiOutput('❌ AI 请求失败: ' + e.message)
    } finally {
      setAiLoading(false)
    }
  }

  if (!exercise) return <div className={styles.loading}>加载中...</div>

  return (
    <div className={styles.page}>
      <NavBar title="练习题" backTo="/exercises" />
      <div className={styles.body}>
        {/* ── 左侧：题目 ── */}
        <div className={styles.leftPane}>
          <div className={styles.problemHeader}>
            <h1 className={styles.problemTitle}>{exercise.title}</h1>
            <div className={styles.meta}>
              <span className={styles.diff} style={{ color: DIFF_COLOR[exercise.difficulty] }}>
                {DIFF_LABEL[exercise.difficulty] ?? exercise.difficulty}
              </span>
              {exercise.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
            </div>
          </div>

          <div className={styles.mdWrap}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {exercise.description}
            </ReactMarkdown>
          </div>

          {/* 测试用例 */}
          {results.length > 0 && (
            <div className={styles.resultsSection}>
              <h3 className={styles.resultsTitle}>
                判题结果：
                {allPassed
                  ? <span className={styles.passed}>✅ 全部通过！</span>
                  : <span className={styles.failed}>{results.filter(r => r.passed).length}/{results.length} 通过</span>
                }
              </h3>
              {results.map((r, i) => (
                <div key={i} className={`${styles.caseCard} ${r.passed ? styles.casePass : styles.caseFail}`}>
                  <div className={styles.caseHead}>
                    <span>{r.passed ? '✓' : '✗'} 用例 {i + 1}</span>
                  </div>
                  {r.input && <div className={styles.caseLine}><b>输入：</b><code>{r.input}</code></div>}
                  <div className={styles.caseLine}><b>期望：</b><code>{r.expected}</code></div>
                  {!r.passed && <div className={styles.caseLine}><b>实际：</b><code>{r.actual}</code></div>}
                </div>
              ))}
            </div>
          )}

          {/* AI 提示输出 */}
          {aiOutput && (
            <div className={styles.aiBox}>
              <pre className={styles.aiPre}>{aiOutput}</pre>
            </div>
          )}

          {/* Hint */}
          {exercise.hint && (
            <div className={styles.hintSection}>
              <button className={styles.hintToggle} onClick={() => setShowHint(v => !v)}>
                💡 {showHint ? '隐藏提示' : '查看提示'}
              </button>
              {showHint && <p className={styles.hintText}>{exercise.hint}</p>}
            </div>
          )}
        </div>

        {/* ── 右侧：编辑器 + 操作 ── */}
        <div className={styles.rightPane}>
          <div className={styles.editorToolbar}>
            <span className={styles.envStatus}>{ready ? '🟢 Python 就绪' : '⏳ 加载中...'}</span>
            <div className={styles.editorActions}>
              <button className={styles.btnSecondary} onClick={() => setCode(exercise.starter_code)}>↺ 重置</button>
              <button className={styles.btnAi} onClick={handleAIHint} disabled={aiLoading}>🤖 AI 提示</button>
              <button
                className={styles.btnJudge}
                onClick={handleJudge}
                disabled={judging || !ready}
              >
                {judging ? '判题中...' : '▶ 提交判题'}
              </button>
            </div>
          </div>
          <div className={styles.editorWrap}>
            <Editor
              height="100%"
              defaultLanguage="python"
              value={code}
              onChange={v => setCode(v ?? '')}
              theme="vs-dark"
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                tabSize: 4,
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                padding: { top: 8 },
              }}
            />
          </div>
          {submitted && (
            <div className={`${styles.resultBanner} ${allPassed ? styles.bannerPass : styles.bannerFail}`}>
              {allPassed
                ? '🎉 恭喜！全部测试用例通过！'
                : `还有 ${results.filter(r => !r.passed).length} 个用例未通过，继���加油！`
              }
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
