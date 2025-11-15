# Git 历史缓存系统 - 快速设置指南

## 🎯 目标

解决 Cloudflare Pages 等 CI 环境中无法获取完整 Git 历史的问题，使博客文章的创建时间、更新时间和版本历史功能正常工作。

## ✅ 已完成的工作

### 1. 核心文件

- ✅ `app/scripts/generate-git-history.ts` - 缓存生成脚本
- ✅ `utils/git.ts` - 增强的 Git 历史读取工具（支持缓存）
- ✅ `app/data/git-history.json` - Git 历史缓存文件
- ✅ `.husky/pre-push` - Git hook（自动更新缓存）

### 2. 工作原理

```
┌─────────────────┐
│  本地开发环境    │
│                 │
│  1. 优先读缓存   │
│  2. 回退 git log │
└─────────────────┘
         │
         │ git push
         ▼
┌─────────────────┐
│  Pre-push Hook  │
│                 │
│  自动生成缓存    │
│  自动提交缓存    │
└─────────────────┘
         │
         │ push to remote
         ▼
┌─────────────────┐
│  CI 环境        │
│  (shallow clone)│
│                 │
│  直接读缓存文件  │
└─────────────────┘
```

## 🚀 使用方法

### 方式一：手动生成缓存（推荐首次使用）

```bash
# 1. 生成缓存
pnpm run git:cache

# 2. 提交缓存
git add app/data/git-history.json
git commit -m "chore: add git history cache"
git push
```

### 方式二：自动更新（推荐日常使用）

```bash
# 1. 确保 hook 可执行
chmod +x .husky/pre-push

# 2. 正常 push，hook 会自动处理
git push
```

Hook 会在 push 前自动：

- 运行 `pnpm run git:cache`
- 如果缓存有变化，自动提交（带 `[skip ci]` 标记）

## 📋 验证

### 1. 验证缓存生成

```bash
pnpm run git:cache
```

应该看到类似输出：

```
🔍 Scanning for blog posts...
📝 Found 10 blog posts
⚙️  Git config: { githubRepo: 'username/repo', githubBranch: 'main' }
📊 Processing: app/routes/blogs.example.mdx
  ✅ 2 commits (2024-01-01 → 2024-11-16)
...
✨ Git history cache generated: app/data/git-history.json
📦 Cached 10 files
```

### 2. 验证构建使用缓存

```bash
pnpm build
```

应该看到类似输出：

```
📦 Using cached Git history for app/routes/blogs.example.mdx
📦 Using cached Git history for app/routes/blogs.another.mdx
...
```

### 3. 验证缓存文件

```bash
cat app/data/git-history.json | head -20
```

应该看到 JSON 格式的缓存数据。

## 🔧 配置

### package.json

已添加脚本：

```json
{
  "scripts": {
    "git:cache": "tsx app/scripts/generate-git-history.ts"
  }
}
```

### .husky/pre-push

已配置 Git hook，会在 push 前自动更新缓存。

### 依赖

已安装：

- `tsx` - 运行 TypeScript 脚本
- `husky` - Git hooks 管理

## 📝 注意事项

1. **缓存文件必须提交**：`app/data/git-history.json` 必须提交到仓库，CI 才能使用
2. **首次使用**：建议手动运行一次 `pnpm run git:cache` 并提交
3. **新文章**：添加新文章后，push 前会自动更新缓存
4. **禁用自动更新**：如果不想自动更新，删除 `.husky/pre-push` 即可

## 🐛 故障排查

### 问题：CI 构建时没有 Git 信息

**解决**：

```bash
# 确保缓存文件已提交
git add app/data/git-history.json
git commit -m "chore: update git history cache"
git push
```

### 问题：本地开发时 Git 信息不准确

**解决**：

```bash
# 重新生成缓存
pnpm run git:cache
```

### 问题：Hook 没有执行

**解决**：

```bash
# 确保 hook 可执行
chmod +x .husky/pre-push

# 检查 husky 是否安装
pnpm exec husky init
```

## 📚 更多信息

详细文档：`docs/git-history-cache.md`
