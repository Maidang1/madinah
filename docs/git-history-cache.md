# Git 历史缓存系统

## 问题背景

在 Cloudflare Pages 等 CI/CD 环境中，通常只会执行 shallow clone（`git clone --depth=1`），只拉取最新的一个 commit。这导致：

- 无法通过 `git log` 获取文件的完整历史
- 博客文章的创建时间、更新时间无法获取
- 版本历史功能无法正常工作

## 解决方案

使用持久化的 JSON 文件来缓存 Git 历史信息：

1. **本地开发**：优先从缓存读取，如果没有缓存则执行 `git log`
2. **Git Push Hook**：每次 push 前自动更新缓存文件
3. **CI 构建**：直接从缓存文件读取，无需 Git 历史

## 快速开始

### 1. 生成缓存文件

```bash
pnpm run git:cache
```

这会扫描所有博客文章和书籍内容，生成 `app/data/git-history.json`。

### 2. 设置自动更新（可选）

如果你想在每次 push 前自动更新缓存：

```bash
# 确保 pre-push hook 可执行
chmod +x .husky/pre-push
```

Hook 会在 push 前自动：

- 运行 `pnpm run git:cache` 生成最新缓存
- 如果缓存有变化，自动提交（commit message 包含 `[skip ci]`）

### 3. 提交缓存文件

```bash
git add app/data/git-history.json
git commit -m "chore: update git history cache"
git push
```

## 工作原理

### 缓存生成（`app/scripts/generate-git-history.ts`）

扫描以下位置的内容文件：

- `app/routes/blogs.*.mdx` - 博客文章
- `app/features/*/content/**/*.mdx` - 书籍章节等

对每个文件执行 `git log --follow`，提取：

- 创建时间（第一个 commit）
- 更新时间（最新 commit）
- 完整的 commit 历史（过滤掉 chore/style/typo 等噪音提交）

### 缓存读取（`utils/git.ts`）

`getFileGitHistory()` 函数的策略：

1. **优先从缓存读取**：检查 `app/data/git-history.json` 是否存在
2. **回退到 git log**：如果缓存不存在或文件不在缓存中，执行 `git log` 命令

这样既保证了 CI 环境的可用性，又不影响本地开发体验。

## CI 配置

### Cloudflare Pages

无需特殊配置，只要确保：

1. `app/data/git-history.json` 已提交到仓库
2. 构建命令为 `pnpm build`

### GitHub Actions

如果使用 GitHub Actions，同样无需特殊配置。但如果你想在 CI 中重新生成缓存：

```yaml
- name: Generate Git history cache
  run: |
    git fetch --unshallow  # 获取完整历史
    pnpm run git:cache
```

## 缓存文件结构

```json
{
  "generatedAt": "2024-11-16T00:00:00.000Z",
  "files": {
    "app/routes/blogs.example.mdx": {
      "createdAt": "2024-01-01T00:00:00+08:00",
      "updatedAt": "2024-11-16T00:00:00+08:00",
      "commits": [
        {
          "hash": "abc1234",
          "date": "2024-11-16T00:00:00+08:00",
          "message": "feat: update example post",
          "author": "Author Name",
          "githubUrl": "https://github.com/user/repo/commit/abc1234"
        }
      ]
    }
  }
}
```

## 常见问题

### Q: 缓存文件会很大吗？

A: 不会。每个文件只存储必要的 commit 信息（hash、日期、作者、消息），并且会过滤掉噪音提交。一般情况下，即使有几十篇文章，缓存文件也只有几十 KB。

### Q: 如果忘记更新缓存会怎样？

A: 本地开发时会自动回退到 `git log`，不影响功能。但在 CI 环境中，新文章的 Git 信息会缺失。建议设置 pre-push hook 自动更新。

### Q: 可以手动编辑缓存文件吗？

A: 可以，但不推荐。缓存文件是自动生成的，手动修改可能会在下次自动更新时被覆盖。

### Q: 如何禁用自动更新？

A: 删除或重命名 `.husky/pre-push` 文件即可。

## 相关文件

- `app/scripts/generate-git-history.ts` - 缓存生成脚本
- `utils/git.ts` - Git 历史读取工具
- `app/data/git-history.json` - 缓存文件
- `.husky/pre-push` - Git hook
