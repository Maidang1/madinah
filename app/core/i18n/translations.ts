import type { Locale } from '~/types';

export const SUPPORTED_LOCALES = ['en', 'zh'] as const satisfies Readonly<Locale[]>;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type TranslationValue =
  | string
  | number
  | boolean
  | TranslationValue[]
  | { [key: string]: TranslationValue };

export type TranslationDictionary = Record<string, TranslationValue>;

export const DEFAULT_LOCALE: SupportedLocale = 'en';
export const FALLBACK_LOCALE: SupportedLocale = 'en';

export const translations: Record<SupportedLocale, TranslationDictionary> = {
  en: {
    common: {
      language: {
        switchLabel: 'Change language',
        localeName: {
          en: 'English',
          zh: '中文',
        },
      },
      errors: {
        defaultTitle: 'Something went wrong',
      },
    },
    header: {
      brand: 'Madinah',
      skipToContent: 'Skip to content',
      navigation: {
        home: 'Home',
        blog: 'Blog',
        books: 'Books',
        projects: 'Projects',
        rss: 'RSS',
      },
      themeToggle: 'Toggle theme',
      rssLabel: 'RSS',
      languageToggle: 'Select language',
    },
    footer: {
      message: '© {{year}} Madinah. Built with curiosity and care.',
      links: {
        blog: 'Blog',
        books: 'Books',
        github: 'GitHub',
        rss: 'RSS',
      },
    },
    home: {
      meta: {
        title: 'Madinah',
        description: 'Welcome to Madinah!',
      },
      hero: {
        badge: 'Frontend · Rust · AI',
        title: "Hi, I'm Madinah.",
        subtitle:
          'Frontend developer, Rust tinkerer, and AI enthusiast building in public.',
        avatarAlt: 'Madinah avatar',
        focusAreas: [
          'Designing thoughtful front-end experiences with Remix & Tailwind.',
          'Exploring Rust and WebAssembly for developer tooling.',
          'Sketching AI-powered workflows that automate the boring parts.',
        ],
      },
      latestPosts: {
        title: 'Quick navigation',
        description: 'The latest two blog posts to catch up fast.',
      },
    },
    blog: {
      detail: {
        readTime: '{{count}} min read',
        readWords: '{{count}} words',
        aiSummary: 'AI Summary',
        tableOfContents: 'Table of contents',
        editOnGitHub: 'Edit on GitHub',
        previousPost: 'Previous',
        nextPost: 'Next',
        mobileToggleToc: 'Toggle table of contents',
        mobileCloseToc: 'Close table of contents',
        stickyTocTitle: 'Contents',
        scrollToTop: 'Scroll to top',
      },
    },
    projects: {
      meta: {
        title: 'Projects - Madinah',
        description: 'Projects that I created or maintain.',
      },
      title: 'Projects',
      subtitle: 'Projects that I created or maintain.',
      items: {
        wallpaperApp: {
          name: 'Wallpaper App',
          description: 'A simple wallpaper app built with Tauri and Rust.',
        },
        farmfePlugins: {
          name: 'FarmFe Plugins',
          description: 'The one-stop shop for official Farm plugins.',
        },
        pixelPicture: {
          name: 'Pixel Picture',
          description: 'Transform your image into pixel art.',
        },
        reminders: {
          name: 'Reminders',
          description: 'A reminder app that nudges you to drink water.',
        },
      },
    },
    books: {
      meta: {
        title: 'Books • Madinah',
        description: 'Curated collections covering Rust, Remix, and more.',
      },
      list: {
        heading: 'Books',
        chapterCount: '{{count}} chapters',
        startReading: 'Start reading',
        emptyTitle: 'Books are being curated',
        emptyMessage: 'Check back soon for fresh chapters.',
      },
      sidebar: {
        sectionLabel: 'Chapters',
      },
      overview: {
        sectionLabel: 'Book',
        author: 'Author: {{name}}',
      },
      layout: {
        closeSidebar: 'Close chapter navigation',
        openSidebar: 'Open chapter navigation',
      },
      chapter: {
        loading: 'Loading chapter content…',
      },
      errors: {
        goHome: 'Back to home',
        goToBooks: 'Back to books',
        listLoadTitle: 'Failed to load books',
        listRenderTitle: 'Failed to render book list',
        listRenderMessage: 'An unknown error occurred while loading books.',
        bookNotFound: 'Book not found',
        bookLoadFailed: 'Failed to load book',
        bookRenderFailed: 'An error occurred while loading the book',
        bookRenderMessage:
          'An unknown error occurred while loading the book. Please try again later.',
        chapterNotFound: 'Chapter not found',
        chapterLoadFailed: 'Failed to load chapter',
        chapterRenderFailed: 'Failed to render chapter content',
        chapterRenderMessage:
          'An unknown error occurred while loading chapter content.',
        chapterRedirectFailed: 'Unable to resolve chapter',
        chapterRedirectMessage:
          'Could not determine the default chapter. Please try again later.',
      },
    },
    license: {
      notice:
        'This content is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0).',
    },
  },
  zh: {
    common: {
      language: {
        switchLabel: '切换语言',
        localeName: {
          en: 'English',
          zh: '中文',
        },
      },
      errors: {
        defaultTitle: '出现了一点小问题',
      },
    },
    header: {
      brand: 'Madinah',
      skipToContent: '跳转到主要内容',
      navigation: {
        home: '首页',
        blog: '博客',
        books: '书籍',
        projects: '项目',
        rss: 'RSS',
      },
      themeToggle: '切换主题',
      rssLabel: 'RSS',
      languageToggle: '选择语言',
    },
    footer: {
      message: '© {{year}} Madinah，以好奇与热情构建。',
      links: {
        blog: '博客',
        books: '书籍',
        github: 'GitHub',
        rss: 'RSS',
      },
    },
    home: {
      meta: {
        title: 'Madinah',
        description: '欢迎来到 Madinah！',
      },
      hero: {
        badge: '前端 · Rust · AI',
        title: '你好，我是 Madinah。',
        subtitle: '一名前端开发者、Rust 爱好者与 AI 实践者，持续公开构建。',
        avatarAlt: 'Madinah 头像',
        focusAreas: [
          '用 Remix 和 Tailwind 打磨细腻的前端体验。',
          '探索 Rust 与 WebAssembly 在开发者工具中的潜力。',
          '构想自动化琐碎流程的 AI 工作流。',
        ],
      },
      latestPosts: {
        title: '快速导航',
        description: '最新两篇博客，快速了解最近的思考与笔记。',
      },
    },
    blog: {
      detail: {
        readTime: '约 {{count}} 分钟阅读',
        readWords: '{{count}} 字',
        aiSummary: 'AI 摘要',
        tableOfContents: '目录',
        editOnGitHub: 'Edit on GitHub',
        previousPost: '上一篇',
        nextPost: '下一篇',
        mobileToggleToc: '展开目录',
        mobileCloseToc: '关闭目录',
        stickyTocTitle: '目录',
        scrollToTop: '返回顶部',
      },
    },
    projects: {
      meta: {
        title: 'Projects - Madinah',
        description: '我创建或维护的项目。',
      },
      title: '项目',
      subtitle: '我创建或正在维护的项目。',
      items: {
        wallpaperApp: {
          name: 'Wallpaper App',
          description: '一个使用 Tauri 和 Rust 构建的简洁壁纸应用。',
        },
        farmfePlugins: {
          name: 'FarmFe 插件',
          description: '官方 Farm 插件的一站式集合。',
        },
        pixelPicture: {
          name: 'Pixel Picture',
          description: '将图片转换为像素风效果。',
        },
        reminders: {
          name: 'Reminders',
          description: '一个按时提醒喝水的小工具。',
        },
      },
    },
    books: {
      meta: {
        title: 'Books • Madinah',
        description: '系统整理的 Rust、Remix 等专题书籍合集。',
      },
      list: {
        heading: '书籍',
        chapterCount: '{{count}} 章',
        startReading: '开始阅读',
        emptyTitle: '书籍正在整理中',
        emptyMessage: '稍后再来看看，也许就会有新的内容。',
      },
      sidebar: {
        sectionLabel: '章节',
      },
      overview: {
        sectionLabel: '书籍',
        author: '作者：{{name}}',
      },
      layout: {
        closeSidebar: '关闭章节导航',
        openSidebar: '打开章节导航',
      },
      chapter: {
        loading: '正在加载章节内容...',
      },
      errors: {
        goHome: '返回首页',
        goToBooks: '返回书籍列表',
        listLoadTitle: '书籍列表加载失败',
        listRenderTitle: '书籍列表渲染失败',
        listRenderMessage: '加载书籍时出现未知错误。',
        bookNotFound: '未找到书籍',
        bookLoadFailed: '加载书籍失败',
        bookRenderFailed: '加载书籍时出现错误',
        bookRenderMessage: '加载书籍时发生未知错误，请稍后再试。',
        chapterNotFound: '未找到章节',
        chapterLoadFailed: '加载章节失败',
        chapterRenderFailed: '章节内容渲染失败',
        chapterRenderMessage: '加载章节内容时发生未知错误。',
        chapterRedirectFailed: '无法定位章节',
        chapterRedirectMessage: '无法确认默认章节，请稍后重试。',
      },
    },
    license: {
      notice:
        '本内容采用 知识共享署名 - 非商业性使用 - 相同方式共享 4.0 国际许可协议 (CC BY-NC-SA 4.0) 进行许可。',
    },
  },
};
