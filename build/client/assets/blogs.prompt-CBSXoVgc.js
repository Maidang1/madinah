import{j as n}from"./index-BZchTVqk.js";import{u as i}from"./index-CFAftGZl.js";function c(e){const s={a:"a",h2:"h2",h3:"h3",li:"li",p:"p",span:"span",strong:"strong",ul:"ul",...i(),...e.components};return n.jsxs(n.Fragment,{children:[n.jsxs(s.h2,{id:"prompt-最佳实践",children:["Prompt 最佳实践",n.jsx(s.a,{className:"header-anchor",href:"#prompt-最佳实践",children:n.jsx(s.span,{className:"icon icon-link"})})]}),`
`,n.jsxs(s.h3,{id:"提供示例",children:["提供示例",n.jsx(s.a,{className:"header-anchor",href:"#提供示例",children:n.jsx(s.span,{className:"icon icon-link"})})]}),`
`,n.jsx(s.p,{children:`最重要的最佳实践是在提示词中提供（单样本/少样本）示例。这非常有效，因为它起到了强大的教学工具的作用。
这些示例展示了期望的输出或类似的回应，让模型能够从中学习并相应地调整自己的生成内容。
这就像给模型一个参考点或目标，有助于提高其回应的准确性、风格和语气，使其更符合你的预期。`}),`
`,n.jsxs(s.h3,{id:"简洁设计",children:["简洁设计",n.jsx(s.a,{className:"header-anchor",href:"#简洁设计",children:n.jsx(s.span,{className:"icon icon-link"})})]}),`
`,n.jsx(s.p,{children:`提示词应当简洁、清晰，并且你和模型都易于理解。根据经验来看，如果你自己都觉得某个提示词令人困惑，那么模型很可能也会有同样的感受。
尽量不要使用复杂的语言，也不要提供不必要的信息。`}),`
`,n.jsx(s.p,{children:n.jsx(s.strong,{children:"示例："})}),`
`,n.jsxs(s.ul,{children:[`
`,n.jsx(s.li,{children:`我现在正在纽约游玩，想多了解一些好地方。我带着两个3岁的孩子，假期里我们应该去哪里呢？ --->  请扮演一名旅游向导，为游客介绍纽约曼哈顿适合带3岁幼儿游览的好去处。
尝试使用描述动作的动词。以下是一组示例：
行动、分析、分类、归类、对比、比较、创造、描述、定义、评估、提取、查找、生成、识别、列举、测量、组织、解析、挑选、预测、提供、排序、推荐、返回、检索、重写、选择、展示、排序、总结、翻译、撰写。`}),`
`]}),`
`,n.jsxs(s.h3,{id:"明确输出内容",children:["明确输出内容",n.jsx(s.a,{className:"header-anchor",href:"#明确输出内容",children:n.jsx(s.span,{className:"icon icon-link"})})]}),`
`,n.jsx(s.p,{children:"明确期望的输出内容。简洁的指令可能不足以引导大语言模型，或者可能过于笼统。在提示词中（通过系统提示或上下文提示）提供具体细节可以帮助模型聚焦于相关内容，提高整体准确性。"}),`
`,n.jsx(s.p,{children:n.jsx(s.strong,{children:"示例："})}),`
`,n.jsx(s.p,{children:`yes: 写一篇三段的博客文章，内容是关于排名前五的视频游戏主机。这篇博客文章应该兼具信息量和吸引力，并且要用对话式的风格来写。
no: 生成一篇关于视频游戏主机的博客文章。`}),`
`,n.jsxs(s.h3,{id:"使用指令而非约束条件",children:["使用指令而非约束条件",n.jsx(s.a,{className:"header-anchor",href:"#使用指令而非约束条件",children:n.jsx(s.span,{className:"icon icon-link"})})]}),`
`,n.jsx(s.p,{children:"在提示词中，指令和约束用于引导大语言模型的输出。"}),`
`,n.jsxs(s.ul,{children:[`
`,n.jsx(s.li,{children:"指令会就期望的响应格式、风格或内容提供明确指示。它会指导模型应该做什么或生成什么。"}),`
`,n.jsx(s.li,{children:"约束条件是对响应的一系列限制或边界。它规定了模型不应该做什么或需要避免什么。"}),`
`]}),`
`,n.jsx(s.p,{children:`越来越多的研究表明，在提示词中侧重于积极的指令可能比过度依赖限制条件更有效。这种方法与人类更喜欢积极指令而非一系列禁止事项的偏好相符。
指令直接传达了期望的结果，而约束条件可能会让模型对允许的内容感到困惑。指令提供了灵活性，并鼓励在既定范围内发挥创造力，而约束条件则可能限制模型的潜力。
此外，一系列约束条件还可能相互冲突。
在某些情况下，约束仍然很有价值。比如为了防止模型生成有害或带有偏见的内容，或者在需要严格的输出格式或风格时。
如果可能的话，请使用积极的指令：不要告诉模型不应该做什么，而是告诉它应该做什么。这样可以避免混淆并提高输出的准确性。`}),`
`,n.jsx(s.p,{children:`yes: 撰写一篇关于五大视频游戏主机的单段博客文章。只需讨论主机、制造公司、推出年份以及总销量。
no: 生成一篇关于五大视频游戏主机的单段博客文章。不要列出游戏名称。`}),`
`,n.jsx(s.p,{children:"作为最佳实践，首先要优先考虑指令，清晰说明你希望模型做什么，并且只在出于安全、清晰度或特定要求的必要情况下使用约束条件。通过试验和迭代来测试指令与约束条件的不同组合，找到最适合你特定任务的方式，并将这些记录下来。"}),`
`,n.jsxs(s.h3,{id:"控制最大令牌长度",children:["控制最大令牌长度",n.jsx(s.a,{className:"header-anchor",href:"#控制最大令牌长度",children:n.jsx(s.span,{className:"icon icon-link"})})]}),`
`,n.jsx(s.p,{children:"要控制大语言模型生成的回复长度，你可以在配置中设置最大令牌限制，或者在提示词中明确要求特定的长度。例如： “用一条推文的长度解释量子物理学。”"}),`
`,n.jsxs(s.h3,{id:"在提示词中使用变量",children:["在提示词中使用变量",n.jsx(s.a,{className:"header-anchor",href:"#在提示词中使用变量",children:n.jsx(s.span,{className:"icon icon-link"})})]}),`
`,n.jsx(s.p,{children:"要重复使用提示词并使其更具动态性，可以在提示词中使用变量，这些变量可以根据不同的输入进行更改。例如，如表20所示，有一个提供某座城市相关事实的提示词。不要在提示词中硬编码城市名称，而是使用变量。变量可以让你避免重复工作，从而节省时间和精力。如果需要在多个提示词中使用同一条信息，你可以将其存储在一个变量中，然后在每个提示词中引用该变量。在将提示词集成到你自己的应用程序中时，这一点非常有用。"}),`
`,n.jsx(s.p,{children:`| Prompt | VARIABLES  = "Amsterdam" PROMPT You are a travel guide. Tell me a fact about the city:  |
| --- | --- |
| Output | Amsterdam is a beautiful city full of canals, bridges, and narrow streets. It’s a great place to visit for its rich history, culture, and nightlife. |`}),`
`,n.jsxs(s.h3,{id:"尝试不同的输入格式和写作风格",children:["尝试不同的输入格式和写作风格",n.jsx(s.a,{className:"header-anchor",href:"#尝试不同的输入格式和写作风格",children:n.jsx(s.span,{className:"icon icon-link"})})]}),`
`,n.jsx(s.p,{children:`不同的模型、模型配置、提示词格式、用词以及提交方式可能会产生不同的结果。因此，尝试不同的提示词属性（如风格、用词和提示词类型（零样本、少样本、系统提示词））是很重要的。
例如，一个旨在生成关于革命性视频游戏机世嘉 Dreamcast 的文本的提示词，可以被表述为一个问题、一个陈述或一条指令，从而产生不同的输出：`}),`
`,n.jsxs(s.ul,{children:[`
`,n.jsx(s.li,{children:"问题：世嘉Dreamcast是什么？它为何是一款极具革命性的游戏机？"}),`
`,n.jsx(s.li,{children:"指令：撰写一个段落，描述世嘉Dreamcast游戏机并解释其为何具有革命性。"}),`
`,n.jsx(s.li,{children:"指令：撰写一个段落，描述世嘉Dreamcast游戏机并解释其为何具有革命性。"}),`
`]}),`
`,n.jsxs(s.h3,{id:"在分类任务的少样本提示中混合不同的类别",children:["在分类任务的少样本提示中，混合不同的类别",n.jsx(s.a,{className:"header-anchor",href:"#在分类任务的少样本提示中混合不同的类别",children:n.jsx(s.span,{className:"icon icon-link"})})]}),`
`,n.jsx(s.p,{children:`一般来说，你的少样本示例的顺序影响不大。不过，在进行分类任务时，要确保在少样本示例中混合可能的响应类别。这是因为否则你可能会过度拟合示例的特定顺序。
通过混合可能的响应类别，你可以确保模型是在学习识别每个类别的关键特征，而不是简单地记住示例的顺序。这将使模型在未见过的数据上表现出更强的稳健性和泛化能力。
一个实用的经验法则是从6个少样本示例开始，并以此为基础测试准确性。`}),`
`,n.jsxs(s.h3,{id:"适应模型更新",children:["适应模型更新",n.jsx(s.a,{className:"header-anchor",href:"#适应模型更新",children:n.jsx(s.span,{className:"icon icon-link"})})]}),`
`,n.jsx(s.p,{children:`及时了解模型架构的变化、新增的数据和功能对你来说很重要。尝试更新的模型版本，并调整你的提示词，以更好地利用模型的新特性。
像Vertex AI Studio这样的工具非常适合存储、测试和记录你的各种提示词版本。`}),`
`,n.jsxs(s.h3,{id:"尝试输出格式",children:["尝试输出格式",n.jsx(s.a,{className:"header-anchor",href:"#尝试输出格式",children:n.jsx(s.span,{className:"icon icon-link"})})]}),`
`,n.jsx(s.p,{children:`除了提示词的输入格式，还可以考虑尝试调整输出格式。对于非创造性任务，如提取、选择、解析、排序、排名或分类数据，尝试让输出以JSON或XML等结构化格式返回。
从用于提取数据的提示词中返回JSON对象有一些好处。在实际应用中，我不需要手动创建这种JSON格式，我已经可以按排序后的顺序返回数据（在处理日期时间对象时非常方便），但最重要的是，通过提示要求JSON格式，这会迫使模型创建一个结构并减少幻觉内容。
总之，为输出使用JSON的好处包括：`}),`
`,n.jsxs(s.ul,{children:[`
`,n.jsx(s.li,{children:"始终以相同的风格返回"}),`
`,n.jsx(s.li,{children:"专注于你想要接收的数据"}),`
`,n.jsx(s.li,{children:"幻觉现象发生的可能性更低"}),`
`,n.jsx(s.li,{children:"使其具有关系感知能力"}),`
`,n.jsx(s.li,{children:"你会得到数据类型"}),`
`]}),`
`,n.jsxs(s.h2,{id:"思维链最佳实践",children:["思维链最佳实践",n.jsx(s.a,{className:"header-anchor",href:"#思维链最佳实践",children:n.jsx(s.span,{className:"icon icon-link"})})]}),`
`,n.jsx(s.p,{children:`对于思维链提示词而言，需要将答案放在推理过程之后，因为推理过程的生成本身会改变模型在预测最终答案时所获取的标记。
使用思维链（CoT）和自一致性方法时，你需要能够从提示词中提取最终答案，并将其与推理过程分开。
对于思维链提示，将温度设置为0。
思维链提示基于贪心解码，即根据语言模型分配的最高概率来预测序列中的下一个词。一般来说，在进行推理以得出最终答案时，很可能存在一个唯一的正确答案。因此，温度应始终设为0。`}),`
`,n.jsxs(s.h2,{id:"记录各种提示词尝试",children:["记录各种提示词尝试",n.jsx(s.a,{className:"header-anchor",href:"#记录各种提示词尝试",children:n.jsx(s.span,{className:"icon icon-link"})})]}),`
`,n.jsx(s.p,{children:"本章前面已经提到过最后一个技巧,但我们再怎么强调它的重要性也不为过:详细记录你的提示词尝试,这样你就能逐渐了解哪些做得好,哪些做得不好。"}),`
`,n.jsx(s.p,{children:`不同模型、不同采样设置,甚至同一模型的不同版本,其提示词输出可能会有所不同。此外,即
使向同一模型输入完全相同的提示词,输出句子的格式和用词也可能出现细微差异。(例如,如前
所述,如果两个标记的预测概率相同,可能会随机打破平局。这进而会影响后续的预测标记。)`})]})}function l(e={}){const{wrapper:s}={...i(),...e.components};return s?n.jsx(s,{...e,children:n.jsx(c,{...e})}):c(e)}export{l as default};
