# Git History Cache

这个目录包含博客文章的 Git 历史缓存，用于在 CI/CD 环境中提供版本历史信息。

## 为什么需要这个？

在 Cloudflare Pages 等 CI 环境中，通常只会拉取最新的 commit（shallow clone），没有完整的 Git 历史。这导致无法通过 `git log` 获取文章的创建时间、更新时间和版本历史。

## 工作原理

1. **本地开发**：`utils/git.ts` 会优先尝试从 `git-history.json` 读取缓存，如果没有缓存则回退到执行 `git log` 命令
2. **Git Push Hook**：每次 push 前，`.husky/pre-push` hook 会自动运行 `pnpm run git:cache` 生成最新的缓存文件
3. **CI/CD 构建**：在 CI 环境中，由于缓存文件已经提交到仓库，构建时直接读取缓存，无需访问 Git 历史

## 使用方法

### 初始化 Git Hooks

```bash
# 运行一次即可
bash app/scripts/setup-git-hooks.sh
```

### 手动生成缓存

```bash
pnpm run git:cache
```

### 在 CI 中使用

无需额外配置，构建时会自动从缓存读取。确保 `app/data/git-history.json` 已提交到仓库。

## 缓存文件结构

```json
{
  "generatedAt": "2024-01-01T00:00:00.000Z",
  "files": {
    "app/features/blog/content/post-1.mdx": {
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-02T00:00:00.000Z",
      "commits": [
        {
          "hash": "abc1234",
          "date": "2024-01-02T00:00:00.000Z",
          "message": "feat: update post",
          "author": "Author Name",
          "githubUrl": "https://github.com/user/repo/commit/abc1234"
        }
      ]
    }
  }
}
```

## 注意事项

- 缓存文件会在每次 push 前自动更新并提交
- 如果你不想自动提交缓存，可以删除 `.husky/pre-push` hook
- 缓存文件应该提交到版本控制系统中
- 本地开发时，如果缓存过期，系统会自动回退到 `git log` 命令
