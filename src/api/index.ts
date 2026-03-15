import axios from 'axios'

const BASE = 'http://localhost:8000'

export const api = axios.create({ baseURL: BASE })

// 每次请求自动带 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Auth ──────────────────────────────────────────────
export const authApi = {
  register: (username: string, password: string, email?: string) =>
    api.post('/api/auth/register', { username, password, email }),
  login: (username: string, password: string) =>
    api.post('/api/auth/login', { username, password }),
  me: () => api.get('/api/auth/me'),
}

// ── Courses ───────────────────────────────────────────
export const courseApi = {
  list: () => api.get('/api/courses'),
  get: (id: string) => api.get(`/api/courses/${id}`),
  getLesson: (courseId: string, lessonId: string) =>
    api.get(`/api/courses/${courseId}/lessons/${lessonId}`),
}

// ── Exercises ─────────────────────────────────────────
export const exerciseApi = {
  list: (params?: { difficulty?: string; tag?: string }) =>
    api.get('/api/exercises', { params }),
  get: (id: string) => api.get(`/api/exercises/${id}`),
  submit: (payload: { exercise_id: string; code: string; passed: boolean; result: string }) =>
    api.post('/api/exercises/submissions', payload),
}

// ── Progress ──────────────────────────────────────────
export const progressApi = {
  me: () => api.get('/api/progress/me'),
  complete: (payload: { course_id?: string; lesson_id?: string; study_time?: number }) =>
    api.post('/api/progress/complete', payload),
}
