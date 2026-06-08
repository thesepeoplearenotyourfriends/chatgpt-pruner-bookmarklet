# ChatGPT Browser Pruner

A minimal Manifest V3 Firefox/Chromium extension that locally prunes old rendered ChatGPT message DOM nodes from very long conversations.

## What it does

- Runs as a content script on `chatgpt.com` and `chat.openai.com`.
- Keeps the newest message area, using both a configurable maximum message count and a viewport-based "last few screenfuls" rule.
- Replaces old removed messages with small placeholders by default, reducing abrupt scroll-height collapse.
- Adds a small fixed-position banner with enabled/paused status, pruned count, pause/resume control, and normal page reload control.

## Safety / privacy boundaries

This extension is intentionally a local DOM-pruning monkeypatch only. It does **not** save transcripts, scrape message text, call APIs, add a server component, intercept network requests, alter ChatGPT app state, touch React internals, or write to IndexedDB/localStorage.

Reload the page normally to restore the full rendered conversation from ChatGPT.

## Installing locally

### Chromium

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable developer mode.
3. Choose **Load unpacked**.
4. Select this repository folder.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select `manifest.json` from this repository folder.

## Tuning selectors

ChatGPT's DOM changes frequently. Edit the centralized selector/config block at the top of `content.js` if pruning stops finding messages or becomes too aggressive. The script prefers `main article` containers and only falls back to narrow `data-testid` / role-based selectors.
