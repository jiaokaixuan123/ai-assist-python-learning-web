import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { courseApi, progressApi } from '../api'
import { useAuth } from '../contexts/AuthContext'
import NavBar from '../components/learn/NavBar'
import PyEditorPanel from '../components/learn/PyEditorPanel'
import styles from './LearnPage.module.css'

interface Lesson {
  id: string
  title: string
  order: number
  content: string
  starter_code: string
}

interface Course {
  id: string
  title: string
  lessons: Lesson[]
}

export default function LearnPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [course, setCourse] = useState<Course | null>(null)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const startTimeRef = useRef(Date.now())

  // 加载课程结构
  useEffect(() => {
    if (!courseId) return
    courseApi.get(courseId).then(r => {
      setCourse(r.data)
      // 默认跳到第一节
      if (!lessonId && r.data.lessons?.length) {
        navigate(`/courses/${courseId}/learn/${r.data.lessons[0].id}`, { replace: true })
      }
    })
    if (user) {
      progressApi.me().then(r => {
        setCompletedLessons(new Set(r.data.completed_lessons ?? []))
      }).catch(() => {})
    }
  }, [courseId])

  // 加载当前章节
  useEffect(() => {
    if (!courseId || !lessonId) return
    setLoading(true)
    startTimeRef.current = Date.now()
    courseApi.getLesson(courseId, lessonId)
      .then(r => setLesson(r.data))
      .finally(() => setLoading(false))
  }, [courseId, lessonId])

  const handleComplete = async () => {
    if (!lessonId || !user) return
    const studyTime = Math.round((Date.now() - startTimeRef.current) / 1000)
    await progressApi.complete({ lesson_id: lessonId, study_time: studyTime })
    setCompletedLessons(prev => new Set([...prev, lessonId]))

    // 自动跳到下一节
    if (!course) return
    const idx = course.lessons.findIndex(l => l.id === lessonId)
    if (idx < course.lessons.length - 1) {
      navigate(`/courses/${courseId}/learn/${course.lessons[idx + 1].id}`)
    }
  }

  const currentIdx = course?.lessons.findIndex(l => l.id === lessonId) ?? -1
  const prevLesson = currentIdx > 0 ? course!.lessons[currentIdx - 1] : null
  const nextLesson = currentIdx >= 0 && currentIdx < (course?.lessons.length ?? 0) - 1
    ? course!.lessons[currentIdx + 1]
    : null

  return (
    <div className={styles.page}>
      <NavBar title={course?.title ?? '课程'} backTo="/courses" />

      <div className={styles.body}>
        {/* ── 侧边栏：章节列表 ── */}
        <aside className={styles.sidebar}>
          <div className={styles.sideTitle}>课程目录</div>
          <ul className={styles.lessonList}>
            {course?.lessons.map((l, i) => {
              const done = completedLessons.has(l.id)
              const active = l.id === lessonId
              return (
                <li key={l.id}>
                  <Link
                    to={`/courses/${courseId}/learn/${l.id}`}
                    className={`${styles.lessonItem} ${active ? styles.active : ''} ${done ? styles.done : ''}`}
                  >
                    <span className={styles.lessonNum}>{done ? '✓' : i + 1}</span>
                    <span className={styles.lessonTitle}>{l.title}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* ── 主内容区 ── */}
        <main className={styles.main}>
          {loading ? (
            <div className={styles.loadingBox}>加载中...</div>
          ) : lesson ? (
            <>
              <div className={styles.contentWrapper}>
                {/* 左：Markdown 教程 */}
                <div className={styles.mdPane}>
                  <h1 className={styles.lessonH1}>{lesson.title}</h1>
                  <div className={styles.mdContent}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                      {lesson.content}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* 右：代码编辑器 + 运行 */}
                <div className={styles.editorPane}>
                  <PyEditorPanel starterCode={lesson.starter_code} />
                </div>
              </div>

              {/* 底部导航 */}
              <div className={styles.bottomNav}>
                <div>
                  {prevLesson && (
                    <Link
                      to={`/courses/${courseId}/learn/${prevLesson.id}`}
                      className={styles.navBtn}
                    >
                      ← {prevLesson.title}
                    </Link>
                  )}
                </div>
                <div className={styles.centerBtns}>
                  {user && !completedLessons.has(lessonId!) && (
                    <button className={styles.completeBtn} onClick={handleComplete}>
                      ✓ 完成本节
                    </button>
                  )}
                  {completedLessons.has(lessonId!) && (
                    <span className={styles.completedBadge}>✓ 已完成</span>
                  )}
                </div>
                <div>
                  {nextLesson && (
                    <Link
                      to={`/courses/${courseId}/learn/${nextLesson.id}`}
                      className={styles.navBtn}
                    >
                      {nextLesson.title} →
                    </Link>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className={styles.loadingBox}>章节不存在</p>
          )}
        </main>
      </div>
    </div>
  )
}
