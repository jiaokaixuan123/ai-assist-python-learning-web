# 基于智谱 AI 助教与 Cursor 的调研

## 1、系统定位

**智谱 AI 助教**

- 面向：学生/教师
- 特性：提供了众多友好的快捷操作，如智能问答、语法检查、代码优化等；助教的模型人设
- 目标：讲清知识点、答疑与作业辅导、引导完成实验/练习
- 价值点：教学友好、门槛较低

![image-20251017161436492](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20251017161436492.png)

**Cursor**

- 面向：开发者
- 特性：提供更专业的编程环境；编码环境与ai模型高度融合；强上下文
- 目标：提升效率、调试/重构/阅读源码、项目落地
- 价值点：“与代码同屏”的共创式开发体验，强上下文代码理解

**启发**

- 目标：将网站定位为“**教学 × 共创**”双模平台；支持「课堂式讲解」与「实战式共写」。
- 技术：前端统一用 **Monaco**（Vscode风格的代码编辑器）  ，保留智谱ai的**右侧助教面板 **（更清晰），添加**行内气泡**（加强ai助教与编码环境的联系）。

------

## 2、 ai 交互

**智谱 AI 助教**

- 交互接口：直接问答窗口；选中代码后快捷操作。
- 交互方式：一次问题 → 一段讲解/答案。

第一种：编写代码的过程中，识别语法错误等问题，CodeGeeX提供了快捷的“Ask CodeGeeX to fix”操作，具体只是依赖编辑器的语法检查功能，将报错所在行的代码和报错信息提供给ai让其作答。

问题：上下文非常有限，只适用于基础的语法错误修改，无法处理复杂的逻辑错误；也没有其宣称的识别并即时提示潜在问题、检查命名规范等功能。仅仅是一个快捷操作。



对于我们的网站建设，类似这种的语法检查或类型检查，只需调用Ruff、pyright等静态工具即可给出一些自动应用的修复建议；

![image-20251016215842118](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20251016215842118.png)

对于算法检查、复杂语义等问题，需要长上下文，不便于使用纯静态工具，也不便于用户快捷操作，再使用下面的功能。



用户可以选中代码块后右键选择一些快捷操作。也可以在聊天框使用 / 键引用选中的代码进行自主提问，省略了拷贝代码的操作。

![image-20251016220355410](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20251016220355410.png)

![image-20251016220635585](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20251016220635585.png)

**Cursor**

- 交互接口：编辑器内联建议、对话驱动的多轮“共写”。
- 交互方式：Agent模式下，与ai的问答不需要拷贝源码，ai会自主阅读整个项目，并引用相关的源码作为上下文；

Agent模式下，针对用户的需求，ai会根据已有的上下文，列出任务清单，然后开始逐个解决，所有任务完成后，一轮对话才结束。对于环境配置、功能验证等环节，Agent还会提供测试脚本，或编辑一个测试文件，在终端进行测试，终端显示的调试信息和结果也会写入上下文。

<img src="C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20251015202750621.png" alt="image-20251015202750621" style="zoom: 0%;" />

这样的ai交互更加一体化，ai 能连贯地实现用户的需求，减轻了用户的多轮调试、验证的负担，更适合开发者进行实战演练。



 此外，Cursor在处理报错或当结果与预期不符时，会编写测试脚本或测试文件，对当前项目进行模块化测试，以查找问题根源进行解决。帮助开发者简化复杂漫长的调试过程。

![image-20251017223308495](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20251017223308495.png)



在生成结果之后，agent 直接在编辑器内产生改动（diff），点击修改过的文件，会出现类似版本控制时，解决冲突的样式，用户自行诊断，选择应用或者回滚。这也使编程环境与ai助手联系更加紧密。

![屏幕截图 2025-10-15 202416](C:\Users\Administrator\Pictures\Camera Roll\屏幕截图 2025-10-15 202416.png)

智谱ai的agent模式下也是类似功能

![image-20251016222414904](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20251016222414904.png)

**启发**

- 目标：为贴合网站的教学需求，借鉴CodeGeex的教学手段，可以在编辑器中引入 **内联提示气泡**（**修复、解释、优化、添加注释、重构**…），减少“从聊天区复制回粘贴”的麻烦；实现 **diff/patch** 应用与撤销；为 AI 提供「选区+上下文」精确提示。
- 实现思路：
  - 想现有编辑器一样，光标移动到报错和警告处后会出现微型工具条
  - 光标处 `Alt+Enter`（或右键菜单）→ 动作列表：修复/解释/优化/重构/加注释，简化交互过程
  - 当ai生成智能注释、修复方案、优化建议等内容时，在聊天框统计出修改或新增的代码量，并在在编辑器内预览（Diff），供用户应用或撤销


------

## 智谱ai助教答疑

**1、引用当前文件。针对性答疑**

![image-20251016222639272](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20251016222639272.png)

![image-20251016222822986](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20251016222822986.png)

- 与市面上的绝大多数ai模型用户端并无差异，都提供图片、文件、代码仓库的引用功能。作为以ai辅助教学为特色的教学网站，文献的引用应该比这些更加灵活、更有针对性
- **目标**：网站应具备**教师后台设置ai的知识库**的功能，学生端在与ai助教沟通时，可以**选择现有教学文献**进行针对性学习，加强对知识的理解。



**2、项目地图**

面对大型项目时，"项目地图"功能可以通过可视化方式动态呈现代码结构、函数调用链和 数据流向，让学生能够直观理解项目架构，建立系统性思维。

流程图展示了项目运行路线

![image-20251017161750141](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20251017161750141.png)

时序图展示了代码块的调用顺序

![image-20251017161820379](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20251017161820379.png)

还有UML图

![image-20251017161833875](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20251017161833875.png)



这三种代码地图都有助于用户了解一个项目的大体结构，方便快速入手。但对于教学网站而言，想要借鉴这样一种展示方式，初步只需对单文件甚至单函数进行图示解析，而这往往不需要ai介入，进行大型项目规模的解析。

一些静态工具有助于用图展示单文件级的代码执行过程，便于初学者学习。

1、pyflowchart

```flow
st3=>start: start binary_search
io5=>inputoutput: input: arr, target
op8=>operation: (left, right) = (0, (len(arr) - 1))
cond11=>condition: while (left <= right)
op44=>operation: mid = (left + ((right - left) // 2))
cond47=>condition: if (arr[mid] == target)
io54=>inputoutput: output:  mid
e52=>end: end function return
cond60=>condition: if (arr[mid] < target)
op64=>operation: left = (mid + 1)
op68=>operation: right = (mid - 1)
io77=>inputoutput: output:  (- 1)
e75=>end: end function return

st3->io5
io5->op8
op8->cond11
cond11(yes)->op44
op44->cond47
cond47(yes)->io54
io54->e52
cond47(no)->cond60
cond60(yes)->op64
op64->cond11
cond60(no)->op68
op68->cond11
cond11(no)->io77
io77->e75
```



```flow
st3=>start: start calc
io5=>inputoutput: input: a, b
cond9=>condition: if (a < 0)
io16=>inputoutput: output:  0
e14=>end: end function return
op22=>operation: s = 0
cond25=>operation: s += b while  _ in range(a)
io40=>inputoutput: output:  s
e38=>end: end function return

st3->io5
io5->cond9
cond9(yes)->io16
io16->e14
cond9(no)->op22
op22->cond25
cond25->io40
io40->e38
```



2、 python tutor

Python Tutor helps you do **programming homework assignments** in Python, Java, C, C++, and JavaScript. It contains a step-by-step [visual debugger and AI tutor](https://pythontutor.com/visualize.html) to help you understand and debug code.



---

## **多会话与历史查询**

![image-20251016223016202](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20251016223016202.png)

![image-20251016225101603](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20251016225101603.png)

**目标**：

+ 用户打开新的题目或作业，**自动生成新的聊天**
+ 切换题目时，**自动保存会话内容、引用知识库、上下文信息**（考虑目标用户的实际情况，为避免长上下文，可设置载入长度，或折叠早期会话，形成**摘要**）
+ 对会话进行清晰的分页检索、内容总结，也方便**后台统计学习信息**。

**实现：**

- **数据表结构**（会话 、 消息 、 上下文等）
- 列表**分页/搜索** + **重命名/置顶/删除**
- **自动标题**/摘要 ：若干条消息后，**AI自动生成标题或摘要**
- 上下文快照与编辑器定位：打开历史消息，恢复上下文；（定位文件和代码区域）



---

## 教师端

### **智谱ai助手的教师端ai助教大屏**

![image-20251016231535178](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20251016231535178.png)

**已有板块都可以保留**：

- **全局 KPI 卡片**：使用总人数、助教总数、问答总次数、活跃率、平均响应时延/每次成本。
- **知识点词云 / Top10**：帮助老师快速感知“学生最常问什么”。
- **AI助教问答次数 Top10**：挑选合适的AI助教
- **活跃用户 Top10**：定位积极学生。
- **常见问题 Top10**：沉淀题库与标准答案。

**可以拓展的板块**：**AI助教质量监控**

+ 各项指标：答案采纳率、追问率、平均tokens/成本等
+ 分析：不同模型、知识库、预设模板的对比
+ 操作：进行快速切换模型、模板等（初步）



### AI助教管理页面

![image-20251016232920171](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20251016232920171.png)

**已有配置项：**

+ 名称和描述：主要根据编程语言划分
+ 配置信息：
  + 工具特点：能力、期望完成的工作或目标
  + 工具身份：与用户的交互方式
  + 工具行为：行为特点、性格、个性化回复的方式
+ 预设问题：用于学生选择快捷操作
+ 选择课程：



网站设计：

+ 名称和描述：教师可以根据**教学内容**、**特殊功能**、**题目复杂程度**等标准划分ai助教
+ 配置信息：
  + 工具教学的内容：基础语法（引用、举例）  、 算法讲解 （运行过程 、思想） 等
  + 工具的提示程度：只作分析引导 、 分析并声明函数 不实现、 直接展示结果 等






**自定义知识库页面**

![image-20251016233105717](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20251016233105717.png)

资料入库：

- 支持各种文本类型、图片和音频
- 设置长度限制

可扩展：

- 要增加**质量检测**，提供更新/修改参考数据，比如引用次数，误答 / 错误率 等

- 可添加**源码仓库**，提供模块、函数等的源码，回答更权威可靠



### AI助教日志页面

![image-20251016233244200](C:\Users\Administrator\AppData\Roaming\Typora\typora-user-images\image-20251016233244200.png)

**日志页面：**还原现场，了解学生的ai辅助学习情况

- 追踪了每个学生的对话记录
- 记录每个学生的使用记录：
  - ai助教的类型
  - 对每个ai助教的对话进行知识点总结
  - 对话的详细信息



**可扩展：**

- 除了总结知识点，也可按提问频率排出其中的重难点，统计提问率高、正确率低的困难题目
- ai 可以根据对话内容作出反馈总结，方便教师快速掌握学生困惑点，而不用浏览大段的对话内容







