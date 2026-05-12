# Browser Sandbox

Host for working with the web, images, and audio. The main tool is **Jina** (search + page reading). For complex automation — Playwright + headless Chromium. For recognition — OCR and ASR APIs.

## Decide first — which tool fits the task?

| Task | Tool |
|---|---|
| "What is X?" / "Find me a page about Y" | `web-search` |
| "Read / summarise this page", "extract title / article body" | `jina-read <url>` |
| "List the top N items from `https://…/trending` (or any listing/feed page)" | `jina-read <url>` |
| "Get all links / table rows / repo names from a public page" | `jina-read <url>` |
| "Fill a form, log in, click a button, wait for state" | Playwright |
| "Screenshot / PDF the page" | `pw-screenshot` or `npx playwright pdf` |
| "Intercept XHR/JSON the page emits" | Playwright |

Hard rules:

- **For *any* read/extract task on a public URL, START with `jina-read`.** It already renders JavaScript (SPAs, React, Vue, dynamic lists), returns clean Markdown, never needs `npm install`, and skips browser launch overhead.
- **Do not reach for Playwright "because the page is dynamic" — `jina-read` handles JS.** Use Playwright only when you genuinely need to *interact* with the page.
- **Do not write Node.js scripts that `require('playwright')` from a non-standard location.** Just use `pw-screenshot` for screenshots, or `node -e "..."` (NODE_PATH is preconfigured).

## System info

- OS: Ubuntu 24.04 (Noble) — Microsoft Playwright image
- User: `sandbox` · Home: `/home/sandbox` · Shell: `/bin/bash`
- Preinstalled: Node.js 20, Playwright 1.50 + Chromium, `web-search`, `jina-read`, `pw-screenshot`, `curl`, `wget`, `jq`, `cheerio`

Environment variables:

| Variable | Description |
|---|---|
| `OCR_API_URL` | URL of the OCR service (recognize text in images), if configured |
| `ASR_API_URL` | URL of the ASR service (speech-to-text), if configured |

## Examples

Pick the smallest tool that does the job — almost always one of the first three.

### 1. Search the web

```bash
web-search 'how to set up nginx reverse proxy'
```

Returns Markdown: title, link, snippet. Pipe to `head -n 30` if you only need the first few hits.

### 2. Read any page (incl. listings, SPA, trending feeds)

```bash
jina-read https://github.com/trending
```

Returns the page as clean Markdown — already rendered with JavaScript executed. Use this for "top N repos", "headlines from HackerNews", "extract article body", search result pages, RSS-style feeds, etc.

### 3. Screenshot or PDF a page

```bash
pw-screenshot https://example.com out.png            # default 1280×720
pw-screenshot --full-page https://example.com out.png # full scroll
npx playwright pdf https://example.com page.pdf
```

### 4. Playwright — only when you need to interact

Canonical pattern (run from a file, not a one-liner):

```bash
cat > /home/sandbox/login.js << 'SCRIPT'
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com/login');
  await page.fill('input[name=username]', 'user');
  await page.fill('input[name=password]', 'pass');
  await page.click('button[type=submit]');
  await page.waitForLoadState('networkidle');
  console.log(page.url());
  await browser.close();
})();
SCRIPT
node /home/sandbox/login.js
```

Notes:

- Prefer a script file over `node -e "..."` — the shell escaping (`$$eval`, quotes) frequently corrupts inline JS.
- Do **not** run `npm install playwright` or `npx playwright install`. The module and Chromium are preinstalled.

### 5. OCR — read text from an image

```bash
curl -sS "${OCR_API_URL}/ocr" -F "file=@/home/sandbox/image.png" | jq -r '.text'
```

Supports PNG, JPEG, WebP, BMP, TIFF. Skip if `OCR_API_URL` is unset.

### 6. ASR — transcribe audio

```bash
curl -sS "${ASR_API_URL}/transcribe" -F "file=@/home/sandbox/audio.ogg" | jq -r '.text'
```

Supports OGG, MP3, WAV, M4A, FLAC. Skip if `ASR_API_URL` is unset.

## Troubleshooting

- `Cannot find module 'playwright'` — env var was not inherited. Add `process.env.NODE_PATH = '/opt/sandbox-node/node_modules'; require('module')._initPaths();` at the top of the script, or just use `pw-screenshot` / one of the helper binaries instead.
- `Executable doesn't exist ... chromium ...` — set `export PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` before running.
- Headless mode only. Data is not persistent — files in `/home/sandbox` are wiped on container restart.
