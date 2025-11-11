import { useState, useCallback } from 'react'

interface Status {
  message: string
  type: 'success' | 'error' | 'loading' | 'idle'
}

export function useStatusBar() {
  const [status, setStatus] = useState<Status>({
    message: '就绪',
    type: 'idle',
  })

  const updateStatus = useCallback((message: string, type: Status['type'] = 'idle') => {
    setStatus({ message, type })
  }, [])

  const clearStatus = useCallback(() => {
    setStatus({ message: '就绪', type: 'idle' })
  }, [])

  return {
    status,
    updateStatus,
    clearStatus,
  }
}
