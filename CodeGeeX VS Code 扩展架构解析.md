按“功能模块 → 关键文件/函数 → 实现要点 → 流程（输入→处理→输出与状态变更）”梳理 CodeGeeX VS Code 扩展整体实现过程

1. 扩展激活与命令注册  
- 文件: extension.ts  
- 关键：activate(context) 注册命令、Provider、状态栏。deactivate() 空。  
- 状态：通过 context.globalState 读写 EnableExtension / DisableInlineCompletion / isOneCommand。  

```typescript
export async function activate(context: vscode.ExtensionContext) {
    const sb = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100); sb.command = "codegeex.disable-enable"; context.subscriptions.push(sb);
    context.subscriptions.push(vscode.commands.registerCommand("codegeex.disable-enable", () => disableEnable(sb, g_isLoading, originalColor, context)));
    context.subscriptions.push(vscode.commands.registerCommand("codegeex.interactive-mode", () => generationWithInteractiveMode(vscode.window.activeTextEditor!, sb, g_isLoading)));
    context.subscriptions.push(vscode.commands.registerCommand("codegeex.translate-mode", () => generationWithTranslationMode(sb, g_isLoading, vscode.window.activeTextEditor!)));
    context.subscriptions.push(vscode.commands.registerCommand("codegeex.prompt-mode", () => generateWithPromptMode(sb, g_isLoading, vscode.window.activeTextEditor!)));
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(myScheme, textDocumentProvider(sb, g_isLoading)));	//注册自定义 scheme 的内容提供者（展示候选/翻译结果）
    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ scheme: myScheme }, codelensProvider));	//CodeLens
    context.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, inlineCompletionProvider(g_isLoading, sb, false, originalColor, context)));
    changeIconColor(enableExtension,sb, originalColor, isCurrentLanguageDisable());
}
```



2. 配置与参数读取  
- 文件: configures.ts  
- 内容：温度 temp、top_p、top_k、延迟、候选显示数量、偏好 generationPreference（line by line 或 adapt）、启用/禁用开关。  
- 机制：通过 vscode.workspace.getConfiguration().get(key) 读取；在使用处直接导入常量（未做动态监听，修改后需重新触发或重载）。  

```typescript
const cfg = workspace.getConfiguration("Codegeex");
export const temp = cfg.get("DecodingStrategies", { temp:0.8,topp:0.95,topk:0 }).temp;
export const topp = cfg.get("DecodingStrategies", { temp:0.8,topp:0.95,topk:0 }).topp;
export const topk = cfg.get("DecodingStrategies", { temp:0.8,topp:0.95,topk:0 }).topk;
export const generationPreference = cfg.get("GenerationPreference");
export const completionDelay = cfg.get("CompletionDelay", 0.5);
export const candidateNum = parseInt(String(cfg.get("CandidateNum","1")));
export const enableExtension = cfg.get("EnableExtension", true);
export const onlyKeyControl
export const controls = {
    interactiveMode: {
        mac: "Control + Enter",
        win: "Ctrl + Enter",
    }......
```



3. 模式层（生成模式入口）  
a. 交互模式 generationWithInteractiveMode  
- 文件: generationWithInteractiveMode.ts  

- 输入：当前编辑器/光标位置。  

- 步骤：截取文件开头至光标 → 特殊符号替换（避免后端误解析）→ 生成自定义 scheme URI（codegeex://interactive/…）→ vscode.workspace.openTextDocument → 触发 textDocumentProvider 查询候选 → 通过 CodeLens 呈现。  

  ```typescript
  export async function generationWithInteractiveMode(editor: vscode.TextEditor, sb: vscode.StatusBarItem, loading: boolean) {
    const pos = editor.selection.active;                                        // 取得当前光标位置
    let code = editor.document.getText(new vscode.Selection(0,0,pos.line,pos.character)); // 截取代码块
    if (pos.character === 0 && !code.endsWith("\n")) code += "\n";       // 若光标在行首且末尾无换行则补换行
    code = code.replaceAll("#","<|hash|>").replaceAll("+","<|add|>").replaceAll("&","<|and|>"); //替换占位符避免后端误解析
    updateStatusBarItem(sb, loading, true, "");                            // 更新状态栏：进入“生成中”状态
    try { await codegeexCodeGen(code); updateStatusBarItem(sb, loading, false, "Done"); } //更新状态栏
    catch { updateStatusBarItem(sb, loading, false, "No Suggestion"); }         // 失败：状态栏显示无建议
  ```

  

  b. 翻译模式 generationWithTranslationMode  

- 文件: generationWithTranslationMode.ts  

- 输入：选中文本 + 源语言选择（QuickPick）+ 当前文件语言为目标。  

- 流程：替换特殊符号 → 调用 getCodeTranslation() → 构建虚拟文档（translation scheme）→ CodeLens（“使用此翻译”）。  

  ```typescript
  export async function generationWithTranslationMode(sb: vscode.StatusBarItem, loading: boolean, editor: vscode.TextEditor) {
    const dst = getDocumentLanguage(editor);                                  // 目标语言 = 当前文档语言
    const sel = new vscode.Selection(editor.selection.anchor, editor.selection.active);
    const srcCode = editor.document.getText(sel);                             // 取得选中文本
    if (!srcCode.trim()) return vscode.window.showInformationMessage(localeTag.selectCode); // 无选区提示
    const src = (await showQuickPick(languageList, localeTag.chooseLanguage)) || "";        // 选择源语言
    if (!languageList.includes(src) || !languageList.includes(dst)) {            // 语言有效性检查
      if (!languageList.includes(src)) vscode.window.showInformationMessage(localeTag.chooseLanguage);
      if (!languageList.includes(dst)) vscode.window.showInformationMessage(localeTag.languageNotSupported);
      return;
    }
    updateStatusBarItem(sb, loading, true, " Translating");                       
    let id = ""; try { id = await getStartData(srcCode, srcCode, `${src}->${dst}`, "translation"); } catch {}
    const res = await getCodeTranslation(srcCode, src, dst);                     // 调用翻译 API
    await codegeexCodeTranslation(dst, res.translation[0].replaceAll("#", hash), id); //虚拟文档显示结果
    updateStatusBarItem(sb, loading, false, " Done");                             
  ```

  

  c. Prompt 模板模式 generationWithPrompMode  

- 文件: generationWithPrompMode.ts + templates/*.ts  

- 流程：读取模板（本地文件或内置）→ QuickPick 选择 → 拼接上下文 → 利用与交互模式类似的虚拟文档展示。  
  d. 隐身内联补全（默认模式）  

- 由 InlineCompletionProvider 自动触发。  

```typescript
// prompt 模式
export async function generateWithPromptMode(sb: vscode.StatusBarItem, loading: boolean, editor: vscode.TextEditor) {
  const keys = Object.keys(templates);                                         // 读取用户配置中的模板键
  const items = [{ label:"explanation", description:"Explain selection line by line"}]; // 加入内置解释模板
  const custom: Record<string,string> = {};                                    // 存放已读取的自定义模板内容
  for (const k of keys) if (k !== "explanation") {                             // 遍历用户自定义模板键
    try { custom[k] = await readTemplate((templates as any)[k]); items.push({ label:k, description:"" }); } catch {}
  }
  vscode.window.showQuickPick(items).then(sel => {                             // 展示 QuickPick 供用户选择
    if (!sel) return;                                                          // 用户取消
    const tpl = sel.label === "explanation" ? templateExplanation : custom[sel.label]; // 选择对应模板文本
    if (!tpl) return;                                                          // 模板缺失容错
    codeGenByTemplate(editor, tpl, sb, loading);                   // 调用模板生成逻辑（内部触发虚拟文档展示）
  });
}
```



4. 提供者层 Provider  
a. InlineCompletionProvider (隐身补全)  
- 文件: inlineCompletionProvider.ts  
- 触发：VS Code 内联补全 API 在用户停顿或手动触发时调用 provideInlineCompletionItems。  
- 处理：  
  1) 收集光标前文本（Notebook 时拼接所有 cell）  
  2) 按末尾 1200 字符截断（保持最近相关上下文）  
  3) 决定 API_URL（模式/偏好）  
  4) 调用 getCodeCompletions(prompt, …)  
  5) 将返回 completions 数组转为 InlineCompletionItem[]（插入点=当前光标）  
  6) 对插入进行 verify（在 chooseCandidate 或 inlineCompletionProviderWithCommand 中另有逻辑）  
- 返回：Promise<InlineCompletionList>。  

```typescript
export function inlineCompletionProvider(ctx: vscode.ExtensionContext): vscode.InlineCompletionItemProvider {
  return {
    provideInlineCompletionItems: async (doc, pos) => {
      const enabled = await ctx.globalState.get("EnableExtension"); if (!enabled) return;   // 启用校验
      const editor = vscode.window.activeTextEditor; if (!editor) return;          // 获取当前编辑器
      let text = doc.getText(new vscode.Selection(0,0,pos.line,pos.character));     // 收集光标前文本
      if (vscode.window.activeNotebookEditor) {        // Notebook 拼接所有前置 cell
        const nb = vscode.window.activeNotebookEditor;
        const before = nb.notebook.getCells().slice(0, nb.selection.start).map(c => c.document.getText().trimEnd()+"\n").join("");
        text = before + text;
      }
      if (text.trim() === "" || text.length < 8) return;               	  // 空/过短不请求
      if (text.length > 1200) text = text.slice(text.length - 1200);      // 截断末 1200 字符
      const lang = editor.document.languageId;                            // 语言用于后端参数
      const num = parseInt(String(vscode.workspace.getConfiguration("Codegeex").get("CandidateNum","1"))); // 候选数配置
      const res = await getCodeCompletions(text, num, lang, apiKey, apiSecret, "inlinecompletion");
// 调用后端，获取completions
      if (!res || res.completions.length === 0) return { items: [] };       // 无结果
      const items = res.completions.map(c => new vscode.InlineCompletionItem(c, new vscode.Range(pos,pos))); // 转为 InlineCompletionItem
      items.forEach(it => it.command = { command: "verifyInsertion", title: "verify", arguments: [res.commandid, res.completions, it.insertText] }); // verify 采纳埋点
      return { items };              // 返回列表
    }
  };
}
```



b. InlineCompletionProviderWithCommand (命令触发补全刷新)  
- 文件: inlineCompletionProviderWithCommand.ts  
- 功能：当用户显式执行“刷新”命令时只生成一次（isOneCommand 标志）。  
- 差异：控制单次刷新避免持续流式提示。 

```typescript
export function inlineCompletionProviderWithCommand(ctx: vscode.ExtensionContext): vscode.InlineCompletionItemProvider {
  return {
       const enableExtension = await extensionContext.globalState.get("EnableExtension");
       const isOneCommand = await extensionContext.globalState.get("isOneCommand");
            // 扩展未启用或非一次性模式：恢复默认状态并退出
            if (!isOneCommand || !enableExtension) {
......
      const num = parseInt(String(vscode.workspace.getConfiguration("Codegeex").get("CandidateNum","1"))); // 候选数
      const rs = await getCodeCompletions(text, num, lang, apiKey, apiSecret, "inlinecompletion"); // 调用后端
      ctx.globalState.update("isOneCommand", false);                         // 恢复标志，避免持续刷新
      ctx.globalState.update("DisableInlineCompletion", false);				//请求完成后自动恢复 
......
}
```

 

c. TextDocumentContentProvider  
- 文件: textDocumentProvider.ts  
- scheme：interactive / translation  
- 逻辑：根据 URI path/authority 判断模式 → 调用相应后端函数（codegeexCodeGen / codegeexCodeTranslation）→ 生成虚拟文档内容（包含多个候选或翻译结果）→ 在顶部插入说明。  

```typescript
export function textDocumentProvider(sb: vscode.StatusBarItem, loading: boolean): vscode.TextDocumentContentProvider {
  return {
    async provideTextDocumentContent(uri: vscode.Uri) {
      const q = new URLSearchParams(uri.query);
      if (q.get("loading") === "true") return `/* ${localeTag.generating} */\n`;        // 生成中占位
      const mode = q.get("mode");
      if (mode === "translation") {                                                     // 翻译模式
        let out = (q.get("translation_res") || "")
            .replaceAll(addSignal,"+").replaceAll(andSignal,"&").replaceAll(hash,"#");  // 恢复被替换符号
        const editor = vscode.window.activeTextEditor; if (!editor) return;             // 需要当前编辑器
        codelensProvider.clearEls();                                                    // 清空旧 CodeLens
        codelensProvider.addEl(0, out, q.get("commandid")||"", "translation");  // 翻译结果 + CodeLens 操作
        return out;                                                                // 返回翻译结果文本
      }
      // 交互模式：读取 code_block
      let code = q.get("code_block") || "";                                             // 取传入代码块
      code = code.replaceAll(hash,"#").replaceAll(addSignal,"+").replaceAll(andSignal,"&");  // 恢复占位符
      if (code.length > 1200) code = code.slice(code.length - 1200);                    // 截断末尾 1200
      const editor = vscode.window.activeTextEditor; if (!editor) return;               // 需活动编辑器
      const lang = getDocumentLanguage(editor);                                         // 检测语言
      const num = candidateNum;                                                         // 候选数配置
      const { commandid, completions } = await getCodeCompletions(code, num, lang, apiKey, apiSecret, "interactive"); // 请求生成
      if (completions.length === 0) return localeTag.noResult;                                 // 无结果
      return getGPTCode(completions, commandid, sb, loading);     // 组装虚拟文档内容（含 CodeLens 标记）
    }
  };
}
```



d. CodeLensProvider  

- 文件: codelensProvider.ts  
- 为虚拟文档每个候选插入“使用该候选”“复制”等 CodeLens → 绑定命令 chooseCandidate。  

```typescript
export const codelensProvider = new (class {
  codelenses: vscode.CodeLens[] = [];                               // 存放当前虚拟文档的所有 CodeLens
  addEl(line: number, text: string, id: string, mode?: string) {    // 为指定行添加一个“使用该候选” CodeLens
    const range = new vscode.Range(line, 0, line, 0);               // CodeLens 作用区域（行首位置）
    this.codelenses.push(new vscode.CodeLens(range, {
      title: localeTag.useCode,                                     // 显示文字：使用代码
      command: "CodeGeeX.chooseCandidate",                          // 点击时执行的命令
      arguments: [text, mode, id],                                  // 传入被选中的候选内容、模式、埋点 id
      tooltip: localeTag.chooseThisSnippet                          // 鼠标悬停提示
    }));
  }
  clearEls() { this.codelenses = []; }                              // 清空现有 CodeLens（打开新虚拟文档前）
  provideCodeLenses() { return this.codelenses; }              // VS Code 调用以获得当前文档的 CodeLens 列表
})();
```

e. 其他  
- translationWebviewProvider.ts / textDocumentProvider 配合提供展示；webview-ui/ 目录存放静态资源（交互面板）。  

```typescript
// translationWebviewProvider.ts 侧栏翻译视图 Provider
export default class translationWebviewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly _extensionUri: vscode.Uri) {}
  // 注册侧栏视图
  public resolveWebviewView(view: vscode.WebviewView) {
    view.webview.options = { enableScripts: true }; // 允许前端脚本发送消息
    view.webview.html = this._getWebviewContent(view.webview, this._extensionUri); // 注入面板结构与资源
    this._setWebviewMessageListener(view); // 监听按钮动作与回传结果
  }
  
  private _getWebviewContent(wv: vscode.Webview, ext: vscode.Uri) {
    const mainJs   = getUri(wv, ext, ["webview-ui","main.js"]);    // 前端逻辑：发送 translate / insert 消息
    const css      = getUri(wv, ext, ["webview-ui","styles.css"]);   // 样式：布局 / 颜色 / 按钮
    const insertSvg= getUri(wv, ext, ["webview-ui","insert.svg"]);   // 插入图标
    const dstLang  = vscode.window.activeTextEditor ? getDocumentLanguage(vscode.window.activeTextEditor) : "C"; // 默认目标语言
    // 活动编辑器语言切换时动态通知 Webview 更新下拉 To: 语言
    vscode.window.onDidChangeActiveTextEditor(() => {
      const ed = vscode.window.activeTextEditor;
      const langNow = ed ? getDocumentLanguage(ed) : "C";
      wv.postMessage({ command: "code.changeDstLang", dstLang: langNow });
    });
    return `<!DOCTYPE html><html><body>
      <textarea id="original"></textarea>          <!-- 原始代码输入 -->
      <select id="srcLang"><option>C</option><option>Python</option><option>JavaScript</option></select>
      <select id="dstLang" value="${dstLang}"><option>Python</option><option>JavaScript</option><option>C++</option></select>
      <button id="translate-button">translate</button>
      <pre><code id="out"></code></pre>            <!-- 翻译结果显示区域 -->
      <button id="insert-button"><img src="${insertSvg}" />Insert</button>
      <script type="module" src="${mainJs}"></script>
      <link rel="stylesheet" href="${css}"/>
    </body></html>`;
  }

  // 消息监听：处理翻译请求与插入动作 + 统计埋点
  private _setWebviewMessageListener(view: vscode.WebviewView) {
    let commandid = ""; // 保存一次翻译会话的标识，用于采纳统计结束
    view.webview.onDidReceiveMessage(async (m) => {
      switch (m.command) {
        case "code.translate": {
          const { original, srcLang, dstLang } = m;          // 1. 获取输入文本与源/目标语言
          const result = await getCodeTranslation(original, srcLang, dstLang).catch(() => ({ translation: [""] }));	          // 2. 调用后端翻译（失败时用空字符串占位）
          commandid = await getStartData(original, original, `${srcLang}->${dstLang}`, "translation").catch(() => "");          // 3. 埋点开始：记录本次翻译启动（失败则 commandid 为空）
          // 4. 回传翻译结果到前端显示（payload 为第一条翻译文本，lang 为目标语言对应的高亮 id）
            view.webview.postMessage({
              command: "code.translate",
              payload: result.translation[0],
              lang: getDocumentLangId(dstLang),
              commandid
            });
          break;
        }
        case "code.insert": {
          const editor = vscode.window.activeTextEditor; 
          if (!editor) break;
          await editor.edit(b => b.replace(editor.selection, m.result)); //用翻译结果替换选区（或光标处空选区）
          if (commandid) await getEndData(commandid, "", "Yes", m.result);//埋点结束：标记用户采纳（Yes）并上传最终内容
          break;
        }
        case "code.translate.inputError": {
          // 输入为空的前端校验反馈
          vscode.window.showInformationMessage("Please input some code to start translating");
          break;
        }
      }
    });
  }
}
```



5. 请求与生成层  
a. getCodeCompletions  
- 文件: getCodeCompletions.ts  
- 核心步骤：  
  1) 选择接口 URL（模式 + generationPreference）  
  2) 自适应候选策略：根据 prompt 长度设 n=3/2/1 并超长截断末 1200  
  3) 构建 payload（lang / prompt / 温度 / top_p / top_k / n）  
  4) 埋点 getStartData(inputText, prompt, lang, mode)  
  5) axios.post → 返回 result.output.code 数组  
  6) 去空 + 去重 → resolve  
  7) 失败：调用 getEndData(commandid, message, \"No\") 并 reject  

```typescript
export async function getCodeCompletionsCore(prompt: string, lang: string, mode: string, num: number, apiKey: string, apiSecret: string) {
  // 选接口 URL：根据 mode + generationPreference
  const API_URL = mode === "prompt"
    ? `${apiHref}/multilingual_code_generate_block`
    : mode === "interactive"
      ? `${apiHref}/multilingual_code_generate_adapt`
      : (generationPreference === "line by line"
          ? `${apiHref}/multilingual_code_generate`
          : `${apiHref}/multilingual_code_generate_adapt`);

  // 自适应候选策略 + 截断末尾 1200 num 传给后端
  let adaptiveN = prompt.length <= 300 ? 3
                 : prompt.length > 600 && prompt.length <= 900 ? 2
                 : prompt.length > 900 && prompt.length <= 1200 ? 1
                 : 1;
  if (prompt.length > 1200) prompt = prompt.slice(-1200); // 截断

  // 构建 payload（含采样参数）
  const payload: any = {
    prompt,
    n: num,                      
    apikey: apiKey,
    apisecret: apiSecret,
    temperature: temp,
    top_p: topp,
    top_k: topk
  };
  if (lang) payload.lang = lang;

  // 构造 inputtext
  let fullText = (() => {
    const ed = vscode.window.activeTextEditor;
    if (!ed) return prompt;
    const end = ed.document.lineAt(ed.document.lineCount - 1).range.end;
    return ed.document.getText(new vscode.Selection(0,0,end.line,end.character));
  })();
  let commandid = "";		// 记录开始埋点
  try { commandid = await getStartData(fullText, prompt, lang, mode); } catch {}

  // axios.post 请求
  try {
    const res = await axios.post(API_URL, payload, { proxy:false, timeout:120000 });//超时容忍、避免本地代理
    if (res?.data.status !== 0) { // 后端业务状态非 0 视为失败
      // 失败：结束埋点并抛错
      try { await getEndData(commandid, res.data.message, "No"); } catch {}
      throw new Error(res.data.message);
    }
    // 去空 + 去重
    const raw: string[] = res.data.result.output.code || [];
    const completions: string[] = [];
    for (const c of raw) {
      const t = c.trim();
      if (!t) continue;
      if (completions.includes(c)) continue;
      completions.push(c);
    }
    return { completions, commandid };	// 返回结果与埋点 
  } catch (err: any) {
    // 网络/异常失败埋点（信息尽量简化）
    try { await getEndData(commandid, String(err), "No"); } catch {}
    throw err;
  }
}
```



b. codegeexCodeGen / codegeexCodeTranslation  

- 文件: codegeexCodeGen.ts / getCodeTranslation.ts / codegeexCodeTranslation.ts  
- 作用：与后端 REST 交互，封装通用请求并处理翻译/生成结果。  

```typescript
// codegeexCodeGen.ts 交互生成：两步导航 -> 先 loading 占位再实际结果
export const codegeexCodeGen = async (code_block: string) => {
  // 生成占位虚拟文档 URI（loading=true 用于显示“生成中”）
  const loading = vscode.Uri.parse(`${myScheme}:CodeGeeX?loading=true&mode=gen&code_block=${code_block}`, true);
  await navUri(loading, "python", "CodeGeeX"); // 打开占位
  // 切换到真实内容（loading=false 触发 textDocumentProvider 拉取生成结果）
  const final = vscode.Uri.parse(`${myScheme}:CodeGeeX?loading=false&mode=gen&code_block=${code_block}`, true);
  await navUri(final, "python", "CodeGeeX");
};

// getCodeTranslation.ts 翻译接口封装：构造 payload -> axios.post -> 过滤空行
export async function getCodeTranslation(prompt: string, src: string, dst: string): Promise<{ translation: string[] }> {
  const API_URL = `https://tianqi.aminer.cn/api/v2/multilingual_code_translate`;
  const payload = {
    prompt,
    n: 1,                 // 仅需一条翻译
    src_lang: src,
    dst_lang: dst,
    stop: [],
    userid: "",
    apikey: apiKey,
    apisecret: apiSecret,
    temperature: temp,
    top_p: topp,
    top_k: topk
  };
  const res = await axios.post(API_URL, payload, { proxy:false, timeout:120000 }).catch(e => { throw e; });
  if (res?.data.status !== 0) throw new Error(res?.data.message || "translate_failed");
  const raw: string[] = res.data.result.output.code || [];
  const translation = raw.filter(s => s.trim() !== ""); // 去空
  return { translation };
}

// codegeexCodeTranslation.ts 虚拟文档导航：翻译结果编码进 URI 查询参数 + 还原特殊符号
export const codegeexCodeTranslation = async (dstLang: string, translationRes: string, commandid: string) => {
  // 将 + & 先替换为占位符，避免 URI 解析混淆
  const encoded = translationRes.replaceAll("+", addSignal).replaceAll("&", andSignal);
  const langId = getDocumentLangId(dstLang);                      // 目标语言对应的语法高亮标识
  const uri = Uri.parse(
    `${myScheme}:CodeGeeX_translation?loading=false&mode=translation&commandid=${commandid}&translation_res=${encoded}`,
    true
  );
  await navUri(uri, langId, "CodeGeeX_translation");              // 导航到翻译虚拟文档（textDocumentProvider 负责展示）
};
```



6. 后处理与插入  
a. chooseCandidate  
- 文件: chooseCandidate.ts  
- 输入：虚拟文档中选的候选索引/内容。  
- 流程：定位原编辑器位置 → 插入选中代码（必要时补换行或缩进）→ 统计采纳行为 → 更新状态栏。  

```typescript
// chooseCandidate.ts 负责将用户选择的候选内容写回原编辑器并做采纳统计
export default async function chooseCandidate(
  editor: vscode.TextEditor,      // 原始代码编辑器
  content: string,                // 选中候选代码/翻译文本
  mode: string,                   // 'translation' 或普通模式
  commandid: string               // 埋点标识（为空则忽略统计）
) {
  if (!editor) return;
  try {
    await editor.edit(async b => {
      const sel = editor.selection;
      // 行首位置且候选首字符是换行 → 去掉以避免产生额外空行
      if (sel.start.character === 0 && content.startsWith("\n")) {
        content = content.slice(1);
      }
      if (mode === "translation") {
        // 翻译模式：根据配置决定是否保留原文（注释形式）或直接替换
        const original = editor.document.getText(sel);
        const lang = editor.document.languageId;
        const commentSignal = getCommentSignal(lang);
        if (translationInsertMode === "comment") {
          // 使用行注释包裹原文，再换行追加翻译结果
            const commented = commentCode(original, lang, "line")
              .replaceAll(comment, commentSignal.line || "#");
          b.replace(sel, commented + "\n" + content);
        } else {
          b.replace(sel, content);
        }
      } else {
        // 普通生成模式：直接替换选区
        b.replace(sel, content);
      }
      // 成功采纳补全/翻译 → 上报结束埋点（whetherAdopt=Yes）
      if (commandid) {
        try { await getEndData(commandid, "", "Yes", content); } catch {}
      }
    });
    // 将光标移到新插入文本末尾，便于继续输入
    const end = editor.selection.end;
    editor.selection = new vscode.Selection(end, end);
  } catch (e) {
    console.log(e);
  }
}
```

b. updateStatusBarItem  
- 文件: updateStatusBarItem.ts  
- 根据加载/空闲/禁用状态更新文字与图标。  

```typescript
// updateStatusBarItem.ts 负责统一更新扩展状态栏图标与文本
let clearTimer: NodeJS.Timeout | undefined;

export function updateStatusBarItem(
  bar: vscode.StatusBarItem,	// 状态栏
  loadingFlag: boolean,			// 当前
  isLoading: boolean,			// 进入加载态
  info: string					// 附加文本
) {
  bar.show();
  if (clearTimer) clearTimeout(clearTimer); // 取消旧的延迟恢复任务

  if (isLoading) {
    // 使用 VS Code spinner 图标
    loadingFlag = true;
    bar.text = `$(loading~spin)` + info;
  } else {
    // 空闲态：自定义图标 + 附加提示，30s 后自动复原只剩图标
    loadingFlag = false;
    bar.text = `$(codegeex-dark)` + info;
    clearTimer = setTimeout(() => {
      bar.text = `$(codegeex-dark)`; // 清除提示只保留图标
    }, 30000);
  }
}
```



c. changeIconColor  

- 文件: changeIconColor.ts  
- 读取配置/状态决定图标背景色（启用/禁用/当前语言禁用）。  

```typescript
// changeIconColor.ts 根据扩展启用 & 当前语言禁用状态设置状态栏背景
let g_isEnable = true;

export function changeIconColor(
  desiredEnable: boolean,			// 期望启用
  bar: vscode.StatusBarItem,		// 状态栏
  originalColor: string | vscode.ThemeColor | undefined,	// 原始背景
  isLangDisabled = false,			// 当前语言是否被禁用
  switchTab = false					// 是否为编辑器切换触发
) { 
  bar.show();
  updateStatusBarItem(bar, false, false, ""); // 刷新图标文本为基线

  // 1. 如果是 tab 切换：使用内部记忆 g_isEnable，不更新它
  const effectiveEnable = switchTab ? g_isEnable : desiredEnable;
  // 非 tab 切换时更新记忆
  if (!switchTab) g_isEnable = desiredEnable;

  // 2. 语言禁用或扩展禁用 → 警示色
  if (!effectiveEnable || isLangDisabled) {
    bar.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    return;
  }

  // 3. 正常启用 → 恢复原色（若是字符串则忽略回退）
  bar.backgroundColor = typeof originalColor === "string" ? undefined : originalColor;
}
```



7. 统计与埋点  
- 文件: statisticFunc.ts  
- getStartData / getEndData / getOpenExtensionData / getTotalRequestNum  
- 行为：扩展启动、请求开始、请求结束、累计次数上报。  
- 形式：axios 或 fetch（视实现）传简单 payload（时间戳/模式/状态）。  
- 改进：Promise reject 直接传字符串，可统一 Error；增加失败重试/批量 flush。  

```typescript
// statisticFunc.ts 负责埋点：扩展启动 / 请求开始 / 请求结束 / 总次数查询
const privacy = vscode.workspace.getConfiguration("Codegeex").get("Privacy");

// 启动埋点：记录环境与版本
export async function getOpenExtensionData(): Promise<string> {
  try {
    const res = await axios.post(`${apiHerf}/tracking/insertVscodeStartRecord`, {
      vscodeMachineId: vscode.env.machineId,
      vscodeSessionId: vscode.env.sessionId,
      platformVersion: os.release(),
      systemOs: os.type(),
      extensionId,
      extensionVersion,
      nodeArch: os.arch(),
      isNewAppInstall: vscode.env.isNewAppInstall,
      vscodeVersion: vscode.version,
      product: vscode.env.appHost,
      uikind: vscode.env.uiKind,
      remoteName: vscode.env.remoteName
    }, { proxy:false });
    return res.data.msg;
  } catch {
    throw new Error("open_extension_failed");
  }
}

// 请求开始：返回 commandid（后续结束埋点用）
export async function getStartData(inputText: string, prompt: string, lang: string, mode?: string): Promise<string> {
  const payload = {
    vscodeMachineId: vscode.env.machineId,
    vscodeSessionId: vscode.env.sessionId,
    requestPhase: "start",
    inputContent: privacy ? inputText : null,
    prompt: privacy ? prompt : null,
    lang,
    mode: mode || null,
    extensionId,
    extensionVersion
  };
  try {
    const res = await axios.post(`${apiHerf}/tracking/vsCodeOperationRecord`, payload, { proxy:false, timeout:1000 });
    return res.data?.data?.id || "";
  } catch {
    // 失败不抛硬错误，返回空 id → 后续结束不上报
    return "";
  }
}

// 请求结束：是否采纳 + 输出数量
export async function getEndData(
  commandid: string,
  message: string,
  isAdopted: string,
  acceptItem?: string | null,
  completions?: string[] | string
): Promise<void> {
  if (!commandid) return; // 无 id 不上报
  const arr = Array.isArray(completions) ? completions : (typeof completions === "string" ? [completions] : []);
  const payload = {
    id: commandid,
    requestPhase: "end",
    outputContent: privacy ? acceptItem : null,
    modelStatus: -1,
    message,
    num: privacy ? arr.length : 0,
    numContent: privacy ? arr.toString() : null,
    whetherAdopt: isAdopted,
    extensionId,
    extensionVersion
  };
  try {
    await axios.post(`${apiHerf}/tracking/vsCodeOperationRecord`, payload, { proxy:false, timeout:1000 });
  } catch {
  }
}

// 总请求次数查询
export async function getTotalRequestNum(): Promise<number> {
  try {
    const res = await axios.get(
      `${apiHerf}/tracking/selectByVscodeMachineIdTotal?vscodeMachineId=${vscode.env.machineId}`,
      { proxy:false }
    );
    if (res.data.code === 200 && res.data.data) return res.data.data;
    throw new Error("total_request_failed");
  } catch {
    throw new Error("total_request_failed");
  }
}
```



8. 模板与说明  
- 模板：src/templates/docstring.ts / explanation.ts  
- 功能：存储结构化模板文本。



9. 语言与禁用判断  
- 文件: getDocumentLangId.ts / isCurrentLanguageDisable.ts / getDocumentLanguage.ts  
- 用途：获取当前编辑器语言、判断是否在禁用列表（影响图标颜色与是否请求补全）。  

```typescript
// getDocumentLangId.ts
export function getDocumentLangId(raw: string): string {
  const normalized = raw.replace("++","pp").replace("#","sharp"); // 简单规整
  return langMap[raw] || normalized.toLowerCase();
}

// isCurrentLanguageDisable.ts
export function getDocumentLanguage(editor: vscode.TextEditor): string {
  const lang = editor.document.languageId || "";
  // 可选过滤：不支持的语言返回空字符串，阻止请求
  const unsupported = ["markdown", "plaintext"];
  return unsupported.includes(lang) ? "" : lang;
}

// getDocumentLanguage.ts
export function isCurrentLanguageDisable(editor: vscode.TextEditor): boolean {
  const disabledFor = vscode.workspace.getConfiguration("Codegeex").get("DisabledFor") as Record<string,boolean|string> | undefined;
  const lang = editor.document.languageId;
  if (!disabledFor) return false;
  const flag = disabledFor[lang];
  return flag === true || flag === "true";
}
```



10. Webview 与交互界面  
- 文件: welcomePage.ts / provider/translationWebviewProvider.ts + webview-ui/*  
- 实现：使用 getUri() 引用本地 JS/CSS(webview-ui/ )；构造 HTML 字符串注入；在 webview 脚本中通过 vscode.postMessage 与扩展通信。  

```typescript
export function showWelcomePage(extUri: vscode.Uri) {
  const panel = vscode.window.createWebviewPanel(
    "codegeexWelcome",                  // viewType
    "CodeGeeX Welcome",                 // 标题
    vscode.ViewColumn.One,
    { enableScripts: true }             // 允许脚本以便交互
  );
  const script = getUri(panel.webview, extUri, ["webview-ui","main.js"]);
  const style  = getUri(panel.webview, extUri, ["webview-ui","styles.css"]);
  panel.webview.html = `
    <!DOCTYPE html><html><head>
      <link rel="stylesheet" href="${style}">
      <script type="module" src="${script}"></script>
    </head>
    <body>
      <h2>Welcome to CodeGeeX</h2>
      <p>快速开始：打开任意代码文件，按 Alt+/ 获得补全。</p>
      <button id="open-translate">Open Translation View</button>
      <script>
        const vscode = acquireVsCodeApi();
        document.getElementById('open-translate').onclick = () => {
          vscode.postMessage({ command: 'open.translation.view' });
        };
      </script>
    </body></html>`;
  panel.webview.onDidReceiveMessage(msg => {
    if (msg.command === 'something') { /* ... */ }
  });
}
```



核心整体流程（端到端：隐身补全）  
(1) 用户输入停顿 → VS Code 触发 InlineCompletionProvider.provideInlineCompletionItems  
(2) 构建上下文（光标前文本 + Notebook cell 拼接 + 截断）  
(3) getCodeCompletions → 选择 URL → 构造 payload → 埋点开始 → axios 请求 → 过滤候选 → 返回 completions[]  
(4) Provider 生成 InlineCompletionItem[] → VS Code 渲染灰色预览  
(5) 用户 Tab 接受 → 文本插入 → chooseCandidate（若多候选模式）或 verifyInsertion → 埋点结束（采纳）  
(6) 状态栏与统计更新  

功能与文件映射简表  

- 激活/命令：extension.ts  
- 内联补全：provider/inlineCompletionProvider.ts (+ getCodeCompletions.ts)  
- 命令触发一次性补全：inlineCompletionProviderWithCommand.ts  
- 交互/翻译/Prompt 模式入口：mode/*.ts  
- 虚拟文档：provider/textDocumentProvider.ts  
- CodeLens：provider/codelensProvider.ts  
- 统计：utils/statisticFunc.ts  
- 候选选择：utils/chooseCandidate.ts  
- 状态栏与图标：utils/updateStatusBarItem.ts, utils/changeIconColor.ts  
- 请求封装：utils/getCodeCompletions.ts, utils/getCodeTranslation.ts  
- 模板：templates/*.ts  
- 语言/禁用：utils/getDocumentLangId.ts, utils/isCurrentLanguageDisable.ts  

