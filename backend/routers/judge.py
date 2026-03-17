from fastapi import APIRouter, HTTPException
from bson import ObjectId
from pydantic import BaseModel
from core.database import get_db
import sys
import io
import traceback
import ast

router = APIRouter(prefix="/api/judge", tags=["judge"])


class SubmitRequest(BaseModel):
    exercise_id: str
    code: str


SAFE_BUILTINS = {
    "print": print, "len": len, "range": range, "str": str, "int": int,
    "float": float, "list": list, "dict": dict, "set": set, "tuple": tuple,
    "sum": sum, "min": min, "max": max, "sorted": sorted, "enumerate": enumerate,
    "zip": zip, "map": map, "filter": filter, "abs": abs, "round": round,
    "bool": bool, "isinstance": isinstance, "type": type,
    "True": True, "False": False, "None": None,
}


def _get_func_name(code: str) -> str | None:
    """从用户代码中提取最后一个顶层函数名"""
    try:
        tree = ast.parse(code)
        funcs = [n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]
        return funcs[-1] if funcs else None
    except Exception:
        return None


@router.post("/submit")
async def judge_code(req: SubmitRequest):
    db = get_db()
    exercise = await db.exercises.find_one({"_id": ObjectId(req.exercise_id)})
    if not exercise:
        raise HTTPException(404, "题目不存在")

    test_cases = exercise.get("test_cases", [])
    func_name = _get_func_name(req.code)

    passed_count = 0
    results = []

    for tc in test_cases:
        stdout_io = io.StringIO()
        old_stdout, old_stderr = sys.stdout, sys.stderr
        try:
            sys.stdout, sys.stderr = stdout_io, io.StringIO()
            exec_globals = {"__builtins__": SAFE_BUILTINS}
            exec(req.code, exec_globals)

            tc_input = tc.get("input", "").strip()
            expected_raw = tc["expected_output"].strip()

            if func_name and func_name in exec_globals:
                # 用测试用例 input 作为参数调用函数
                call_expr = f"{func_name}({tc_input})"
                actual_val = eval(call_expr, exec_globals)
                actual_str = repr(actual_val)
                # 尝试与期望值做 Python 值比较，fallback 到字符串比较
                try:
                    expected_val = eval(expected_raw, {"__builtins__": SAFE_BUILTINS})
                    passed = actual_val == expected_val
                except Exception:
                    passed = actual_str.strip() == expected_raw
            else:
                # 没有函数定义，退回到 stdout 比较
                output = stdout_io.getvalue().strip()
                passed = output == expected_raw
                actual_str = output

            passed_count += int(passed)
            results.append({
                "input": tc_input,
                "expected": expected_raw,
                "actual": actual_str if func_name else stdout_io.getvalue().strip(),
                "passed": passed,
            })
        except Exception as e:
            results.append({
                "input": tc.get("input", ""),
                "expected": tc["expected_output"],
                "actual": "",
                "passed": False,
                "error": traceback.format_exc(limit=3),
            })
        finally:
            sys.stdout, sys.stderr = old_stdout, old_stderr

    return {
        "passed": passed_count == len(test_cases),
        "passed_count": passed_count,
        "total": len(test_cases),
        "results": results,
    }
