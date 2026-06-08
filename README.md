# ChatGPT Browser Pruner

<img width="287" height="145" alt="ChatGPT Browser Pruner control" src="https://github.com/user-attachments/assets/902febb5-94df-43a9-91b7-1dec7f7391db" />

ChatGPT Browser Pruner is now a bookmarklet-first tool for trimming old, already-rendered ChatGPT message nodes out of very long conversations.

I originally chased the Firefox/Fennec extension route, including the self-distributed signing workflow. In practice, that turned out to be a lot of ceremony for a few lines of local page JavaScript. The temporary-extension path through `about:debugging#/runtime/this-firefox` is not much better for everyday use: Firefox drops temporary add-ons when the browser restarts, so you have to load the extension again and again.

The actual behavior is simple enough to fit comfortably in a bookmarklet, and the bookmarklet provides the same functionality without packaging, signing, or reinstalling an extension after every restart.

The old browser-extension version still exists in [`extension/`](extension/), but the recommended path is the bookmarklet below.

## What it does

- Runs only when you manually invoke it on `chatgpt.com` or `chat.openai.com`.
- Finds old ChatGPT message containers conservatively inside `main`.
- Keeps recent/current messages.
- Removes older rendered message DOM nodes, leaving small placeholders by default to reduce scroll-height jumps.
- Automatically re-checks after page changes, scrolling, and resizing.
- Shows a tiny bottom-right control with:
  - `#: N` pruned message count
  - `⏸` / `▶` pause and resume
  - `↻` reload to restore the normal ChatGPT page DOM

Reload the page normally to restore pruned messages.

## What it does not do

- Does not save transcripts.
- Does not use browser storage.
- Does not call ChatGPT APIs.
- Does not send network requests.
- Does not intercept requests.
- Does not touch React internals.

## Install the bookmarklet

Mobile browsers make bookmarklets deliberately awkward to save. Creating a normal bookmark and editing its URL is usually easier than trying to paste a `javascript:` URL directly into the address bar.

1. Open any normal webpage.
2. Bookmark it.
3. Edit the bookmark.
4. Rename it `ChatGPT Pruner`.
5. Replace the URL with the contents of [`bookmarklet.txt`](bookmarklet.txt).
6. Open a ChatGPT conversation.
7. Run the bookmarklet from bookmarks/address-bar bookmark suggestions.

After it runs, use `⏸` / `▶` to pause or resume pruning. Tap `↻` to reload ChatGPT and restore the normal page DOM.

## Build

Build with Python from the repository root:

```sh
python3 build_bookmarklet.py
```

The stdlib-only build script reads [`pruner-bookmarklet.js`](pruner-bookmarklet.js), strips leading/trailing whitespace, percent-encodes it, and writes [`bookmarklet.txt`](bookmarklet.txt).

The generated bookmarklet URL is also available from the raw GitHub file:

https://raw.githubusercontent.com/thesepeoplearenotyourfriends/chatgtpt-browser-pruner-extension/refs/heads/main/bookmarklet.txt

## Browser extension

The browser-extension implementation is kept in [`extension/`](extension/) for reference and for anyone who still wants that workflow. It is no longer the primary recommendation because signing and temporary loading add friction without adding meaningful capability for this script.
