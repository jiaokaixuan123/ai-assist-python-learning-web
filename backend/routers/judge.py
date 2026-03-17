from fastapi import APIRouter, HTTPException
from bson import ObjectId
from pydantic import BaseModel
from core.database import get_db
import sys
import io
import traceback

router = APIRouter(prefix="/api/judge", tags=["judge"])


class SubmitRequest(BaseModel):
    exercise_id: str
    code: str


@router.post("/submit")
async def judge_code(req: SubmitRequest):
    """服务端判题（使用沙箱执行）"""
    db = get_db()

    # 获取测试用例
    exercise = await db.exercises.find_one({"_id": ObjectId(req.exercise_id)})
    if not exercise:
        raise HTTPException(404, "题目不存在")

    test_cases = exercise.get("test_cases", [])
    passed_count = 0
    results = []

    for tc in test_cases:
        try:
            # 使用沙箱执行用户代码
            stdout_io = io.StringIO()
            stderr_io = io.StringIO()
            old_stdout, old_stderr = sys.stdout, sys.stderr

            try:
                sys.stdout, sys.stderr = stdout_io, stderr_io

                # 创建受限的执行环境
                exec_globals = {
                    "__builtins__": {
                        "print": print,
                        "len": len,
                        "range": range,
                        "str": str,
                        "int": int,
                        "float": float,
                        "list": list,
                        "dict": dict,
                        "set": set,
                        "tuple": tuple,
                        "sum": sum,
                        "min": min,
                        "max": max,
                        "sorted": sorted,
                        "enumerate": enumerate,
                        "zip": zip,
                        "map": map,
                        "filter": filter,
                        "abs": abs,
                        "round": round,
                        "True": True,
                        "False": False,
                        "None": None,
                    }
                }

                # 执行代码
                exec(req.code, exec_globals)

                # 获取输出
                output = stdout_io.getvalue().strip()
                expected = tc["expected_output"].strip()

                passed = output == expected
                passed_count += passed

                results.append({
                    "input": tc.get("input", ""),
                    "expected": expected,
                    "actual": output,
                    "passed": passed
                })

            finally:
                sys.stdout, sys.stderr = old_stdout, old_stderr

        except Exception as e:
            results.append({
                "input": tc.get("input", ""),
                "expected": tc["expected_output"],
                "actual": "",
                "passed": False,
                "error": str(e)
            })

    return {
        "passed": passed_count == len(test_cases),
        "passed_count": passed_count,
        "total": len(test_cases),
        "results": results
    }
