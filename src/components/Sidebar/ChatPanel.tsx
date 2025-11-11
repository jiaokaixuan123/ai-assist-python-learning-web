import { useState, useEffect, useRef } from 'react'
import { getModelClient } from '../../services/modelClient'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  id: string
  model?: string
}

// ChatPanel 组件属性定义
interface ChatPanelProps {
  code: string
  selectedCode?: string // 新增：当前编辑器选中的代码片段
}

// 简单的 nanoid 替代，避免额外依赖（项目已有 nanoid 可改为导入）
function uid() {
  return Math.random().toString(36).slice(2, 10)    // 生成唯一 ID
}

// ChatPanel 组件实现
export default function ChatPanel({ code, selectedCode }: ChatPanelProps) {
  // 聊天消息记录, 用于保存用户和助手之间的对话
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('chat-messages')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  // 输入框状态
  const [input, setInput] = useState('')
  // 加载状态
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  // 保存消息到本地存储
  useEffect(() => {
    localStorage.setItem('chat-messages', JSON.stringify(messages))
  }, [messages])

  // 每次消息更新时，自动滚动到底部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, streaming])

  // 删除原 sendMessage，改为全部使用流式 streamAsk
  const streamAsk = async (content: string) => {
    if (!content.trim() || streaming) return
    setError(null)
    setStreaming(true)

    const userMsg: ChatMessage = { role: 'user', content, id: uid() }
    setMessages(prev => [...prev, userMsg])

    let acc = ''
    const assistantId = uid()
    // 先插入占位
    setMessages(prev => [...prev, { role: 'assistant', content: '', id: assistantId, model: '' }])

    try {
      const client = getModelClient()
      const resp = await client.streamChat({
        messages: [
          { role: 'system', content: '你是一名专业的 Python 编程助教，回答精炼且包含必要示例。' },
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content }
        ],
        temperature: 0.6,
        maxTokens: 800
      }, (delta) => {
        acc += delta
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: acc, model: 'stream' } : m))
      })
      // 完成后更新最终模型名称
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, model: resp.model || 'stream' } : m))
    } catch (e: any) {
      setError(e.message || '流式请求失败')
    } finally {
      setStreaming(false)
    }
  }

  // 处理按钮点击的快捷提问（调用 sendMessage）
  const handleQuickAsk = (type: 'explain' | 'optimize' | 'tests') => {
    if (streaming) return
    const source = (selectedCode && selectedCode.trim()) ? selectedCode : code
    const isSelection = !!(selectedCode && selectedCode.trim())
    if (!source.trim()) {
      setError(isSelection ? '选中的代码为空' : '当前没有代码可分析')
      return
    }
    if (type === 'explain') {
      streamAsk(`请解释以下${isSelection ? '代码片段' : '代码'}：\n\n${source}`)
    } else if (type === 'optimize') {
      streamAsk(`请优化以下${isSelection ? '代码片段' : '代码'}并说明改进点：\n\n${source}`)
    } else if (type === 'tests') {
      streamAsk(`请为以下${isSelection ? '代码片段' : '代码'}生成完整的单元测试（使用 pytest 风格），并说明每个测试的目的：\n\n${source}`)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* 快捷操作按钮 */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <button onClick={() => handleQuickAsk('explain')} disabled={streaming} style={btnStyle}>🧐 解释代码</button>
        <button onClick={() => handleQuickAsk('optimize')} disabled={streaming} style={btnStyle}>⚙️ 优化代码</button>
        <button onClick={() => handleQuickAsk('tests')} disabled={streaming} style={btnStyle}>🧪 生成测试</button>
        <button onClick={() => setMessages([])} disabled={streaming} style={{ ...btnStyle, background: '#5a1e1e', color: '#f48771' }}>🗑️ 清空</button>
      </div>

      {/* 消息列表，充满剩余空间 */}
      <div ref={listRef} style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px',
        background: '#1e1e1e',
        border: '1px solid #3e3e3e',
        borderRadius: '6px'
      }}>
        {messages.length === 0 && (
          <div style={{ fontSize: '12px', color: '#888' }}>开始提问：例如 “解释当前递归函数在做什么？”</div>
        )}
        {messages.map(m => (
          <div key={m.id} style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column' }}>
            <div style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? '#0e639c' : '#2d2d2d',
              color: '#fff',
              padding: '8px 10px',
              borderRadius: '10px',
              maxWidth: '85%',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.5
            }}>
              {m.content}
            </div>
            {m.model && m.role === 'assistant' && (
              <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>模型: {m.model}</div>
            )}
          </div>
        ))}
        {streaming && <div style={{ fontSize: '12px', color: '#888' }}>⌛ 正在生成回复...</div>}
        {error && <div style={{ fontSize: '12px', color: '#f48771' }}>错误: {error}</div>}
      </div>

      {/* 输入框固定在底部 */}
      <form onSubmit={(e) => { e.preventDefault(); streamAsk(input); setInput('') }} style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="输入问题，回车发送..."
          style={{
            flex: 1,
            background: '#1e1e1e',
            border: '1px solid #3e3e3e',
            borderRadius: '4px',
            padding: '8px',
            color: '#d4d4d4',
            fontSize: '12px'
          }}
          disabled={streaming}
        />
        <button type="submit" disabled={streaming || !input.trim()} style={{ ...btnStyle, background: '#16825d' }}>发送</button>
      </form>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '6px 10px',
  background: '#2d2d2d',
  border: '1px solid #3e3e3e',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px',
  color: '#d4d4d4'
}
