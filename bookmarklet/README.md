# ChatGPT Browser Pruner bookmarklet

<img width="287" height="145" alt="image" src="https://github.com/user-attachments/assets/902febb5-94df-43a9-91b7-1dec7f7391db" />


This directory contains a bookmarklet edition of ChatGPT Browser Pruner for browsers where installing the extension is inconvenient or unavailable, such as Firefox/Fennec on Android without AMO signing, unsigned extensions, Iceraven, or another browser install.

The bookmarklet path is separate from the extension path. It runs only when you manually invoke it on `chatgpt.com` or `chat.openai.com`.

## What it does

- Finds old ChatGPT message containers conservatively inside `main`.
- Keeps recent/current messages.
- Removes older rendered message DOM nodes directly.
- Shows a tiny bottom-right control with:
  - `#: N` removed message count
  - `✂` manual sweep
  - `↻` reload to restore the normal ChatGPT page DOM
  - `×` close/remove-control

## What it does not do

- Does not change the browser extension behavior.
- Does not create per-message replacement or placeholder blocks.
- Does not save transcripts.
- Does not use storage.
- Does not call ChatGPT APIs.
- Does not send network requests.
- Does not intercept requests.
- Does not use a `MutationObserver`.

Reload the page normally to restore pruned messages.

## Build

Build with Python from the repository root:

```sh
python3 bookmarklet/build_bookmarklet.py
```

The stdlib-only build script reads `bookmarklet/pruner-bookmarklet.js`, strips leading/trailing whitespace, percent-encodes it, and writes `bookmarklet/bookmarklet.txt`. The generated version is here: https://raw.githubusercontent.com/thesepeoplearenotyourfriends/chatgtpt-browser-pruner-extension/refs/heads/main/bookmarklet/bookmarklet.txt

## Android / Fennec setup

Mobile browsers make bookmarklets deliberately awkward to save. Creating a normal bookmark and editing its URL is usually easier than trying to paste a `javascript:` URL directly into the address bar.

1. Open any normal webpage.
2. Bookmark it.
3. Edit the bookmark.
4. Rename it `ChatGPT Pruner`.
5. Replace the URL with the contents of `bookmarklet/bookmarklet.txt`.
6. Open a ChatGPT conversation.
7. Run the bookmarklet from bookmarks/address-bar bookmark suggestions.

After it runs, tap `✂` whenever you want another manual sweep. Tap `↻` to reload ChatGPT and restore the normal page DOM.
