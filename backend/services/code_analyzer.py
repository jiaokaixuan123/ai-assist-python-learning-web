"""
CodeAnalyzer — 代码静态分析引擎

基于 Python AST 对用户提交的代码进行三维度分析：
  1. 正确性 Correctness (50%) — 刚性判定 + 错误分类
  2. 复杂性 Complexity  (40%) — 圈复杂度/嵌套深度/Big-O 启发式估算 + 参考解对比
  3. 质量 Quality      (10%) — 奖励制 base=60 + bonus pool

设计原则：
  - 纯函数风格，不依赖外部状态
  - 所有异常安全捕获，保证不因分析失败阻塞提交流程
  - 初学者友好：质量维度不扣分，只加分
"""

import ast
import re
from typing import Optional, List
from models.analytics import (
    CorrectnessDetail,
    ComplexityDetail,
    QualityDetail,
    BehaviorMetadata,
    DimensionsScore,
)


# ══════════════════════════════════════════════
# 公共入口
# ══════════════════════════════════════════════

class CodeAnalyzer:
    """
    代码静态分析器
    
    用法：
        analyzer = CodeAnalyzer()
        result = analyzer.analyze(code_text, passed, test_result, behavior, ref_analysis=None)
        # result: dict (可直接写入 code_analytics 集合)
    
    也可单独调用各子分析方法：
        cc = analyzer.calc_cyclomatic_complexity(ast_tree)
    """

    def analyze(
        self,
        code_text: str,
        passed: bool,
        test_result: str = "",
        behavior: BehaviorMetadata = BehaviorMetadata(),
        ref_analysis: Optional[dict] = None,
    ) -> dict:
        """
        完整的三维分析入口
        
        Args:
            code_text: 用户提交的 Python 源码
            passed: 判题是否全部通过
            test_result: 判题结果描述字符串
            behavior: 用户行为元数据
            ref_analysis: 参考解答的预分析结果（如有）
        
        Returns:
            包含 dimensions / overall_score / level 的字典
        """
        try:
            tree = ast.parse(code_text)
        except SyntaxError:
            # 语法错误时给出最低分但不会崩溃
            return self._syntax_error_fallback(
                code_text, passed, test_result, behavior
            )

        # 三维独立计算
        correctness = self._calc_correctness(passed, test_result, behavior.attempt_number)
        complexity = self._calc_complexity(tree, code_text, ref_analysis)
        quality = self._calc_quality(code_text, tree)

        # 加权总分
        overall = (
            correctness.score * 0.50 +
            complexity.score * 0.40 +
            quality.score * 0.10
        )
        overall = round(min(100, max(0, overall)), 1)

        # 综合等级判定
        level = self._judge_level(complexity.level, overall)

        return {
            "dimensions": {
                "correctness": correctness.model_dump(),
                "complexity": complexity.model_dump(),
                "quality": quality.model_dump(),
                "overall": overall,
            },
            "overall_score": overall,
            "level": level,
        }

    # ── 维度一：正确性 (45%) ─────────────────────

    def _calc_correctness(
        self, passed: bool, test_result: str, attempt_number: int = 1
    ) -> CorrectnessDetail:
        """
        正确性评估：刚性通过/失败 + 尝试次数惩罚
        
        评分规则：
          - 全部通过: base 90~100 (首次100, 每多一次尝试 -5)
          - 未通过: base 30~70 (按通过率加权)
        """
        if passed:
            # 通过分 = 90 + min(10, 10 // attempt)，首次=100, 二次=95...
            attempt_factor = max(0.7, 1.0 - (attempt_number - 1) * 0.15)
            base = min(100, 90 + min(10, 10 // max(1, attempt_number)))
            error_cat = "none"
        else:
            # 解析 "x/y 用例通过" 格式
            attempt_factor = max(0.7, 1.0 - (attempt_number - 1) * 0.10)
            match = re.search(r'(\d+)/(\d+)', test_result)
            if match:
                passed_n, total_n = int(match.group(1)), int(match.group(2))
                ratio = passed_n / total_n if total_n > 0 else 0
                base = 30 + ratio * 40  # 30 ~ 70
            else:
                base = 35
                ratio = 0
            
            # 错误分类
            if "Error" in test_result or "Traceback" in test_result:
                error_cat = "runtime_error"
            elif "assert" in test_result.lower() or "Failed" in test_result:
                error_cat = "logic_error"
            else:
                error_cat = "logic_error"

        return CorrectnessDetail(
            score=min(100, round(base * attempt_factor, 1)),
            passed=passed,
            test_score=test_result,
            error_category=error_cat,
            attempt_factor=round(attempt_factor, 2),
        )

    # ── 维度二：复杂性 (35%) ────────────────────

    def _calc_complexity(
        self, tree: ast.AST, code_text: str, ref_analysis: Optional[dict] = None
    ) -> ComplexityDetail:
        """
        复杂性评估：AST 结构指标 + Big-O 启发式 + 参考解对比
        """
        lines = [l for l in code_text.split('\n') if l.strip()]
        loc = len(lines)

        cc = self.cyclomatic_complexity(tree)
        nd = self.max_nesting_depth(tree)
        tc = self.estimate_time_complexity(tree)
        sc = self.estimate_space_complexity(tree, tc)

        if ref_analysis:
            # 与参考解对比模式
            ref_cc = ref_analysis.get("cyclomatic_complexity", 1)
            ref_loc = ref_analysis.get("loc", 1)
            
            cc_ratio = cc / ref_cc if ref_cc > 0 else 1.0
            loc_ratio = loc / ref_loc if ref_loc > 0 else 1.0
            worst_ratio = max(cc_ratio, loc_ratio)

            if worst_ratio > 3.0:
                level = "runaway"
                score = 25
            elif worst_ratio > 1.8:
                level = "elevated"
                score = 50
            elif worst_ratio > 1.3:
                level = "elevated"
                score = 65
            else:
                level = "normal"
                # 接近参考解 → 高分，线性递减
                score = min(100, int(95 * (1.0 / max(worst_ratio, 0.8))))
            
            return ComplexityDetail(
                score=score,
                level=level,
                cyclomatic_complexity=cc,
                nesting_depth=nd,
                loc=loc,
                time_complexity=tc,
                space_complexity=sc,
                complexity_vs_ref=round(worst_ratio, 2),
            )
        else:
            # 无参考解时的绝对评估
            score = self._absolute_complexity_score(cc, nd, loc, tc)
            level = "normal" if score >= 70 else ("elevated" if score >= 45 else "runaway")
            
            return ComplexityDetail(
                score=score,
                level=level,
                cyclomatic_complexity=cc,
                nesting_depth=nd,
                loc=loc,
                time_complexity=tc,
                space_complexity=sc,
                complexity_vs_ref=1.0,
            )

    def _absolute_complexity_score(self, cc, nd, loc, tc_str) -> int:
        """无参考解时的绝对复杂性评分（越简单分数越高）"""
        score = 80
        
        # 圈复杂度扣分 (每超 1 扣 3 分)
        if cc > 5:
            score -= min(30, (cc - 5) * 3)
        
        # 嵌套深度扣分 (超过 3 层每层扣 5 分)
        if nd > 3:
            score -= min(20, (nd - 3) * 5)
        
        # 代码行数扣分 (超过 50 行每 10 行扣 2 分)
        if loc > 50:
            score -= min(15, ((loc - 50) // 10) * 2)
        
        # 时间复杂度严重偏高扣分
        high_complexity = ["O(n²)", "O(n^2)", "O(n³)", "O(n^3)", "O(2^n)", "O(n!)",
                           "O(n*m)", "O(m*n)"]
        for hc in high_complexity:
            if tc_str.lower().replace(" ", "") == hc.lower().replace(" ", ""):
                score -= 20
                break
        
        return max(15, min(100, score))

    # ── 维度三：质量 (20%) — 奖励制 ──────────────

    def _calc_quality(self, code_text: str, tree: ast.AST) -> QualityDetail:
        """
        代码质量评估（初学者友好的奖励制）
        
        基础分 60 分 + 奖励池最高 40 分
        最终范围 [40, 100]，保底 40 分
        """
        BASE_SCORE = 60
        
        bonuses = {}
        
        # 1. 文档字符串 (+15)
        doc_bonus = 15 if self._has_docstring(tree) else 0
        bonuses["docstring"] = doc_bonus
        
        # 2. 有意义注释 (+10)
        comment_bonus = 10 if self._has_meaningful_comments(code_text) else 0
        bonuses["comments"] = comment_bonus
        
        # 3. 命名规范 (+0~10)
        naming_bonus = self._calc_naming_bonus(tree)
        bonuses["naming"] = naming_bonus
        
        # 4. 类型注解 (+5)
        type_hint_bonus = 5 if self._has_type_hints(tree) else 0
        bonuses["type_hints"] = type_hint_bonus
        
        # 5. Pythonic 特性 (+0~10)
        pythonic_list, pythonic_bonus = self._detect_pythonic_features(code_text, tree)
        bonuses["pythonic"] = pythonic_bonus
        
        total_bonus = sum(bonuses.values())
        final_score = BASE_SCORE + total_bonus
        
        return QualityDetail(
            score=max(40, min(100, final_score)),
            has_docstring=doc_bonus > 0,
            has_comments=comment_bonus > 0,
            naming_score=naming_bonus,
            has_type_hints=type_hint_bonus > 0,
            pythonic_features=pythonic_list,
            bonuses=bonuses,
        )

    # ── 综合等级判定 ───────────────────────────

    @staticmethod
    def _judge_level(complexity_level: str, overall: float) -> str:
        """根据复杂度等级和综合分判定最终级别"""
        if complexity_level == "runaway":
            return "runaway"
        if complexity_level == "elevated" and overall < 55:
            return "elevated"
        return "normal"

    # ── 异常降级 ─────────────────────────────────

    @staticmethod
    def _syntax_error_fallback(code_text, passed, test_result, behavior):
        """语法错误时的兜底返回"""
        corr = CodeAnalyzer._calc_correctness_static(passed, test_result, behavior.attempt_number)
        return {
            "dimensions": {
                "correctness": corr.model_dump(),
                "complexity": ComplexityDetail(
                    score=20, level="runaway",
                    cyclomatic_complexity=99, nesting_depth=99, loc=len(code_text.split('\n')),
                    time_complexity="parse_error", space_complexity="unknown", complexity_vs_ref=1.0
                ).model_dump(),
                "quality": QualityDetail(score=40).model_dump(),
                "overall": 20,
            },
            "overall_score": 20.0,
            "level": "runaway",
        }

    @staticmethod
    def _calc_correctness_static(passed, test_result, attempt_number):
        return CodeAnalyzer()._calc_correctness(passed, test_result, attempt_number)

    # ══════════════════════════════════════════════
    # AST 分析工具方法（可独立调用）
    # ══════════════════════════════════════════════

    @staticmethod
    def cyclomatic_complexity(tree: ast.AST) -> int:
        """
        计算圈复杂度 (McCabe Cyclomatic Complexity)
        
        基础值 1，每个决策点 (+1):
          if/elif/else, for, while, except, with, and, or, comprehension, lambda
        """
        class ComplexityVisitor(ast.NodeVisitor):
            def __init__(self):
                self.complexity = 1

            def visit_If(self, node):
                self.complexity += len(node.orelse) + len(node.body)
                # elif 分支
                for child in node.orelse:
                    if isinstance(child, ast.If):
                        self.complexity += 1
                self.generic_visit(node)

            def visit_For(self, node):
                self.complexity += 1
                self.generic_visit(node)

            def visit_While(self, node):
                self.complexity += 1
                self.generic_visit(node)

            def visit_ExceptHandler(self, node):
                self.complexity += 1
                self.generic_visit(node)

            def visit_With(self, node):
                self.complexity += len(node.items)
                self.generic_visit(node)

            def visit_BoolOp(self, node):
                self.complexity += len(node.values) - 1
                self.generic_visit(node)

            def visit_comprehension(self, node):
                self.complexity += 1
                if node.ifs:
                    self.complexity += len(node.ifs)
                self.generic_visit(node)

            def visit_Lambda(self, node):
                self.complexity += 1
                self.generic_visit(node)

            def visit_Assert(self, node):
                self.complexity += 1
                self.generic_visit(node)

        visitor = ComplexityVisitor()
        visitor.visit(tree)
        return visitor.complexity

    @staticmethod
    def max_nesting_depth(tree: ast.AST) -> int:
        """计算最大控制流嵌套深度"""
        class NestingVisitor(ast.NodeVisitor):
            def __init__(self):
                self.max_depth = 0
                self.current_depth = 0

            def _enter(self):
                self.current_depth += 1
                self.max_depth = max(self.max_depth, self.current_depth)

            def _exit(self):
                self.current_depth -= 1

            def visit_If(self, node):
                self._enter()
                self.generic_visit(node)
                self._exit()

            def visit_For(self, node):
                self._enter()
                self.generic_visit(node)
                self._exit()

            def visit_While(self, node):
                self._enter()
                self.generic_visit(node)
                self._exit()

            def visit_With(self, node):
                self._enter()
                self.generic_visit(node)
                self._exit()

            def visit_Try(self, node):
                self._enter()
                self.generic_visit(node)
                self._exit()

            def visit_ExceptHandler(self, node):
                self._enter()
                self.generic_visit(node)
                self._exit()

            def visit_comprehension(self, node):
                self._enter()
                self.generic_visit(node)
                self._exit()

        visitor = NestingVisitor()
        visitor.visit(tree)
        return visitor.max_depth

    @staticmethod
    def estimate_time_complexity(tree: ast.AST) -> str:
        """
        基于 AST 模式的启发式时间复杂度估算
        
        规则集：
          O(1): 纯算术/赋值/常量操作
          O(n): 单层循环 / 列表推导 / filter/map
          O(n log n): 循环内含 sort() 或递归分治模式
          O(n²): 双重嵌套循环 / 冒泡选择插入排序特征
          O(log n): 二分查找模式 (while low<high + mid)
          O(2^n)/O(n!): 递归两次调用自身 (斐波那契朴素实现等)
        """
        loops = []
        nested_loops = []

        class LoopDetector(ast.NodeVisitor):
            def __init__(self):
                self.loop_stack = []
                self.nested_counts = []
                self.has_sort = False
                self.recursive_calls = 0
                self.bisection_pattern = False
                self.func_name = ""

            def visit_FunctionDef(self, node):
                old_func = self.func_name
                self.func_name = node.name
                self.generic_visit(node)
                self.func_name = old_func

            def visit_For(self, node):
                depth = len(self.loop_stack)
                self.loop_stack.append('for')
                
                # 检查 range(step) 是否为减半模式 → O(log n)
                self._check_halving_range(node.target, node.iter)
                
                self.nested_counts.append(depth + 1)
                self.generic_visit(node)
                self.loop_stack.pop()

            def visit_While(self, node):
                depth = len(self.loop_stack)
                self.loop_stack.append('while')
                
                # 检测二分查找模式
                self._check_bisection(node)
                
                self.nested_counts.append(depth + 1)
                self.generic_visit(node)
                self.loop_stack.pop()

            def visit_Call(self, node):
                # sort/sorted → O(n log n)
                if isinstance(node.func, ast.Attribute):
                    if node.func.attr in ('sort', 'sorted'):
                        self.has_sort = True
                # 递归调用检测
                if isinstance(node.func, ast.Name):
                    if node.func.id == self.func_name and self.func_name:
                        self.recursive_calls += 1
                self.generic_visit(node)

            def visit_comprehension(self, node):
                depth = len(self.loop_stack)
                self.nested_counts.append(depth + 1)
                self.generic_visit(node)

            def _check_halving_range(self, target, iter_node):
                # range(n, 0, -1) 或 range(n//2) 等
                if isinstance(iter_node, ast.Call):
                    func = iter_node.func
                    if isinstance(func, ast.Name) and func.id == 'range':
                        args = iter_node.args
                        if len(args) >= 3:
                            # 有 step 且为负或 > 1
                            step = args[2]
                            if isinstance(step, (ast.Constant, ast.UnaryOp)):
                                pass  # 可能是 O(log n) 或 O(sqrt(n))

            def _check_bisection(self, node):
                # while left < right / low < high ... mid = (low+high)//2
                names_used = {n.id for n in ast.walk(node) if isinstance(n, ast.Name)}
                if any(kw in names_used for kw in ('mid', 'low', 'high', 'left', 'right')):
                    assigns = [n for n in ast.walk(node) if isinstance(n, ast.Assign)]
                    for a in assigns:
                        a_str = ast.unparse(a) if hasattr(ast, 'unparse') else ''
                        if '//' in a_str and ('+' in a_str or '-' in a_str):
                            self.bisection_pattern = True

        detector = LoopDetector()
        detector.visit(tree)

        max_nested = max(detector.nested_counts) if detector.nested_counts else 0
        total_loops = len(detector.nested_counts)

        # 优先级判断
        if detector.recursive_calls >= 2:
            # 多重递归 → 指数级
            return "O(2^n)"
        
        if detector.bisection_pattern:
            return "O(log n)"

        if max_nested >= 3:
            return "O(n³)" if max_nested == 3 else f"O(n^{max_nested})"
        if max_nested == 2:
            if detector.has_sort and total_loops <= 2:
                return "O(n log n)"
            return "O(n²)"
        
        if max_nested == 1:
            if detector.has_sort:
                return "O(n log n)"
            return "O(n)"
        
        if total_loops == 0:
            return "O(1)"
        
        return "O(n)"

    @staticmethod
    def estimate_space_complexity(tree: ast.AST, time_complexity: str) -> str:
        """启发式空间复杂度估算"""
        tc = time_complexity.lower().replace(" ", "")

        # 检测是否创建了大型数据结构
        class SpaceChecker(ast.NodeVisitor):
            def __init__(self):
                self.large_structures = 0
                self.has_recursion = False

            def visit_ListComp(self, node):
                self.large_structures += 1
                self.generic_visit(node)

            def visit_DictComp(self, node):
                self.large_structures += 1
                self.generic_visit(node)

            def visit_SetComp(self, node):
                self.large_structures += 1
                self.generic_visit(node)

            def visit_GeneratorExp(self, node):
                # 生成器表达式是惰性的 → 不额外占空间
                self.generic_visit(node)

            def visit_Call(self, node):
                if isinstance(node.func, ast.Name):
                    if node.func.id == ("list") or node.func.id == ("dict"):
                        self.large_structures += 1
                self.generic_visit(node)

        checker = SpaceChecker()
        checker.visit(tree)

        if checker.large_structures >= 2:
            if "n²" in tc or "n^2" in tc:
                return "O(n²)"
            if "n" in tc:
                return "O(n)"
        if checker.large_structures == 1:
            return "O(n)"

        if "log" in tc:
            return "O(log n)"
        
        return "O(1)"

    # ── 质量子项检查 ───────────────────────────

    @staticmethod
    def _has_docstring(tree: ast.AST) -> bool:
        """检查模块/函数是否有 docstring"""
        # 模块级 docstring
        if (isinstance(tree, ast.Module) and tree.body and
                isinstance(tree.body[0], ast.Expr) and
                isinstance(tree.body[0].value, ast.Constant) and
                isinstance(tree.body[0].value.value, str)):
            return True
        # 函数级 docstring
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if (node.body and isinstance(node.body[0], ast.Expr) and
                        isinstance(node.body[0].value, ast.Constant) and
                        isinstance(node.body[0].value.value, str)):
                    return True
        return False

    @staticmethod
    def _has_meaningful_comments(code_text: str) -> bool:
        """检查是否有有意义的注释（非纯空行或单个 #）"""
        import re
        comments = re.findall(r'#.*$', code_text, re.MULTILINE)
        meaningful = [
            c for c in comments
            if len(c.strip()) > 3 and not c.strip().startswith('#!')
        ]
        return len(meaningful) >= 1

    @staticmethod
    def _calc_naming_bonus(tree: ast.AST) -> int:
        """
        命名规范评分 (0~10)
        
        检查变量名/参数名/函数名：
          - 长度 >= 2 字符
          - snake_case（全小写+下划线）
          - 非单字符名称（循环变量 i/j/k 允许但不加分）
        """
        names = []
        score = 0

        for node in ast.walk(tree):
            if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
                names.append(node.id)
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                names.append(node.name)
            elif isinstance(node, ast.arg):
                names.append(node.arg)

        if not names:
            return 0

        valid_count = 0
        total_relevant = 0

        for name in names:
            # 排除常见的短循环变量
            if name in ('i', 'j', 'k', 'x', 'y', '_', 'n', 'm'):
                continue
            total_relevant += 1
            
            if len(name) < 2:
                continue
            
            # snake_case 检查
            if name.replace('_', '').isalnum() and name == name.lower():
                # 不以数字开头、不以 _ 开头结尾（排除 __magic__ 但允许）
                if not name[0].isdigit():
                    valid_count += 1
                    continue
            
            # camelCase 也接受（部分学生习惯）
            if name[0].islower() and '_' not in name and name.isidentifier():
                valid_count += 0.8

        if total_relevant > 0:
            ratio = valid_count / total_relevant
            score = int(ratio * 10)

        return max(0, min(10, score))

    @staticmethod
    def _has_type_hints(tree: ast.AST) -> bool:
        """检查是否有类型注解"""
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if node.returns:  # 返回值注解
                    return True
                if node.args and any(a.annotation for a in node.args.args + node.args.kwonlyargs):
                    return True
        return False

    @staticmethod
    def _detect_pythonic_features(code_text: str, tree: ast.AST) -> tuple:
        """
        检测 Pythonic 特性 (0~10 分)
        
        检测列表：
          - 列表/字典/集合推导式 (+3)
          - with 上下文管理器 (+2)
          - 解包 (*args, **kwargs, a, b = ...) (+2)
          - 枚举/zip/map/filter 使用 (+1)
          - f-string (+1)
          - 生成器表达式 (+1)
        """
        features = []
        score = 0

        # 推导式
        comp_types = (ast.ListComp, ast.DictComp, ast.SetComp)
        has_comp = any(isinstance(node, comp_types) for node in ast.walk(tree))
        if has_comp:
            features.append("comprehension")
            score += 3

        # with 语句
        has_with = any(isinstance(node, ast.With) for node in ast.walk(tree))
        if has_with:
            features.append("context_manager")
            score += 2

        # 解包
        has_unpack = (
            any(isinstance(node, ast.Starred) for node in ast.walk(tree)) or
            '--' in code_text or '**' in code_text
        )
        if has_unpack:
            features.append("unpacking")
            score += 2

        # enumerate / zip / map / filter
        builtin_patterns = re.compile(r'\b(enumerate|zip|map|filter)\s*\(')
        if builtin_patterns.search(code_text):
            features.append("builtin_functional")
            score += 1

        # f-string
        if re.search(r'f(["\'])', code_text) or re.search(r'f"', code_text):
            features.append("f_string")
            score += 1

        # 生成器表达式
        has_gen = any(isinstance(node, ast.GeneratorExp) for node in ast.walk(tree))
        if has_gen:
            features.append("generator_expr")
            score += 1

        return features, min(10, score)


# ══════════════════════════════════════════════
# 参考解答预分析（admin 上传题目时调用）
# ══════════════════════════════════════════════

def analyze_reference_solution(code_text: str) -> dict:
    """
    分析参考解答代码，返回基准指标供学生代码对比
    
    Returns:
        {
            "cyclomatic_complexity": int,
            "nesting_depth": int,
            "loc": int,
            "time_complexity": str,
            "space_complexity": str,
            "has_docstring": bool,
            "quality_estimate": float,
        }
    """
    try:
        tree = ast.parse(code_text)
    except SyntaxError:
        return {"loc": len(code_text.split('\n')), "parse_error": True}

    analyzer = CodeAnalyzer()
    lines = [l for l in code_text.split('\n') if l.strip()]

    quality_result = analyzer._calc_quality(code_text, tree)

    return {
        "cyclomatic_complexity": analyzer.cyclomatic_complexity(tree),
        "nesting_depth": analyzer.max_nesting_depth(tree),
        "loc": len(lines),
        "time_complexity": analyzer.estimate_time_complexity(tree),
        "space_complexity": analyzer.estimate_space_complexity(
            tree, analyzer.estimate_time_complexity(tree)
        ),
        "has_docstring": analyzer._has_docstring(tree),
        "quality_estimate": quality_result.score,
    }
