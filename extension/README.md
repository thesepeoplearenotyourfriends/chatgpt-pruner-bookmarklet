# ChatGPT Browser Pruner browser extension

<img width="2170" height="725" alt="ChatGPT Browser Pruner extension screenshot" src="https://github.com/user-attachments/assets/2568208e-77f2-4ecf-bc50-e5d006ca1fd0" />

This directory contains the original Firefox/Fennec-targeted browser extension for ChatGPT Browser Pruner. It locally prunes old rendered ChatGPT message DOM nodes from very long conversations.

The extension is now the secondary path. For normal use, the repository root documents the bookmarklet version, which provides the same pruning behavior without Mozilla signing, XPI packaging, or temporary-extension reload chores.

## Why this is no longer the recommended path

The extension works, but the distribution story is worse than the code deserves:

- Mozilla signing for a self-distributed Firefox/Fennec add-on is a notary process, not a feature the pruner needs.
- Loading it temporarily from `about:debugging#/runtime/this-firefox` is fine for a quick desktop test, but Firefox removes temporary add-ons on browser restart, which means re-installing the extension every time the browser comes back.
- The JavaScript is small and self-contained enough to live in a bookmarklet while preserving the same user-facing functionality.

If you do not specifically need an extension-shaped artifact, use the bookmarklet from the repository root instead.

## Target browsers

- Firefox desktop
- Firefox for Android / Fennec-family browsers that can install signed XPIs from local files

The manifest is intentionally Manifest V2 because the extension is only a content script and does not need MV3-only features.

## What it does

- Runs as a content script on `chatgpt.com` and `chat.openai.com`.
- Keeps the newest message area, tuned for mobile by retaining roughly 12 mounted message containers plus the current screenful.
- Replaces old removed messages with small placeholders by default, reducing abrupt scroll-height collapse.
- Adds a small top-left fixed-position banner, offset from the mobile hamburger menu, with enabled/paused status, total pruned count, last found/cut diagnostics, pause/resume control, and normal page reload control.

## Safety / privacy boundaries

This extension is intentionally a local DOM-pruning monkeypatch only. It does **not** save transcripts, scrape message text, call APIs, add a server component, intercept network requests, alter ChatGPT app state, touch React internals, or write to IndexedDB/localStorage.

Reload the page normally to restore the full rendered conversation from ChatGPT.

## Files included in the extension

- `manifest.json` — Firefox/Fennec MV2 manifest, content-script registration, and Gecko extension ID.
- `content.js` — the entire runtime behavior.

No build system, bundler, background script, service worker, native component, or remote code is used.

## Installing during development

Temporary loading is useful only for development. It is not a pleasant everyday workflow because Firefox removes temporary add-ons after restart.

### Firefox desktop temporary load

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select `extension/manifest.json` from this repository.
4. Repeat those steps after every browser restart if you continue using the temporary path.

### Android/Fennec development note

For regular phone use, install a signed XPI instead of relying on temporary loading—or skip the extension and use the bookmarklet from the repository root.

## Packaging an unsigned XPI

From the repository root:

```sh
rm -f chatgpt-browser-pruner-0.1.0.unsigned.xpi
cd extension
zip -r ../chatgpt-browser-pruner-0.1.0.unsigned.xpi \
  manifest.json \
  content.js
cd ..
```

The archive root must contain `manifest.json` directly, not a parent folder.

## Mozilla signing workflow for self-distribution

This remains here for archival/reference use. It is no longer the recommended installation story for this project.

1. Create the unsigned XPI with the packaging command above.
2. Submit it to Mozilla Add-ons for signing as an **unlisted** add-on / self-distributed extension.
3. Use the signed XPI returned by Mozilla as the release artifact.
4. Attach the signed XPI to a GitHub Release.
5. Install that signed XPI on Firefox/Fennec from a local file.

AMO is only the signing/notary step for this project. Do not direct users to an add-on store listing.

## Suggested reviewer notes

> ChatGPT Browser Pruner is a Firefox/Fennec-targeted content-script-only extension. It runs only on `https://chatgpt.com/*` and `https://chat.openai.com/*`. It locally removes older already-rendered ChatGPT message DOM nodes from the live page to reduce DOM weight in long conversations, optionally leaving placeholders to reduce scroll-height jumps. It does not persist transcript content, call remote APIs, intercept network requests, use a background script, use remote code, touch React internals, or write IndexedDB/localStorage. Reloading the page restores the full rendered conversation from ChatGPT.

## Release checklist

1. Confirm the version in `extension/manifest.json`.
2. Run `python -m json.tool extension/manifest.json >/dev/null`.
3. Package the unsigned XPI with the command above.
4. Inspect the archive with `unzip -l chatgpt-browser-pruner-0.1.0.unsigned.xpi` and confirm only `manifest.json` and `content.js` are included at the archive root.
5. Submit the unsigned XPI to Mozilla for unlisted/self-distributed signing.
6. Attach the signed XPI to the matching GitHub Release.

## Tuning selectors

ChatGPT's DOM changes frequently. Edit the centralized selector/config block at the top of `extension/content.js` if pruning stops finding messages or becomes too aggressive. The script prefers `main article` containers and only falls back to narrow `data-testid` / role-based selectors.
