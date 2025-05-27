# Blog Detail 组件重构

## 概述

这次重构将原来的单个 `blog-detail.tsx` 文件拆分成了多个独立、可复用的组件，并重新实现了 Table of Contents 功能，支持滚动时自动高亮对应标题，点击时平滑滚动到指定位置。

## 文件结构

```
components/
├── blog-detail.tsx              # 主容器组件
├── table-of-contents.tsx        # 桌面端目录组件
├── mobile-table-of-contents.tsx # 移动端目录组件
├── blog-content.tsx             # 博客内容组件
├── scroll-to-top-button.tsx     # 滚动到顶部按钮
├── index.ts                     # 统一导出文件
├── config/
│   └── scroll-config.ts         # 滚动相关配置
├── hooks/
│   └── use-table-of-contents.ts # 目录功能 Hook
├── types/
│   └── index.ts                 # 组件类型定义
└── utils/
    └── scroll-utils.ts          # 滚动工具函数
```

## 主要特性

### 1. 模块化设计
- **BlogDetail**: 主容器组件，负责数据获取和布局
- **TableOfContents**: 桌面端目录，支持层级显示和进度条
- **MobileTableOfContents**: 移动端目录，侧边抽屉式设计
- **BlogContent**: 博客内容区域，支持标题和摘要显示
- **ScrollToTopButton**: 滚动到顶部按钮

### 2. 智能目录高亮
- 基于滚动位置自动高亮当前标题
- 支持多级标题层级显示
- 节流优化，60fps 流畅体验
- 可配置的偏移量和缓冲区

### 3. 平滑滚动
- 点击目录项平滑滚动到对应位置
- 支持自定义滚动容器
- 可配置滚动偏移量

### 4. 响应式设计
- 桌面端：侧边栏固定目录
- 移动端：浮动按钮 + 侧边抽屉
- 进度指示器

### 5. 性能优化
- 事件节流，避免频繁计算
- 被动事件监听
- 组件懒加载

## 配置选项

### SCROLL_CONFIG

```typescript
export const SCROLL_CONFIG = {
  // 滚动到顶部按钮显示阈值
  SCROLL_TO_TOP_THRESHOLD: 500,
  
  // 标题高亮偏移量
  HEADING_HIGHLIGHT_OFFSET: 120,
  
  // 高亮检测缓冲区
  HIGHLIGHT_BUFFER: 50,
  
  // 滚动行为
  SCROLL_BEHAVIOR: 'smooth' as ScrollBehavior,
} as const;
```

## 使用方法

### 基本使用

```tsx
import BlogsDetail from '~/components/blog-detail';

function BlogPage({ list }: { list: PostInfo[] }) {
  return <BlogsDetail list={list} />;
}
```

### 单独使用组件

```tsx
import { 
  TableOfContents, 
  MobileTableOfContents,
  ScrollToTopButton 
} from '~/components';

function CustomLayout({ tocs }: { tocs: TocItem[] }) {
  return (
    <div>
      <TableOfContents tocs={tocs} showProgress={true} />
      <MobileTableOfContents tocs={tocs} />
      <ScrollToTopButton threshold={300} />
    </div>
  );
}
```

### 自定义 Hook

```tsx
import { useTableOfContents } from '~/components/hooks/use-table-of-contents';

function CustomTOC({ tocs }: { tocs: TocItem[] }) {
  const { activeId, handleClick } = useTableOfContents({ 
    tocs,
    offset: 100,
    highlightBuffer: 30
  });

  return (
    <nav>
      {tocs.map(toc => (
        <a
          key={toc.url}
          href={toc.url}
          onClick={(e) => handleClick(e, toc.url)}
          className={activeId === toc.url.slice(1) ? 'active' : ''}
        >
          {toc.value}
        </a>
      ))}
    </nav>
  );
}
```

## 类型定义

```typescript
interface TocItem {
  url: string;      // 锚点链接，如 "#heading-1"
  value: string;    // 显示文本
  level?: number;   // 标题层级 (1-6)
}

interface ScrollOptions {
  offset?: number;
  threshold?: number;
  highlightBuffer?: number;
  behavior?: ScrollBehavior;
}
```

## 自定义样式

所有组件都使用 Tailwind CSS 类名，可以通过 `className` 属性进行自定义：

```tsx
<TableOfContents 
  tocs={tocs} 
  className="custom-toc-class"
  showProgress={false}
/>
```

## 浏览器兼容性

- 现代浏览器支持 `scroll-behavior: smooth`
- 旧版浏览器会降级到瞬间跳转
- 支持触摸设备的滑动操作

## 性能考虑

1. **事件节流**: 滚动事件使用 16ms 节流，确保 60fps
2. **被动监听**: 使用 `{ passive: true }` 优化滚动性能
3. **DOM 查询优化**: 缓存 DOM 元素引用
4. **内存管理**: 组件卸载时清理事件监听器

## 未来改进

- [ ] 支持键盘导航
- [ ] 添加滚动动画缓动函数
- [ ] 支持目录项拖拽排序
- [ ] 添加阅读时间估算
- [ ] 支持全文搜索定位
