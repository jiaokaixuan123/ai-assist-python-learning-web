/**
 * 智能助教组件
 * 支持：实时答疑、代码解释、错误诊断、学习路径推荐
 */
import { useState, useRef, useEffect } from 'react'
import { getModelClient } from '../../services/modelClient'
import { knowledgeApi } from '../../api'
import styles from './AiTutor.module.css'

type Mode = 'qa' | 'explain' | 'diagnose' | 'path'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AiTutorProps {
  code?: string          // 当前编辑器代码
  error?: string         // 当前错误信息
  context?: string       // 当前学习上下文（课程/练习标题）
}

const MODE_CONFIG: Record<Mode, { label: string; icon: string; placeholder: string }> = {
  qa:       { label: '实时答疑', icon: '💬', placeholder: '有什么 Python 问题？' },
  explain:  { label: '代码解释', icon: '🔍', placeholder: '粘贴代码或直接问「解释当前代码」' },
  diagnose: { label: '错误诊断', icon: '🐛', placeholder: '描述错误，或点击「诊断当前错误」' },
  path:     { label: '学习路径', icon: '🗺️', placeholder: '告诉我你的目标，我来推荐学习路径' },
}

export default function AiTutor({ code, error, context }: AiTutorProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('qa')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [useKnowledge, setUseKnowledge] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const systemPrompt = () => {
    const base = `你是一个专业的 Python 编程助教，风格简洁、友好、实用。${context ? `当前学习内容：${context}。` : ''}`
    switch (mode) {
      case 'explain':
        return base + '请用清晰的语言解释代码逻辑，指出关键点，适当给出改进建议。'
      case 'diagnose':
        return base + '请分析错误原因，给出具体的修复方案，并解释为什么会出现这个错误。'
      case 'path':
        return base + '根据用户的目标和当前水平，推荐合理的 Python 学习路径，列出具体的学习步骤和资源。'
      default:
        return base + '回答要简洁准确，适当给出代码示例。'
    }
  }

  const buildPrompt = async (userInput: string): Promise<string> => {
    let prompt = userInput

    // 注入当前代码上下文
    if (mode === 'explain' && code && !userInput.includes('```')) {
      prompt = `请解释以下代码：\n\`\`\`python\n${code}\n\`\`\`\n\n${userInput !== '解释当前代码' ? userInput : ''}`
    }

    if (mode === 'diagnose' && error) {
      prompt = `错误信息：\n\`\`\`\n${error}\n\`\`\`\n${code ? `\n相关代码：\n\`\`\`python\n${code}\n\`\`\`` : ''}\n\n${userInput}`
    }

    // 知识库检索增强
    if (useKnowledge) {
      try {
        const res = await knowledgeApi.search(userInput, 2)
        const docs = res.data.results as { content: string; metadata: { lesson_title: string } }[]
        if (docs.length > 0) {
          const ctx = docs.map(d => `【${d.metadata.lesson_title}】\n${d.content.slice(0, 300)}`).join('\n\n')
          prompt = `参考以下课程内容回答：\n\n${ctx}\n\n问题：${prompt}`
        }
      } catch {
        // 知识库不可用时忽略
      }
    }

    return prompt
  }

  const handleSend = async (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const prompt = await buildPrompt(text)

    // 构建历史消息
    const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }))

    let acc = ''
    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMsg])

    try {
      await getModelClient().streamChat(
        {
          messages: [
            { role: 'system', content: systemPrompt() },
            ...history,
            { role: 'user', content: prompt },
          ],
          temperature: 0.5,
          maxTokens: 800,
        },
        delta => {
          acc += delta
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: acc }
            return updated
          })
        }
      )
    } catch (e: any) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: `❌ ${e.message}` }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }

  const quickActions: Record<Mode, { label: string; prompt: string }[]> = {
    qa: [
      { label: '什么是列表推导式？', prompt: '什么是列表推导式？给个例子' },
      { label: 'for vs while 区别', prompt: 'Python 中 for 循环和 while 循环有什么区别？' },
    ],
    explain: [
      { label: '解释当前代码', prompt: '解释当前代码' },
      { label: '有什么改进建议？', prompt: '这段代码有什么可以改进的地方？' },
    ],
    diagnose: [
      { label: '诊断当前错误', prompt: '帮我分析这个错误' },
      { label: '如何调试？', prompt: '如何调试这段代码？' },
    ],
    path: [
      { label: '我是初学者', prompt: '我是 Python 初学者，想学数据分析，推荐学习路径' },
      { label: '我想做 Web 开发', prompt: '我已掌握 Python 基础，想做 Web 开发，下一步学什么？' },
    ],
  }

  return (
    <>
      {/* 悬浮按钮 */}
      <button className={styles.fab} onClick={() => setOpen(v => !v)} title="AI 助教">
        {open ? '✕' : '🤖'}
      </button>

      {/* 面板 */}
      {open && (
        <div className={styles.panel}>
          {/* 头部 */}
          <div className={styles.header}>
            <span className={styles.headerTitle}>🤖 AI 助教</span>
            <label className={styles.knowledgeToggle}>
              <input
                type="checkbox"
                checked={useKnowledge}
                onChange={e => setUseKnowledge(e.target.checked)}
              />
              引用课程知识库
            </label>
          </div>

          {/* 模式切换 */}
          <div className={styles.modes}>
            {(Object.keys(MODE_CONFIG) as Mode[]).map(m => (
              <button
                key={m}
                className={`${styles.modeBtn} ${mode === m ? styles.modeActive : ''}`}
                onClick={() => { setMode(m); setMessages([]) }}
              >
                {MODE_CONFIG[m].icon} {MODE_CONFIG[m].label}
              </button>
            ))}
          </div>

          {/* 消息区 */}
          <div className={styles.messages}>
            {messages.length === 0 && (
              <div className={styles.empty}>
                <p>{MODE_CONFIG[mode].icon} {MODE_CONFIG[mode].label}</p>
                <div className={styles.quickActions}>
                  {quickActions[mode].map(a => (
                    <button key={a.label} className={styles.quickBtn} onClick={() => handleSend(a.prompt)}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`${styles.msg} ${m.role === 'user' ? styles.msgUser : styles.msgAi}`}>
                <pre className={styles.msgContent}>{m.content}</pre>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.content === '' && (
              <div className={styles.typing}>思考中...</div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 输入区 */}
          <div className={styles.inputArea}>
            <textarea
              className={styles.inputBox}
              placeholder={MODE_CONFIG[mode].placeholder}
              value={input}
              rows={2}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
            />
            <button className={styles.sendBtn} onClick={() => handleSend()} disabled={loading || !input.trim()}>
              发送
            </button>
          </div>
        </div>
      )}
    </>
  )
}
