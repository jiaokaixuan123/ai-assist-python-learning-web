import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import styles from './Auth.module.css'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('密码至少 6 位'); return }
    setLoading(true)
    try {
      await register(username, password, email || undefined)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>🐍</div>
        <h1 className={styles.title}>创建账号</h1>
        <p className={styles.subtitle}>开启你的 Python 编程之旅</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>用户名 <span>（2-20 个字符）</span></label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="输入用户名"
              minLength={2}
              maxLength={20}
              required
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <label>密码 <span>（至少 6 位）</span></label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="输入密码"
              required
            />
          </div>
          <div className={styles.field}>
            <label>邮箱 <span>（选填）</span></label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <p className={styles.switch}>
          已有账号？<Link to="/login">立即登录</Link>
        </p>
      </div>
    </div>
  )
}
