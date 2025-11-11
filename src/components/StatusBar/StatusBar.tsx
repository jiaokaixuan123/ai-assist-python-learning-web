// StatusBar 组件实现
interface StatusBarProps {
  status: {
    message: string
    type: 'success' | 'error' | 'loading' | 'idle'
  }
  isReady: boolean
}

// StatusBar 组件实现
function StatusBar({ status, isReady }: StatusBarProps) {
  const bg = isReady ? '#16825d' : '#0e639c'

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '6px 12px',
      background: bg,
      color: 'white',
      fontSize: '12px',
      borderTop: '1px solid #333'
    }}>
      <span>{isReady ? '✓ 就绪' : '⏳ 加载中...'}</span>
      <span>{status.message}</span>
    </div>
  )
}

export default StatusBar
