# Dark Mode 功能说明

## 已实现功能

✅ 完整的 dark mode 支持
✅ 主题切换按钮（太阳/月亮图标）
✅ localStorage 持久化
✅ 系统主题自动检测
✅ 无闪烁加载（FOUC 防护）
✅ 所有颜色变量支持 dark mode

## 使用方法

1. 启动开发服务器：
   ```bash
   pnpm dev
   ```

2. 访问 http://localhost:4326/

3. 点击导航栏中 "Madinah" 品牌名称旁边的主题切换按钮（月亮/太阳图标）

## 技术实现

### 组件
- `src/components/ThemeToggle.tsx` - React 主题切换组件
- 使用 `client:load` 指令确保客户端交互

### 样式
- `src/styles/global.css` - 包含完整的 light/dark 主题变量
- Tailwind 配置 `darkMode: 'class'`

### 防闪烁
- `BaseLayout.astro` 中的内联脚本在页面渲染前设置主题
- 从 localStorage 读取保存的主题偏好
- 回退到系统主题偏好

## 主题变量

所有颜色都通过 CSS 变量定义，支持 light/dark 两种模式：

- `--text-primary` / `--text-secondary` / `--text-muted`
- `--surface-white` / `--surface-gray-50` / `--surface-gray-100`
- `--border-default` / `--border-strong`
- `--icon-primary` / `--icon-secondary`
- Code Hike 语法高亮变量 (`--ch-0` 到 `--ch-26`)

## 测试

1. 切换主题，检查颜色变化
2. 刷新页面，确认主题保持
3. 清除 localStorage，确认回退到系统主题
4. 在不同页面间导航，确认主题一致
