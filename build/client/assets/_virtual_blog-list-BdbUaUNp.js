const n=[{filename:"kode-cli-context-engineering",title:"kode-cli 上下文管理",author:"Madinah",tags:["AI"],readingTime:{text:"11 min read",minutes:10.92,time:655200,words:2184},url:"/blogs/kode-cli-context-engineering",toc:[{url:"#kode-完整上下文管理流程",value:"Kode 完整上下文管理流程",level:2},{url:"#架构概览",value:"架构概览",level:4},{url:"#完整数据流程",value:"完整数据流程",level:4},{url:"#完整示例从用户输入到-llm-响应",value:"完整示例：从用户输入到 LLM 响应",level:4},{url:"#关键设计要点",value:"关键设计要点",level:4}],content:`<hr>
<p>title: kode-cli 上下文管理
author: Madinah
tags:</p>
<ul>
<li>AI</li>
</ul>
<hr>
<h2>Kode 完整上下文管理流程</h2>
<h3>架构概览</h3>
<pre><code class="language-plaintext">用户输入 → REPL → query() → formatSystemPromptWithContext() → LLM
                ↓                        ↓
            getContext()          generateSystemReminders()
                ↓                        ↓
           [静态上下文]              [动态 Reminders]
</code></pre>
<h3>完整数据流程</h3>
<h4>1. 用户启动会话</h4>
<pre><code class="language-typescript">// src/screens/REPL.tsx - 初始化阶段

// 用户启动 Kode CLI
$ kode

// REPL 组件初始化
const [messages, setMessages] = useState&#x3C;MessageType[]>([])
const [context, setContext] = useState&#x3C;{[k: string]: string}>({})

// 异步加载静态上下文（会话开始时一次性加载）
useEffect(() => {
  async function loadContext() {
    const ctx = await getContext()
    setContext(ctx)
  }
  loadContext()
}, [])

</code></pre>
<h4>2. 静态上下文收集 (src/context.ts)</h4>
<pre><code class="language-typescript">// getContext() 返回的数据结构
const staticContext = {
  // 1. 目录结构（memoized，会话期间不变）
  directoryStructure: \`
Below is a snapshot of this project's file structure:
.
├── src/
│   ├── screens/
│   │   └── REPL.tsx
│   ├── services/
│   │   ├── claude.ts
│   │   └── systemReminder.ts
│   ├── tools/
│   │   ├── TodoWriteTool/
│   │   └── FileReadTool/
│   └── utils/
│       ├── context.ts
│       └── todoStorage.ts
├── package.json
└── README.md
\`,

  // 2. Git 状态（memoized）
  gitStatus: \`
Current branch: feature/context-management
Main branch: main

Status:
M  src/services/claude.ts
M  src/query.ts
?? docs/context-flow.md

Recent commits:
abc1234 Add context management
def5678 Implement reminders
ghi9012 Fix todo storage

Your recent commits:
abc1234 Add context management
\`,

  // 3. 代码风格（memoized）
  codeStyle: \`
Project uses:
- TypeScript with strict mode
- React with Ink for CLI UI
- Zod for schema validation
- Prettier for formatting
\`,

  // 4. README 内容
  readme: \`
# Kode CLI

AI-powered coding assistant...
\`,

  // 5. 项目文档（AGENTS.md + CLAUDE.md）
  projectDocs: \`
# AGENTS.md

This file provides guidance to Kode automation agents...

---

# CLAUDE.md

Additional project-specific instructions...
\`,

  // 6. 用户自定义上下文（从配置文件）
  customContext: \`
Team conventions:
- Use functional components
- Prefer async/await over promises
\`,
};
</code></pre>
<h4>3. 用户发送消息</h4>
<pre><code class="language-typescript">// 用户输入
const userInput = '帮我实现一个新的 tool';

// PromptInput 组件处理
const handleSubmit = async (input: string) => {
  setIsLoading(true);

  // 创建用户消息
  const userMessage: UserMessage = {
    type: 'user',
    uuid: crypto.randomUUID(),
    message: {
      role: 'user',
      content: input,
    },
  };

  // 添加到消息历史
  setMessages((prev) => [...prev, userMessage]);

  // 开始查询
  const abortController = new AbortController();
  setAbortController(abortController);

  // 调用 query 生成器
  for await (const message of query(
    [...messages, userMessage], // 消息历史
    getSystemPrompt(), // 系统提示
    context, // 静态上下文
    canUseTool, // 权限检查函数
    {
      abortController,
      options: {
        commands,
        forkNumber,
        messageLogName,
        tools,
        verbose,
        safeMode,
        maxThinkingTokens: getMaxThinkingTokens(),
        model: 'main',
      },
      readFileTimestamps: {},
      setToolJSX,
      agentId: 'default',
    },
    getBinaryFeedbackResponse,
  )) {
    setMessages((prev) => [...prev, message]);
  }

  setIsLoading(false);
};
</code></pre>
<h4>4. query() 函数处理 (src/query.ts)</h4>
<pre><code class="language-typescript">export async function* query(
  messages: Message[],
  systemPrompt: string[],
  context: { [k: string]: string },
  canUseTool: CanUseToolFn,
  toolUseContext: ExtendedToolUseContext,
  getBinaryFeedbackResponse?: (m1, m2) => Promise&#x3C;BinaryFeedbackResult>,
): AsyncGenerator&#x3C;Message, void> {
  // 📊 当前状态
  console.log('=== Query Start ===');
  console.log('Messages count:', messages.length);
  console.log('Context keys:', Object.keys(context));
  console.log('Agent ID:', toolUseContext.agentId);

  // 🔄 自动压缩检查
  const { messages: processedMessages, wasCompacted } = await checkAutoCompact(
    messages,
    toolUseContext,
  );

  if (wasCompacted) {
    console.log(
      '✅ Messages compacted:',
      messages.length,
      '→',
      processedMessages.length,
    );
    messages = processedMessages;
  }

  // 🎯 格式化系统提示 + 生成动态 reminders
  const { systemPrompt: fullSystemPrompt, reminders } =
    formatSystemPromptWithContext(
      systemPrompt,
      context,
      toolUseContext.agentId,
    );

  console.log('System prompt blocks:', fullSystemPrompt.length);
  console.log('Reminders generated:', reminders ? 'Yes' : 'No');

  // 📢 触发会话启动事件
  emitReminderEvent('session:startup', {
    agentId: toolUseContext.agentId,
    messages: messages.length,
    timestamp: Date.now(),
  });

  // 💉 注入 reminders 到最后一条用户消息
  if (reminders &#x26;&#x26; messages.length > 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.type === 'user') {
        const lastUserMessage = messages[i] as UserMessage;

        // 前置注入 reminders
        messages[i] = {
          ...lastUserMessage,
          message: {
            ...lastUserMessage.message,
            content: reminders + lastUserMessage.message.content,
          },
        };

        console.log('✅ Reminders injected to message', i);
        break;
      }
    }
  }

  // 🤖 调用 LLM
  const result = await queryWithBinaryFeedback(
    toolUseContext,
    () =>
      queryLLM(
        normalizeMessagesForAPI(messages),
        fullSystemPrompt,
        toolUseContext.options.maxThinkingTokens,
        toolUseContext.options.tools,
        toolUseContext.abortController.signal,
        {
          safeMode: toolUseContext.options.safeMode,
          model: toolUseContext.options.model || 'main',
          prependCLISysprompt: true,
          toolUseContext,
        },
      ),
    getBinaryFeedbackResponse,
  );

  // 返回 AI 响应
  if (result.message) {
    yield result.message;
  }

  // 🔧 处理工具调用...
  // （省略工具执行逻辑）
}
</code></pre>
<h4>5. formatSystemPromptWithContext() (src/services/claude.ts)</h4>
<pre><code class="language-typescript">export function formatSystemPromptWithContext(
  systemPrompt: string[],
  context: { [k: string]: string },
  agentId?: string,
  skipContextReminders = false,
): { systemPrompt: string[]; reminders: string } {
  const enhancedPrompt = [...systemPrompt];
  let reminders = '';

  // 📊 输入数据示例
  console.log('=== formatSystemPromptWithContext ===');
  console.log('Input systemPrompt:', systemPrompt.slice(0, 2));
  console.log('Input context keys:', Object.keys(context));
  console.log('Agent ID:', agentId);

  // 🎯 步骤 0: GPT-5 特殊处理
  const modelManager = getModelManager();
  const modelProfile = modelManager.getModel('main');

  if (modelProfile &#x26;&#x26; isGPT5Model(modelProfile.modelName)) {
    enhancedPrompt.push(
      '\\n# Agent Persistence for Long-Running Coding Tasks',
      'You are working on a coding project...',
      // ... 更多持久化指令
    );
    console.log('✅ Added GPT-5 persistence prompts');
  }

  // 🔍 检查是否有上下文
  const hasContext = Object.entries(context).length > 0;
  console.log('Has context:', hasContext);

  if (hasContext) {
    // 📄 步骤 1: 注入 Kode 项目文档到系统提示
    if (!skipContextReminders) {
      const kodeContext = generateKodeContext();

      if (kodeContext) {
        enhancedPrompt.push('\\n---\\n# 项目上下文\\n');
        enhancedPrompt.push(kodeContext);
        enhancedPrompt.push('\\n---\\n');

        console.log('✅ Kode context injected:', kodeContext.length, 'chars');
      }
    }

    // 🔔 步骤 2: 生成动态 reminders
    const reminderMessages = generateSystemReminders(hasContext, agentId);

    if (reminderMessages.length > 0) {
      reminders = reminderMessages.map((r) => r.content).join('\\n') + '\\n';

      console.log('✅ Generated reminders:', reminderMessages.length);
      console.log(
        'Reminder types:',
        reminderMessages.map((r) => r.type).join(', '),
      );
    }

    // 📦 步骤 3: 添加其他静态上下文
    enhancedPrompt.push(
      \`\\nAs you answer the user's questions, you can use the following context:\\n\`,
    );

    // 过滤掉已处理的项目文档
    const filteredContext = Object.fromEntries(
      Object.entries(context).filter(
        ([key]) => key !== 'projectDocs' &#x26;&#x26; key !== 'userDocs',
      ),
    );

    enhancedPrompt.push(
      ...Object.entries(filteredContext).map(
        ([key, value]) => \`&#x3C;context name="\${key}">\${value}&#x3C;/context>\`,
      ),
    );

    console.log(
      '✅ Added context blocks:',
      Object.keys(filteredContext).join(', '),
    );
  }

  // 📤 输出数据示例
  console.log('=== Output ===');
  console.log('Enhanced prompt blocks:', enhancedPrompt.length);
  console.log('Reminders length:', reminders.length);

  return { systemPrompt: enhancedPrompt, reminders };
}
</code></pre>
<h4>6. generateSystemReminders() (src/services/systemReminder.ts)</h4>
<pre><code class="language-typescript">public generateReminders(
  hasContext: boolean = false,
  agentId?: string
): ReminderMessage[] {

  console.log('=== generateSystemReminders ===')
  console.log('Has context:', hasContext)
  console.log('Agent ID:', agentId)

  // 🚫 无上下文时不生成
  if (!hasContext) {
    console.log('❌ No context, skipping reminders')
    return []
  }

  // 🚫 达到会话限制
  if (this.sessionState.reminderCount >=
      this.sessionState.config.maxRemindersPerSession) {
    console.log('❌ Reminder limit reached:',
      this.sessionState.reminderCount)
    return []
  }

  const reminders: ReminderMessage[] = []

  // 🔄 懒加载生成器
  const reminderGenerators = [
    () => this.dispatchTodoEvent(agentId),
    () => this.dispatchSecurityEvent(),
    () => this.dispatchPerformanceEvent(),
    () => this.getMentionReminders()
  ]

  for (const generator of reminderGenerators) {
    if (reminders.length >= 5) break

    const result = generator()
    if (result) {
      const remindersToAdd = Array.isArray(result) ? result : [result]
      reminders.push(...remindersToAdd)
      this.sessionState.reminderCount += remindersToAdd.length

      console.log('✅ Added reminder:',
        remindersToAdd.map(r => r.type).join(', '))
    }
  }

  console.log('=== Total reminders ===', reminders.length)

  return reminders
}

// Todo Reminder 示例
private dispatchTodoEvent(agentId?: string): ReminderMessage | null {
  const todos = getTodos(agentId)
  const agentKey = agentId || 'default'

  console.log('📋 Checking todos for agent:', agentKey)
  console.log('Todo count:', todos.length)

  // 场景 1: 空列表提醒
  if (todos.length === 0 &#x26;&#x26;
      !this.sessionState.remindersSent.has(\`todo_empty_\${agentKey}\`)) {

    this.sessionState.remindersSent.add(\`todo_empty_\${agentKey}\`)

    console.log('✅ Generated empty todo reminder')

    return this.createReminderMessage(
      'todo',
      'task',
      'medium',
      'Your todo list is currently empty. Use TodoWrite if needed.',
      Date.now()
    )
  }

  // 场景 2: Todo 更新提醒
  if (todos.length > 0) {
    const stateHash = this.getTodoStateHash(todos)
    const reminderKey = \`todo_updated_\${agentKey}_\${todos.length}_\${stateHash}\`

    if (!this.sessionState.remindersSent.has(reminderKey)) {
      this.sessionState.remindersSent.add(reminderKey)
      this.clearTodoReminders(agentKey)

      const todoContent = JSON.stringify(
        todos.map(todo => ({
          content: todo.content.substring(0, 100),
          status: todo.status,
          priority: todo.priority,
          id: todo.id
        }))
      )

      console.log('✅ Generated todo update reminder')
      console.log('Todo content preview:', todoContent.substring(0, 100))

      return this.createReminderMessage(
        'todo',
        'task',
        'medium',
        \`Your todo list has changed:\\n\${todoContent}\`,
        Date.now()
      )
    }
  }

  console.log('❌ No todo reminder needed')
  return null
}


</code></pre>
<h4>7. 最终发送给 LLM 的数据结构</h4>
<pre><code class="language-typescript">// queryLLM() 接收的参数
const llmRequest = {
  // 消息历史（已注入 reminders）
  messages: [
    {
      role: 'user',
      content: \`&#x3C;system-reminder>
Your todo list has changed:
[{"content":"实现新 tool","status":"in_progress","priority":"high","id":"task-1"}]
&#x3C;/system-reminder>

帮我实现一个新的 tool\`
    },
    {
      role: 'assistant',
      content: [
        { type: 'text', text: '好的，我来帮你...' },
        { type: 'tool_use', name: 'FileRead', input: {...} }
      ]
    },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_123',
          content: '文件内容...'
        }
      ]
    }
  ],

  // 系统提示（已增强）
  systemPrompt: [
    // 基础系统提示
    "You are Kode, an AI coding assistant...",

    // GPT-5 持久化指令（如果适用）
    "\\n# Agent Persistence for Long-Running Coding Tasks",
    "You are working on a coding project...",

    // Kode 项目文档
    "\\n---\\n# 项目上下文\\n",
    "# AGENTS.md\\n\\nThis file provides guidance...",
    "\\n---\\n",

    // 静态上下文
    "\\nAs you answer the user's questions, you can use the following context:\\n",
    '&#x3C;context name="directoryStructure">...&#x3C;/context>',
    '&#x3C;context name="gitStatus">...&#x3C;/context>',
    '&#x3C;context name="codeStyle">...&#x3C;/context>',
    '&#x3C;context name="readme">...&#x3C;/context>'
  ],

  // 其他参数
  maxThinkingTokens: 10000,
  tools: [...],  // 工具定义
  temperature: 1.0,
  model: 'claude-sonnet-4-20250514'
}


</code></pre>
<h3>完整示例：从用户输入到 LLM 响应</h3>
<pre><code class="language-typescript">// ============================================
// 场景：用户要求实现新功能
// ============================================

// 1️⃣ 用户输入
用户: "帮我实现一个文件搜索工具"

// 2️⃣ REPL 处理
const userMessage = {
  type: 'user',
  uuid: 'msg-001',
  message: {
    role: 'user',
    content: '帮我实现一个文件搜索工具'
  }
}

// 3️⃣ 静态上下文（已缓存）
const context = {
  directoryStructure: "src/\\n  tools/\\n    FileReadTool/\\n    ...",
  gitStatus: "Current branch: main\\nStatus: clean",
  codeStyle: "TypeScript + React + Zod",
  projectDocs: "# AGENTS.md\\n\\n工具开发指南..."
}

// 4️⃣ 调用 query()
for await (const message of query(
  [userMessage],
  ["You are Kode..."],
  context,
  canUseTool,
  toolUseContext
)) {
  // 处理响应
}

// 5️⃣ formatSystemPromptWithContext()
// 输入:
{
  systemPrompt: ["You are Kode..."],
  context: { directoryStructure: "...", gitStatus: "...", ... },
  agentId: "default"
}

// 输出:
{
  systemPrompt: [
    "You are Kode...",
    "\\n---\\n# 项目上下文\\n",
    "# AGENTS.md\\n\\n工具开发指南...",
    "\\n---\\n",
    "\\nAs you answer...\\n",
    '&#x3C;context name="directoryStructure">...&#x3C;/context>',
    '&#x3C;context name="gitStatus">...&#x3C;/context>'
  ],
  reminders: "&#x3C;system-reminder>\\nYour todo list is empty...\\n&#x3C;/system-reminder>\\n"
}

// 6️⃣ 注入 reminders
messages[0].message.content =
  "&#x3C;system-reminder>\\nYour todo list is empty...\\n&#x3C;/system-reminder>\\n" +
  "帮我实现一个文件搜索工具"

// 7️⃣ 发送给 LLM
API Request: {
  model: "claude-sonnet-4-20250514",
  messages: [
    {
      role: "user",
      content: "&#x3C;system-reminder>...&#x3C;/system-reminder>\\n帮我实现一个文件搜索工具"
    }
  ],
  system: [
    { type: "text", text: "You are Kode..." },
    { type: "text", text: "\\n---\\n# 项目上下文\\n" },
    { type: "text", text: "# AGENTS.md\\n\\n..." },
    { type: "text", text: '&#x3C;context name="directoryStructure">...&#x3C;/context>' },
    { type: "text", text: '&#x3C;context name="gitStatus">...&#x3C;/context>',
      cache_control: { type: "ephemeral" } }  // 缓存控制
  ],
  tools: [...],
  max_tokens: 8192,
  temperature: 1.0
}

// 8️⃣ LLM 响应
{
  role: "assistant",
  content: [
    {
      type: "text",
      text: "我来帮你实现一个文件搜索工具。根据项目结构，我会创建..."
    },
    {
      type: "tool_use",
      name: "FileWrite",
      input: {
        path: "src/tools/FileSearchTool/FileSearchTool.tsx",
        content: "import { Tool } from '@tool'..."
      }
    }
  ]
}

// 9️⃣ 工具执行
// FileWrite 工具被调用，创建新文件

// 🔟 返回给用户
✅ 文件已创建: src/tools/FileSearchTool/FileSearchTool.tsx

</code></pre>
<h3>关键设计要点</h3>
<ul>
<li>静态上下文缓存：getContext() 使用 memoize，会话期间只加载一次</li>
<li>动态 Reminders：每次查询时实时生成，基于当前状态</li>
<li>分离注入：项目文档注入系统提示，reminders 注入用户消息</li>
<li>去重机制：使用 remindersSent Set 避免重复提醒</li>
<li>优先级管理：最多 5 个 reminders，按优先级选择</li>
<li>缓存控制：长文本使用 prompt caching 减少成本</li>
<li>事件驱动：通过事件系统解耦各模块</li>
</ul>
`,time:"2025-12-09T17:39:36+08:00",date:"2025-12-09T17:39:36+08:00",gitInfo:{createdAt:"2025-12-09T17:39:36+08:00",updatedAt:"2025-12-09T17:39:36+08:00",commits:[{hash:"a46d0ee",date:"2025-12-09T17:39:36+08:00",author:"madinah",message:"feat: add kode-cli 上下文流程",githubUrl:"https://github.com/Maidang1/madinah/commit/a46d0ee4262b21d7f31fc551f592d5ce5345e79f"}]}},{filename:"mini-kode",title:"mini-Kode coding agent 学习记录",author:"Madinah",tags:["AI","Agent"],time:"2025-11-16T01:26:56+08:00",readingTime:{text:"18 min read",minutes:17.375,time:1042500,words:3475},url:"/blogs/mini-kode",toc:[{url:"#系统架构概览",value:"系统架构概览",level:2},{url:"#核心组件",value:"核心组件",level:4},{url:"#技术栈",value:"技术栈",level:4},{url:"#启动流程",value:"启动流程",level:2},{url:"#1-入口点-srcindexts",value:"1. 入口点 (",level:4},{url:"#2-cli-解析-srcclits",value:"2. CLI 解析 (",level:4},{url:"#核心执行循环",value:"核心执行循环",level:2},{url:"#agent-执行引擎-srcagentexecutorts",value:"Agent 执行引擎 (",level:4},{url:"#执行流程图",value:"执行流程图",level:4},{url:"#核心代码解析",value:"核心代码解析",level:4},{url:"#系统消息构建",value:"系统消息构建",level:4},{url:"#工具执行机制",value:"工具执行机制",level:2},{url:"#工具系统架构",value:"工具系统架构",level:4},{url:"#并发执行策略",value:"并发执行策略",level:4},{url:"#工具执行流程",value:"工具执行流程",level:4},{url:"#权限系统",value:"权限系统",level:2},{url:"#权限架构",value:"权限架构",level:4},{url:"#权限检查流程",value:"权限检查流程",level:4},{url:"#权限类型",value:"权限类型",level:4},{url:"#异步权限请求流程",value:"异步权限请求流程",level:4},{url:"#消息流转",value:"消息流转",level:2},{url:"#openai-消息顺序规则",value:"OpenAI 消息顺序规则",level:4},{url:"#消息格式化",value:"消息格式化",level:4},{url:"#典型消息流",value:"典型消息流",level:4},{url:"#错误处理",value:"错误处理",level:2},{url:"#错误分类",value:"错误分类",level:4},{url:"#错误处理流程",value:"错误处理流程",level:4},{url:"#常见错误场景",value:"常见错误场景",level:4},{url:"#完整执行示例",value:"完整执行示例",level:2},{url:"#场景修改文件",value:"场景：修改文件",level:4},{url:"#执行步骤",value:"执行步骤",level:4},{url:"#总结",value:"总结",level:2}],content:`<hr>
<p>title: mini-Kode coding agent 学习记录
author: Madinah
tags:</p>
<ul>
<li>AI</li>
<li>Agent
time: 2025-11-16 00:01:23</li>
</ul>
<hr>
<h2>系统架构概览</h2>
<p>Mini-Kode 是一个基于 LLM 的命令行编程助手，采用 <strong>工具调用（Tool Calling）</strong> 模式与大语言模型交互。</p>
<h3>核心组件</h3>
<pre><code>┌─────────────────────────────────────────────────────────────┐
│                         用户界面层                            │
│  ┌──────────────────┐              ┌──────────────────┐     │
│  │  Interactive UI  │              │ Non-Interactive  │     │
│  │   (Ink + React)  │              │      Mode        │     │
│  └──────────────────┘              └──────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Agent 执行引擎                           │
│              (src/agent/executor.ts)                         │
│  • 管理 LLM 对话循环                                          │
│  • 协调工具执行                                               │
│  • 处理权限请求                                               │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  LLM Client  │   │ Tool System  │   │  Permission  │
│              │   │              │   │   System     │
│ • 流式响应    │   │ • 工具注册    │   │ • 权限检查    │
│ • Token 统计 │   │ • 并发执行    │   │ • 策略管理    │
└──────────────┘   └──────────────┘   └──────────────┘
</code></pre>
<h3>技术栈</h3>
<ul>
<li><strong>TypeScript</strong> - 类型安全</li>
<li><strong>Bun</strong> - 运行时和构建工具</li>
<li><strong>Ink</strong> - 基于 React 的 CLI UI</li>
<li><strong>OpenAI SDK</strong> - LLM 集成</li>
<li><strong>Zod</strong> - 运行时类型验证</li>
</ul>
<hr>
<h2>启动流程</h2>
<h3>1. 入口点 (<code>src/index.ts</code>)</h3>
<pre><code class="language-typescript">#!/usr/bin/env -S node --no-warnings=ExperimentalWarning

import { EventEmitter } from "events";
EventEmitter.defaultMaxListeners = 200; // 支持多个 LLM 流式调用

import { runCli } from "./cli";
void runCli();
</code></pre>
<h3>2. CLI 解析 (<code>src/cli.ts</code>)</h3>
<p>系统支持两种运行模式：</p>
<h4>交互模式（Interactive Mode）</h4>
<pre><code class="language-bash"># 启动交互式 UI
mini-kode
</code></pre>
<h4>非交互模式（Non-Interactive Mode）</h4>
<pre><code class="language-bash"># 直接执行任务
mini-kode "修复 auth.ts 中的 bug"
</code></pre>
<p><strong>CLI 参数：</strong></p>
<ul>
<li><code>-a, --approval-mode &#x3C;mode></code>: 权限模式
<ul>
<li><code>default</code>: 每次都询问</li>
<li><code>autoEdit</code>: 自动批准文件编辑</li>
<li><code>yolo</code>: 自动批准所有操作</li>
</ul>
</li>
<li><code>-w, --work-dir &#x3C;path></code>: 工作目录</li>
</ul>
<p><strong>代码示例：</strong></p>
<pre><code class="language-typescript">// src/cli.ts
if (prompt) {
  // 非交互模式：直接执行任务
  const exitCode = await runNonInteractive(prompt, workDir, approvalMode);
  process.exit(exitCode);
} else {
  // 交互模式：启动 UI
  const element = React.createElement(App, { cwd: workDir, approvalMode });
  const instance = render(element, { exitOnCtrlC: false });
  await instance.waitUntilExit();
}
</code></pre>
<hr>
<h2>核心执行循环</h2>
<h3>Agent 执行引擎 (<code>src/agent/executor.ts</code>)</h3>
<p>这是整个系统的核心，负责管理 LLM 与工具之间的交互循环。</p>
<h3>执行流程图</h3>
<pre><code>┌─────────────────────────────────────────────────────────────┐
│ 1. 用户输入 Prompt                                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. 构建对话上下文                                             │
│    • System Message (环境信息 + AGENTS.md)                   │
│    • 历史消息                                                 │
│    • 当前 Prompt                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. 发送请求到 LLM                                             │
│    • 流式响应                                                 │
│    • 实时更新 UI                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
    ┌──────────────────┐    ┌──────────────────┐
    │ finish_reason:   │    │ finish_reason:   │
    │   "stop"         │    │  "tool_calls"    │
    └──────────────────┘    └──────────────────┘
                │                       │
                ▼                       ▼
    ┌──────────────────┐    ┌──────────────────┐
    │ 返回最终响应      │    │ 执行工具调用      │
    └──────────────────┘    └──────────────────┘
                                        │
                                        ▼
                            ┌──────────────────┐
                            │ 工具执行完成      │
                            │ 添加结果到对话    │
                            └──────────────────┘
                                        │
                                        ▼
                            ┌──────────────────┐
                            │ 回到步骤 3        │
                            │ (继续循环)        │
                            └──────────────────┘
</code></pre>
<h3>核心代码解析</h3>
<pre><code class="language-typescript">// src/agent/executor.ts - executeAgent 函数
export async function executeAgent(
  prompt: string,
  context: ExecutionContext,
  callbacks: ExecutionCallbacks = {},
): Promise&#x3C;ExecutionResult> {
  // 1. 初始化 LLM 客户端
  const client = createClient({ cwd });
  
  // 2. 构建对话历史
  const systemMessage = await buildSystemMessage(cwd);
  let conversationHistory: ChatCompletionMessageParam[] = [
    systemMessage,
    ...toOpenAIMessages(session.messages),
    { role: "user", content: prompt }
  ];

  // 3. 主循环
  while (true) {
    // 3.1 流式调用 LLM
    const stream = streamChatCompletion(client, conversationHistory, {
      signal,
      tools: openaiTools,
    });

    // 3.2 处理流式响应
    for await (const response of stream) {
      callbacks.onLLMMessageUpdate?.({
        kind: "api",
        status: response.isComplete ? "complete" : "streaming",
        message: response.completeMessage,
      });
    }

    // 3.3 判断 finish_reason
    if (finishReason === "tool_calls" &#x26;&#x26; parsedCalls.length > 0) {
      // 执行工具
      const toolCalls = await executeToolsWithPermission(
        parsedCalls,
        context,
        callbacks,
      );
      
      // 添加工具结果到对话
      for (const toolCall of toolCalls) {
        const toolMessage = formatToolResultMessage(toolCall);
        conversationHistory.push(toolMessage);
      }
      
      // 继续循环
      continue;
    }

    // 3.4 返回最终响应
    return { success: true, response: assembled };
  }
}
</code></pre>
<h3>系统消息构建</h3>
<p>系统消息包含环境信息和项目上下文：</p>
<pre><code class="language-typescript">// src/agent/context.ts
async function buildSystemMessage(effectiveCwd: string) {
  const envInfo: EnvironmentInfo = {
    cwd: effectiveCwd,
    isGitRepo: isGitRepository(effectiveCwd),
    platform: process.platform,
    date: new Date().toISOString().split("T")[0],
    model: client.model,
  };

  // 读取 AGENTS.md 作为项目上下文
  let projectContext = "";
  const agentsPath = path.join(envInfo.cwd, "AGENTS.md");
  if (fs.existsSync(agentsPath)) {
    projectContext = fs.readFileSync(agentsPath, "utf8");
  }

  return { role: "system", content: buildSystemPrompt(envDetails, projectContext) };
}
</code></pre>
<p><strong>AGENTS.md 的作用：</strong></p>
<ul>
<li>提供项目特定的上下文信息</li>
<li>记录技术栈、架构、开发规范</li>
<li>帮助 LLM 更好地理解项目</li>
</ul>
<hr>
<h2>工具执行机制</h2>
<h3>工具系统架构</h3>
<pre><code>┌─────────────────────────────────────────────────────────────┐
│                      Tool Definition                         │
│  • name: 工具名称                                             │
│  • description: 工具描述                                      │
│  • inputSchema: Zod 验证模式                                  │
│  • readonly: 是否只读                                         │
│  • execute: 执行函数                                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Tool Executor                              │
│              (src/agent/toolExecutor.ts)                     │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Concurrent  │   │  Sequential  │   │  Permission  │
│  Execution   │   │  Execution   │   │   Handling   │
│  (只读工具)   │   │  (写入工具)   │   │              │
└──────────────┘   └──────────────┘   └──────────────┘
</code></pre>
<h3>并发执行策略</h3>
<pre><code class="language-typescript">// src/agent/toolExecutor.ts
async function executeToolsWithPermission(
  calls: ParsedToolCall[],
  context: ExecutionContext,
  callbacks: ExecutionCallbacks,
): Promise&#x3C;ToolCall[]> {
  // 检查是否所有工具都是只读的
  const allReadonly = toolCallsToExecute.every((tc) => {
    const tool = toolsByName[tc.toolName];
    return tool?.readonly === true;
  });

  if (allReadonly) {
    // 并发执行只读工具
    return await executeToolsConcurrently(toolCallsToExecute, context, callbacks);
  } else {
    // 顺序执行包含写入操作的工具
    return await executeToolsSequentially(toolCallsToExecute, context, callbacks);
  }
}
</code></pre>
<p><strong>为什么需要区分并发和顺序执行？</strong></p>
<ol>
<li>
<p><strong>只读工具（Concurrent）</strong>：</p>
<ul>
<li>例如：<code>fileRead</code>, <code>grepSearch</code></li>
<li>无副作用，可以并发执行提高性能</li>
<li>结果按照调用顺序返回</li>
</ul>
</li>
<li>
<p><strong>写入工具（Sequential）</strong>：</p>
<ul>
<li>例如：<code>fsWrite</code>, <code>bash</code></li>
<li>有副作用，必须顺序执行避免冲突</li>
<li>确保操作的原子性</li>
</ul>
</li>
</ol>
<h3>工具执行流程</h3>
<pre><code class="language-typescript">// src/tools/runner.ts
async function executeSingleTool(
  toolCall: ToolCall,
  execContext: ToolExecutionContext,
  startedAt: string,
): Promise&#x3C;ToolCall> {
  try {
    const tool = toolsByName[toolCall.toolName];
    const result = await tool.execute(toolCall.input, execContext);

    // 检查是否是业务逻辑错误
    if ("isError" in result &#x26;&#x26; result.isError === true) {
      return {
        ...toolCall,
        status: "error",
        result,
      };
    }

    return {
      ...toolCall,
      status: "success",
      result,
    };
  } catch (err) {
    // 捕获权限错误
    if (err instanceof PermissionRequiredError) {
      return {
        ...toolCall,
        status: "permission_required",
        uiHint: err.uiHint,
      };
    }
    
    return {
      ...toolCall,
      status: "error",
      result: { isError: true, message: String(err?.message) },
    };
  }
}
</code></pre>
<hr>
<h2>权限系统</h2>
<h3>权限架构</h3>
<p>Mini-Kode 实现了<strong>两层权限系统</strong>：</p>
<pre><code>┌─────────────────────────────────────────────────────────────┐
│                      Approval Mode                           │
│  • yolo: 自动批准所有操作                                     │
│  • autoEdit: 自动批准文件编辑                                 │
│  • default: 每次都询问                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Permission Policies                        │
│  ┌──────────────────┐              ┌──────────────────┐     │
│  │  Project Policy  │              │ Session Policy   │     │
│  │  (持久化到磁盘)   │              │  (内存中)         │     │
│  │  .mini-kode/     │              │  运行时授权       │     │
│  │  config.json     │              │                  │     │
│  └──────────────────┘              └──────────────────┘     │
└─────────────────────────────────────────────────────────────┘
</code></pre>
<h3>权限检查流程</h3>
<pre><code class="language-typescript">// src/permissions/policyResolver.ts
export function checkFsPermission(
  cwd: string,
  targetPath: string,
  approvalMode: ApprovalMode,
): { ok: true } | { ok: false; message: string } {
  // 1. YOLO 模式：自动批准
  if (approvalMode === "yolo") {
    return { ok: true };
  }

  // 2. AutoEdit 模式：自动批准写操作
  if (approvalMode === "autoEdit") {
    return { ok: true };
  }

  // 3. 检查 Session 权限（内存，快速）
  if (checkSessionFsPermission(targetPath)) {
    return { ok: true };
  }

  // 4. 检查 Project 权限（磁盘，持久化）
  if (checkProjectFsPermission(cwd, targetPath)) {
    return { ok: true };
  }

  // 5. 需要用户授权
  return {
    ok: false,
    message: \`Permission required to modify: \${relativePath}\`,
  };
}
</code></pre>
<h3>权限类型</h3>
<ol>
<li>
<p><strong>文件系统权限（FS）</strong></p>
<pre><code class="language-typescript">type FsGrant = {
  type: "fs";
  path: string; // 绝对路径或 "*" 表示全局
};
</code></pre>
</li>
<li>
<p><strong>Bash 命令权限</strong></p>
<pre><code class="language-typescript">type BashGrant = {
  type: "bash";
  command: string; // 命令或 "npm:*" 表示前缀匹配
};
</code></pre>
</li>
<li>
<p><strong>MCP 工具权限</strong></p>
<pre><code class="language-typescript">type MCPGrant = {
  type: "mcp";
  serverName: string;
  toolName?: string; // 可选，特定工具
};
</code></pre>
</li>
</ol>
<h3>异步权限请求流程</h3>
<pre><code>┌─────────────────────────────────────────────────────────────┐
│ 1. 工具执行时检查权限                                         │
│    checkFsPermission() / checkBashApproval()                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ 权限已授予？   │
                    └───────────────┘
                    │               │
                Yes │               │ No
                    ▼               ▼
        ┌──────────────┐   ┌──────────────────┐
        │ 直接执行      │   │ 抛出              │
        │              │   │ PermissionRequired│
        │              │   │ Error             │
        └──────────────┘   └──────────────────┘
                                    │
                                    ▼
                        ┌──────────────────────┐
                        │ Executor 捕获错误     │
                        │ 调用 onPermission    │
                        │ Required 回调         │
                        └──────────────────────┘
                                    │
                                    ▼
                        ┌──────────────────────┐
                        │ UI 显示权限请求       │
                        │ 等待用户决策          │
                        └──────────────────────┘
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
            ┌──────────────────┐    ┌──────────────────┐
            │ 用户批准          │    │ 用户拒绝          │
            └──────────────────┘    └──────────────────┘
                        │                       │
                        ▼                       ▼
            ┌──────────────────┐    ┌──────────────────┐
            │ 应用授权并重新    │    │ 返回              │
            │ 执行工具          │    │ permission_denied │
            └──────────────────┘    └──────────────────┘
</code></pre>
<p><strong>代码示例：</strong></p>
<pre><code class="language-typescript">// src/agent/toolExecutor.ts
async function executeSingleToolWithPermission(
  toolCallToExecute: ToolCallPending,
  context: ExecutionContext,
  callbacks: ExecutionCallbacks,
): Promise&#x3C;ToolCall> {
  // 执行工具
  const result = await executeSingleToolCall(toolCallToExecute, toolContext);

  if (result.status === "permission_required") {
    // 处理权限请求
    const finalResult = await handlePermissionRequest(
      result,
      toolContext,
      callbacks,
    );
    return finalResult;
  }
  
  return result;
}

async function handlePermissionRequest(
  toolCallToExecute: ToolCallPermissionRequired,
  toolContext: ToolExecutionContext,
  callbacks: ExecutionCallbacks,
): Promise&#x3C;ToolCall> {
  // 调用回调，等待用户决策
  const decision = await callbacks.onPermissionRequired?.(
    toolCallToExecute.uiHint,
    toolCallToExecute.requestId,
  );

  if (decision?.approved) {
    // 应用授权
    applyPermissionGrant(decision.grant, toolContext);
    
    // 重新执行工具
    return await executeSingleToolCall(toolCallToExecute, toolContext);
  } else {
    // 用户拒绝
    return {
      ...toolCallToExecute,
      status: "permission_denied",
      result: { isError: true, message: "Permission denied by user" },
    };
  }
}
</code></pre>
<hr>
<h2>消息流转</h2>
<h3>OpenAI 消息顺序规则</h3>
<p>OpenAI API 对消息顺序有<strong>严格要求</strong>，违反规则会导致 400 错误。</p>
<p><strong>关键规则：</strong></p>
<ol>
<li>
<p><strong>Tool 消息必须跟在包含 tool_calls 的 Assistant 消息后面</strong></p>
<pre><code class="language-typescript">// ✅ 正确
[
  { role: "user", content: "..." },
  { role: "assistant", tool_calls: [{ id: "call_1", ... }] },
  { role: "tool", tool_call_id: "call_1", content: "..." },
]

// ❌ 错误
[
  { role: "user", content: "..." },
  { role: "tool", tool_call_id: "call_1", content: "..." }, // 没有前置 tool_calls
]
</code></pre>
</li>
<li>
<p><strong>每个 tool_call 必须有且仅有一个对应的 tool 消息</strong></p>
</li>
<li>
<p><strong>Tool 消息必须按照 tool_calls 数组的顺序</strong></p>
<pre><code class="language-typescript">// ✅ 正确
[
  { role: "assistant", tool_calls: [{ id: "call_1" }, { id: "call_2" }] },
  { role: "tool", tool_call_id: "call_1", content: "..." }, // 第一个
  { role: "tool", tool_call_id: "call_2", content: "..." }, // 第二个
]

// ❌ 错误（顺序颠倒）
[
  { role: "assistant", tool_calls: [{ id: "call_1" }, { id: "call_2" }] },
  { role: "tool", tool_call_id: "call_2", content: "..." }, // 顺序错误
  { role: "tool", tool_call_id: "call_1", content: "..." },
]
</code></pre>
</li>
</ol>
<h3>消息格式化</h3>
<pre><code class="language-typescript">// src/agent/formatters.ts
export function formatToolResultMessage(
  result: ToolCall,
): ChatCompletionToolMessageParam {
  let content: string;

  if (result.status === "success") {
    content = JSON.stringify(result.result, null, 2);
  } else if (result.status === "error") {
    content = \`Error: \${result.result.message}\`;
  } else if (result.status === "abort") {
    content = result.result.message;
  } else if (result.status === "permission_denied") {
    content = \`\${result.toolName} was rejected by user\`;
  }

  return {
    role: "tool",
    tool_call_id: result.requestId,
    content,
  };
}
</code></pre>
<h3>典型消息流</h3>
<pre><code>Round 1: 简单工具调用
1. user: "读取 file.txt"
2. assistant: { tool_calls: [{ id: "call_1", function: "fileRead" }] }
3. tool: { tool_call_id: "call_1", content: "{ 文件内容 }" }
4. assistant: "文件包含..."

Round 2: 多工具调用
5. user: "比较 file1.txt 和 file2.txt"
6. assistant: { tool_calls: [
     { id: "call_2", function: "fileRead", arguments: "file1.txt" },
     { id: "call_3", function: "fileRead", arguments: "file2.txt" }
   ]}
7. tool: { tool_call_id: "call_2", content: "{ file1 内容 }" }
8. tool: { tool_call_id: "call_3", content: "{ file2 内容 }" }
9. assistant: "比较结果..."
</code></pre>
<hr>
<h2>错误处理</h2>
<h3>错误分类</h3>
<pre><code class="language-typescript">// src/agent/types.ts
type ExecutionError = {
  type:
    | "permission_denied"  // 用户拒绝权限 (exit 1)
    | "aborted"            // 用户取消 (exit 3)
    | "llm_error"          // LLM API 错误 (exit 2)
    | "internal_error";    // 内部错误 (exit 4)
  message: string;
  cause?: unknown;
};
</code></pre>
<h3>错误处理流程</h3>
<pre><code class="language-typescript">// src/agent/executor.ts
try {
  // 执行循环
  while (true) {
    // LLM 调用和工具执行
  }
} catch (err) {
  // 1. 错误分类
  let errorType: "aborted" | "llm_error" | "internal_error" = "internal_error";
  
  if (err instanceof APIUserAbortError) {
    errorType = "aborted";
  } else if (err instanceof OpenAIError) {
    errorType = "llm_error";
  }

  // 2. 更新 UI 状态
  callbacks.onGeneratingChange?.(false);

  // 3. 调用错误回调（用户取消除外）
  if (errorType !== "aborted") {
    callbacks.onError?.(err);
  }

  // 4. 返回错误结果
  return {
    success: false,
    error: { type: errorType, message: errorMessage, cause: err },
  };
}
</code></pre>
<h3>常见错误场景</h3>
<ol>
<li>
<p><strong>LLM API 错误</strong></p>
<ul>
<li>速率限制（Rate Limit）</li>
<li>认证失败（Authentication）</li>
<li>网络错误（Network）</li>
</ul>
</li>
<li>
<p><strong>工具执行错误</strong></p>
<ul>
<li>文件不存在</li>
<li>命令执行失败</li>
<li>权限不足</li>
</ul>
</li>
<li>
<p><strong>用户中断</strong></p>
<ul>
<li>Ctrl+C 取消</li>
<li>拒绝权限请求</li>
</ul>
</li>
</ol>
<hr>
<h2>完整执行示例</h2>
<p>让我们通过一个完整的例子来理解整个流程：</p>
<h3>场景：修改文件</h3>
<p><strong>用户输入：</strong></p>
<pre><code class="language-bash">mini-kode "在 src/main.ts 中添加一个 hello 函数"
</code></pre>
<h3>执行步骤</h3>
<p><strong>Step 1: 启动和初始化</strong></p>
<pre><code class="language-typescript">// CLI 解析参数
const prompt = "在 src/main.ts 中添加一个 hello 函数";
const cwd = "/project";
const approvalMode = "default";

// 创建 Session
const session = createSession();

// 调用 executeAgent
await executeAgent(prompt, { cwd, signal, getApprovalMode, session }, callbacks);
</code></pre>
<p><strong>Step 2: 构建对话上下文</strong></p>
<pre><code class="language-typescript">// 系统消息
const systemMessage = {
  role: "system",
  content: \`
    Environment: macOS, /project
    Date: 2025-11-16
    Model: gpt-4
    
    Project Context (AGENTS.md):
    # Mini-Kode - Development Guide
    ...
  \`
};

// 对话历史
const conversationHistory = [
  systemMessage,
  { role: "user", content: "在 src/main.ts 中添加一个 hello 函数" }
];
</code></pre>
<p><strong>Step 3: LLM 第一次调用</strong></p>
<pre><code class="language-typescript">// LLM 决定先读取文件
{
  role: "assistant",
  tool_calls: [{
    id: "call_1",
    function: {
      name: "fileRead",
      arguments: { path: "src/main.ts" }
    }
  }]
}
</code></pre>
<p><strong>Step 4: 执行 fileRead 工具</strong></p>
<pre><code class="language-typescript">// fileRead 是只读工具，无需权限
const result = {
  status: "success",
  result: {
    content: "export function main() { console.log('Hello'); }"
  }
};

// 添加 tool 消息到对话
conversationHistory.push({
  role: "tool",
  tool_call_id: "call_1",
  content: JSON.stringify(result.result)
});
</code></pre>
<p><strong>Step 5: LLM 第二次调用</strong></p>
<pre><code class="language-typescript">// LLM 决定写入文件
{
  role: "assistant",
  tool_calls: [{
    id: "call_2",
    function: {
      name: "fsWrite",
      arguments: {
        path: "src/main.ts",
        text: "export function hello() { return 'Hello'; }\\n\\nexport function main() { console.log('Hello'); }"
      }
    }
  }]
}
</code></pre>
<p><strong>Step 6: 执行 fsWrite 工具（需要权限）</strong></p>
<pre><code class="language-typescript">// 检查权限
const permission = checkFsPermission(cwd, "/project/src/main.ts", "default");
// => { ok: false, message: "Permission required to modify: src/main.ts" }

// 抛出 PermissionRequiredError
throw new PermissionRequiredError({
  kind: "fs",
  path: "/project/src/main.ts",
  message: "Permission required to modify: src/main.ts"
});
</code></pre>
<p><strong>Step 7: 处理权限请求</strong></p>
<pre><code class="language-typescript">// Executor 捕获错误，调用回调
const decision = await callbacks.onPermissionRequired({
  kind: "fs",
  path: "/project/src/main.ts",
  message: "Permission required to modify: src/main.ts"
}, "call_2");

// UI 显示权限请求，用户批准
// decision = {
//   approved: true,
//   grant: { type: "fs", path: "/project/src/main.ts" },
//   scope: "once"
// }

// 应用授权到 Session Policy
applySessionGrant(decision.grant);

// 重新执行工具
const result = await tool.execute(input, context);
// => { status: "success" }
</code></pre>
<p><strong>Step 8: LLM 第三次调用</strong></p>
<pre><code class="language-typescript">// 添加 tool 消息
conversationHistory.push({
  role: "tool",
  tool_call_id: "call_2",
  content: JSON.stringify({ success: true })
});

// LLM 生成最终响应
{
  role: "assistant",
  content: "我已经在 src/main.ts 中添加了 hello 函数。"
}

// 返回结果
return {
  success: true,
  response: "我已经在 src/main.ts 中添加了 hello 函数。"
};
</code></pre>
<hr>
<h2>总结</h2>
<p>Mini-Kode 的 Agent 执行流程可以总结为：</p>
<ol>
<li><strong>用户输入</strong> → CLI 解析 → 选择运行模式</li>
<li><strong>Agent 初始化</strong> → 构建对话上下文 → 加载 AGENTS.md</li>
<li><strong>LLM 循环</strong>：
<ul>
<li>发送请求到 LLM</li>
<li>流式接收响应</li>
<li>判断 finish_reason</li>
<li>如果是 tool_calls：执行工具 → 添加结果 → 继续循环</li>
<li>如果是 stop：返回最终响应</li>
</ul>
</li>
<li><strong>工具执行</strong>：
<ul>
<li>只读工具并发执行</li>
<li>写入工具顺序执行</li>
<li>权限检查和异步请求</li>
</ul>
</li>
<li><strong>权限系统</strong>：
<ul>
<li>Approval Mode 快速路径</li>
<li>Session Policy（内存）</li>
<li>Project Policy（持久化）</li>
</ul>
</li>
<li><strong>错误处理</strong>：
<ul>
<li>分类错误类型</li>
<li>更新 UI 状态</li>
<li>返回适当的退出码</li>
</ul>
</li>
</ol>
<p>这个架构确保了：</p>
<ul>
<li>✅ <strong>类型安全</strong>：TypeScript + Zod</li>
<li>✅ <strong>高性能</strong>：并发执行只读工具</li>
<li>✅ <strong>安全性</strong>：细粒度权限控制</li>
<li>✅ <strong>可扩展</strong>：工具系统易于扩展</li>
<li>✅ <strong>用户友好</strong>：流式响应和实时反馈</li>
</ul>
`,date:"2025-11-16T01:26:56+08:00",gitInfo:{createdAt:"2025-11-16T01:26:56+08:00",updatedAt:"2025-11-16T01:26:56+08:00",commits:[{hash:"081a4b4",date:"2025-11-16T01:26:56+08:00",author:"madinah",message:"feat: add mini-kode coding agent 学习流程",githubUrl:"https://github.com/Maidang1/madinah/commit/081a4b48f8f3bfc83d7fe21a29235f75b4f693bc"}]}},{filename:"prompt",title:"Prompt 学习",author:"Madinah",tags:["prompt","AI"],time:"2025-10-20T23:54:29+08:00",readingTime:{text:"13 min read",minutes:12.54,time:752400,words:2508},url:"/blogs/prompt",toc:[{url:"#prompt-最佳实践",value:"Prompt 最佳实践",level:2},{url:"#提供示例",value:"提供示例",level:4},{url:"#简洁设计",value:"简洁设计",level:4},{url:"#明确输出内容",value:"明确输出内容",level:4},{url:"#使用指令而非约束条件",value:"使用指令而非约束条件",level:4},{url:"#控制最大令牌长度",value:"控制最大令牌长度",level:4},{url:"#在提示词中使用变量",value:"在提示词中使用变量",level:4},{url:"#尝试不同的输入格式和写作风格",value:"尝试不同的输入格式和写作风格",level:4},{url:"#在分类任务的少样本提示中混合不同的类别",value:"在分类任务的少样本提示中，混合不同的类别",level:4},{url:"#适应模型更新",value:"适应模型更新",level:4},{url:"#尝试输出格式",value:"尝试输出格式",level:4},{url:"#思维链最佳实践",value:"思维链最佳实践",level:2},{url:"#记录各种提示词尝试",value:"记录各种提示词尝试",level:2}],content:`<hr>
<p>title: Prompt 学习
author: Madinah
tags:</p>
<ul>
<li>prompt</li>
<li>AI
time: 2025-10-20 22:51:00</li>
</ul>
<hr>
<h2>Prompt 最佳实践</h2>
<h3>提供示例</h3>
<p>最重要的最佳实践是在提示词中提供（单样本/少样本）示例。这非常有效，因为它起到了强大的教学工具的作用。
这些示例展示了期望的输出或类似的回应，让模型能够从中学习并相应地调整自己的生成内容。
这就像给模型一个参考点或目标，有助于提高其回应的准确性、风格和语气，使其更符合你的预期。</p>
<h3>简洁设计</h3>
<p>提示词应当简洁、清晰，并且你和模型都易于理解。根据经验来看，如果你自己都觉得某个提示词令人困惑，那么模型很可能也会有同样的感受。
尽量不要使用复杂的语言，也不要提供不必要的信息。</p>
<p><strong>示例：</strong></p>
<ul>
<li>我现在正在纽约游玩，想多了解一些好地方。我带着两个3岁的孩子，假期里我们应该去哪里呢？ --->  请扮演一名旅游向导，为游客介绍纽约曼哈顿适合带3岁幼儿游览的好去处。
尝试使用描述动作的动词。以下是一组示例：
行动、分析、分类、归类、对比、比较、创造、描述、定义、评估、提取、查找、生成、识别、列举、测量、组织、解析、挑选、预测、提供、排序、推荐、返回、检索、重写、选择、展示、排序、总结、翻译、撰写。</li>
</ul>
<h3>明确输出内容</h3>
<p>明确期望的输出内容。简洁的指令可能不足以引导大语言模型，或者可能过于笼统。在提示词中（通过系统提示或上下文提示）提供具体细节可以帮助模型聚焦于相关内容，提高整体准确性。</p>
<p><strong>示例：</strong></p>
<p>yes: 写一篇三段的博客文章，内容是关于排名前五的视频游戏主机。这篇博客文章应该兼具信息量和吸引力，并且要用对话式的风格来写。
no: 生成一篇关于视频游戏主机的博客文章。</p>
<h3>使用指令而非约束条件</h3>
<p>在提示词中，指令和约束用于引导大语言模型的输出。</p>
<ul>
<li>指令会就期望的响应格式、风格或内容提供明确指示。它会指导模型应该做什么或生成什么。</li>
<li>约束条件是对响应的一系列限制或边界。它规定了模型不应该做什么或需要避免什么。</li>
</ul>
<p>越来越多的研究表明，在提示词中侧重于积极的指令可能比过度依赖限制条件更有效。这种方法与人类更喜欢积极指令而非一系列禁止事项的偏好相符。
指令直接传达了期望的结果，而约束条件可能会让模型对允许的内容感到困惑。指令提供了灵活性，并鼓励在既定范围内发挥创造力，而约束条件则可能限制模型的潜力。
此外，一系列约束条件还可能相互冲突。
在某些情况下，约束仍然很有价值。比如为了防止模型生成有害或带有偏见的内容，或者在需要严格的输出格式或风格时。
如果可能的话，请使用积极的指令：不要告诉模型不应该做什么，而是告诉它应该做什么。这样可以避免混淆并提高输出的准确性。</p>
<p>yes: 撰写一篇关于五大视频游戏主机的单段博客文章。只需讨论主机、制造公司、推出年份以及总销量。
no: 生成一篇关于五大视频游戏主机的单段博客文章。不要列出游戏名称。</p>
<p>作为最佳实践，首先要优先考虑指令，清晰说明你希望模型做什么，并且只在出于安全、清晰度或特定要求的必要情况下使用约束条件。通过试验和迭代来测试指令与约束条件的不同组合，找到最适合你特定任务的方式，并将这些记录下来。</p>
<h3>控制最大令牌长度</h3>
<p>要控制大语言模型生成的回复长度，你可以在配置中设置最大令牌限制，或者在提示词中明确要求特定的长度。例如： “用一条推文的长度解释量子物理学。”</p>
<h3>在提示词中使用变量</h3>
<p>要重复使用提示词并使其更具动态性，可以在提示词中使用变量，这些变量可以根据不同的输入进行更改。例如，如表20所示，有一个提供某座城市相关事实的提示词。不要在提示词中硬编码城市名称，而是使用变量。变量可以让你避免重复工作，从而节省时间和精力。如果需要在多个提示词中使用同一条信息，你可以将其存储在一个变量中，然后在每个提示词中引用该变量。在将提示词集成到你自己的应用程序中时，这一点非常有用。</p>
<p>| Prompt | VARIABLES  = "Amsterdam" PROMPT You are a travel guide. Tell me a fact about the city:  |
| --- | --- |
| Output | Amsterdam is a beautiful city full of canals, bridges, and narrow streets. It’s a great place to visit for its rich history, culture, and nightlife. |</p>
<h3>尝试不同的输入格式和写作风格</h3>
<p>不同的模型、模型配置、提示词格式、用词以及提交方式可能会产生不同的结果。因此，尝试不同的提示词属性（如风格、用词和提示词类型（零样本、少样本、系统提示词））是很重要的。
例如，一个旨在生成关于革命性视频游戏机世嘉 Dreamcast 的文本的提示词，可以被表述为一个问题、一个陈述或一条指令，从而产生不同的输出：</p>
<ul>
<li>问题：世嘉Dreamcast是什么？它为何是一款极具革命性的游戏机？</li>
<li>指令：撰写一个段落，描述世嘉Dreamcast游戏机并解释其为何具有革命性。</li>
<li>指令：撰写一个段落，描述世嘉Dreamcast游戏机并解释其为何具有革命性。</li>
</ul>
<h3>在分类任务的少样本提示中，混合不同的类别</h3>
<p>一般来说，你的少样本示例的顺序影响不大。不过，在进行分类任务时，要确保在少样本示例中混合可能的响应类别。这是因为否则你可能会过度拟合示例的特定顺序。
通过混合可能的响应类别，你可以确保模型是在学习识别每个类别的关键特征，而不是简单地记住示例的顺序。这将使模型在未见过的数据上表现出更强的稳健性和泛化能力。
一个实用的经验法则是从6个少样本示例开始，并以此为基础测试准确性。</p>
<h3>适应模型更新</h3>
<p>及时了解模型架构的变化、新增的数据和功能对你来说很重要。尝试更新的模型版本，并调整你的提示词，以更好地利用模型的新特性。
像Vertex AI Studio这样的工具非常适合存储、测试和记录你的各种提示词版本。</p>
<h3>尝试输出格式</h3>
<p>除了提示词的输入格式，还可以考虑尝试调整输出格式。对于非创造性任务，如提取、选择、解析、排序、排名或分类数据，尝试让输出以JSON或XML等结构化格式返回。
从用于提取数据的提示词中返回JSON对象有一些好处。在实际应用中，我不需要手动创建这种JSON格式，我已经可以按排序后的顺序返回数据（在处理日期时间对象时非常方便），但最重要的是，通过提示要求JSON格式，这会迫使模型创建一个结构并减少幻觉内容。
总之，为输出使用JSON的好处包括：</p>
<ul>
<li>始终以相同的风格返回</li>
<li>专注于你想要接收的数据</li>
<li>幻觉现象发生的可能性更低</li>
<li>使其具有关系感知能力</li>
<li>你会得到数据类型</li>
</ul>
<h2>思维链最佳实践</h2>
<p>对于思维链提示词而言，需要将答案放在推理过程之后，因为推理过程的生成本身会改变模型在预测最终答案时所获取的标记。
使用思维链（CoT）和自一致性方法时，你需要能够从提示词中提取最终答案，并将其与推理过程分开。
对于思维链提示，将温度设置为0。
思维链提示基于贪心解码，即根据语言模型分配的最高概率来预测序列中的下一个词。一般来说，在进行推理以得出最终答案时，很可能存在一个唯一的正确答案。因此，温度应始终设为0。</p>
<h2>记录各种提示词尝试</h2>
<p>本章前面已经提到过最后一个技巧,但我们再怎么强调它的重要性也不为过:详细记录你的提示词尝试,这样你就能逐渐了解哪些做得好,哪些做得不好。</p>
<p>不同模型、不同采样设置,甚至同一模型的不同版本,其提示词输出可能会有所不同。此外,即
使向同一模型输入完全相同的提示词,输出句子的格式和用词也可能出现细微差异。(例如,如前
所述,如果两个标记的预测概率相同,可能会随机打破平局。这进而会影响后续的预测标记。)</p>
`,date:"2025-10-20T23:54:29+08:00",gitInfo:{createdAt:"2025-10-20T23:54:29+08:00",updatedAt:"2025-10-20T23:54:29+08:00",commits:[{hash:"e5993be",date:"2025-10-20T23:54:29+08:00",author:"madinah",message:"feat: add prompt learn",githubUrl:"https://github.com/Maidang1/madinah/commit/e5993beb2cd0e1f50c2073589cd175d3e01bd0f3"}]}},{filename:"algorithm",title:"Rust algorithm",author:"Madinah",tags:["rust"],time:"2024-10-24T00:39:29+08:00",readingTime:{text:"3 min read",minutes:2.01,time:120600,words:402},url:"/blogs/algorithm",toc:[{url:"#寻找独特数字卡片",value:"寻找独特数字卡片",level:2},{url:"#数字分组求偶数和",value:"数字分组求偶数和",level:2}],content:`<hr>
<p>title: Rust algorithm
author: Madinah
tags:</p>
<ul>
<li>rust
time: 2024-10-24 00:34:00</li>
</ul>
<hr>
<h2>寻找独特数字卡片</h2>
<p>在一个班级中，每位同学都拿到了一张卡片，上面有一个整数。有趣的是，除了一个数字之外，所有的数字都恰好出现了两次。现在需要你帮助班长小 C 快速找到那个拿了独特数字卡片的同学手上的数字是什么</p>
<pre><code class="language-rust">fn solution(inp: Vec&#x3C;i32>) -> i32 {
    let mut result = 0;
    for i in inp.iter() {
        result = result ^ i;
    }
    result
}
</code></pre>
<h2>数字分组求偶数和</h2>
<p>小 M 面对一组从 1 到 9 的数字，这些数字被分成多个小组，并从每个小组中选择一个数字组成一个新的数。目标是使得这个新数的各位数字之和为偶数。任务是计算出有多少种不同的分组和选择方法可以达到这一目标。
numbers: 一个由多个整数字符串组成的列表，每个字符串可以视为一个数字组。小 M 需要从每个数字组中选择一个数字。
例如对于[123, 456, 789]，14 个符合条件的数为：147 149 158 167 169 248 257 259 268 347 349 358 367 369</p>
<pre><code class="language-rust">fn solution(numbers: &#x26;[i32]) -> i32 {
  let mut groups = Vec::new();
  for num in numbers.iter() {
      let chats_arr: Vec&#x3C;i32> = num
          .to_string()
          .chars()
          .map(|c| c.to_digit(10).unwrap() as i32)
          .collect::&#x3C;Vec&#x3C;i32>>();
      groups.push(chats_arr);
  }

  fn calc_nums(group: &#x26;Vec&#x3C;Vec&#x3C;i32>>, index: usize, current_sum: i32, count: &#x26;mut i32) {
      if index == group.len() {
          if current_sum % 2 == 0 {
              *count = *count + 1;
          }
          return;
      }
      for &#x26;num in group[index].iter() {
          calc_nums(group, index + 1, num + current_sum, count);
      }
  }

  let mut count = 0;
  calc_nums(&#x26;mut groups, 0, 0, &#x26;mut count);

  return count;
}
</code></pre>
`,date:"2024-10-24T00:39:29+08:00",gitInfo:{createdAt:"2024-10-24T00:39:29+08:00",updatedAt:"2025-06-01T04:42:15+08:00",commits:[{hash:"3afb49a",date:"2025-06-01T04:42:15+08:00",author:"madinah",message:"fix: some ui detail",githubUrl:"https://github.com/Maidang1/madinah/commit/3afb49a4483e4b341c3da24510ff80ee62ac7cf0"},{hash:"8517fe2",date:"2024-10-24T00:39:29+08:00",author:"maidang1",message:"feat: add rust algorithm",githubUrl:"https://github.com/Maidang1/madinah/commit/8517fe20e8f480ebceb339e54b041b31b24795c1"}]}},{filename:"async",title:"Rust 异步编程",author:"Madinah",tags:["rust"],time:"2024-10-21T01:43:58+08:00",readingTime:{text:"14 min read",minutes:13.275,time:796500,words:2655},url:"/blogs/async",toc:[{url:"#名次解释",value:"名次解释",level:2},{url:"#rust-异步编程",value:"Rust 异步编程",level:2},{url:"#asyncawait-的使用",value:"async/await 的使用",level:2},{url:"#async-lifetime",value:"async lifetime",level:4},{url:"#rust-异步和其他语言的区别",value:"Rust 异步和其他语言的区别",level:4},{url:"#future-trait",value:"Future trait",level:2},{url:"#poll",value:"Poll",level:4},{url:"#rust-异步调试",value:"Rust 异步调试",level:2},{url:"#编译结果",value:"编译结果",level:4},{url:"#调测工具",value:"调测工具",level:4},{url:"#openharmony",value:"openharmony",level:4},{url:"#其他",value:"其他",level:2}],content:`<hr>
<p>title: Rust 异步编程
author: Madinah
tags:</p>
<ul>
<li>rust
time: 2024-10-20 22:48:00</li>
</ul>
<hr>
<h2>名次解释</h2>
<ul>
<li><strong>trait</strong>: 是一种定义共享行为的方式，它类似于其他编程语言中的接口（interface）或抽象类（abstract class）。trait 允许你定义一组方法，这些方法可以被任何类型的结构体、枚举或实现该 trait 的类型所使用</li>
</ul>
<h2>Rust 异步编程</h2>
<p>异步编程，或者叫异步，是一种被越来越多编程语言支持的并发编程模型。它能够在一小撮 OS 线程上运行一大堆并发任务，同时还能通过 <code>async/await</code> 语法，保持原本同步编程的观感。</p>
<p>在 Rust 中主要应用的是 进程—线程—协程 异步模型，如下所示：</p>
<p><img src="https://images.felixwliu.cn/async-model.png" alt="异步编程"></p>
<p>下层是进程，进程是持有资源的最小单位；中层是线程，线程不持有资源，是 CPU 调度的最小单位；上层是协程，协程既不持有资源、也不在意 CPU 的调度，它仅仅关注的是“协作式的、自然的流程切换”。</p>
<p>异步运行时就负责调度执行上述的协程对象。例如在一个协程在等待 IO 时，这个协程会主动出让自己的执行权给异步运行时，这时异步运行时可以调度运行其他的协程，从而最大化地利用 CPU 时间片。在 IO 密集型的应用中，异步编程将能够极大地提高执行效率</p>
<h2>async/await 的使用</h2>
<p><code>async/await</code> 是 Rust 中特殊的语法，它使得让出当前线程的控制权而不阻塞线程成为可能，从而允许在等待一个操作完成时可以运行其他代码。</p>
<p><strong>简单代码</strong></p>
<pre><code class="language-rust">use tokio::time::{sleep, Duration};
async fn foo() -> u8 {
    sleep(Duration::from_secs(1)).await;
    5
}
// 另一个异步函数，调用 \`foo\` 并等待其结果
async fn bar() -> u8 {
    let result = foo().await;
    result + 1
}

#[tokio::main]
async fn main() {
    // 调用 \`bar\` 并等待其结果
    let result = bar().await;
    println!("Result: {}", result); // 输出: Result: 6
}
</code></pre>
<p>有两种主要的方式使用 <code>async：async fn 和 async {}</code>。这两中使用方式都会返回一个实现了 <code>Future trait</code> 的值：</p>
<pre><code class="language-rust">// \`foo()\` 返回一个实现了 \`Future&#x3C;Output = u8>\` 的类型。
// \`foo().await\` 将会产生一个 u8 类型的值。
async fn foo() -> u8 { 5 }

fn bar() -> impl Future&#x3C;Output = u8> {
    // 这个 \`async\` 块会产生一个实现了 \`Future&#x3C;Output = u8>\` 的类型。
    async {
        let x: u8 = foo().await;
        x + 5
    }
}

</code></pre>
<p><code>async fn 和 async {}</code> 返回的 <code>Future</code> 是惰性的：在真正开始运行之前它什么也不会做。运行一个 <code>Future</code> 的最普遍的方式是 <code>await</code> 这个 <code>Future： Future.await</code>。
当 <code>await</code> 一个 <code>Future</code> 时，会暂停当前函数的运行，直到完成对 Future 的运行。如果这个 Future 被阻塞住了（例如等待网络 IO），它会让出当前线程的控制权。当 Future 中的阻塞操作就绪时（
例如等待的网络 IO 返回了响应），executor 会通过 <code>poll</code> 会恢复 <code>Future</code> 的运行。</p>
<h3>async lifetime</h3>
<p>与普通的函数不一样，<code>async fn</code> 会获取引用或其他非静态生命周期的参数，然后返回被这些参数的生命周期约束的 <code>Future</code>：</p>
<pre><code class="language-rust">async fn foo(x: &#x26;u8) -> u8 { *x }

// 这与上面的函数完全等价
fn foo_expanded&#x3C;'a>(x: &#x26;'a u8) -> impl Future&#x3C;Output = u8> + 'a {
    async move { *x }
}
</code></pre>
<ul>
<li><code>&#x3C;'a></code>：这是一个生命周期参数，表示引用 x 的生命周期。</li>
<li>x: <code>&#x26;'a u8</code>：函数参数 x 是一个生命周期为 'a 的 u8 类型的引用。</li>
<li><code>-> impl Future&#x3C;Output = u8> + 'a：</code>函数返回一个实现了 <code>Future</code> 特性的对象，该对象的输出类型为 <code>u8</code>，且具有生命周期 <code>'a</code>。</li>
</ul>
<p>这意味着，<code>async fn</code> 返回的 <code>Future </code>必须在非静态生命周期参数仍然有效时 <code>.await</code>。在大多数情况下，我们在调用 <code>async</code> 函数后会立马 <code>.await（例如 foo(&#x26;x).await）</code>，因此 <code>async lifetime</code> 不会对执行产生什么影响。
但是，如果我们存储这种 <code>Futur</code>e 或者发送给其他的 <code>task</code> 或者 <code>thread</code>，就可能会造成问题。</p>
<p>把带有引用参数的<code>async fn</code> 转化为静态 <code>Future</code> 的解决方法是：把参数和对 <code>async fn</code> 的调用封装到 <code>async</code> 块中：</p>
<pre><code class="language-rust">fn bad() -> impl Future&#x3C;Output = u8> {
    let x = 5;
    borrow_x(&#x26;x) // ERROR: \`x\` does not live long enough
}

fn good() -> impl Future&#x3C;Output = u8> {
    async {
        let x = 5;
        borrow_x(&#x26;x).await
    }
}
</code></pre>
<h3>Rust 异步和其他语言的区别</h3>
<ul>
<li>Rust 中 <code>Futures</code> 是惰性的，并且只有被轮询才会进一步执行。丢弃（Dropping）一个 future 可以阻止它继续执行。</li>
<li>Rust 中的 异步是零成本的，这意味着你只需要为你所使用的东西付出代价。特别来说，你使用异步时可以不需要堆分配或动态分发，这对性能来说是好事！这也使得你能够在约束环境下使用异步，例如嵌入式系统。</li>
<li>Rust 不提供内置运行时。相反，运行时由社区维护的库提供。</li>
<li>Rust 里 单线程的和多线程的 运行时都可用，而他们会有不同的优劣</li>
</ul>
<h2>Future trait</h2>
<pre><code class="language-rust">pub trait Future {
    type Output;	// Future计算完成时产生的值的类型
    fn poll(self: Pin&#x3C;&#x26;mut Self>, cx: &#x26;mut Context&#x3C;'_>) -> Poll&#x3C;Self::Output>;
}
</code></pre>
<p><code>Future</code> 表示一个异步计算，或者说会在未来完成计算的操作。<code>Future </code>的核心是 <code>poll</code> 方法，当调用 <code>poll</code> 方法时会尝试计算 <code>Future</code> 得到最终的值。
如果值还没有准备好（例如等待某些事件发生），则此方法不会阻塞，而是会直接返回一个结果表示 Future 还没有计算完毕</p>
<h3>Poll</h3>
<p>当调用 <code>Future</code> 的 <code>poll</code> 方法时会返回一个枚举类型的值：</p>
<ul>
<li><code>Poll::Pending</code>，表示这个 <code>Future</code> 还没计算完成</li>
<li><code>Poll::Ready(val)</code>，表示这个 <code>Future</code> 计算完毕，并附带计算结果：<code>val</code></li>
</ul>
<p>如果 <code>Future</code> 没有计算完成，例如想要等待一个 <code>IO</code> 事件发生，那么在 <code>poll</code> 方法体内，我们通常会调用传递给 <code>poll</code> 方法的 <code>Context</code> 的 <code>waker</code> 方法拿到一个 <code>Wake</code>r（通常把 Waker 叫做唤醒器），然后注册这个 <code>Waker</code> 到一个“事件通知系统”中，最后返回 <code>Pending</code> 表示 <code>Future</code> 没有计算完成。</p>
<p>在未来某一时刻，<code>Future</code> 等待的 <code>IO</code> 事件就绪了，那么“事件通知系统”就会利用我们注册的 <code>Waker</code> 通过某种唤醒机制唤醒这个 <code>Future</code>，通过 <code>poll</code> 继续计算执行该 <code>Future</code>。</p>
<p>通过 <code>Waker</code> 唤醒器，我们可以只在 <code>Future</code> 想要等待的事件就绪时，才去唤醒 <code>Future</code>。这样我们就不需要通过一个死循环不断的调用 <code>poll</code> 方法来驱动 <code>Future</code> 的执行，这是异步编程之所以高效的关键所在。</p>
<pre><code class="language-rust">struct SocketRead&#x3C;'a> {
    socket: &#x26;'a Socket
}

impl&#x3C;'a> Future for SocketRead&#x3C;'a> {
    type Output = Vec&#x3C;u8>;

    fn poll(self: Pin&#x3C;&#x26;mut Self>, cx: &#x26;mut Context&#x3C;'_'>) -> Poll&#x3C;Self::Output> {
        let data = self.socket.no_block_read::&#x3C;Option&#x3C;Vec&#x3C;u8>>>(1024);
        match data {
            Some(data) => Poll::Ready(data),
            None => {
                REACTOR.registe_waker_and_event(self.socket, Type::Read, cx.waker().clone());
                Poll::Pending
            }
        }
    }
}
</code></pre>
<p>代码中的 <code>REACTOR</code> 就是前文中所提到过的“事件通知系统”。当 <code>socket</code> 中有数据可读时，<code>REACTOR</code>就会使用注册的 <code>Wake</code>r 唤醒负责 <code>SocketRead</code> ，然后调用 <code>poll</code> 方法再次计算该 <code>Future</code>。</p>
<h2>Rust 异步调试</h2>
<h3>编译结果</h3>
<p><img src="https://images.felixwliu.cn/64211729439988_.pic.jpg" alt="编译结果"></p>
<p>rust 异步实现是一个无栈协程实现，所有的执行都是在工作线程执行的</p>
<ul>
<li><code>Future</code>执行使用工作线程的栈，无独立栈空间</li>
<li><code>Poll</code>函数执行完毕，栈将被回收</li>
</ul>
<p><img src="https://images.felixwliu.cn/WX20241021-001108%402x.png" alt="无栈协程"></p>
<p>执行的时候 工作线程会开栈，保存自己的寄存器和一些上下文的信息，获取异步任务执行的时候，调用 poll 函数，给 poll 函数创建一个栈，保存 <code>poll</code>函数里面的
变量和一些上下文信息。当 <code>poll</code>函数执行完毕， 无论返回的状态是 <code>pending</code> 还是 <code>ready</code> 栈将被回收 回到之前的执行逻辑上面去。这样就会有严重的缺点， poll 方法执行之后
栈就被回收了，只有在异步执行的过程中，用户才能观察到异步任务的状态。当异步任务挂起的时候，用户无法观察到异步任务的状态，这样就会导致调试困难。</p>
<p><img src="https://images.felixwliu.cn/debug.png" alt="定位问题"></p>
<h3>调测工具</h3>
<h4>tokio-tracing</h4>
<p>tokio-tracing 提供了一种结构化的日志记录方式，可以捕获和记录异步任务的上下文信息</p>
<pre><code class="language-rust">use tracing::{info, instrument};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt};

#[instrument]
fn foo(ans: i32) {
    info!("in foo");
}

fn main() {
    tracing_subscriber::registry().with(fmt::layer()).init();
    foo(42);
}
</code></pre>
<p>运行结果：</p>
<pre><code class="language-shell">2022-04-10T02:44:12.885556Z  INFO foo{ans=42}: test_tracing: in foo
</code></pre>
<p><code>#[instrument]</code> 宏会自动为函数生成跟踪信息，包括函数名和参数。<code>info!</code> 宏用于记录日志信息。</p>
<h4>tokio-console</h4>
<pre><code class="language-rust">use std::{sync::Arc, time::Duration};
use tokio::{sync::Semaphore, task, time::sleep};

#[tokio::main]
async fn main() {
    // 注意. 初始化tracing收集
    console_subscriber::init();
    // 线程1的令牌桶1初始一个令牌，可以先打印1
    let semaphore = Arc::new(Semaphore::new(1));
    let cnt = 3;
    let semaphore2 = semaphore.clone();

    // 线程2的令牌桶2初始没有令牌，直到1打印后增加令牌
    let semaphore_wait = Arc::new(Semaphore::new(0));
    let semaphore_wait2 = semaphore_wait.clone();

    // 注意. 使用task::Builder来增加task名字，否则等同tokio::spawn
    let t1 = task::Builder::default()
        .name("t1")
        .spawn(async move {
            for i in 0..cnt {
                let permit = semaphore.acquire().await.unwrap();
                print!("1 ");
                // 注意. 增加等待时间，便于观测
                sleep(Duration::from_secs(i)).await;
                // 消耗令牌，不放回令牌桶1
                permit.forget();
                // 令牌桶2增加令牌，可以打印2
                semaphore_wait2.add_permits(1);
            }
        })
        .unwrap();

    let t2 = task::Builder::default()
        .name("t2")
        .spawn(async move {
            for i in 0..cnt {
                let permit = semaphore_wait.acquire().await.unwrap();
                print!("2 ");
                // 注意. 增加等待时间，便于观测
                sleep(Duration::from_secs(i)).await;
                // 消耗令牌，不放回令牌桶2
                permit.forget();
                // 令牌桶1增加令牌，可以打印1
                semaphore2.add_permits(1);
            }
        })
        .unwrap();

    tokio::try_join!(t1, t2).unwrap();
}

</code></pre>
<p><img src="https://images.felixwliu.cn/screenshot-20241021-011452.png" alt="result"></p>
<h4>await-tree</h4>
<pre><code class="language-rust">use std::time::Duration;

use await_tree::{Config, InstrumentAwait, Registry};
use futures::future::{join, pending};
use tokio::time::sleep;

async fn bar(i: i32) {
    // \`&#x26;'static str\` span
    baz(i).instrument_await("baz in bar").await
}

async fn baz(i: i32) {
    // runtime \`String\` span is also supported
    pending()
        .instrument_await(format!("pending in baz {i}"))
        .await
}

async fn foo() {
    // spans of joined futures will be siblings in the tree
    join(
        bar(3).instrument_await("bar"),
        baz(2).instrument_await("baz"),
    )
    .await;
}

#[tokio::main]
async fn main() {
    let registry = Registry::new(Config::default());
    let root = registry.register((), "foo");
    tokio::spawn(root.instrument(foo()));

    sleep(Duration::from_secs(1)).await;
    let tree = registry.get(()).unwrap().to_string();
    println!("{tree}");
}

</code></pre>
<pre><code class="language-bash">foo [1.003s]
  bar [1.003s]
    baz in bar [1.003s]
      pending in baz 3 [1.003s]
  baz [1.003s]
    pending in baz 2 [1.003s]
</code></pre>
<h3>openharmony</h3>
<h4>诉求</h4>
<ul>
<li>可以检测任务阻塞和执行时间过长</li>
<li>支持黑匣打印</li>
<li>支持性能调优</li>
<li>可以推出完整的异步栈</li>
<li>运行态避免额外性能 &#x26; 内存开销</li>
<li>易用性，避免大范围的侵入式修改</li>
</ul>
<h4>yinglong 框架</h4>
<p><img src="https://images.felixwliu.cn/rust01.png" alt="yinglong"></p>
<ul>
<li>pending 状态
<img src="https://images.felixwliu.cn/rust02.png" alt="yinglong"></li>
<li>组合
<img src="https://images.felixwliu.cn/rust03.png" alt="yinglong"></li>
<li>任务栈
<img src="https://images.felixwliu.cn/rust04.png" alt="yinglong"></li>
<li>组合信息
<img src="https://images.felixwliu.cn/rust05.png" alt="yinglong"></li>
</ul>
<h2>其他</h2>
<p><a href="https://blog.hpp2334.com/blog/reactor-pattern">reactor</a></p>
`,date:"2024-10-21T01:43:58+08:00",gitInfo:{createdAt:"2024-10-21T01:43:58+08:00",updatedAt:"2025-06-01T04:42:15+08:00",commits:[{hash:"3afb49a",date:"2025-06-01T04:42:15+08:00",author:"madinah",message:"fix: some ui detail",githubUrl:"https://github.com/Maidang1/madinah/commit/3afb49a4483e4b341c3da24510ff80ee62ac7cf0"},{hash:"97e3894",date:"2024-10-21T01:43:58+08:00",author:"maidang1",message:"feat: add rust async post",githubUrl:"https://github.com/Maidang1/madinah/commit/97e38947516969b248b599c8b0b0ea8fbcb1c071"}]}},{filename:"farmfe-plugins-ci",title:"Introduce farm plugins ci",author:"Madinah",tags:["ci","github actions"],time:"2024-10-19T17:29:32+08:00",readingTime:{text:"6 min read",minutes:5.43,time:325800,words:1086},url:"/blogs/farmfe-plugins-ci",toc:[{url:"#rust-plugins",value:"Rust Plugins",level:2},{url:"#building-rust-plugins",value:"Building Rust Plugins",level:4},{url:"#deploying-rust-plugins",value:"Deploying Rust Plugins",level:4},{url:"#javascript-plugins",value:"JavaScript Plugins",level:2},{url:"#building-javascript-plugins",value:"Building JavaScript Plugins",level:4},{url:"#deploying-javascript-plugins",value:"Deploying JavaScript Plugins",level:4},{url:"#summary",value:"Summary",level:4}],content:`<hr>
<p>title: Introduce farm plugins ci
author: Madinah
tags:</p>
<ul>
<li>ci</li>
<li>github actions
time: 2024-10-19 16:42:00</li>
</ul>
<hr>
<p>Recently, I have been working on a project that requires me to support both JavaScript and Rust plugins. I have been using GitHub Actions to deploy the plugins, and I wanted to share how I managed to support both JavaScript and Rust plugins in the same repository.</p>
<h2>Rust Plugins</h2>
<h3>Building Rust Plugins</h3>
<p>Bacause of rust plugin need support multi-platform, so we should build in multi-platform before deploy to npm registry.</p>
<pre><code class="language-yaml">name: Building Rust Binding And Upload Artifacts
on: workflow_call

jobs:
  build:
    name: Build and Upload Artifacts - \${{ matrix.settings.abi }}
    runs-on: \${{ matrix.settings.os }}
    strategy:
      fail-fast: false
      matrix:
        settings:
          - os: ubuntu-latest
            docker: ghcr.io/napi-rs/napi-rs/nodejs-rust:lts-debian
            abi: linux-x64-gnu
            build: >-
              git config --global --add safe.directory /build &#x26;&#x26;
              set -e &#x26;&#x26;
              unset CC_x86_64_unknown_linux_gnu &#x26;&#x26;
              unset CC &#x26;&#x26;
              pnpm --filter "{rust-plugins}[HEAD~1]" --sequential build --target x86_64-unknown-linux-gnu --abi linux-x64-gnu
          - os: ubuntu-latest
            docker: ghcr.io/napi-rs/napi-rs/nodejs-rust:lts-alpine
            abi: linux-x64-musl
            build: >-
              git config --global --add safe.directory /build &#x26;&#x26;
              set -e &#x26;&#x26;
              unset CC_x86_64_unknown_linux_musl &#x26;&#x26;
              unset CC &#x26;&#x26;
              pnpm  --filter "{rust-plugins}[HEAD~1]" --sequential build --target x86_64-unknown-linux-musl --abi linux-x64-musl
          - os: windows-latest
            abi: win32-x64-msvc
          - os: macos-latest
            abi: darwin-arm64
          - os: macos-13
            abi: darwin-x64
          # cross compile
          # windows. Note swc plugins is not supported on ia32 and arm64
          - os: windows-latest
            abi: win32-ia32-msvc
            target: i686-pc-windows-msvc
            build: |
              export CARGO_PROFILE_RELEASE_LTO=false
              cargo install cargo-xwin --locked
              pnpm --filter "{rust-plugins}[HEAD~1]" --sequential build --target i686-pc-windows-msvc --abi win32-ia32-msvc --cargo-flags="--no-default-features"
          - os: windows-latest
            abi: win32-arm64-msvc
            target: aarch64-pc-windows-msvc
            build: |
              export CARGO_PROFILE_RELEASE_CODEGEN_UNITS=256
              export CARGO_PROFILE_RELEASE_LTO=false
              cargo install cargo-xwin --locked
              pnpm --filter "{rust-plugins}[HEAD~1]" --sequential build --target aarch64-pc-windows-msvc --abi win32-arm64-msvc --cargo-flags="--no-default-features"

          # linux
          - os: ubuntu-latest
            abi: linux-arm64-musl
            target: aarch64-unknown-linux-musl
            zig: true
          - os: ubuntu-latest
            abi: linux-arm64-gnu
            target: aarch64-unknown-linux-gnu
            zig: true
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 2
      # - run: |
      # git fetch --no-tags --prune --depth=1 origin +refs/heads/main:refs/remotes/HEAD~1

      - name: Cache rust artifacts
        uses: Swatinem/rust-cache@v2
        with:
          shared-key: rust-build-\${{ matrix.settings.abi }}

      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Install Dependencies
        run: npm config set registry https://registry.npmmirror.com &#x26;&#x26; npm install -g pnpm@9.1.0 &#x26;&#x26; pnpm i --frozen-lockfile
      - run: rustup target add \${{ matrix.settings.target }}
        if: \${{ matrix.settings.target }}
      # Use the v1 of this action
      - uses: mbround18/setup-osxcross@v1
        if: \${{ matrix.settings.osxcross }}
        # This builds executables &#x26; sets env variables for rust to consume.
        with:
          osx-version: '12.3'
      - uses: goto-bus-stop/setup-zig@v2
        if: \${{ matrix.settings.zig }}
      - name: Build in docker
        uses: addnab/docker-run-action@v3
        if: \${{ matrix.settings.docker }}
        with:
          image: \${{ matrix.settings.docker }}
          options: -v \${{ env.HOME }}/.cargo/git:/root/.cargo/git -v \${{ env.HOME }}/.cargo/registry:/root/.cargo/registry -v \${{ github.workspace }}:/build -w /build
          run: \${{ matrix.settings.build }}
      - name: Default Build
        if: \${{ !matrix.settings.docker &#x26;&#x26; !matrix.settings.build }}
        run: |
          pnpm --filter "{rust-plugins}[HEAD~1]" --sequential build --abi \${{ matrix.settings.abi }} \${{ matrix.settings.target &#x26;&#x26; format('--target {0}', matrix.settings.target) || '' }} \${{ matrix.settings.zig &#x26;&#x26; '--zig' || '' }}
        shell: bash
      - name: Build
        if: \${{ !matrix.settings.docker &#x26;&#x26; matrix.settings.build }}
        run: \${{ matrix.settings.build }}
        shell: bash
      - name: Upload Plugin dsv
        uses: actions/upload-artifact@v3
        with:
          name: \${{ github.sha }}-\${{ matrix.settings.abi }}-dsv
          path: ./rust-plugins/dsv/npm/\${{ matrix.settings.abi }}/index.farm
          if-no-files-found: ignore
      # other packages upload
</code></pre>
<p>In the above ci config, first we build defferent platform rust plugins. But in then build step, we use <code>pnpm --filter "{rust-plugins}[HEAD~1]"</code> to build only changed rust plugins. This is very important, because we don't want to build all rust plugins every time. Then filter only build changed rust plugins under <code>rust-plugins</code> directory.</p>
<h3>Deploying Rust Plugins</h3>
<pre><code class="language-yaml">name: Publish packages and crates
on:
  push:
    branches:
      - main

concurrency: \${{ github.workflow }}-\${{ github.ref }}

jobs:
  call-rust-build:
    if: contains(github.event.head_commit.message, 'rust-plugins') || contains(github.event.head_commit.message, 'all')
    uses: ./.github/workflows/build.yaml

  release:
    name: Release
    if: contains(github.event.head_commit.message, 'rust-plugins') || contains(github.event.head_commit.message, 'all')
    needs: [call-rust-build]
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v3
        with:
          fetch-depth: 2
      - run: |
          git fetch --no-tags --prune --depth=1 origin +refs/heads/main:refs/remotes/HEAD~1

      - name: Setup Node.js 18.x
        uses: actions/setup-node@v3
        with:
          node-version: 18.x

      # batch download artifacts
      - uses: actions/download-artifact@v3
        with:
          path: /tmp/artifacts
      - name: Move Artifacts
        run: |
          for abi in linux-x64-gnu linux-x64-musl darwin-x64 win32-x64-msvc linux-arm64-musl linux-arm64-gnu darwin-arm64 win32-ia32-msvc win32-arm64-msvc
          do
             for package in dsv react-components virtual yaml strip image url icons auto-import mdx
              do
                folder_path="/tmp/artifacts/\${{github.sha}}-\${abi}-\${package}"
                if [ -d "\${folder_path}" ] &#x26;&#x26; [ -n "$(ls -A $folder_path)" ]; then
                  mv /tmp/artifacts/\${{ github.sha }}-\${abi}-\${package}/* ./packages/\${package}/npm/\${abi}
                  ls -R $folder_path
                  ls -R ./packages/\${package}/npm/\${abi}
                  test -f ./packages/\${package}/npm/\${abi}/index.farm
                else
                  echo "\${folder_path} is empty"
                fi
              done
          done

      - name: Install Dependencies
        run: npm install -g pnpm@9.1.0 &#x26;&#x26; pnpm i --frozen-lockfile

      - name: Publish to npm
        run: |
          npm set //registry.npmjs.org/:_authToken=\${{ secrets.NPM_TOKEN }} &#x26;&#x26; npm config set access public &#x26;&#x26; pnpm --filter "{rust-plugins}[HEAD~1]" publish --no-git-checks
</code></pre>
<p>In the above ci config, we use <code>contains</code> to determine whether to run the ci. If the commit message contains <code>rust-plugins</code> or <code>all</code>, then we run the ci. In the <code>release</code> job, we first download the artifacts that we built in the previous ci. Then we move the artifacts to the corresponding directory. Finally, we publish the rust plugins to the npm registry.</p>
<h2>JavaScript Plugins</h2>
<h3>Building JavaScript Plugins</h3>
<pre><code class="language-yaml">name: PR build plugins
on: workflow_call

jobs:
  build:
    runs-on: ubuntu-latest
    name: release
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 2
      # - run: |
      # git fetch --no-tags --prune --depth=1 origin +refs/heads/main:refs/remotes/HEAD~1
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org/

      - name: Enable Corepack
        id: pnpm-setup
        run: |
          corepack enable

      - name: Initliaze .npmrc
        run: >
          echo -e "//registry.npmjs.org/:_authToken=\${{ secrets.NPM_TOKEN }}\\n$(cat .npmrc)" > .npmrc
          &#x26;&#x26; cat -n .npmrc

      - name: pnpm install
        run: pnpm install --frozen-lockfile

      - name: Build Packages
        run: |
          pnpm --filter "{js-plugins}[HEAD~1]" build
</code></pre>
<p>the config is as same as rust plugins, but we use <code>pnpm --filter "{js-plugins}[HEAD~1]" build</code> to build only changed js plugins.</p>
<h3>Deploying JavaScript Plugins</h3>
<pre><code class="language-yaml">name: Release Packages

on:
  push:
    branches:
      - main

jobs:
  release:
    runs-on: ubuntu-latest
    if: contains(github.event.head_commit.message, 'js-plugins') || contains(github.event.head_commit.message, 'all')
    name: release
    steps:
      - name: Checkout repo
        uses: actions/checkout@v3
        with:
          fetch-depth: 2

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org/

      - name: Enable Corepack
        id: pnpm-setup
        run: |
          corepack enable

      - name: Initliaze .npmrc
        run: >
          echo -e "//registry.npmjs.org/:_authToken=\${{ secrets.NPM_TOKEN }}\\n$(cat .npmrc)" > .npmrc
          &#x26;&#x26; cat -n .npmrc

      - name: pnpm install
        run: pnpm install --frozen-lockfile

      - name: Build Packages
        run: |
          pnpm --filter "{js-plugins}[HEAD~1]" build

      - name: Release and Publish Packages
        run: |
          npm set //registry.npmjs.org/:_authToken=\${{ secrets.NPM_TOKEN }} &#x26;&#x26; npm config set access public &#x26;&#x26; pnpm --filter "{js-plugins}[HEAD~1]" publish --no-git-checks
</code></pre>
<p>the relase config is as same as rust plugins too.</p>
<h3>Summary</h3>
<ul>
<li>use <code>pnpm --filter "{xx}[HEAD~1]"</code> to build only changed to reduce build time.</li>
<li>use <code>contains</code> to determine whether to run the ci.</li>
</ul>
`,date:"2024-10-19T17:29:32+08:00",gitInfo:{createdAt:"2024-10-19T17:29:32+08:00",updatedAt:"2024-10-19T17:29:32+08:00",commits:[{hash:"2163454",date:"2024-10-19T17:29:32+08:00",author:"maidang1",message:"feat: add farmfe plugins ci post",githubUrl:"https://github.com/Maidang1/madinah/commit/2163454d57b65fd992c16c14e432ab4b8b9d0baa"}]}}];export{n as l};
