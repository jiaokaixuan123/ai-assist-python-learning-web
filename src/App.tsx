import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CoursesPage from './pages/CoursesPage'
import CourseDetailPage from './pages/CourseDetailPage'
import LearnPage from './pages/LearnPage'
import ExercisesPage from './pages/ExercisesPage'
import ExerciseDetailPage from './pages/ExerciseDetailPage'
import EditorPage from './pages/EditorPage'
import AdminPage from './pages/AdminPage'
import AiTutor from './components/AiTutor/AiTutor'

function TeacherRoute({ children }: { children: JSX.Element }) {
  const { user, loading, isTeacher } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!isTeacher) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/courses/:courseId" element={<CourseDetailPage />} />
        <Route path="/courses/:courseId/learn/:lessonId" element={<LearnPage />} />
        <Route path="/exercises" element={<ExercisesPage />} />
        <Route path="/exercises/:exerciseId" element={<ExerciseDetailPage />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/admin" element={<TeacherRoute><AdminPage /></TeacherRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AiTutor />
    </>
  )
}
