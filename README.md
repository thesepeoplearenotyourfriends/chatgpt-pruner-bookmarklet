<img width="2170" height="725" alt="image" src="https://github.com/user-attachments/assets/2568208e-77f2-4ecf-bc50-e5d006ca1fd0" />

# ChatGPT Browser Pruner

A small Firefox/Fennec-targeted, self-distributed browser extension that locally prunes old rendered ChatGPT message DOM nodes from very long conversations.

This project is intentionally not a store-listing product, not a Chromium-first extension, and not a general extension platform. The source stays readable here; release builds are packaged as XPIs, sent through Mozilla signing as **unlisted/self-distributed** add-ons, and attached to GitHub Releases for installation from a local file.

## Target browsers

- Firefox desktop
- Firefox for Android / Fennec-family browsers that can install signed XPIs from local files

The manifest is intentionally Manifest V2 because the extension is only a content script and does not need MV3-only features. Mozilla still documents Android-targeted extension compatibility around MV2, and Fennec-style browser restarts make temporary extension loading unsuitable for real phone use.

## What it does

- Runs as a content script on `chatgpt.com` and `chat.openai.com`.
- Keeps the newest message area, using both a configurable maximum message count and a viewport-based "last few screenfuls" rule.
- Replaces old removed messages with small placeholders by default, reducing abrupt scroll-height collapse.
- Adds a small fixed-position banner with enabled/paused status, pruned count, pause/resume control, and normal page reload control.

## Safety / privacy boundaries

This extension is intentionally a local DOM-pruning monkeypatch only. It does **not** save transcripts, scrape message text, call APIs, add a server component, intercept network requests, alter ChatGPT app state, touch React internals, or write to IndexedDB/localStorage.

Reload the page normally to restore the full rendered conversation from ChatGPT.

## Files included in the extension

- `manifest.json` — Firefox/Fennec MV2 manifest, content-script registration, and Gecko extension ID.
- `content.js` — the entire runtime behavior.

No build system, bundler, background script, service worker, native component, or remote code is used.

## Installing during development

Temporary loading is useful for desktop development, but it is not the recommended Android/Fennec usage path because mobile browsers may kill and restart processes often.

### Firefox desktop temporary load

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select `manifest.json` from this repository folder.

### Android/Fennec development note

For regular phone use, install a signed XPI instead of relying on temporary loading. See the release workflow below.

## Packaging an unsigned XPI

From the repository root:

```sh
rm -f chatgpt-browser-pruner-0.1.0.unsigned.xpi
zip -r chatgpt-browser-pruner-0.1.0.unsigned.xpi \
  manifest.json \
  content.js
```

The archive root must contain `manifest.json` directly, not a parent folder.

## Mozilla signing workflow for self-distribution

1. Create the unsigned XPI with the packaging command above.
2. Submit it to Mozilla Add-ons for signing as an **unlisted** add-on / self-distributed extension.
3. Use the signed XPI returned by Mozilla as the release artifact.
4. Attach the signed XPI to a GitHub Release.
5. Install that signed XPI on Firefox/Fennec from a local file.

AMO is only the signing/notary step for this project. Do not direct users to an add-on store listing.

## Suggested reviewer notes

> ChatGPT Browser Pruner is a Firefox/Fennec-targeted content-script-only extension. It runs only on `https://chatgpt.com/*` and `https://chat.openai.com/*`. It locally removes older already-rendered ChatGPT message DOM nodes from the live page to reduce DOM weight in long conversations, optionally leaving placeholders to reduce scroll-height jumps. It does not persist transcript content, call remote APIs, intercept network requests, use a background script, use remote code, touch React internals, or write IndexedDB/localStorage. Reloading the page restores the full rendered conversation from ChatGPT.

## Release checklist

1. Confirm the version in `manifest.json`.
2. Run `python -m json.tool manifest.json >/dev/null`.
3. Package the unsigned XPI with the command above.
4. Inspect the archive with `unzip -l chatgpt-browser-pruner-0.1.0.unsigned.xpi` and confirm only `manifest.json` and `content.js` are included at the archive root.
5. Submit the unsigned XPI to Mozilla for unlisted/self-distributed signing.
6. Attach the signed XPI to the matching GitHub Release.

## Tuning selectors

ChatGPT's DOM changes frequently. Edit the centralized selector/config block at the top of `content.js` if pruning stops finding messages or becomes too aggressive. The script prefers `main article` containers and only falls back to narrow `data-testid` / role-based selectors.
