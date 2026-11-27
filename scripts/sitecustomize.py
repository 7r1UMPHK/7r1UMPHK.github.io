import json
import os
import sys

if os.environ.get("GMEEK_CMARK_FALLBACK") == "1":
    try:
        import requests
        from cmarkgfm import github_flavored_markdown_to_html as _render_gfm
    except Exception as exc:
        print(f"[Gmeek fallback] disabled: {exc}", file=sys.stderr)
    else:
        _real_post = requests.post
        _real_session_post = requests.sessions.Session.post
        _fallback_hit = 0

        class _LocalMarkdownResponse:
            def __init__(self, html):
                if isinstance(html, bytes):
                    html = html.decode("utf-8", "ignore")
                self.status_code = 200
                self.ok = True
                self.text = html
                self.content = html.encode("utf-8")

            def json(self):
                return {"html": self.text}

            def raise_for_status(self):
                return None

        def _extract_markdown_text(*args, **kwargs):
            payload = kwargs.get("json")
            if isinstance(payload, dict):
                return payload.get("text", "")
            data = kwargs.get("data")
            if isinstance(data, dict):
                return data.get("text", "")
            if isinstance(data, (str, bytes)):
                try:
                    raw = data.decode("utf-8") if isinstance(data, bytes) else data
                    obj = json.loads(raw)
                    if isinstance(obj, dict):
                        return obj.get("text", "")
                except Exception:
                    pass
            return ""

        def _is_markdown_api(url):
            return isinstance(url, str) and "api.github.com/markdown" in url

        def _patched_post(url, *args, **kwargs):
            global _fallback_hit
            if _is_markdown_api(url):
                _fallback_hit += 1
                print(f"[Gmeek fallback] cmark-gfm render hit #{_fallback_hit}", file=sys.stderr)
                return _LocalMarkdownResponse(_render_gfm(_extract_markdown_text(*args, **kwargs)))
            return _real_post(url, *args, **kwargs)

        def _patched_session_post(self, url, *args, **kwargs):
            global _fallback_hit
            if _is_markdown_api(url):
                _fallback_hit += 1
                print(f"[Gmeek fallback] cmark-gfm render hit #{_fallback_hit}", file=sys.stderr)
                return _LocalMarkdownResponse(_render_gfm(_extract_markdown_text(*args, **kwargs)))
            return _real_session_post(self, url, *args, **kwargs)

        requests.post = _patched_post
        requests.sessions.Session.post = _patched_session_post
