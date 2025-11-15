# Git 历史缓存 - 快速开始

## ✅ 系统已配置完成

Git 历史缓存系统已经完全配置好，`generatePostsMetadata` 方法现在会：

1. **优先从缓存读取** - 检查 `app/data/git-history.json`
2. **自动回退** - 如果缓存不存在，使用 `git log` 命令
3. **零配置 CI** - Cloudflare Pages 等 CI 环境直接使用缓存

## 🎯 验证系统

```bash
# 验证缓存文件
pnpm run git:verify
```

输出示例：

```
🔍 Verifying Git history cache...
✅ Cache file exists
✅ Cache file is valid JSON
✅ Cache structure is valid

📊 Cache Statistics:
   Generated: 11/16/2025, 2:44:15 AM
   Files cached: 10

📝 Cached files:
   • app/routes/blogs.algorithm.mdx (2 commits)
   • app/routes/blogs.async.mdx (2 commits)
   ...

✅ Cache is up to date
🎉 Git history cache verification passed!
```

## 🔄 更新缓存

### 手动更新

```bash
pnpm run git:cache
```

### 自动更新（推荐）

每次 `git push` 时，`.husky/pre-push` hook 会自动更新缓存。

## 📦 构建验证

```bash
pnpm build
```

你会看到：

```
📦 Using cached Git history for app/routes/blogs.algorithm.mdx
📦 Using cached Git history for app/routes/blogs.async.mdx
...
```

这表示系统正在使用缓存，而不是执行 `git log` 命令。

## 🚀 部署到 CI

无需任何配置！只要确保：

1. ✅ `app/data/git-history.json` 已提交到仓库
2. ✅ 构建命令为 `pnpm build`

CI 环境会自动从缓存读取 Git 历史。

## 📝 可用命令

```bash
# 生成/更新缓存
pnpm run git:cache

# 验证缓存
pnpm run git:verify

# 构建（会使用缓存）
pnpm build
```

## 🎉 完成！

系统已经完全配置好，`utils/post.ts` 中的 `generatePostsMetadata` 方法现在会自动从缓存读取 Git 信息。
