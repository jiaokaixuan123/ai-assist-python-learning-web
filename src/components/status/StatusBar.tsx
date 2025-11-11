interface StatusBarProps { isReady: boolean; loadingStatus: string }
export function StatusBar({ isReady, loadingStatus }: StatusBarProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '6px 12px',
      background: isReady ? '#16825d' : '#0e639c',
      color: 'white',
      fontSize: '12px'
    }}>
      <span>{isReady ? '✓ 就绪' : '⏳ 加载中...'}</span>
      <span>{isReady ? '🐍 Python 3.11 | Monaco Editor' : loadingStatus}</span>
    </div>
  )
}
export default StatusBar
