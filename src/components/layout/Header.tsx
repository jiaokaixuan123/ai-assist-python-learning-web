import React from 'react'

interface HeaderProps {
  isReady: boolean
  loadingStatus: string
  code: string
  onToggleSettings: () => void
  showSettings: boolean
  onFormat: () => void
  onRun: () => void
  isRunning: boolean
}

const Header: React.FC<HeaderProps> = ({
  isReady,
  loadingStatus,
  showSettings,
  onToggleSettings,
  onFormat,
  onRun,
  isRunning,
  code
}) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 20px',
      background: '#2d2d2d',
      borderBottom: '1px solid #3e3e3e'
    }}>
      <h1 style={{ margin: 0, fontSize: '20px' }}>🎓 Monaco AI 编程助手</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          fontSize: '12px',
          color: isReady ? '#4ec9b0' : '#dcdcaa',
          padding: '4px 8px',
          background: '#1e1e1e',
          borderRadius: '3px'
        }}>
          {isReady ? '🐍 Python 就绪' : '⏳ ' + loadingStatus}
        </span>
        <button
          onClick={onToggleSettings}
          title="编辑器设置"
          style={{
            padding: '8px 12px',
            background: showSettings ? '#0e639c' : '#2d2d2d',
            color: 'white',
            border: '1px solid #3e3e3e',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          ⚙️ 设置
        </button>
        <button
          onClick={onFormat}
          disabled={!isReady || !code.trim()}
          title="格式化代码 (Ctrl+Shift+F)"
          style={{
            padding: '8px 12px',
            background: (!isReady || !code.trim()) ? '#555' : '#2d2d2d',
            color: 'white',
            border: '1px solid #3e3e3e',
            borderRadius: '4px',
            cursor: (!isReady || !code.trim()) ? 'not-allowed' : 'pointer',
            opacity: (!isReady || !code.trim()) ? 0.6 : 1,
            fontSize: '12px'
          }}
        >
          ✨ 格式化
        </button>
        <button
          onClick={onRun}
          disabled={!isReady || isRunning}
          title="运行代码 (Ctrl+Enter)"
          style={{
            padding: '8px 16px',
            background: (!isReady || isRunning) ? '#555' : '#0e639c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (!isReady || isRunning) ? 'not-allowed' : 'pointer',
            opacity: (!isReady || isRunning) ? 0.6 : 1
          }}
        >
          {isRunning ? '⏳ 运行中...' : '▶️ 运行代码'}
        </button>
      </div>
    </div>
  )
}

export default Header
