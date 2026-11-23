# 站点开发说明

这个仓库只负责「内容 + 配置 + 皮肤」。Gmeek 是渲染引擎，单独维护在
[7r1UMPHK/Gmeek](https://github.com/7r1UMPHK/Gmeek)。

## 目录边界

| 位置 | 作用 | 改什么 |
| --- | --- | --- |
| GitHub Issues | 文章正文 | 日常写文章 |
| `config.json` | 站点标题、头像、单页、外链、脚本入口 | 站点级配置 |
| `static/about.html`、`static/link.html` | 两个静态单页 | 页面内容与结构 |
| `static/css/pages.css` | about/link 的内容区样式 | 两个单页的排版 |
| `static/css/theme.css` | 全站皮肤 | 背景、卡片、导航、文章排版 |
| `static/plugins/theme.js` | 主题的 DOM 行为 | 顶部导航、页脚统计、分页增强 |
| `static/plugins/` | TOC、lightbox、懒加载、计数、加密 | 通用前端插件 |
| `static/image/` | 站点图片 | 新增/替换图片 |
| `backup/` | Issue 的 Markdown 备份（由构建更新） | 不要手改 |
| `docs/` | 构建产物 | **不要手改，也不入库** |

## 构建流程

1. GitHub Actions 按 `config.json` 里的 `GMEEK_REPO` / `GMEEK_VERSION` 克隆固定版本的 Gmeek。
2. Gmeek 把 `static/` 复制进 `docs/`，再根据 Issues 生成文章、列表、标签页和 RSS。
3. `scripts/check_site.py` 做一次产物检查。
4. `docs/` 作为 Pages artifact 上传并部署。
5. 只有 `backup/` 会由 Action 自动提交；`docs/`、`blogBase.json`、`README.md` 都是生成物，已忽略。

## 本地预览

```bash
# 在仓库根目录
python3 -m http.server 8000 -d docs
# 打开 http://localhost:8000
```

如果要本地重新构建，需要 GitHub token：

```bash
GITHUB_TOKEN=... GITHUB_REPOSITORY=7r1UMPHK/7r1UMPHK.github.io \
  bash scripts/build.sh
```

## 修改主题时的约定

- **样式改 `static/css/theme.css`**，不要再往 `theme.js` 里塞 CSS 字符串。
- `theme.js` 只做 DOM 行为，并通过 `html.page-home` / `html.page-article` /
  `html.page-tag` / `html.page-page` 这些 class 给 CSS 提供页面类型。
- 页面骨架（header/footer/content）由 Gmeek 模板提供；如果只是视觉变化，
  优先写在 `theme.css`，不要改 Gmeek fork。
- Gmeek fork 只保留引擎级改动（模板结构、tag 搜索、性能优化）。
- `GMEEK_VERSION` 必须是固定 commit SHA 或 tag，不要用 `main`。

## 发布

推送后到 GitHub Actions → `build Gmeek` → `Run workflow`。
定时构建是每月 15 号 16:00（UTC）。
