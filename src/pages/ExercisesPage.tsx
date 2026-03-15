import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { exerciseApi, progressApi } from '../api'
import { useAuth } from '../contexts/AuthContext'
import NavBar from '../components/learn/NavBar'
import styles from './ExercisesPage.module.css'

interface Exercise {
  id: string
  title: string
  description: string
  difficulty: string
  tags: string[]
}

const DIFF_LABEL: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' }
const DIFF_COLOR: Record<string, string> = { easy: '#3fb950', medium: '#d29922', hard: '#f85149' }

export default function ExercisesPage() {
  const { user } = useAuth()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    exerciseApi.list().then(r => setExercises(r.data))
    if (user) progressApi.me().then(r => setCompleted(new Set(r.data.completed_exercises ?? []))).catch(() => {})
  }, [user])

  const filtered = filter === 'all' ? exercises : exercises.filter(e => e.difficulty === filter)

  return (
    <div className={styles.page}>
      <NavBar title="练习题库" backTo="/" />
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Python 练习题</h1>
          <p className={styles.sub}>通过实战练习，巩固所学知识</p>
          <div className={styles.topRow}>
            <div className={styles.filters}>
              {['all', 'easy', 'medium', 'hard'].map(f => (
                <button
                  key={f}
                  className={`${styles.filterBtn} ${filter === f ? styles.active : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? '全部' : DIFF_LABEL[f]}
                </button>
              ))}
            </div>
            {user && (
              <span className={styles.progress}>
                已完成 {completed.size} / {exercises.length} 题
              </span>
            )}
          </div>
        </div>

        <div className={styles.list}>
          {filtered.map((e, i) => {
            const done = completed.has(e.id)
            return (
              <Link key={e.id} to={`/exercises/${e.id}`} className={`${styles.row} ${done ? styles.done : ''}`}>
                <span className={styles.idx}>{done ? '✓' : i + 1}</span>
                <div className={styles.info}>
                  <span className={styles.exTitle}>{e.title}</span>
                  <div className={styles.tagRow}>
                    {e.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
                  </div>
                </div>
                <span
                  className={styles.diff}
                  style={{ color: DIFF_COLOR[e.difficulty] }}
                >
                  {DIFF_LABEL[e.difficulty] ?? e.difficulty}
                </span>
                <span className={styles.arrow}>→</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
