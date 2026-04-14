"""学习曲线分析相关数据模型"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ══════════════════════════════════════
# 1. 代码分析记录（每次提交生成一条）
# ══════════════════════════════════════


class CorrectnessDetail(BaseModel):
    """正确性维度详情"""
    score: float = Field(ge=0, le=100)
    passed: bool
    test_score: str = ""              # "3/3" 或 "2/3"
    error_category: Optional[str] = None   # runtime_error | logic_error | none
    attempt_factor: float = 1.0       # 首次通过=1.0, 第2次=0.85, 第3次+=0.7


class ComplexityDetail(BaseModel):
    """时空复杂性维度详情"""
    score: float = Field(ge=0, le=100)
    level: str = "normal"             # normal | elevated | runaway
    cyclomatic_complexity: int = 0
    nesting_depth: int = 0
    loc: int = 0
    time_complexity: str = "unknown"
    space_complexity: str = "unknown"
    complexity_vs_ref: float = 1.0    # 与参考解答的比值，无参考时=1.0


class QualityDetail(BaseModel):
    """代码质量维度详情（奖励制 base=60）"""
    score: float = Field(ge=40, le=100)  # 保底40
    has_docstring: bool = False
    has_comments: bool = False
    naming_score: int = 0               # 0~10
    has_type_hints: bool = False
    pythonic_features: List[str] = []
    bonuses: dict = {}                  # 各奖励项明细


class BehaviorMetadata(BaseModel):
    """用户行为元数据"""
    time_spent_ms: int = 0              # 页面停留到提交的毫秒数
    edit_count: int = 0                 # 编辑器编辑次数
    hint_used: bool = False             # 是否使用了 AI 提示
    attempt_number: int = 1             # 此题第几次提交


class DimensionsScore(BaseModel):
    """三维评分容器"""
    correctness: CorrectnessDetail
    complexity: ComplexityDetail
    quality: QualityDetail
    overall: float = Field(ge=0, le=100)


class CodeAnalyticsRecordIn(BaseModel):
    """
    提交给后端的分析请求体（由 submit 端点内部构造）
    
    注意：此模型不直接暴露给前端，
    前端只传 SubmissionIn + behavior_metadata，
    后端在 submit 端点中组装后传入 CodeAnalyzer
    """
    user_id: str
    exercise_id: str
    code_text: str
    submitted_at: datetime
    
    # 原始判题结果
    passed: bool
    test_result: str = ""
    
    # 行为数据
    behavior: BehaviorMetadata = BehaviorMetadata()
    
    # 参考解答分析结果（可选）
    ref_analysis: Optional[dict] = None


class CodeAnalyticsOut(BaseModel):
    """单次代码分析输出"""
    id: str = ""
    user_id: str
    exercise_id: str
    dimensions: DimensionsScore
    behavior: BehaviorMetadata
    overall_score: float
    level: str = "normal"
    submitted_at: datetime


# ══════════════════════════════════════
# 2. 聚合后的学习曲线快照
# ══════════════════════════════════════


class DimensionTrend(BaseModel):
    """单个维度的趋势数据"""
    score: float
    trend: str = "stable"          # up | down | stable
    level: Optional[str] = None    # 仅 complexity 有


class DimensionSnapshot(BaseModel):
    """维度快照（用于曲线文档中的 dimensions 字段）"""
    correctness: DimensionTrend
    complexity: DimensionTrend
    quality: DimensionTrend


class WeeklyScorePoint(BaseModel):
    """周评分数据点（图表用）"""
    week_label: str                # "第1周", "第2周", ...
    week_start: str                # ISO date
    correctness: float
    complexity: float
    quality: float
    overall: float
    submission_count: int = 0


class ExerciseBreakdownItem(BaseModel):
    """单题平均分统计（图表用）"""
    exercise_id: str
    exercise_title: str
    avg_correctness: float = 0
    avg_complexity: float = 0
    avg_quality: float = 0
    avg_overall: float = 0
    attempt_count: int = 0
    pass_rate: float = 0


class LearningCurveDocument(BaseModel):
    """
    学习曲线聚合文档（存入 MongoDB learning_curve 集合）
    每个用户最多保留一份（upsert 更新）
    """
    user_id: str
    period_start: datetime
    period_end: datetime
    
    # 三维评分 + 趋势
    dimensions: DimensionSnapshot
    overall_score: float
    
    # 模式检测
    patterns: List[str] = []        # improving / stagnating / declining / ...
    
    # AI 洞察
    ai_insight: str = ""            # GLM-4 生成的学习建议文字
    recommendations: List[str] = []
    
    # 风险标记
    risk_flags: List[str] = []      # complexity_runaway / excessive_retry / ...
    
    # 图表数据
    chart_data: dict = {
        "weekly_scores": [],
        "exercise_breakdown": [],
    }
    
    # 统计摘要
    total_submissions: int = 0
    total_passed: int = 0
    pass_rate: float = 0
    average_score: float = 0
    
    updated_at: datetime


# ══════════════════════════════════════
# 3. API 请求/响应模型
# ══════════════════════════════════════


class RefreshCurveResponse(BaseModel):
    """手动刷新曲线的响应"""
    ok: bool
    message: str
    records_analyzed: int = 0


class CurveStatusResponse(BaseModel):
    """曲线数据状态查询"""
    has_data: bool
    record_count: int = 0
    last_updated: Optional[str] = None
