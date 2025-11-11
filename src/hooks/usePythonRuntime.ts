import { useState, useEffect, useCallback, useRef } from 'react'

interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<any>
  loadPackage: (packages: string[]) => Promise<void>
  FS: any
}

declare global {
  interface Window {
    loadPyodide: (config: { indexURL: string }) => Promise<PyodideInterface>
  }
}

export function usePythonRuntime() {
  const [isReady, setIsReady] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pyodideRef = useRef<PyodideInterface | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadPyodide() {
      try {
        // 使用本地打包的 Pyodide 资源，避免 CDN
        const pyodide = await window.loadPyodide({
          indexURL: '/pyodide/',
        })

        pyodideRef.current = pyodide

        // 设置标准输出捕获
        await pyodide.runPythonAsync(`
import sys
import io

class OutputCapture:
    def __init__(self):
        self.output = []
    
    def write(self, text):
        if text and text.strip():
            self.output.append(str(text))
    
    def flush(self):
        pass
    
    def get_output(self):
        return ''.join(self.output)
    
    def clear(self):
        self.output = []

_output_capture = OutputCapture()
sys.stdout = _output_capture
sys.stderr = _output_capture
        `)

        if (isMounted) {
          setIsReady(true)
          setError(null)
        }
      } catch (err: any) {
        console.error('Pyodide 加载失败:', err)
        if (isMounted) {
          setError(err.message)
          setIsReady(false)
        }
      }
    }

    loadPyodide()

    return () => {
      isMounted = false
    }
  }, [])

  const runPython = useCallback(async (code: string): Promise<string> => {
    if (!pyodideRef.current) {
      throw new Error('Python 运行时未初始化')
    }

    setIsRunning(true)
    setError(null)

    try {
      const pyodide = pyodideRef.current

      // 清除之前的输出
      await pyodide.runPythonAsync('_output_capture.clear()')

      // 执行用户代码
      await pyodide.runPythonAsync(code)

      // 获取输出
      const output = await pyodide.runPythonAsync('_output_capture.get_output()')

      return output || '✓ 代码执行成功（无输出）'
    } catch (err: any) {
      const errorMessage = err.message || String(err)
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsRunning(false)
    }
  }, [])

  const loadPackages = useCallback(async (packages: string[]) => {
    if (!pyodideRef.current) {
      throw new Error('Python 运行时未初始化')
    }

    try {
      await pyodideRef.current.loadPackage(packages)
    } catch (err: any) {
      throw new Error(`包加载失败: ${err.message}`)
    }
  }, [])

  return {
    isReady,
    isRunning,
    error,
    runPython,
    loadPackages,
  }
}
