import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import styles from './NavBar.module.css'

interface Props {
  title?: string
  backTo?: string
}

export default function NavBar({ title, backTo }: Props) {
  const { user, logout, isTeacher } = useAuth()
  return (
    <nav className={styles.nav}>
      <div className={styles.left}>
        <Link to="/" className={styles.brand}>
          <span className={styles.brandLogo}>🐍</span>
          <span className={styles.brandName}>Python 学习</span>
        </Link>
        {title && (
          <>
            <span className={styles.divider}>/</span>
            {backTo
              ? <Link to={backTo} className={styles.back}>← 返回</Link>
              : null
            }
            <span className={styles.title}>{title}</span>
          </>
        )}
      </div>
      <div className={styles.right}>
        <Link to="/courses" className={styles.link}>课程</Link>
        <Link to="/exercises" className={styles.link}>练习</Link>
        <Link to="/books" className={styles.link}>书籍</Link>
        <Link to="/editor" className={styles.link}>编辑器</Link>
        {user ? (
          <>
            {isTeacher && <Link to="/admin" className={styles.link}>管理</Link>}
            <span className={styles.user}>👤 {user.username}</span>
            <button type="button" className={styles.logoutBtn} onClick={logout}>退出</button>
          </>
        ) : (
          <>
            <Link to="/login" className={styles.loginLink}>登录</Link>
            <Link to="/register" className={styles.registerBtn}>注册</Link>
          </>
        )}
      </div>
    </nav>
  )
}
