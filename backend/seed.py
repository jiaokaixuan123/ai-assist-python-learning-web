"""
种子数据脚本 —— 运行一次即可初始化课程和练习题
用法：python seed.py
"""
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URL = "mongodb://localhost:27017"
DB_NAME = "python_edu"

# ─────────────────────────────────────────────
# 课程数据
# ─────────────────────────────────────────────
COURSES = [
    {
        "title": "Python 入门基础",
        "description": "从零开始学习 Python，掌握变量、条件、循环、函数等核心语法。",
        "difficulty": "beginner",
        "tags": ["基础", "语法", "入门"],
        "cover": "/covers/beginner.svg",
        "lesson_count": 5,
        "created_at": datetime.utcnow(),
        "lessons": [
            {
                "id": "l1",
                "title": "Hello, Python！",
                "order": 1,
                "starter_code": 'print("Hello, World!")',
                "content": """## 第一个 Python 程序

Python 是一门简洁、易读的编程语言，在数据科学、Web 开发、人工智能等领域广泛应用。

### print() 函数

`print()` 用于向控制台输出内容：

```python
print("Hello, World!")
print(2 + 3)        # 输出 5
print("我叫", "小明") # 多个参数用逗号分隔
```

### 注释

以 `#` 开头的内容是注释，不会被执行：

```python
# 这是一行注释
print("注释不影响运行")  # 行尾注释
```

### 动手试试

在右侧编辑器中修改代码，输出你自己的名字吧！
""",
            },
            {
                "id": "l2",
                "title": "变量与数据类型",
                "order": 2,
                "starter_code": "name = \"Python\"\nversion = 3\npi = 3.14\nprint(name, version, pi)",
                "content": """## 变量与数据类型

变量是存储数据的容器，Python 会自动推断类型。

### 基本类型

| 类型 | 示例 | 说明 |
|------|------|------|
| `int` | `42` | 整数 |
| `float` | `3.14` | 浮点数 |
| `str` | `"hello"` | 字符串 |
| `bool` | `True / False` | 布尔值 |

```python
age = 18          # int
height = 1.75     # float
name = "小明"     # str
is_student = True # bool

# 用 type() 查看类型
print(type(age))  # <class 'int'>
```

### 字符串操作

```python
greeting = "Hello"
name = "Python"
print(greeting + ", " + name + "!")  # 拼接
print(len(greeting))                 # 长度：5
print(greeting.upper())              # HELLO
print(f"我叫 {name}，版本 {3.12}")   # f-string
```
""",
            },
            {
                "id": "l3",
                "title": "条件语句",
                "order": 3,
                "starter_code": "score = 85\n\nif score >= 90:\n    print(\"优秀\")\nelif score >= 60:\n    print(\"及格\")\nelse:\n    print(\"不及格\")",
                "content": """## 条件语句

`if / elif / else` 让程序根据条件执行不同分支。

### 基本语法

```python
if 条件:
    # 条件为 True 时执行
elif 另一个条件:
    # 第二个条件为 True 时执行
else:
    # 以上条件都不满足时执行
```

### 比较运算符

```python
x = 10
print(x > 5)   # True
print(x == 10) # True
print(x != 3)  # True
print(x >= 10) # True
```

### 逻辑运算符

```python
age = 20
has_id = True

if age >= 18 and has_id:
    print("可以进入")

if age < 0 or age > 150:
    print("年龄不合法")
```
""",
            },
            {
                "id": "l4",
                "title": "循环",
                "order": 4,
                "starter_code": "# for 循环\nfor i in range(5):\n    print(i)\n\n# while 循环\nn = 1\nwhile n <= 3:\n    print(f\"第 {n} 次\")\n    n += 1",
                "content": """## 循环

循环让我们重复执行代码块。

### for 循环

```python
# 遍历范围
for i in range(5):       # 0, 1, 2, 3, 4
    print(i)

# 遍历列表
fruits = ["苹果", "香蕉", "橙子"]
for fruit in fruits:
    print(fruit)

# enumerate 获取下标
for i, fruit in enumerate(fruits):
    print(i, fruit)
```

### while 循环

```python
count = 0
while count < 5:
    print(count)
    count += 1
```

### break 与 continue

```python
for i in range(10):
    if i == 3:
        continue   # 跳过本次
    if i == 7:
        break      # 结束循环
    print(i)
```
""",
            },
            {
                "id": "l5",
                "title": "函数",
                "order": 5,
                "starter_code": "def greet(name, greeting=\"你好\"):\n    return f\"{greeting}, {name}！\"\n\nprint(greet(\"小明\"))\nprint(greet(\"小红\", \"Hi\"))",
                "content": """## 函数

函数是可复用的代码块，用 `def` 定义。

### 定义与调用

```python
def add(a, b):
    return a + b

result = add(3, 5)
print(result)  # 8
```

### 默认参数

```python
def greet(name, greeting="你好"):
    return f"{greeting}, {name}！"

print(greet("小明"))        # 你好, 小明！
print(greet("小红", "Hi")) # Hi, 小红！
```

### 多返回值

```python
def min_max(numbers):
    return min(numbers), max(numbers)

lo, hi = min_max([3, 1, 4, 1, 5, 9])
print(lo, hi)  # 1 9
```

### 作用域

```python
x = 10          # 全局变量

def foo():
    x = 20      # 局部变量，不影响外部
    print(x)    # 20

foo()
print(x)        # 10
```
""",
            },
        ],
    },
    {
        "title": "Python 数据结构",
        "description": "深入学习列表、字典、集合、元组，掌握数据处理的利器。",
        "difficulty": "intermediate",
        "tags": ["数据结构", "列表", "字典"],
        "cover": "/covers/intermediate.svg",
        "lesson_count": 4,
        "created_at": datetime.utcnow(),
        "lessons": [
            {
                "id": "l1",
                "title": "列表（List）",
                "order": 1,
                "starter_code": "nums = [3, 1, 4, 1, 5, 9]\nprint(nums[0])      # 第一个\nprint(nums[-1])     # 最后一个\nprint(sorted(nums)) # 排序",
                "content": """## 列表（List）

列表是 Python 最常用的数据结构，有序、可变、允许重复。

### 创建与访问

```python
fruits = ["苹果", "香蕉", "橙子"]
print(fruits[0])   # 苹果
print(fruits[-1])  # 橙子（倒数第一）
print(fruits[1:3]) # ['香蕉', '橙子']（切片）
```

### 常用方法

```python
lst = [1, 2, 3]
lst.append(4)       # [1, 2, 3, 4]
lst.insert(0, 0)    # [0, 1, 2, 3, 4]
lst.remove(2)       # [0, 1, 3, 4]
lst.pop()           # 移除并返回最后一个
lst.sort()          # 原地排序
print(len(lst))     # 长度
```

### 列表推导式

```python
squares = [x**2 for x in range(1, 6)]
# [1, 4, 9, 16, 25]

evens = [x for x in range(10) if x % 2 == 0]
# [0, 2, 4, 6, 8]
```
""",
            },
            {
                "id": "l2",
                "title": "字典（Dict）",
                "order": 2,
                "starter_code": "person = {\"name\": \"小明\", \"age\": 18}\nprint(person[\"name\"])\nperson[\"score\"] = 95\nprint(person)",
                "content": """## 字典（Dict）

字典以键值对存储数据，查找效率极高。

### 创建与访问

```python
student = {"name": "小明", "age": 18, "score": 95}
print(student["name"])          # 小明
print(student.get("grade", "N/A"))  # 不存在时返回默认值
```

### 增删改查

```python
d = {}
d["key"] = "value"      # 添加/更新
del d["key"]            # 删除
"key" in d              # 判断键是否存在
```

### 遍历

```python
for key in student:
    print(key, student[key])

for key, value in student.items():
    print(f"{key}: {value}")

print(list(student.keys()))    # 所有键
print(list(student.values()))  # 所有值
```
""",
            },
            {
                "id": "l3",
                "title": "元组与集合",
                "order": 3,
                "starter_code": "# 元组\npoint = (3, 4)\nx, y = point\nprint(x, y)\n\n# 集合\ncolors = {\"red\", \"blue\", \"red\"}\nprint(colors)  # 自动去重",
                "content": """## 元组（Tuple）与集合（Set）

### 元组

元组与列表类似，但**不可修改**，常用于多值返回。

```python
point = (3, 4)
x, y = point          # 解包
print(point[0])       # 3

# 单元素元组需要逗号
single = (42,)
```

### 集合

集合**无序、不重复**，适合去重和集合运算。

```python
a = {1, 2, 3, 4}
b = {3, 4, 5, 6}

print(a | b)  # 并集 {1,2,3,4,5,6}
print(a & b)  # 交集 {3,4}
print(a - b)  # 差集 {1,2}

# 去重
names = ["Alice", "Bob", "Alice"]
unique = list(set(names))
```
""",
            },
            {
                "id": "l4",
                "title": "推导式与生成器",
                "order": 4,
                "starter_code": "# 字典推导式\nsquares = {x: x**2 for x in range(1, 6)}\nprint(squares)\n\n# 生成器\ngen = (x**2 for x in range(5))\nprint(list(gen))",
                "content": """## 推导式与生成器

### 各类推导式

```python
# 列表推导式
lst = [x * 2 for x in range(5)]          # [0,2,4,6,8]

# 字典推导式
d = {k: v for k, v in enumerate("abc")}  # {0:'a',1:'b',2:'c'}

# 集合推导式
s = {x % 3 for x in range(9)}            # {0,1,2}
```

### 生成器

生成器**惰性求值**，节省内存，适合大数据场景：

```python
# 生成器表达式
gen = (x**2 for x in range(1_000_000))
print(next(gen))  # 0
print(next(gen))  # 1

# 生成器函数
def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

fib = fibonacci()
for _ in range(8):
    print(next(fib), end=" ")
# 0 1 1 2 3 5 8 13
```
""",
            },
        ],
    },
]

# ─────────────────────────────────────────────
# 练习题数据
# ─────────────────────────────────────────────
EXERCISES = [
    {
        "title": "两数之和",
        "description": """## 两数之和

给定两个整数 `a` 和 `b`，返回它们的和。

**示例：**
```
输入：a=3, b=5
输出：8
```

请补全函数 `add(a, b)`。
""",
        "difficulty": "easy",
        "tags": ["基础", "数学"],
        "starter_code": "def add(a, b):\n    # 请在此填写代码\n    pass\n\nprint(add(3, 5))",
        "hint": "直接使用 `+` 运算符即可。",
        "test_cases": [
            {"input": "3 5", "expected_output": "8"},
            {"input": "0 0", "expected_output": "0"},
            {"input": "-1 1", "expected_output": "0"},
        ],
    },
    {
        "title": "判断奇偶",
        "description": """## 判断奇偶

编写函数 `is_even(n)`，若 `n` 是偶数返回 `True`，否则返回 `False`。

**示例：**
```
is_even(4) → True
is_even(7) → False
```
""",
        "difficulty": "easy",
        "tags": ["基础", "条件"],
        "starter_code": "def is_even(n):\n    pass\n\nprint(is_even(4))\nprint(is_even(7))",
        "hint": "用取余运算 `%` 判断是否能被 2 整除。",
        "test_cases": [
            {"input": "4", "expected_output": "True"},
            {"input": "7", "expected_output": "False"},
            {"input": "0", "expected_output": "True"},
        ],
    },
    {
        "title": "列表求和",
        "description": """## 列表求和

给定一个整数列表，返回所有元素的总和。

**示例：**
```
sum_list([1, 2, 3, 4]) → 10
sum_list([])            → 0
```
""",
        "difficulty": "easy",
        "tags": ["列表", "循环"],
        "starter_code": "def sum_list(nums):\n    pass\n\nprint(sum_list([1, 2, 3, 4]))\nprint(sum_list([]))",
        "hint": "可以使用内置 `sum()` 函数，或用 for 循环累加。",
        "test_cases": [
            {"input": "[1, 2, 3, 4]", "expected_output": "10"},
            {"input": "[]", "expected_output": "0"},
            {"input": "[-1, 1]", "expected_output": "0"},
        ],
    },
    {
        "title": "反转字符串",
        "description": """## 反转字符串

编写函数 `reverse_str(s)`，返回字符串 `s` 的逆序版本。

**示例：**
```
reverse_str("hello") → "olleh"
reverse_str("Python") → "nohtyP"
```
""",
        "difficulty": "easy",
        "tags": ["字符串", "切片"],
        "starter_code": "def reverse_str(s):\n    pass\n\nprint(reverse_str(\"hello\"))\nprint(reverse_str(\"Python\"))",
        "hint": "Python 切片 `s[::-1]` 可以非常简洁地实现字符串反转。",
        "test_cases": [
            {"input": "hello", "expected_output": "olleh"},
            {"input": "Python", "expected_output": "nohtyP"},
            {"input": "", "expected_output": ""},
        ],
    },
    {
        "title": "斐波那契数列",
        "description": """## 斐波那契数列

编写函数 `fibonacci(n)`，返回斐波那契数列的前 `n` 项（列表形式）。

斐波那契数列：每一项等于前两项之和，前两项为 0 和 1。

**示例：**
```
fibonacci(6) → [0, 1, 1, 2, 3, 5]
fibonacci(1) → [0]
```
""",
        "difficulty": "medium",
        "tags": ["循环", "数学", "列表"],
        "starter_code": "def fibonacci(n):\n    pass\n\nprint(fibonacci(6))\nprint(fibonacci(1))",
        "hint": "从 `[0, 1]` 开始，每次将前两项之和追加到列表。",
        "test_cases": [
            {"input": "6", "expected_output": "[0, 1, 1, 2, 3, 5]"},
            {"input": "1", "expected_output": "[0]"},
            {"input": "2", "expected_output": "[0, 1]"},
        ],
    },
    {
        "title": "统计单词频率",
        "description": """## 统计单词频率

给定一个字符串，统计其中每个单词出现的次数，返回字典。

**示例：**
```
word_count("hello world hello") → {"hello": 2, "world": 1}
```
""",
        "difficulty": "medium",
        "tags": ["字典", "字符串"],
        "starter_code": "def word_count(text):\n    pass\n\nprint(word_count(\"hello world hello\"))",
        "hint": "先用 `split()` 分割字符串，再用字典统计每个单词出现次数。",
        "test_cases": [
            {"input": "hello world hello", "expected_output": "{'hello': 2, 'world': 1}"},
            {"input": "a b c a", "expected_output": "{'a': 2, 'b': 1, 'c': 1}"},
        ],
    },
    {
        "title": "二分查找",
        "description": """## 二分查找

在**有序列表** `nums` 中查找目标值 `target`，返回其下标；不存在则返回 `-1`。

**示例：**
```
binary_search([1,3,5,7,9], 5) → 2
binary_search([1,3,5,7,9], 4) → -1
```

要求时间复杂度 O(log n)。
""",
        "difficulty": "medium",
        "tags": ["算法", "查找", "经典"],
        "starter_code": "def binary_search(nums, target):\n    pass\n\nprint(binary_search([1,3,5,7,9], 5))\nprint(binary_search([1,3,5,7,9], 4))",
        "hint": "维护左右指针 `lo, hi`，每次取中间值与 target 比较，缩小搜索范围。",
        "test_cases": [
            {"input": "[1,3,5,7,9] 5", "expected_output": "2"},
            {"input": "[1,3,5,7,9] 4", "expected_output": "-1"},
            {"input": "[2] 2", "expected_output": "0"},
        ],
    },
    {
        "title": "冒泡排序",
        "description": """## 冒泡排序

实现冒泡排序，对列表进行**升序排序**并返回。

**示例：**
```
bubble_sort([5, 3, 1, 4, 2]) → [1, 2, 3, 4, 5]
```

不允许使用内置 `sort()` / `sorted()`。
""",
        "difficulty": "hard",
        "tags": ["算法", "排序", "经典"],
        "starter_code": "def bubble_sort(nums):\n    nums = nums[:]  # 不修改原列表\n    # 请在此填写代码\n    return nums\n\nprint(bubble_sort([5, 3, 1, 4, 2]))",
        "hint": "外层循环 n-1 次，内层循环相邻元素两两比较并交换，每轮将最大值冒泡到末尾。",
        "test_cases": [
            {"input": "[5,3,1,4,2]", "expected_output": "[1, 2, 3, 4, 5]"},
            {"input": "[1]", "expected_output": "[1]"},
            {"input": "[2,1]", "expected_output": "[1, 2]"},
        ],
    },
]


async def seed():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]

    # 清空旧数据
    await db.courses.delete_many({})
    await db.exercises.delete_many({})
    print("✓ 清空旧课程和练习题数据")

    # 插入课程
    result = await db.courses.insert_many(COURSES)
    print(f"✓ 插入 {len(result.inserted_ids)} 门课程")

    # 插入练习题
    result = await db.exercises.insert_many(EXERCISES)
    print(f"✓ 插入 {len(result.inserted_ids)} 道练习题")

    # 创建索引
    await db.users.create_index("username", unique=True)
    await db.submissions.create_index([("user_id", 1), ("exercise_id", 1)])
    await db.progress.create_index("user_id", unique=True)
    print("✓ 创建数据库索引")

    client.close()
    print("\n🎉 种子数据初始化完成！")


if __name__ == "__main__":
    asyncio.run(seed())
