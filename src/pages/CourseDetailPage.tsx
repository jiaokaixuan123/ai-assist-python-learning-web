/**
 * 课程详情页：展示课程介绍 + 章节列表，点击章节进入学习
 * 路由：/courses/:courseId/learn/:lessonId?
 * （注意：/courses/:courseId 由 App.tsx 重定向到第一节）
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { courseApi, progressApi } from '../api'
import { useAuth } from '../contexts/AuthContext'
import NavBar from '../components/learn/NavBar'
import styles from './CourseDetailPage.module.css'

interface Lesson { id: string; title: string; order: number }
interface Course {
  id: string
  title: string
  description: string
  difficulty: string
  tags: string[]
  lesson_count: number
  lessons: Lesson[]
}

const DIFF_LABEL: Record<string, string> = { beginner: '入门', intermediate: '进阶', advanced: '高级' }
const DIFF_COLOR: Record<string, string> = { beginner: '#3fb950', intermediate: '#d29922', advanced: '#f85149' }

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [course, setCourse] = useState<Course | null>(null)
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!courseId) return
    courseApi.get(courseId).then(r => setCourse(r.data))
    if (user) progressApi.me().then(r => setCompletedLessons(new Set(r.data.completed_lessons ?? []))).catch(() => {})
  }, [courseId, user])

  if (!course) return <div className={styles.loading}>加载中...</div>

  const doneCount = course.lessons?.filter(l => completedLessons.has(l.id)).length ?? 0

  return (
    <div className={styles.page}>
      <NavBar title={course.title} backTo="/courses" />
      <div className={styles.content}>
        {/* 课程头部 */}
        <div className={styles.hero}>
          <div className={styles.heroLeft}>
            <div className={styles.meta}>
              <span className={styles.badge} style={{ color: DIFF_COLOR[course.difficulty], borderColor: DIFF_COLOR[course.difficulty] }}>
                {DIFF_LABEL[course.difficulty] ?? course.difficulty}
              </span>
              {course.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
            </div>
            <h1 className={styles.title}>{course.title}</h1>
            <p className={styles.desc}>{course.description}</p>
            <div className={styles.info}>
              <span>📚 {course.lesson_count} 节课</span>
              {user && <span>✅ 已完成 {doneCount} / {course.lessons?.length ?? 0} 节</span>}
            </div>
          </div>
          <button
            className={styles.startBtn}
            onClick={() => {
              const firstLesson = course.lessons?.[0]
              if (firstLesson) navigate(`/courses/${course.id}/learn/${firstLesson.id}`)
            }}
          >
            {doneCount > 0 ? '继续学习 →' : '开始学习 →'}
          </button>
        </div>

        {/* 进度条 */}
        {user && course.lessons?.length > 0 && (
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${(doneCount / course.lessons.length) * 100}%` }} />
          </div>
        )}

        {/* 章节列表 */}
        <div className={styles.lessonsSection}>
          <h2 className={styles.sectionTitle}>课程目录</h2>
          <div className={styles.lessonList}>
            {course.lessons?.map((lesson, i) => {
              const done = completedLessons.has(lesson.id)
              return (
                <Link
                  key={lesson.id}
                  to={`/courses/${course.id}/learn/${lesson.id}`}
                  className={`${styles.lessonRow} ${done ? styles.done : ''}`}
                >
                  <span className={styles.lessonNum}>{done ? '✓' : i + 1}</span>
                  <span className={styles.lessonTitle}>{lesson.title}</span>
                  <span className={styles.lessonArrow}>→</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
