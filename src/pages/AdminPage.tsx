import { useState, useEffect } from 'react'
import { adminApi, courseApi, exerciseApi } from '../api'
import { useAuth } from '../contexts/AuthContext'
import NavBar from '../components/learn/NavBar'
import styles from './AdminPage.module.css'

type Tab = 'courses' | 'exercises' | 'users'

interface Lesson { id: string; title: string; content: string; starter_code?: string; order: number }
interface Course { id: string; title: string; description: string; difficulty: string; tags: string[]; lesson_count: number; cover?: string; lessons?: Lesson[] }
interface Exercise { id: string; title: string; description: string; difficulty: string; tags: string[]; starter_code?: string; hint?: string; test_cases: { input: string; expected_output: string }[] }
interface UserItem { id: string; username: string; email?: string; role: string; created_at: string }

const emptyExForm = () => ({
  title: '', description: '', difficulty: 'easy',
  tags: '', starter_code: '', hint: '',
  test_cases: [{ input: '', expected_output: '' }]
})

const emptyCourseForm = () => ({
  title: '', description: '', difficulty: 'beginner', tags: '', cover: ''
})

const emptyLessonForm = () => ({
  id: '', title: '', content: '', starter_code: '', order: 1
})

export default function AdminPage() {
  const { } = useAuth()
  const [tab, setTab] = useState<Tab>('courses')
  const [courses, setCourses] = useState<Course[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [msg, setMsg] = useState('')

  // 编辑状态
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null)
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)

  // 表单状态
  const [courseForm, setCourseForm] = useState(emptyCourseForm())
  const [exForm, setExForm] = useState(emptyExForm())
  const [lessonForm, setLessonForm] = useState(emptyLessonForm())

  const refreshCourses = () => courseApi.list().then(r => setCourses(r.data))
  const refreshExercises = () => exerciseApi.list().then(r => setExercises(r.data))
  const refreshUsers = () => adminApi.listUsers().then(r => setUsers(r.data))

  useEffect(() => {
    refreshCourses()
    refreshExercises()
    refreshUsers()
  }, [])

  const notify = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const handleUpdateRole = async (id: string, role: 'student' | 'teacher') => {
    try {
      await adminApi.updateUserRole(id, role)
      notify('✅ 角色已更新')
      refreshUsers()
    } catch { notify('❌ 操作失败') }
  }

  const handleDeleteUser = async (id: string, username: string) => {
    if (!confirm(`确定删除用户「${username}」？`)) return
    try {
      await adminApi.deleteUser(id)
      notify('✅ 用户已删除')
      refreshUsers()
    } catch { notify('❌ 删除失败') }
  }

  /* ── 课程：开始编辑 ── */
  const startEditCourse = async (c: Course) => {
    const { data } = await courseApi.get(c.id)
    setEditingCourse(data)
    setCourseForm({
      title: data.title, description: data.description,
      difficulty: data.difficulty, tags: data.tags.join(', '), cover: data.cover ?? ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEditCourse = () => {
    setEditingCourse(null)
    setCourseForm(emptyCourseForm())
    setEditingLesson(null)
    setLessonForm(emptyLessonForm())
  }

  /* ── 课程：保存 ── */
  const handleSaveCourse = async () => {
    if (!courseForm.title.trim()) return notify('请填写课程标题')
    const data = {
      title: courseForm.title, description: courseForm.description,
      difficulty: courseForm.difficulty,
      tags: courseForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      cover: courseForm.cover || undefined,
    }
    try {
      if (editingCourse) {
        await adminApi.updateCourse(editingCourse.id, data)
        notify('✅ 课程更新成功')
        setEditingCourse(null)
      } else {
        await adminApi.createCourse(data)
        notify('✅ 课程创建成功')
      }
      setCourseForm(emptyCourseForm())
      refreshCourses()
    } catch {
      notify('❌ 操作失败，请检查登录状态')
    }
  }

  /* ── 课程：删除 ── */
  const handleDeleteCourse = async (id: string, title: string) => {
    if (!confirm(`确定删除课程「${title}」？此操作不可撤销。`)) return
    try {
      await adminApi.deleteCourse(id)
      notify('✅ 课程已删除')
      refreshCourses()
    } catch {
      notify('❌ 删除失败')
    }
  }

  /* ── 练习：开始编辑 ── */
  const startEditExercise = async (e: Exercise) => {
    const { data } = await exerciseApi.get(e.id)
    setEditingExercise(data)
    setExForm({
      title: data.title, description: data.description,
      difficulty: data.difficulty, tags: data.tags.join(', '),
      starter_code: data.starter_code ?? '', hint: data.hint ?? '',
      test_cases: data.test_cases.length > 0 ? data.test_cases : [{ input: '', expected_output: '' }]
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEditExercise = () => { setEditingExercise(null); setExForm(emptyExForm()) }

  /* ── 章节：开始编辑 ── */
  const startEditLesson = (l: Lesson) => {
    setEditingLesson(l)
    setLessonForm({ id: l.id, title: l.title, content: l.content, starter_code: l.starter_code ?? '', order: l.order })
  }

  const cancelEditLesson = () => { setEditingLesson(null); setLessonForm(emptyLessonForm()) }

  const handleSaveLesson = async () => {
    if (!editingCourse) return
    if (!lessonForm.title.trim()) return notify('请填写章节标题')
    const lesson = { ...lessonForm, id: lessonForm.id || `lesson_${Date.now()}` }
    try {
      if (editingLesson) {
        await adminApi.updateLesson(editingCourse.id, editingLesson.id, lesson)
        notify('✅ 章节更新成功')
      } else {
        await adminApi.addLesson(editingCourse.id, lesson)
        notify('✅ 章节添加成功')
      }
      cancelEditLesson()
      const { data } = await courseApi.get(editingCourse.id)
      setEditingCourse(data)
    } catch { notify('❌ 操作失败') }
  }

  const handleDeleteLesson = async (lessonId: string, title: string) => {
    if (!editingCourse) return
    if (!confirm(`确定删除章节「${title}」？`)) return
    try {
      await adminApi.deleteLesson(editingCourse.id, lessonId)
      notify('✅ 章节已删除')
      const { data } = await courseApi.get(editingCourse.id)
      setEditingCourse(data)
    } catch { notify('❌ 删除失败') }
  }

  /* ── 练习：保存 ── */
  const handleSaveExercise = async () => {
    if (!exForm.title.trim()) return notify('请填写练习标题')
    if (exForm.test_cases.some(tc => !tc.expected_output.trim())) return notify('请填写所有测试用例的期望输出')
    const data = {
      exercise: {
        title: exForm.title, description: exForm.description,
        difficulty: exForm.difficulty,
        tags: exForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        starter_code: exForm.starter_code || undefined,
        hint: exForm.hint || undefined,
      },
      test_cases: exForm.test_cases,
    }
    try {
      if (editingExercise) {
        await adminApi.updateExercise(editingExercise.id, data)
        notify('✅ 练习题更新成功')
        setEditingExercise(null)
      } else {
        await adminApi.createExercise(data)
        notify('✅ 练习题创建成功')
      }
      setExForm(emptyExForm())
      refreshExercises()
    } catch {
      notify('❌ 操作失败，请检查登录状态')
    }
  }

  /* ── 练习：删除 ── */
  const handleDeleteExercise = async (id: string, title: string) => {
    if (!confirm(`确定删除练习题「${title}」？此操作不可撤销。`)) return
    try {
      await adminApi.deleteExercise(id)
      notify('✅ 练习题已删除')
      refreshExercises()
    } catch {
      notify('❌ 删除失败')
    }
  }

  const addTestCase = () =>
    setExForm(f => ({ ...f, test_cases: [...f.test_cases, { input: '', expected_output: '' }] }))

  const removeTestCase = (i: number) =>
    setExForm(f => ({ ...f, test_cases: f.test_cases.filter((_, idx) => idx !== i) }))

  const updateTestCase = (i: number, field: 'input' | 'expected_output', val: string) =>
    setExForm(f => ({
      ...f,
      test_cases: f.test_cases.map((tc, idx) => idx === i ? { ...tc, [field]: val } : tc)
    }))

  return (
    <div className={styles.page}>
      <NavBar title="管理后台" backTo="/" />
      {msg && <div className={styles.toast}>{msg}</div>}

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <h2 className={styles.sideTitle}>管理</h2>
          {(['courses', 'exercises', 'users'] as Tab[]).map(t => (
            <button key={t}
              className={`${styles.sideBtn} ${tab === t ? styles.active : ''}`}
              onClick={() => { setTab(t); cancelEditCourse(); cancelEditExercise() }}
            >
              {t === 'courses' ? '📚 课程管理' : t === 'exercises' ? '🧩 练习管理' : '👥 用户管理'}
            </button>
          ))}
        </aside>

        <main className={styles.main}>

          {/* ── 课程管理 ── */}
          {tab === 'courses' && (
            <div>
              <h2 className={styles.sectionTitle}>课程列表 ({courses.length})</h2>
              <table className={styles.table}>
                <thead>
                  <tr><th>标题</th><th>难度</th><th>章节数</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {courses.map(c => (
                    <tr key={c.id} className={editingCourse?.id === c.id ? styles.editingRow : ''}>
                      <td>{c.title}</td>
                      <td>{c.difficulty}</td>
                      <td>{c.lesson_count}</td>
                      <td className={styles.actions}>
                        <button type="button" className={styles.btnEdit} onClick={() => startEditCourse(c)}>编辑</button>
                        <button type="button" className={styles.btnDanger} onClick={() => handleDeleteCourse(c.id, c.title)}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h2 className={styles.sectionTitle}>
                {editingCourse ? `编辑课程：${editingCourse.title}` : '新建课程'}
              </h2>
              <div className={styles.form}>
                <input className={styles.input} placeholder="课程标题 *"
                  value={courseForm.title} onChange={e => setCourseForm(f => ({ ...f, title: e.target.value }))} />
                <textarea className={styles.textarea} placeholder="课程描述"
                  value={courseForm.description} onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))} />
                <select className={styles.select}
                  value={courseForm.difficulty} onChange={e => setCourseForm(f => ({ ...f, difficulty: e.target.value }))}>
                  <option value="beginner">入门</option>
                  <option value="intermediate">进阶</option>
                  <option value="advanced">高级</option>
                </select>
                <input className={styles.input} placeholder="标签（逗号分隔）"
                  value={courseForm.tags} onChange={e => setCourseForm(f => ({ ...f, tags: e.target.value }))} />
                <input className={styles.input} placeholder="封面图路径（可选）"
                  value={courseForm.cover} onChange={e => setCourseForm(f => ({ ...f, cover: e.target.value }))} />
                <div className={styles.formActions}>
                  <button type="button" className={styles.btnPrimary} onClick={handleSaveCourse}>
                    {editingCourse ? '保存修改' : '创建课程'}
                  </button>
                  {editingCourse && (
                    <button type="button" className={styles.btnSecondary} onClick={cancelEditCourse}>取消</button>
                  )}
                </div>
              </div>

              {/* ── 章节管理（仅编辑课程时显示）── */}
              {editingCourse && (
                <div>
                  <h2 className={styles.sectionTitle}>章节管理</h2>
                  <table className={styles.table}>
                    <thead>
                      <tr><th>顺序</th><th>标题</th><th>操作</th></tr>
                    </thead>
                    <tbody>
                      {(editingCourse.lessons ?? []).map(l => (
                        <tr key={l.id} className={editingLesson?.id === l.id ? styles.editingRow : ''}>
                          <td>{l.order}</td>
                          <td>{l.title}</td>
                          <td className={styles.actions}>
                            <button type="button" className={styles.btnEdit} onClick={() => startEditLesson(l)}>编辑</button>
                            <button type="button" className={styles.btnDanger} onClick={() => handleDeleteLesson(l.id, l.title)}>删除</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <h3 className={styles.subTitle}>{editingLesson ? `编辑章节：${editingLesson.title}` : '新增章节'}</h3>
                  <div className={styles.form}>
                    <input className={styles.input} placeholder="章节 ID（唯一标识，如 lesson_1）*"
                      value={lessonForm.id} onChange={e => setLessonForm(f => ({ ...f, id: e.target.value }))} />
                    <input className={styles.input} placeholder="章节标题 *"
                      value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} />
                    <textarea className={styles.textarea} placeholder="章节内容（支持 Markdown）*" rows={10}
                      value={lessonForm.content} onChange={e => setLessonForm(f => ({ ...f, content: e.target.value }))} />
                    <textarea className={styles.textarea} placeholder="初始代码（可选）" rows={4}
                      value={lessonForm.starter_code} onChange={e => setLessonForm(f => ({ ...f, starter_code: e.target.value }))} />
                    <input className={styles.input} type="number" placeholder="排序（数字越小越靠前）"
                      value={lessonForm.order} onChange={e => setLessonForm(f => ({ ...f, order: Number(e.target.value) }))} />
                    <div className={styles.formActions}>
                      <button type="button" className={styles.btnPrimary} onClick={handleSaveLesson}>
                        {editingLesson ? '保存章节' : '添加章节'}
                      </button>
                      {editingLesson && (
                        <button type="button" className={styles.btnSecondary} onClick={cancelEditLesson}>取消</button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 练习管理 ── */}
          {tab === 'exercises' && (
            <div>
              <h2 className={styles.sectionTitle}>练习列表 ({exercises.length})</h2>
              <table className={styles.table}>
                <thead>
                  <tr><th>标题</th><th>难度</th><th>标签</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {exercises.map(e => (
                    <tr key={e.id} className={editingExercise?.id === e.id ? styles.editingRow : ''}>
                      <td>{e.title}</td>
                      <td>{e.difficulty}</td>
                      <td>{e.tags.join(', ')}</td>
                      <td className={styles.actions}>
                        <button type="button" className={styles.btnEdit} onClick={() => startEditExercise(e)}>编辑</button>
                        <button type="button" className={styles.btnDanger} onClick={() => handleDeleteExercise(e.id, e.title)}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h2 className={styles.sectionTitle}>
                {editingExercise ? `编辑练习：${editingExercise.title}` : '新建练习题'}
              </h2>
              <div className={styles.form}>
                <input className={styles.input} placeholder="题目标题 *"
                  value={exForm.title} onChange={e => setExForm(f => ({ ...f, title: e.target.value }))} />
                <textarea className={styles.textarea} placeholder="题目描述（支持 Markdown）*" rows={6}
                  value={exForm.description} onChange={e => setExForm(f => ({ ...f, description: e.target.value }))} />
                <select className={styles.select}
                  value={exForm.difficulty} onChange={e => setExForm(f => ({ ...f, difficulty: e.target.value }))}>
                  <option value="easy">简单</option>
                  <option value="medium">中等</option>
                  <option value="hard">困难</option>
                </select>
                <input className={styles.input} placeholder="标签（逗号分隔）"
                  value={exForm.tags} onChange={e => setExForm(f => ({ ...f, tags: e.target.value }))} />
                <textarea className={styles.textarea} placeholder="初始代码（可选）" rows={4}
                  value={exForm.starter_code} onChange={e => setExForm(f => ({ ...f, starter_code: e.target.value }))} />
                <input className={styles.input} placeholder="提示（可选）"
                  value={exForm.hint} onChange={e => setExForm(f => ({ ...f, hint: e.target.value }))} />

                <h3 className={styles.subTitle}>测试用例</h3>
                {exForm.test_cases.map((tc, i) => (
                  <div key={i} className={styles.testCase}>
                    <span className={styles.tcLabel}>用例 {i + 1}</span>
                    <input className={styles.input} placeholder="输入（可选）"
                      value={tc.input} onChange={e => updateTestCase(i, 'input', e.target.value)} />
                    <input className={styles.input} placeholder="期望输出 *"
                      value={tc.expected_output} onChange={e => updateTestCase(i, 'expected_output', e.target.value)} />
                    {exForm.test_cases.length > 1 && (
                      <button type="button" className={styles.btnDanger} onClick={() => removeTestCase(i)}>删除用例</button>
                    )}
                  </div>
                ))}
                <button type="button" className={styles.btnSecondary} onClick={addTestCase}>+ 添加测试用例</button>
                <div className={styles.formActions}>
                  <button type="button" className={styles.btnPrimary} onClick={handleSaveExercise}>
                    {editingExercise ? '保存修改' : '创建练习题'}
                  </button>
                  {editingExercise && (
                    <button type="button" className={styles.btnSecondary} onClick={cancelEditExercise}>取消</button>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* ── 用户管理 ── */}
          {tab === 'users' && (
            <div>
              <h2 className={styles.sectionTitle}>用户列表 ({users.length})</h2>
              <table className={styles.table}>
                <thead>
                  <tr><th>用户名</th><th>邮箱</th><th>角色</th><th>注册时间</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.username}</td>
                      <td>{u.email || '-'}</td>
                      <td>
                        <select value={u.role} aria-label="用户角色"
                          onChange={e => handleUpdateRole(u.id, e.target.value as 'student' | 'teacher')}>
                          <option value="student">学生</option>
                          <option value="teacher">教师</option>
                        </select>
                      </td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className={styles.actions}>
                        <button type="button" className={styles.btnDanger}
                          onClick={() => handleDeleteUser(u.id, u.username)}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
