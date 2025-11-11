import { useState } from 'react'
import { explainCode, optimizeCode } from '@/services/completionService'

// PromptPanel 组件属性定义
interface PromptPanelProps {
  code: string
  onCodeUpdate: (code: string) => void  // 代码更新回调
}

// PromptPanel 组件实现
function PromptPanel({ code }: PromptPanelProps) {
  // 输入框状态
  const [input, setInput] = useState('')
  // 聊天消息记录
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: '👋 你好！我是 AI 编程助教。我可以帮你解释代码、优化代码、回答编程问题。',
    },
  ])
  // 加载状态
  const [isLoading, setIsLoading] = useState(false)

  const handleQuickAction = async (action: string) => {// 处理快速操作
    if (!code.trim()) {
      alert('请先在编辑器中编写代码')
      return
    }

    setIsLoading(true)
    setMessages((prev) => [...prev, { role: 'user', content: `${action}当前代码` }])

    try {
      let response = ''
      
      if (action === '解释') {
        response = await explainCode(code)
      } else if (action === '优化') {
        response = await optimizeCode(code)
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: response }])
    } catch (error: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `❌ ${error.message}` }])
    } finally {
      setIsLoading(false)
    }
  }

  // 处理发送消息
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const response = await explainCode(code + '\n\n问题: ' + userMessage)
      setMessages((prev) => [...prev, { role: 'assistant', content: response }])
    } catch (error: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `❌ ${error.message}` }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="prompt-panel">
      <div className="quick-actions">
        <button onClick={() => handleQuickAction('解释')} disabled={isLoading}>
          💡 解释代码
        </button>
        <button onClick={() => handleQuickAction('优化')} disabled={isLoading}>
          ⚡ 优化代码
        </button>
      </div>

      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message message-${msg.role}`}>
            <div className="message-role">{msg.role === 'user' ? '👤 你' : '🤖 AI'}</div>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="message message-assistant">
            <div className="message-role">🤖 AI</div>
            <div className="message-content typing">正在思考...</div>
          </div>
        )}
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="输入问题..."
          disabled={isLoading}
        />
        <button onClick={handleSendMessage} disabled={isLoading || !input.trim()}>
          发送
        </button>
      </div>
    </div>
  )
}

export default PromptPanel
