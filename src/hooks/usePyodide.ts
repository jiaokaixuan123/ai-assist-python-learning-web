import { useEffect, useState } from 'react'

// 从 pyodide 包中获取类型，如果已安装
// import type { PyodideInterface } from 'pyodide'

// 暂时使用 any 来避免类型错误
type Pyodide = any

// 自定义 Hook：使用 Pyodide
export function usePyodide() {
  const [pyodide, setPyodide] = useState<Pyodide | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPyodide = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // 在加载 Pyodide 之前，临时“隐藏”AMD define，避免冲突
      const amdDefine = (window as any).define
      ;(window as any).define = undefined

      const script = document.createElement('script')
      script.src = '/pyodide/pyodide.js' // 本地文件，替换 CDN
      script.onload = async () => {
        try {
          const py = await (window as any).loadPyodide()
          setPyodide(py)
        } catch (e: any) {
          setError(e.message)
        } finally {
          setIsLoading(false)
          // 加载完成后恢复 define
          ;(window as any).define = amdDefine
        }
      }
      script.onerror = () => {
        setError('Failed to load Pyodide script.')
        setIsLoading(false)
        // 出错时也要恢复 define
        ;(window as any).define = amdDefine
      }
      document.body.appendChild(script)
    } catch (e: any) {
      setError(e.message)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPyodide()
  }, [])

  return { pyodide, isLoading, error }
}
