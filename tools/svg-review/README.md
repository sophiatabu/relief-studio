# SVG review page

Run from repository root: `python3 tools/svg-review/server.py`.
Open http://127.0.0.1:5190/ .

Three columns show the original SVG, audited render/error, and an autosaved comment.
The manifest comes from `public/achievement-library/manifest.json`.
Results are refreshed every three seconds from `../relief-svg-audit-2026-09-22/raw/`;
render images are loaded from its `images/` directory.
Comments are written atomically to `../relief-svg-audit-2026-09-22/comments.json`.
Read these comments before the next requested correction pass. Match entries by SVG filename.
Browser drafts also survive failed saves; the UI retries automatically.
Use `--data PATH` and `--port NUMBER` to choose another audit directory or port.
The server binds only to localhost; keep it running while reviewing.
