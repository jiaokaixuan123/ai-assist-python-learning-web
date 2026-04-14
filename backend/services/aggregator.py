"""
学习曲线聚合服务

从 code_analytics 原始记录中聚合出用户的学习曲线快照：
  - 按周分组统计各维度趋势
  - 检测学习模式（进步/停滞/退步）
  - 可选：调用 AI 生成学习洞察建议
"""

import asyncio
from datetime import datetime, timedelta
from typing import List, Optional
from collections import defaultdict
from bson import ObjectId

from core.database import get_db


async def aggregate_user_learning_curve(user_id: str, force: bool = False) -> dict:
    """
    为单个用户生成/更新学习曲线聚合数据

    Args:
        user_id: 用户 ID
        force: 是否强制重新计算（忽略冷却时间）

    Returns:
        操作结果摘要 { ok, records_found, records_analyzed, ... }
    """
    db = get_db()
    now = datetime.utcnow()

    # ── 1. 取最近 28 天的原始分析记录 ──
    cutoff = now - timedelta(days=28)
    raw = await db.code_analytics.find({
        "user_id": user_id,
        "submitted_at": {"$gte": cutoff},
    }).sort("submitted_at", 1).to_list(500)

    if not raw:
        return {"ok": True, "records_found": 0, "message": "暂无分析数据"}

    # 冷却检查：距上次聚合不足 5 分钟则跳过（除非强制）
    if not force:
        last_curve = await db.learning_curve.find_one({"user_id": user_id})
        if last_curve and last_curve.get("updated_at"):
            elapsed = (now - last_curve["updated_at"]).total_seconds()
            if elapsed < 300:
                return {
                    "ok": True,
                    "records_found": len(raw),
                    "message": f"距上次聚合仅 {int(elapsed)}s，跳过",
                }

    # ── 2. 按 7 天窗口分组（最近 4 周）──
    weekly_groups = _group_by_week(raw, now)

    # ── 3. 计算每周维度均值 ──
    weekly_scores = []
    for i, (week_start, week_end, records) in enumerate(weekly_groups):
        week_label = f"第{i+1}周"
        
        n = len(records)
        c_scores = [r["dimensions"]["correctness"]["score"] for r in records]
        x_scores = [r["dimensions"]["complexity"]["score"] for r in records]
        q_scores = [r["dimensions"]["quality"]["score"] for r in records]
        
        corr = sum(c_scores) / n if n else 0
        comp = sum(x_scores) / n if n else 0
        qual = sum(q_scores) / n if n else 0
        overall = round(corr * 0.50 + comp * 0.40 + qual * 0.10, 1)
        
        latest_level = records[-1]["level"] if records else "normal"
        
        weekly_scores.append({
            "week_label": week_label,
            "week_start": week_start.isoformat(),
            "correctness": round(corr, 1),
            "complexity": round(comp, 1),
            "quality": round(qual, 1),
            "overall": overall,
            "submission_count": n,
            "_latest_level": latest_level,
        })

    # ── 4. 计算趋势（最新周 vs 上一周）──
    current = weekly_scores[-1]
    previous = weekly_scores[-2] if len(weekly_scores) >= 2 else current

    trends = _calc_trends(current, previous)

    # 最新一周的 level
    current_levels = [
        r["level"] for r in raw
        if (now - r["submitted_at"]) <= timedelta(days=7)
    ]
    latest_level = "runaway" if "runaway" in current_levels else (
        "elevated" if "elevated" in current_levels else "normal"
    )

    # ── 5. 模式检测 ──
    patterns = detect_patterns(weekly_scores, raw)

    # ── 6. 风险标记 ──
    risk_flags = detect_risks(raw, current)

    # ── 7. 各题按难度分组平均分统计 ──
    exercise_breakdown = await calc_per_exercise_breakdown(raw)

    # ── 8. AI 洞察生成（可选）──
    ai_insight = ""
    recommendations = []
    
    try:
        from ai import is_ai_available, get_provider, ChatOptions, ChatMessage
        if is_ai_available():
            provider = get_provider()
            prompt_text = _build_insight_prompt(
                user_id, weekly_scores, patterns, risk_flags, raw
            )
            resp = await provider.chat(ChatOptions(
                messages=[ChatMessage(role="user", content=prompt_text)],
                temperature=0.3,
                max_tokens=500,
            ))
            ai_insight = resp.content
            
            # 从洞察文字中提取关键建议
            recommendations = extract_recommendations(ai_insight)
    except Exception as e:
        ai_insight = f"（AI 洞察生成暂时不可用: {str(e)[:50]}）"

    # ── 9. 统计摘要 ──
    total_submissions = len(raw)
    total_passed = sum(1 for r in raw if r.get("passed"))
    pass_rate = round(total_passed / total_submissions * 100, 1) if total_submissions > 0 else 0
    avg_score = round(sum(r["overall_score"] for r in raw) / total_submissions, 1) if total_submissions > 0 else 0

    # ── 10. 组装文档写入 learning_curve ──
    curve_doc = {
        "user_id": user_id,
        "period_start": weekly_groups[-1][0] if weekly_groups else now,
        "period_end": weekly_groups[-1][1] if weekly_groups else now,
        "dimensions": {
            "correctness": {"score": current["correctness"], "trend": trends["correctness"]},
            "complexity": {
                "score": current["complexity"],
                "trend": trends["complexity"],
                "level": latest_level,
            },
            "quality": {"score": current["quality"], "trend": trends["quality"]},
        },
        "overall_score": current["overall"],
        "patterns": patterns,
        "ai_insight": ai_insight,
        "recommendations": recommendations,
        "risk_flags": risk_flags,
        "chart_data": {
            "weekly_scores": [
                {k: v for k, v in w.items() if not k.startswith("_")}
                for w in weekly_scores
            ],
            "exercise_breakdown": exercise_breakdown,
        },
        "total_submissions": total_submissions,
        "total_passed": total_passed,
        "pass_rate": pass_rate,
        "average_score": avg_score,
        "updated_at": now,
    }

    await db.learning_curve.update_one(
        {"user_id": user_id},
        {"$set": curve_doc},
        upsert=True,
    )

    return {
        "ok": True,
        "records_found": len(raw),
        "records_analyzed": len(raw),
        "message": f"成功聚合 {len(raw)} 条记录",
    }


# ══════════════════════════════════════
# 内部工具函数
# ══════════════════════════════════════

def _group_by_week(raw_records: list, reference_now: datetime):
    """将记录按自然周分组，返回 [(week_start, week_end, [records]), ...]"""
    groups = []
    # 从当前时间往前推，每 7 天一组
    for i in range(4):
        end = reference_now - timedelta(days=i * 7)
        start = end - timedelta(days=7)
        week_recs = [
            r for r in raw_records
            if start <= r["submitted_at"] < end
        ]
        groups.insert(0, (start, end, week_recs))
    return groups


def _calc_trends(current: dict, previous: dict) -> dict:
    """计算三维度趋势标签"""
    result = {}
    for dim in ["correctness", "complexity", "quality"]:
        diff = current[dim] - previous[dim]
        if diff > 3:
            result[dim] = "up"
        elif diff < -3:
            result[dim] = "down"
        else:
            result[dim] = "stable"
    return result


def detect_patterns(weekly_scores: list, raw_records: list) -> List[str]:
    """
    学习模式检测
    
    返回模式标签列表，如 ["improving_steadily", "complexity_elevating"]
    """
    patterns = []

    if not weekly_scores or len(weekly_scores) < 2:
        return patterns or ["insufficient_data"]

    # 整体趋势判断（至少有 2 周以上数据时）
    first_half = weekly_scores[:max(1, len(weekly_scores)//2)]
    second_half = weekly_scores[len(weekly_scores)//2:]
    
    first_avg = sum(w["overall"] for w in first_half) / len(first_half) if first_half else 0
    second_avg = sum(w["overall"] for w in second_half) / len(second_half) if second_half else 0
    
    if second_avg > first_avg + 5:
        patterns.append("improving")
    elif second_avg < first_avg - 5:
        patterns.append("declining")
    elif abs(second_avg - first_avg) <= 3:
        patterns.append("stagnant")

    # 复杂度专项检测
    recent_complexity = [w["complexity"] for w in weekly_scores[-2:]]
    early_complexity = [w["complexity"] for w in weekly_scores[:2]]
    if recent_complexity and early_complexity:
        if sum(recent_complexity)/len(recent_complexity) < sum(early_complexity)/len(early_complexity) - 10:
            patterns.append("complexity_improving")
        elif sum(recent_complexity)/len(recent_complexity) > sum(early_complexity)/len(early_complexity) + 10:
            patterns.append("complexity_elevating")

    # 正确率变化
    recent_corr = [w["correctness"] for w in weekly_scores[-2:]]
    early_corr = [w["correctness"] for w in weekly_scores[:2]]
    if recent_corr and early_corr:
        if all(c >= 90 for c in recent_corr) and any(c < 70 for c in early_corr):
            patterns.append("accuracy_surge")

    # 提交频率检测
    recent_week_subs = weekly_scores[-1].get("submission_count", 0) if weekly_scores else 0
    if recent_week_subs > 15:
        patterns.append("high_activity")

    # 质量提升
    if len(weekly_scores) >= 2:
        if weekly_scores[-1]["quality"] > weekly_scores[0]["quality"] + 15:
            patterns.append("quality_improving")

    return patterns or ["developing"]


def detect_risks(raw_records: list, current_week: dict) -> List[str]:
    """风险标记检测"""
    flags = []

    # 最近 5 条记录中有 runaway 标记
    recent_runaway = [r for r in raw_records[-5:] if r.get("level") == "runaway"]
    if recent_runaway:
        flags.append("recent_runaway")

    # 复杂度持续偏低
    if current_week.get("complexity", 100) < 40:
        flags.append("low_complexity_score")

    # 近期尝试过多
    recent_7d = [
        r for r in raw_records
        if (datetime.utcnow() - r["submitted_at"]).days <= 7
    ]
    if len(recent_7d) > 25:
        flags.append("excessive_retry")

    # 通过率过低
    passed_count = sum(1 for r in recent_7d if r.get("passed")) if recent_7d else 0
    if recent_7d and passed_count / len(recent_7d) < 0.3:
        flags.append("low_pass_rate")

    # 质量停滞（始终在低分区）
    quality_vals = [r["dimensions"]["quality"]["score"] for r in raw_records[-10:]] if raw_records else []
    if quality_vals and all(q < 65 for q in quality_vals) and len(quality_vals) >= 5:
        flags.append("quality_stagnant_low")

    return flags


async def calc_per_exercise_breakdown(raw_records: list) -> List[dict]:
    """按题目难度（简单/中等/困难）分组统计平均分"""
    ex_map = defaultdict(list)
    title_map = {}
    diff_map = {}

    for r in raw_records:
        eid = r["exercise_id"]
        ex_map[eid].append(r)

    # 尝试获取题目标题和难度（批量查询）
    eids = list(ex_map.keys())
    db = get_db()
    cursor = await db.exercises.find(
        {"_id": {"$in": [ObjectId(eid) for eid in eids]}},
        {"title": 1, "difficulty": 1},
    ).to_list(len(eids))
    for doc in cursor:
        did = str(doc.pop("_id"))
        title_map[did] = doc.get("title", f"练习{did[:6]}")
        diff_map[did] = doc.get("difficulty", "medium")

    # 按难度分桶
    DIFF_LABELS = {
        "easy": "简单",
        "medium": "中等",
        "hard": "困难",
    }
    buckets: dict[str, list] = defaultdict(list)
    for eid, recs in ex_map.items():
        diff = diff_map.get(eid, "medium")
        buckets[diff].append((eid, recs))

    results = []
    for diff_key in ("easy", "medium", "hard"):
        bucket = buckets.get(diff_key, [])
        if not bucket:
            continue

        # 合并该难度下所有提交记录
        all_recs = [r for _, recs in bucket for r in recs]
        n = len(all_recs)
        avg_c = sum(r["dimensions"]["correctness"]["score"] for r in all_recs) / n if n else 0
        avg_x = sum(r["dimensions"]["complexity"]["score"] for r in all_recs) / n if n else 0
        avg_q = sum(r["dimensions"]["quality"]["score"] for r in all_recs) / n if n else 0
        avg_o = sum(r["overall_score"] for r in all_recs) / n if n else 0
        p_rate = sum(1 for r in all_recs if r.get("passed")) / n * 100 if n else 0
        exercise_count = len(bucket)

        results.append({
            "difficulty_label": DIFF_LABELS.get(diff_key, diff_key),
            "difficulty_key": diff_key,
            "avg_correctness": round(avg_c, 1),
            "avg_complexity": round(avg_x, 1),
            "avg_quality": round(avg_q, 1),
            "avg_overall": round(avg_o, 1),
            "attempt_count": n,
            "pass_rate": round(p_rate, 1),
            "exercise_count": exercise_count,
        })

    return results


def _build_insight_prompt(user_id: str, weekly_scores: list, patterns: list,
                          risk_flags: list, raw_records: list) -> str:
    """构建 AI 洞察生成的 prompt"""
    pattern_str = "、".join(patterns) if patterns else "正常发展"
    risk_str = "、".join(risk_flags) if risk_flags else "无"
    
    latest = weekly_scores[-1] if weekly_scores else {}
    scores_summary = (
        f"最新一周：正确性 {latest.get('correctness', 0)}, "
        f"复杂度 {latest.get('complexity', 0)}, "
        f"质量 {latest.get('quality', 0)}"
    )

    total = len(raw_records)
    passed = sum(1 for r in raw_records if r.get("passed"))

    return f"""你是一个专业的编程教育数据分析助手。请基于以下学生学习数据分析，给出简明扼要的学习建议。

【学生 ID】{user_id}
【总提交数】{total}, 【通过数】{passed}
【三维评分】{scores_summary}
【学习模式】{pattern_str}
【风险标记】{risk_str}

要求：
- 用中文回复，150~300 字
- 先肯定进步或亮点（如有），再指出需要改进的方面
- 给出 2-3 条具体可操作的建议
- 语言鼓励为主，适合初学者阅读"""


def extract_recommendations(insight_text: str) -> List[str]:
    """从 AI 洞察文本中提取关键建议条目"""
    recs = []
    lines = insight_text.strip().split('\n')
    for line in lines:
        line = line.strip()
        # 匹配数字编号、破折号、星号开头的建议行
        if re.match(r'^(\d+[.、)）]|[-–—*•·])', line) and len(line) > 6:
            clean = re.sub(r'^[\d\s.、)）\-–—*•·]+\s*', '', line)
            if clean:
                recs.append(clean[:80])
    return recs[:5]


import re
