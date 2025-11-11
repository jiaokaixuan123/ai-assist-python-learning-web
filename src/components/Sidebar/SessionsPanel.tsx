function SessionsPanel() {
  return (
    <div className="sessions-panel">
      <div className="sessions-header">
        <h3>会话历史</h3>
        <button className="btn-text">+ 新建</button>
      </div>
      
      <div className="sessions-list">
        <div className="session-item active">
          <div className="session-title">Python 基础练习</div>
          <div className="session-time">今天 14:30</div>
        </div>
        <div className="session-item">
          <div className="session-title">算法题解答</div>
          <div className="session-time">昨天 10:15</div>
        </div>
      </div>
    </div>
  )
}

export default SessionsPanel
