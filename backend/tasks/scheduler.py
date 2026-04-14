"""
定时任务调度器

使用 APScheduler 在系统空闲时段（凌晨 3:00）自动执行：
  - 学习曲线数据聚合（对过去 24h 有活跃的用户）

用法（在 main.py 的 lifespan 中启动）：
    from tasks.scheduler import start_scheduler
    start_scheduler()
"""

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def daily_aggregation_job():
    """
    每日定时任务：聚合所有活跃用户的学习曲线
    
    只处理过去 24 小时有新提交记录的用户。
    """
    logger.info("[Scheduler] 开始每日学习曲线聚合...")
    
    try:
        from core.database import get_db
        from datetime import datetime, timedelta
        
        db = get_db()
        cutoff = datetime.utcnow() - timedelta(days=1)
        
        # 找出过去 24h 有新提交的去重用户列表
        pipeline = [
            {"$match": {"submitted_at": {"$gte": cutoff}}},
            {"$group": {"_id": "$user_id"}},
        ]
        active_users = await db.code_analytics.aggregate(pipeline).to_list(None)
        
        if not active_users:
            logger.info("[Scheduler] 过去 24h 无新提交，跳过聚合")
            return

        user_ids = [str(u["_id"]) for u in active_users]
        logger.info(f"[Scheduler] 发现 {len(user_ids)} 个活跃用户，开始逐个聚合...")
        
        from services.aggregator import aggregate_user_learning_curve
        
        success_count = 0
        fail_count = 0
        
        for uid in user_ids:
            try:
                result = await aggregate_user_learning_curve(uid, force=True)
                success_count += 1
            except Exception as e:
                logger.error(f"[Scheduler] 聚合用户 {uid} 失败: {e}", exc_info=True)
                fail_count += 1
        
        logger.info(
            f"[Scheduler] 每日聚合完成：成功 {success_count}, 失败 {fail_count}"
        )
        
    except Exception as e:
        logger.error(f"[Scheduler] 每日聚合任务异常: {e}", exc_info=True)


def start_scheduler():
    """启动 APScheduler（在应用启动时调用一次）"""
    global _scheduler

    if _scheduler is not None:
        return  # 已启动过

    _scheduler = AsyncIOScheduler(timezone="Asia/Shanghai")

    # 每天凌晨 3:00 执行学习曲线聚合
    _scheduler.add_job(
        daily_aggregation_job,
        trigger=CronTrigger(hour=3, minute=0),
        id="daily_learning_curve_aggregation",
        name="每日学习曲线聚合",
        replace_existing=True,
    )

    _scheduler.start()
    logger.info("[Scheduler] 定时任务已启动 — 每日 03:00 执行学习曲线聚合")


def shutdown_scheduler():
    """关闭调度器（应用关闭时调用）"""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("[Scheduler] 定时任务已关闭")
