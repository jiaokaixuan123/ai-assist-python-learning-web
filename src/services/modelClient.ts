import axios from 'axios'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatOptions {
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  model?: string
}

interface ChatResponse {
  content: string
  model: string
}

class ModelClient {
  private apiKey: string
  private apiUrl: string
  private defaultModel: string
  private provider: 'deepseek' | 'zhipu'

  constructor() {
    // provider 检测：优先显式设置，其次根据专用 key 猜测
    this.provider = (import.meta.env.VITE_AI_PROVIDER as any) || (import.meta.env.VITE_DEEPSEEK_API_KEY ? 'deepseek' : 'zhipu')

    if (this.provider === 'deepseek') {
      // DeepSeek（OpenAI 兼容风格）
      this.apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY || import.meta.env.VITE_AI_API_KEY || ''
      this.apiUrl = import.meta.env.VITE_AI_API_URL || 'https://api.deepseek.com/chat/completions'
      this.defaultModel = import.meta.env.VITE_AI_MODEL || 'deepseek-chat'
    } else {
      // 智谱默认
      this.apiKey = import.meta.env.VITE_AI_API_KEY || ''
      this.apiUrl = import.meta.env.VITE_AI_API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
      this.defaultModel = import.meta.env.VITE_AI_MODEL || 'glm-4-flash'
    }

    console.log('[ModelClient] init:', {
      provider: this.provider,
      apiUrl: this.apiUrl,
      defaultModel: this.defaultModel,
      hasKey: !!this.apiKey,
      keyPrefix: this.apiKey ? this.apiKey.slice(0, 10) + '...' : 'NONE'
    })
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const { messages, temperature = 0.7, maxTokens = 1000, model = this.defaultModel } = options

    if (!this.apiKey) {
      console.warn('[ModelClient] apiKey missing, returning mock response. 请检查 .env.local 是否包含 VITE_DEEPSEEK_API_KEY 或 VITE_AI_API_KEY')
      return this.getMockResponse(messages)
    }

    console.log('[ModelClient] chat request:', { provider: this.provider, model, temperature, maxTokens, messagesCount: messages.length })

    try {
      // DeepSeek 与 智谱 请求体字段大部分兼容（均使用 messages / model / temperature / max_tokens）
      const payload: any = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }

      const response = await axios.post(
        this.apiUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 30000,
        }
      )

      // 兼容不同返回结构
      // 智谱: data.model + data.choices[0].message.content
      // DeepSeek: data.choices[0].message.content, model 可能在 data.model 或 choices[0].model
      const data = response.data
      const choice = data?.choices?.[0]
      const content = choice?.message?.content || ''
      const usedModel = data?.model || choice?.model || model

      console.log('[ModelClient] chat response OK:', { provider: this.provider, usedModel, contentPreview: content.slice(0, 40) })
      return { content, model: usedModel }
    } catch (error: any) {
      const status = error?.response?.status
      const respData = error?.response?.data
      console.error('[ModelClient] chat error:', status, respData || error)
      if (status === 401 || status === 403) {
        throw new Error(`鉴权失败(${status})：请确认 API Key 正确，并重启开发服务器。当前 provider=${this.provider}`)
      }
      throw new Error(`AI 服务错误: ${error.message}`)
    }
  }

  // 流式输出
  async streamChat(options: ChatOptions, onDelta: (text: string) => void): Promise<ChatResponse> {
    const { messages, temperature = 0.7, maxTokens = 1000, model = this.defaultModel } = options

    if (!this.apiKey) {
      console.warn('[ModelClient] 无 apiKey，流式模式回退为模拟响应')
      const mock = this.getMockResponse(messages)
      onDelta(mock.content)
      return mock
    }

    // 仅 deepseek 走流式，其他 provider 回退普通
    if (this.provider !== 'deepseek') {
      console.warn('[ModelClient] 当前 provider 不支持流式，回退普通 chat')
      const resp = await this.chat(options)
      onDelta(resp.content)
      return resp
    }

    // 构建请求体
    const payload: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true
    }

    console.log('[ModelClient] 开始流式请求:', { provider: this.provider, model })

    // 发起请求
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok || !response.body) {
      console.error('[ModelClient] 流式连接失败', response.status, response.statusText)
      throw new Error(`流式请求失败: ${response.status}`)
    }

    // 读取流
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let full = ''

    // 逐行解析
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true }) // 解码当前块
        // DeepSeek SSE 格式: 多行 data: {json}\n
        const lines = chunk.split(/\r?\n/).filter(l => l.startsWith('data:')) // 只处理 data: 开头的行
        for (const line of lines) {
          const dataStr = line.replace(/^data:\s*/, '').trim()  // 提取 data 内容
          if (dataStr === '[DONE]') { // 流结束标志
            console.log('[ModelClient] 流结束')
            break
          }
          try {
            const json = JSON.parse(dataStr)  // 解析 JSON
            const delta = json?.choices?.[0]?.delta?.content || ''  // 提取增量内容
            if (delta) {  // 有增量则回调
              full += delta // 累积完整内容
              onDelta(delta)  // 回调
            }
          } catch (e) {
            // 忽略无法解析的行
          }
        }
      }
    } catch (e: any) {
      console.error('[ModelClient] 流读取错误', e)
      throw new Error('流式读取失败: ' + e.message)
    }

    return { content: full, model }
  }

  // 模拟响应
  private getMockResponse(messages: ChatMessage[]): ChatResponse {
    const lastMessage = messages[messages.length - 1].content.toLowerCase()

    let response = '这是一个模拟响应。请配置 VITE_DEEPSEEK_API_KEY 或 VITE_AI_API_KEY 环境变量以使用真实的 AI 服务。'

    if (lastMessage.includes('解释')) {
      response = '这段代码定义了一个函数，用于处理特定逻辑。可进一步加入类型注解与异常处理。'
    } else if (lastMessage.includes('优化')) {
      response = '优化建议：\n1. 减少重复计算\n2. 拆分函数提升可读性\n3. 增加错误处理和边界条件判断'
    }

    return { content: response, model: this.provider === 'deepseek' ? 'deepseek-mock' : 'mock-model' }
  }
}

let modelClient: ModelClient | null = null

// 获取ModelClient实例
export function getModelClient(): ModelClient {
  if (!modelClient) {
    modelClient = new ModelClient()
  }
  return modelClient
}
