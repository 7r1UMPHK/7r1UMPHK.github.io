#!/usr/bin/env python3
import re
from pathlib import Path
from lxml import html as lh

ROOT = Path("/mnt/hgfs/gx/code/sites/7r1UMPHK.github.io")
OUT = ROOT / "dev"
POST = ROOT / "docs/post/nei-bu-_motto.html"
FONT_CDN = "https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css"

DEMO = """
<h2>元素自检 demo</h2>
<p>这一段同时放 <code>inline code</code>、<strong>加粗</strong>、<em>斜体</em>、
<del>删除线</del>、<a href="https://github.com/yanxinwu946/SeeYuePlus">外部链接</a>
和 <a href="#postBody">站内锚点</a>，用来核对 salt 的行内样式。</p>
<ul>
  <li>一级无序列表项，带 <code>code</code></li>
  <li>另一项
    <ul>
      <li>二级嵌套
        <ul><li>三级嵌套</li></ul>
      </li>
    </ul>
  </li>
</ul>
<ol>
  <li>一级有序列表（圆形徽章）</li>
  <li>另一项
    <ol>
      <li>二级（半透明小圆）
        <ol><li>三级（纯数字）</li></ol>
      </li>
    </ol>
  </li>
</ol>
<blockquote><p>普通引用块：左侧竖线 + 左上角引号图标。</p></blockquote>
<blockquote><h3>注意事项</h3><p>这是 Admonition 形态：引用块以标题开头时，标题变成标题栏。</p></blockquote>
<h3>代码块</h3>
<pre lang="bash"><code>nmap -sC -sV -oA nmap/target 192.168.205.187
grep -RiEn "password|secret" /var/www/html --include=*.php
curl -s "http://192.168.205.187/mymotter/index.php?nickname=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&amp;submit=%E6%8F%90%E4%BA%A4"
php -r '$x=base64_decode("YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXpBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWjAxMjM0NTY3ODlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB");');</code></pre>
<h3>表格</h3>
<table>
  <thead><tr><th>端口</th><th>服务</th><th>备注</th></tr></thead>
  <tbody>
    <tr><td>22</td><td>ssh</td><td>OpenSSH 7.6p1</td></tr>
    <tr><td>80</td><td>http</td><td>Apache 2.4.29</td></tr>
    <tr><td>3306</td><td>mysql</td><td>仅内网监听</td></tr>
  </tbody>
</table>
<p>标题里的 <code>code</code> 不应该把行高撑破。</p>
<h3>这是三级标题 <a href="https://example.com">带外链</a> 的写法</h3>
<hr>
<p>分隔线以上是本次移植覆盖的全部元素。</p>
"""

styles = []
for name, old, new in [
    ("preview-theme.css", '"/image/', '"../static/image/'),
    ("preview-seeyue-salt.css", '"/font/', '"../static/font/'),
]:
    src = (ROOT / "static/css" / name.split("-", 1)[1]).read_text(encoding="utf-8")
    (OUT / name).write_text(src.replace(old, new), encoding="utf-8")
    styles.append(name)

post = POST.read_text(encoding="utf-8")
head_styles = re.findall(r"<style>(.*?)</style>", post, re.S)
body = lh.fromstring(post).xpath('//div[@id="postBody"]')[0]
body_html = re.sub(r'(?:https?://7r1UMPHK\.github\.io)?(/|)image/', "../static/image/",
                   lh.tostring(body, encoding="unicode", method="html"))
body_html = re.sub(r'^<div[^>]*id="postBody"[^>]*>|</div>\s*$', "", body_html.strip())
title = re.search(r"<title>(.*?)</title>", post, re.S).group(1).strip()

def render(body_html):
    return f"""<!DOCTYPE html>
<!-- 本地预览产物，由 dev/gen_preview.py 生成。皮肤对比用，不参与构建。 -->
<html class="page-article page-post" data-color-mode="light" data-light-theme="light" data-dark-theme="github-light" lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>正文皮肤预览 - {title}</title>
<script>
// file:// 下 origin 是 "null"，替 theme.js 补一个 wordcount，页脚统计才有数
const _fetch = window.fetch;
window.fetch = (u, o) => /wordcount\\.json/.test(u)
  ? Promise.resolve(new Response(JSON.stringify({{total: 2480000, posts: 308, perPage: 15, totalPages: 21}}),
      {{ headers: {{ 'content-type': 'application/json' }} }}))
  : _fetch(u, o);
</script>
<link href="../static/css/primer.css" rel="stylesheet">
{''.join(f'<link href="{s}" rel="stylesheet">\n' for s in styles)}<script>
// ?baseline 关掉新皮肤；?pagebg 换成整页 salt 绿底
if (location.search.indexOf('baseline') >= 0) document.querySelector('link[href="preview-seeyue-salt.css"]').remove();
if (location.search.indexOf('pagebg') >= 0) {{
  const st = document.createElement('style');
  st.textContent = 'html{{background:#e4eddf !important}}html.page-article body{{background:rgba(255,255,255,.6) !important}}';
  document.head.appendChild(st);
}}
if (location.search.indexOf('check') >= 0) {{
  window.addEventListener('load', function () {{
    setTimeout(function () {{
      var e = document.querySelector('.toc-end'), m = document.querySelector('.mobile-top-button');
      document.title = 'CHECK toc-end=' + (e ? getComputedStyle(e).display : 'none-el')
        + ' mobile-top=' + (m ? getComputedStyle(m).display : 'none-el')
        + ' toc-top=' + getComputedStyle(document.querySelector('.toc')).top;
    }}, 400);
  }});
}}
</script>
{''.join(f"<style>{s}</style>" for s in head_styles)}
<style>
#skin-toggle {{
  position: fixed; top: 12px; right: 12px; z-index: 99999;
  padding: 8px 14px; border-radius: 999px; border: 1px solid #81b29a;
  background: #fff; color: #2f5d4b; font-size: 14px; cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, .12); font-family: system-ui, sans-serif;
}}
</style>
</head>
<body>
<button id="skin-toggle" onclick="var s=document.getElementById('salt');s.disabled=!s.disabled;this.textContent=s.disabled?'打开 salt 皮肤':'关掉 salt 皮肤'">关掉 salt 皮肤</button>
<div id="header">
  <h1 class="postTitle">{title}</h1>
</div>
<div id="content">
<div class="markdown-body" id="postBody">
{body_html}
{DEMO}
</div>
</div>
<div id="footer">
<div id="footer1">Copyright © 2025 <a href="#">TriumphK Blog</a></div>
<div id="footer2"><span id="runday"></span><span>预览页 · primer + theme + seeyue-salt</span></div>
</div>
<script src="../static/plugins/theme.js"></script>
<script src="../static/plugins/TOC.js"></script>
<script src="../static/plugins/lightbox.js"></script>
<script src="../static/plugins/LazyLoadImages.js"></script>
<script>
  var saltLink = document.querySelector('link[href="preview-seeyue-salt.css"]');
  if (saltLink) saltLink.id = 'salt';
</script>
</body>
</html>
"""

(OUT / "seeyue-salt-preview.html").write_text(render(body_html), encoding="utf-8")
(OUT / "seeyue-salt-demo.html").write_text(render(""), encoding="utf-8")
print("wrote:", ", ".join(str(OUT / n) for n in ("seeyue-salt-preview.html", "seeyue-salt-demo.html")))
print("css:", ", ".join(str(OUT / s) for s in styles))
