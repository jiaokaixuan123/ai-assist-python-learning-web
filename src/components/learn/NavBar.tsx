import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import styles from './NavBar.module.css'

interface Props {
  title: string
  backTo: string
}

export default function NavBar({ title, backTo }: Props) {
  const { user, logout } = useAuth()
  return (
    <nav className={styles.nav}>
      <div className={styles.left}>
        <Link to={backTo} className={styles.back}>← 返回</Link>
        <span className={styles.title}>{title}</span>
      </div>
      <div className={styles.right}>
        <Link to="/" className={styles.link}>首页</Link>
        <Link to="/courses" className={styles.link}>课程</Link>
        <Link to="/exercises" className={styles.link}>练习</Link>
        <Link to="/editor" className={styles.link}>编辑器</Link>
        {user ? (
          <>
            <span className={styles.user}>👤 {user.username}</span>
            <button className={styles.logoutBtn} onClick={logout}>退出</button>
          </>
        ) : (
          <Link to="/login" className={styles.loginLink}>登录</Link>
        )}
      </div>
    </nav>
  )
}
