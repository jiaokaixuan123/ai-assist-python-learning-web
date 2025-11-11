import { getModelClient } from './modelClient'

export async function getCodeCompletions(
  prompt: string,
  language: string = 'python'
): Promise<string[]> {
  try {
    const client = getModelClient()
    
    const response = await client.chat({
      messages: [
        { role: 'system', content: `你是一个 ${language} 编程助手。` },
        { role: 'user', content: `请为以下代码提供补全：\n\n${prompt}` },
      ],
      temperature: 0.3,
      maxTokens: 200,
    })

    const completion = response.content.trim().replace(/```python\n?/g, '').replace(/```\n?/g, '').trim()
    return completion ? [completion] : []
  } catch (error) {
    console.error('补全失败:', error)
    return []
  }
}

export async function explainCode(code: string, language: string = 'python'): Promise<string> {
  try {
    const client = getModelClient()
    
    const response = await client.chat({
      messages: [
        { role: 'system', content: '你是一个编程教学助手。' },
        { role: 'user', content: `请解释以下 ${language} 代码：\n\n${code}` },
      ],
      temperature: 0.7,
      maxTokens: 800,
    })

    return response.content
  } catch (error: any) {
    throw new Error(`解释失败: ${error.message}`)
  }
}

export async function optimizeCode(code: string, language: string = 'python'): Promise<string> {
  try {
    const client = getModelClient()
    
    const response = await client.chat({
      messages: [
        { role: 'system', content: '你是代码优化专家。' },
        { role: 'user', content: `请优化以下 ${language} 代码：\n\n${code}` },
      ],
      temperature: 0.5,
      maxTokens: 1000,
    })

    return response.content
  } catch (error: any) {
    throw new Error(`优化失败: ${error.message}`)
  }
}

export async function generateTests(code: string, language: string = 'python'): Promise<string> {
  try {
    const client = getModelClient()
    const response = await client.chat({
      messages: [
        { role: 'system', content: '你是单元测试生成助手，输出 pytest 风格测试，涵盖边界、正常与异常场景。' },
        { role: 'user', content: `请为以下 ${language} 代码生成全面的测试：\n\n${code}` },
      ],
      temperature: 0.4,
      maxTokens: 1000,
    })
    return response.content
  } catch (error: any) {
    throw new Error(`测试生成失败: ${error.message}`)
  }
}
