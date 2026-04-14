/**
 * LearningCurvePage — 个人学习曲线展示页
 *
 * 布局：
 *   顶部：标题 + 刷新按钮
 *   左列：雷达图 + 趋势折线图
 *   右列：AI 洞察卡片 + 风险提示 + 各题条形图
 *   底部：统计摘要栏
 */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import NavBar from '../components/learn/NavBar'
import ScoreRadarChart from '../components/charts/ScoreRadarChart'
import TrendLineChart from '../components/charts/TrendLineChart'
import ExerciseBarChart from '../components/charts/ExerciseBarChart'
import { useLearningCurve } from '../hooks/useLearningCurve'
import styles from './LearningCurvePage.module.css'

/** 趋势箭头映射 */
const TREND_ICON: Record<string, string> = {
  up: '\u2191',
  down: '\u2193',
  stable: '\u2192',
}

/** 等级颜色 */
const LEVEL_STYLE: Record<string, string> = {
  normal: styles.levelNormal,
  elevated: styles.levelElevated,
  runaway: styles.levelRunaway,
}

/** 风险标签颜色 */
const RISK_COLORS: Record<string, string> = {
  recent_runaway: '#ef4444',
  low_complexity_score: '#f59e0b',
  excessive_retry: '#f97316',
  low_pass_rate: '#ef4444',
  quality_stagnant_low: '#8b5cf6',
}

/** 风险标签中文映射 */
const RISK_LABELS: Record<string, string> = {
  recent_runaway: '近期代码复杂度失控',
  low_complexity_score: '综合复杂性评分偏低',
  excessive_retry: '近期尝试次数过多',
  low_pass_rate: '通过率偏低，建议复习基础',
  quality_stagnant_low: '代码质量长期处于低分区',
}

export default function LearningCurvePage() {
  const { data, loading, error, refreshing, canRefresh, refresh } = useLearningCurve()

  // 雷达图数据
  const radarData = data
    ? [
        { subject: '正确性', value: data.dimensions.correctness.score, fullMark: 100 },
        { subject: '复杂性', value: data.dimensions.complexity.score, fullMark: 100 },
        { subject: '代码质量', value: data.dimensions.quality.score, fullMark: 100 },
      ]
    : []

  return (
    <div className={styles.page}>
      <NavBar title="学习曲线" />

      {/* ── 头部 ── */}
      <header className={styles.header}>
        <h1 className={styles.title}>📊 个人学习曲线</h1>
        <button
          type="button"
          className={`${styles.refreshBtn} ${!canRefresh || refreshing ? styles.disabled : ''}`}
          onClick={refresh}
          disabled={!canRefresh || refreshing}
        >
          {refreshing ? '⏱ 分析中...' : '🔄 更新数据'}
        </button>
      </header>

      {/* ── 等待聚合结果的遮罩提示 ── */}
      {refreshing && (
        <div className={styles.pollingOverlay}>
          <div className={styles.pollingBox}>
            <div className={styles.spinner} />
            <p>正在分析您的学习数据...</p>
            <p style={{ color: '#9ca3af', fontSize: 12 }}>后端正在聚合代码分析结果，请稍候</p>
          </div>
        </div>
      )}

      {/* ── 加载 / 错误 / 空状态 ── */}
      {!refreshing && loading && (
        <div className={styles.centerMsg}>
          <div className={styles.spinner} />
          <p>加载学习数据中...</p>
        </div>
      )}

      {!refreshing && !loading && error && (
        <div className={styles.centerMsg}>
          <p className={styles.errorText}>{error}</p>
          <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 8 }}>
            提交一些练习后这里会展示你的学习分析
          </p>
        </div>
      )}

      {/* ── 主内容（有数据时）── */}
      {!refreshing && !loading && data && !error && (
        <>
          {/* 两列布局 */}
          <div className={styles.grid}>
            {/* 左列：图表 */}
            <div className={styles.colLeft}>
              {/* 综合分 + 等级 */}
              <div className={styles.scoreCard}>
                <span className={styles.scoreLabel}>当前综合分</span>
                <span className={styles.scoreValue}>{data.overall_score.toFixed(1)}</span>
                <span className={`${styles.levelBadge} ${LEVEL_STYLE[data.dimensions.complexity.level || 'normal']}`}>
                  {data.dimensions.complexity.level === 'runaway' && '⚠️ '}
                  {data.dimensions.complexity.level === 'elevated' && '⚡ '}
                  {data.dimensions.complexity.level === 'normal' && '✅ '}
                  {(data.dimensions.complexity.level || 'normal').toUpperCase()}
                </span>
              </div>

              {/* 雷达图 */}
              <section className={styles.chartCard}>
                <h3 className={styles.cardTitle}>三维能力雷达图</h3>
                <ScoreRadarChart data={radarData} height={300} />
                {/* 维度趋势小标签 */}
                <div className={styles.trendRow}>
                  {(['correctness', 'complexity', 'quality'] as const).map((dim) => {
                    const d = data.dimensions[dim]
                    const label = dim === 'correctness' ? '正确性' :
                                    dim === 'complexity' ? '复杂性' : '质量'
                    return (
                      <span key={dim} className={styles.trendItem}>
                        {label}{' '}
                        <span className={styles.trendIcon}>
                          {TREND_ICON[d.trend] || '?'} {d.score.toFixed(0)}
                        </span>
                      </span>
                    )
                  })}
                </div>
              </section>

              {/* 趋势折线图 */}
              <section className={styles.chartCard}>
                <h3 className={styles.cardTitle}>周趋势变化</h3>
                <TrendLineChart data={data.chart_data?.weekly_scores || []} height={260} />
              </section>
            </div>

            {/* 右列：洞察 + 风险 + 条形图 */}
            <div className={styles.colRight}>
              {/* AI 洞察 */}
              <section className={`${styles.chartCard} ${styles.insightCard}`}>
                <h3 className={styles.cardTitle}>🤖 AI 学习洞察</h3>
                <div className={styles.insightBody}>
                  {data.ai_insight ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {data.ai_insight}
                    </ReactMarkdown>
                  ) : (
                    <p className={styles.placeholder}>
                      AI 洞见生成中或暂不可用...
                    </p>
                  )}
                </div>
                {/* 建议 */}
                {data.recommendations && data.recommendations.length > 0 && (
                  <ul className={styles.recoList}>
                    {data.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </section>

              {/* 模式标签 */}
              {data.patterns && data.patterns.length > 0 && (
                <section className={styles.patternSection}>
                  <h4 className={styles.subTitle}>📈 当前模式</h4>
                  <div className={styles.tagGroup}>
                    {data.patterns.map((p) => (
                      <span key={p} className={styles.patternTag}>
                        {p.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* 风险警告 */}
              {data.risk_flags && data.risk_flags.length > 0 && (
                <section className={styles.riskSection}>
                  <h4 className={styles.subTitle}>⚠️ 风险提示</h4>
                  <div className={styles.riskList}>
                    {data.risk_flags.map((flag) => (
                      <span
                        key={flag}
                        className={styles.riskItem}
                        style={{ borderLeftColor: RISK_COLORS[flag] || '#ef4444' }}
                      >
                        {RISK_LABELS[flag] || flag}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* 难度分组条形图 */}
              <section className={styles.chartCard}>
                <h3 className={styles.cardTitle}>📋 难度表现分布</h3>
                <ExerciseBarChart
                  data={data.chart_data?.exercise_breakdown || []}
                  height={(data.chart_data?.exercise_breakdown?.length || 0) * 70 + 40}
                />
              </section>
            </div>
          </div>

          {/* 底部统计栏 */}
          <footer className={styles.statsFooter}>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{data.total_submissions}</span>
              <span className={styles.statLabel}>总提交次数</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statNum}>{data.total_passed}</span>
              <span className={styles.statLabel}>通过数</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statNum}>{data.pass_rate}%</span>
              <span className={styles.statLabel}>通过率</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statNum}>{data.average_score}</span>
              <span className={styles.statLabel}>平均分</span>
            </div>
            {data.updated_at && (
              <>
                <div className={styles.statDivider} />
                <div className={styles.statItem}>
                  <span className={styles.statLabel} style={{ fontSize: 11 }}>
                    最后更新：{new Date(data.updated_at).toLocaleString('zh-CN')}
                  </span>
                </div>
              </>
            )}
          </footer>
        </>
      )}
    </div>
  )
}
