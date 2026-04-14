/**
 * useLearningCurve — 学习曲线数据管理 Hook
 
 职责：
   - 加载 / 刷新学习曲线聚合数据
   - 管理刷新按钮冷却状态
   - 提供结构化的图表用数据
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { analyticsApi } from '../api'

export interface WeeklyPoint {
  week_label: string
  week_start: string
  correctness: number
  complexity: number
  quality: number
  overall: number
  submission_count: number
}

export interface ExerciseBreakdown {
  difficulty_label: string
  difficulty_key: string
  avg_correctness: number
  avg_complexity: number
  avg_quality: number
  avg_overall: number
  attempt_count: number
  pass_rate: number
  exercise_count: number
}

export interface LearningCurveData {
  dimensions: {
    correctness: { score: number; trend: string }
    complexity: { score: number; trend: string; level?: string }
    quality: { score: number; trend: string }
  }
  overall_score: number
  patterns: string[]
  ai_insight: string
  recommendations: string[]
  risk_flags: string[]
  chart_data: {
    weekly_scores: WeeklyPoint[]
    exercise_breakdown: ExerciseBreakdown[]
  }
  total_submissions: number
  total_passed: number
  pass_rate: number
  average_score: number
  updated_at: string
}

const REFRESH_COOLDOWN_MS = 60_000 // 60 秒

export function useLearningCurve() {
  const [data, setData] = useState<LearningCurveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  // 标记是否正在等待后端异步聚合完成（refresh 点击后的完整等待期）
  const [waitingResult, setWaitingResult] = useState(false)
  const lastRefreshTime = useRef(0)

  // 加载曲线数据
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await analyticsApi.getMyCurve()
      setData(res.data as LearningCurveData)
    } catch (e: any) {
      // 等待聚合结果期间遇到 404 是正常的，不视为错误
      if (e.response?.status !== 404) {
        setError('加载失败，请稍后重试')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // 手动刷新 → 轮询等待后端完成聚合
  const POLL_INTERVAL_MS = 2000   // 每 2 秒轮询一次
  const MAX_POLL_ATTEMPTS = 15    // 最多轮询 15 次（约 30 秒）

  const refresh = useCallback(async () => {
    const now = Date.now()
    if (now - lastRefreshTime.current < REFRESH_COOLDOWN_MS) return

    lastRefreshTime.current = now
    setRefreshing(true)
    setWaitingResult(true)

    try {
      await analyticsApi.refresh()

      // 轮询直到后端聚合写入完成
      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
        try {
          const res = await analyticsApi.getMyCurve()
          setData(res.data as LearningCurveData)
          setError(null)
          setLoading(false)
          // 成功拿到数据，结束等待
          break
        } catch (pollErr: any) {
          // 404 说明还在聚合中，继续轮询；其他错误也继续试几次
          if (pollErr.response?.status !== 404 && attempt >= 3) {
            setError('刷新失败，请稍后重试')
            break
          }
        }
      }
    } catch (e: any) {
      setError(e.response?.data?.detail || '刷新失败，请稍后重试')
    } finally {
      setRefreshing(false)
      setWaitingResult(false)
    }
  }, [])

  // 是否可以点击刷新
  const canRefresh =
    !refreshing &&
    Date.now() - lastRefreshTime.current >= REFRESH_COOLDOWN_MS

  // 首次自动加载
  useEffect(() => { load() }, [load])

  return {
    data,
    loading,
    error,
    refreshing,
    waitingResult,
    canRefresh,
    refresh,
    reload: load,
  }
}
