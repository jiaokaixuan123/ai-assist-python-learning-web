/**
 * 智能助教组件（悬浮可拖动版）
 * - 按钮可拖动，面板随按钮位置显示
 * - 流式输出 + Markdown 渲染
 * - 多会话管理（复用 useChatSessions）
 * - 快捷操作：解释代码 / 优化代码 / 错误诊断
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import { getModelClient } from '../../services/modelClient'
import { knowledgeApi } from '../../api'
import { useChatSessions, ChatMessage } from '../../hooks/useChatSessions'
import styles from './AiTutor.module.css'

interface AiTutorProps {
  code?: string    // 当前编辑器代码
  error?: string   // 当前错误信息
  context?: string // 当前学习上下文（课程/练习标题）
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function relativeTime(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60000)
  if (min < 1)  return '刚刚'
  if (min < 60) return `${min}m前`
  const h = Math.floor(min / 60)
  if (h < 24)   return `${h}h前`
  const d = Math.floor(h / 24)
  return d === 1 ? '昨天' : `${d}天前`
}

// 拖动时位移超过此阈值才判定为拖动（避免误触发点击）
const DRAG_THRESHOLD = 5

export default function AiTutor({ code, error, context }: AiTutorProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [useKnowledge, setUseKnowledge] = useState(false)
  const [showSessions, setShowSessions] = useState(false)

  // 悬浮按钮位置（right / bottom，CSS fixed 坐标）
  const [pos, setPos] = useState({ right: 32, bottom: 32 })

  const fabRef        = useRef<HTMLButtonElement>(null)
  const listRef       = useRef<HTMLDivElement>(null)
  const sessionBarRef = useRef<HTMLDivElement>(null)
  const dragState     = useRef<{
    dragging: boolean
    startX: number
    startY: number
    startRight: number
    startBottom: number
    moved: boolean
  } | null>(null)

  const {
    sessions,
    activeSession,
    activeId,
    createSession,
    deleteSession,
    switchSession,
    updateMessages,
  } = useChatSessions()

  const messages = activeSession?.messages ?? []
  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)

  // 消息更新时滚动到底部
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, streaming])

  // 点击会话栏外部收起下拉
  useEffect(() => {
    if (!showSessions) return
    const handler = (e: MouseEvent) => {
      if (sessionBarRef.current && !sessionBarRef.current.contains(e.target as Node)) {
        setShowSessions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSessions])

  // ── 拖动逻辑 ──
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startRight: pos.right,
      startBottom: pos.bottom,
      moved: false,
    }
  }, [pos])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const ds = dragState.current
    if (!ds?.dragging) return
    const dx = e.clientX - ds.startX
    const dy = e.clientY - ds.startY
    if (!ds.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) ds.moved = true
    if (!ds.moved) return

    const newRight  = Math.max(8, Math.min(window.innerWidth  - 60, ds.startRight  - dx))
    const newBottom = Math.max(8, Math.min(window.innerHeight - 60, ds.startBottom - dy))
    setPos({ right: newRight, bottom: newBottom })
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const ds = dragState.current
    if (!ds) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    const wasMoved = ds.moved
    dragState.current = null
    if (!wasMoved) {
      setOpen(v => !v)
    }
  }, [])

  // ── 流式问答 ──
  const systemPrompt = () => {
    const levelHint = context ? `当前学习内容：「${context}」。` : ''
    return `你是一个专业的 Python 编程助教，风格简洁、友好、实用。${levelHint}
教学原则：
- 优先引用已上传教材中的内容和例子，并注明书名
- 根据问题复杂度调整解释深度：初学者多举例子，进阶者讲底层原理
- 代码示例必须可运行，关键行加注释
- 回答要简洁准确，适当给出代码示例`
  }

  const buildPrompt = async (userInput: string): Promise<string> => {
    let prompt = userInput
    if (useKnowledge) {
      try {
        const res = await knowledgeApi.search(userInput, 3)
        const docs = res.data.results as { content: string; source: string }[]
        if (docs.length > 0) {
          const ctx = docs.map(d => `【${d.source}】\n${d.content.slice(0, 400)}`).join('\n\n')
          prompt = `请参考以下教材内容回答（优先引用书中原话并注明来源）：\n\n${ctx}\n\n问题：${prompt}`
        }
      } catch {
        // 知识库不可用时忽略
      }
    }
    return prompt
  }

  const streamAsk = async (content: string) => {
    if (!content.trim() || streaming) return
    setChatError(null)
    setStreaming(true)

    const builtPrompt = await buildPrompt(content)
    const userMsg: ChatMessage = { role: 'user', content, id: uid() }
    const assistantId = uid()
    const placeholder: ChatMessage = { role: 'assistant', content: '', id: assistantId, model: '' }

    const base = [...messages, userMsg]
    updateMessages([...base, placeholder])

    let acc = ''
    try {
      const client = getModelClient()
      const contextHistory = messages.slice(-10)
      const resp = await client.streamChat({
        messages: [
          { role: 'system', content: systemPrompt() },
          ...contextHistory.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: builtPrompt },
        ],
        temperature: 0.5,
        maxTokens: 800,
      }, (delta) => {
        acc += delta
        updateMessages([...base, { role: 'assistant', content: acc, id: assistantId, model: 'stream' }])
      })
      updateMessages([...base, { role: 'assistant', content: acc, id: assistantId, model: resp.model || '' }])
    } catch (e: any) {
      setChatError(e.message || '请求失败')
    } finally {
      setStreaming(false)
    }
  }

  const handleSend = () => {
    if (!input.trim() || streaming) return
    streamAsk(input.trim())
    setInput('')
  }

  const handleQuickAsk = (type: 'explain' | 'optimize' | 'diagnose') => {
    if (streaming) return
    if (type === 'explain') {
      if (!code?.trim()) { setChatError('当前没有代码可解释'); return }
      streamAsk(`请解释以下代码：\n\n\`\`\`python\n${code}\n\`\`\``)
    } else if (type === 'optimize') {
      if (!code?.trim()) { setChatError('当前没有代码可优化'); return }
      streamAsk(`请优化以下代码并说明改进点：\n\n\`\`\`python\n${code}\n\`\`\``)
    } else if (type === 'diagnose') {
      if (!error && !code) { setChatError('没有错误信息或代码可诊断'); return }
      const parts: string[] = []
      if (error) parts.push(`错误信息：\n\`\`\`\n${error}\n\`\`\``)
      if (code)  parts.push(`相关代码：\n\`\`\`python\n${code}\n\`\`\``)
      streamAsk(`请分析以下错误并给出修复方案：\n\n${parts.join('\n\n')}`)
    }
  }

  const handleNewSession = () => {
    if (streaming) return
    createSession()
    setShowSessions(false)
    setChatError(null)
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteSession(id)
    setShowSessions(false)
  }

  const handleSwitch = (id: string) => {
    switchSession(id)
    setShowSessions(false)
    setChatError(null)
  }

  // 面板位置：紧贴按钮上方，同侧对齐
  const FAB_SIZE = 52
  const PANEL_W  = 380
  const PANEL_H  = 560
  const GAP       = 12

  // 面板的 right 与按钮一致（右边对齐），bottom 在按钮顶部上方
  const panelRight  = pos.right - (PANEL_W - FAB_SIZE) / 2
  const panelBottom = pos.bottom + FAB_SIZE + GAP

  // 防止面板超出屏幕左侧
  const clampedPanelRight = Math.min(panelRight, window.innerWidth - PANEL_W - 8)

  return (
    <>
      {/* 悬浮按钮（可拖动） */}
      <button
        ref={fabRef}
        type="button"
        className={styles.fab}
        // dynamic drag position — CSS variables are the only way to pass runtime coords
        // eslint-disable-next-line react/forbid-component-props
        style={
          {
            '--fab-right':  `${pos.right}px`,
            '--fab-bottom': `${pos.bottom}px`,
          } as React.CSSProperties
        }
        title="AI 助教（可拖动）"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* 对话面板 */}
      {open && (
        <div
          className={styles.panel}
          // dynamic panel position derived from drag state
          // eslint-disable-next-line react/forbid-component-props
          style={
            {
              '--panel-right':  `${Math.max(8, clampedPanelRight)}px`,
              '--panel-bottom': `${Math.min(window.innerHeight - PANEL_H - 8, Math.max(8, panelBottom))}px`,
            } as React.CSSProperties
          }
        >
          {/* 头部 */}
          <div className={styles.header}>
            <span className={styles.headerTitle}>🤖 AI 助教</span>
            <label className={styles.knowledgeToggle}>
              <input
                type="checkbox"
                checked={useKnowledge}
                onChange={e => setUseKnowledge(e.target.checked)}
              />
              引用知识库
            </label>
          </div>

          {/* 会话栏 */}
          <div ref={sessionBarRef} className={styles.sessionBar}>
            <div className={`${styles.sessionTitle} ${showSessions ? styles.sessionTitleOpen : ''}`}>
              <button
                type="button"
                onClick={handleNewSession}
                disabled={streaming}
                title="新建会话"
                className={styles.newSessionBtn}
              >+</button>
              <span
                onClick={() => setShowSessions(v => !v)}
                title={activeSession?.title}
                className={styles.sessionName}
              >
                {activeSession?.title || '新会话'}
              </span>
              {sessions.length > 1 && (
                <span className={styles.sessionCount}>
                  {sortedSessions.findIndex(s => s.id === activeId) + 1}/{sessions.length}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowSessions(v => !v)}
                className={styles.sessionToggleBtn}
                title="会话列表"
              >{showSessions ? '▲' : '▼'}</button>
            </div>

            {showSessions && (
              <div className={styles.sessionList}>
                {sortedSessions.map(s => (
                  <div
                    key={s.id}
                    className={`${styles.sessionItem} ${s.id === activeId ? styles.sessionItemActive : ''}`}
                    onClick={() => handleSwitch(s.id)}
                  >
                    <span className={styles.sessionItemName}>{s.title}</span>
                    <span className={styles.sessionItemTime}>{relativeTime(s.updatedAt)}</span>
                    <button
                      type="button"
                      onClick={e => handleDelete(e, s.id)}
                      className={styles.sessionDeleteBtn}
                      title="删除"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 快捷操作 */}
          <div className={styles.quickBar}>
            <button type="button" className={styles.quickBarBtn} onClick={() => handleQuickAsk('explain')}  disabled={streaming}>🧐 解释代码</button>
            <button type="button" className={styles.quickBarBtn} onClick={() => handleQuickAsk('optimize')} disabled={streaming}>⚙️ 优化代码</button>
            <button type="button" className={styles.quickBarBtn} onClick={() => handleQuickAsk('diagnose')} disabled={streaming}>🐛 错误诊断</button>
            <button
              type="button"
              className={`${styles.quickBarBtn} ${styles.quickBarBtnDanger}`}
              onClick={() => { if (!streaming) updateMessages([]) }}
              disabled={streaming}
            >🗑️ 清空</button>
          </div>

          {/* 消息列表 */}
          <div ref={listRef} className={styles.messages}>
            {messages.length === 0 && !chatError && (
              <div className={styles.empty}>
                <p>👋 有什么 Python 问题？</p>
                <p className={styles.emptyHint}>可直接提问，或点击上方快捷操作</p>
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} className={`${styles.msg} ${m.role === 'user' ? styles.msgUser : styles.msgAi}`}>
                {m.role === 'user' ? (
                  <div className={`${styles.bubble} ${styles.bubbleUser}`}>{m.content}</div>
                ) : (
                  <div className={`${styles.bubble} ${styles.bubbleAi} chat-md`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                      {m.content || (streaming ? '▍' : '')}
                    </ReactMarkdown>
                  </div>
                )}
                {m.model && m.role === 'assistant' && m.model !== 'stream' && (
                  <div className={styles.modelTag}>{m.model}</div>
                )}
              </div>
            ))}
            {streaming && <div className={styles.typing}>⌛ 正在生成回复...</div>}
            {chatError && <div className={styles.errorMsg}>错误: {chatError}</div>}
          </div>

          {/* 输入区 */}
          <div className={styles.inputArea}>
            <textarea
              className={styles.inputBox}
              placeholder="输入问题，Enter 发送，Shift+Enter 换行..."
              value={input}
              rows={2}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
            />
            <button
              type="button"
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={streaming || !input.trim()}
            >
              发送
            </button>
          </div>
        </div>
      )}
    </>
  )
}
