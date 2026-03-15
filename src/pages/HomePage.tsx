import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { courseApi, progressApi } from '../api'
import styles from './HomePage.module.css'

interface Course {
  id: string
  title: string
  description: string
  difficulty: string
  tags: string[]
  lesson_count: number
}

interface Progress {
  completed_lessons: string[]
  completed_exercises: string[]
  study_time: number
}

const DIFF_LABEL: Record<string, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高级',
}

const DIFF_COLOR: Record<string, string> = {
  beginner: '#3fb950',
  intermediate: '#d29922',
  advanced: '#f85149',
}

export default function HomePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [courses, setCourses] = useState<Course[]>([])
  const [progress, setProgress] = useState<Progress | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    courseApi.list().then(r => setCourses(r.data))
    if (user) {
      progressApi.me().then(r => setProgress(r.data)).catch(() => {})
    }
    setLoading(false)
  }, [user])

  return (
    <div className={styles.page}>
      {/* ── 导航栏 ── */}
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <span className={styles.navLogo}>🐍</span>
          <span className={styles.navTitle}>Python 学习</span>
        </div>
        <div className={styles.navLinks}>
          <Link to="/courses" className={styles.navLink}>课程</Link>
          <Link to="/exercises" className={styles.navLink}>练习</Link>
          <Link to="/editor" className={styles.navLink}>代码编辑器</Link>
          {user ? (
            <div className={styles.userArea}>
              <span className={styles.username}>👤 {user.username}</span>
              <button className={styles.logoutBtn} onClick={logout}>退出</button>
            </div>
          ) : (
            <div className={styles.authArea}>
              <Link to="/login" className={styles.loginBtn}>登录</Link>
              <Link to="/register" className={styles.registerBtn}>注册</Link>
            </div>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>
          从零开始学 <span className={styles.heroAccent}>Python</span>
        </h1>
        <p className={styles.heroSub}>
          交互式代码编辑 · AI 智能辅导 · 即时判题反馈
        </p>
        <div className={styles.heroBtns}>
          <button className={styles.heroPrimary} onClick={() => navigate('/courses')}>
            开始学习 →
          </button>
          <button className={styles.heroSecondary} onClick={() => navigate('/editor')}>
            打开编辑器
          </button>
        </div>
      </section>

      {/* ── 学习统计（已登录） ── */}
      {user && progress && (
        <section className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statNum}>{progress.completed_lessons?.length ?? 0}</div>
            <div className={styles.statLabel}>已完成章节</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNum}>{progress.completed_exercises?.length ?? 0}</div>
            <div className={styles.statLabel}>已通过练习</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNum}>{Math.round((progress.study_time ?? 0) / 60)}</div>
            <div className={styles.statLabel}>学习分钟数</div>
          </div>
        </section>
      )}

      {/* ── 课程列表 ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>精选课程</h2>
        {loading ? (
          <p className={styles.loading}>加载中...</p>
        ) : (
          <div className={styles.courseGrid}>
            {courses.map(c => (
              <Link key={c.id} to={`/courses/${c.id}`} className={styles.courseCard}>
                <div className={styles.cardTop}>
                  <span
                    className={styles.diffBadge}
                    style={{ color: DIFF_COLOR[c.difficulty], borderColor: DIFF_COLOR[c.difficulty] }}
                  >
                    {DIFF_LABEL[c.difficulty] ?? c.difficulty}
                  </span>
                  <span className={styles.lessonCount}>{c.lesson_count} 节</span>
                </div>
                <h3 className={styles.cardTitle}>{c.title}</h3>
                <p className={styles.cardDesc}>{c.description}</p>
                <div className={styles.cardTags}>
                  {c.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
                </div>
                <div className={styles.cardAction}>开始学习 →</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── 特色功能 ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>核心特色</h2>
        <div className={styles.featureGrid}>
          {[
            { icon: '💻', title: '在线代码编辑器', desc: '基于 Monaco Editor，支持语法高亮、自动补全、实时语法检查' },
            { icon: '🤖', title: 'AI 教学助手', desc: '代码解释、错误修复、优化建议，随时在线答疑' },
            { icon: '✅', title: '即时判题系统', desc: '提交代码后自动运行测试用例，即时反馈对错' },
            { icon: '📊', title: '学习进度追踪', desc: '记录已学章节、已做练习题，掌握自己的学习轨迹' },
          ].map(f => (
            <div key={f.title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <p>© 2025 Python 学习平台 · 为计算机设计大赛而生</p>
      </footer>
    </div>
  )
}
