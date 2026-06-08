(() => {
  "use strict";

  /**
   * ChatGPT Browser Pruner bookmarklet edition.
   *
   * Manual, local-only DOM pruning for very long ChatGPT conversations.
   * This bookmarklet does not use placeholders, storage, network requests,
   * ChatGPT APIs, request interception, or automatic DOM watching.
   */

  const CONFIG = {
    controlId: "cgpt-pruner-bookmarklet-control",
    maxMessagesToKeep: 24,
    keepScreenfuls: 3,
    minMessagesBeforePrune: 10,
    preferredMessageSelectors: ["main article"],
    fallbackMessageSelectors: [
      'main [data-testid^="conversation-turn-"]',
      'main [data-message-author-role]'
    ],
    unsafeAncestorSelectors: [
      "nav",
      "aside",
      "header",
      "footer",
      "form",
      "textarea",
      "input",
      "button",
      "select",
      "dialog",
      '[role="navigation"]',
      '[role="dialog"]',
      '[aria-modal="true"]',
      '[contenteditable="true"]',
      '[data-testid*="composer"]',
      '[data-testid*="sidebar"]',
      '[data-testid*="modal"]'
    ]
  };

  const allowedHosts = new Set(["chatgpt.com", "chat.openai.com"]);

  const existingState = window.__cgptPrunerBookmarkletState;
  if (existingState && existingState.control && existingState.control.isConnected) {
    existingState.sweep();
    return;
  }

  if (!allowedHosts.has(window.location.hostname)) {
    return;
  }

  const state = {
    removedCount: 0,
    control: null,
    countText: null,
    sweep: null
  };

  function uniqueElements(elements) {
    return [...new Set(elements)].filter((element) => element instanceof HTMLElement);
  }

  function isVisibleElement(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isUnsafeCandidate(element) {
    if (!element.isConnected || element.id === CONFIG.controlId) {
      return true;
    }

    if (element.closest(`#${CONFIG.controlId}`)) {
      return true;
    }

    if (element.closest(CONFIG.unsafeAncestorSelectors.join(","))) {
      return true;
    }

    const main = element.closest("main");
    if (!main) {
      return true;
    }

    const rect = element.getBoundingClientRect();
    return rect.height < 24;
  }

  function getMessageCandidates() {
    const preferred = uniqueElements(
      CONFIG.preferredMessageSelectors.flatMap((selector) => [...document.querySelectorAll(selector)])
    ).filter((element) => !isUnsafeCandidate(element));

    if (preferred.length > 0) {
      return preferred;
    }

    return uniqueElements(
      CONFIG.fallbackMessageSelectors.flatMap((selector) => [...document.querySelectorAll(selector)])
    )
      .map((element) => element.closest("article") || element)
      .filter((element) => !isUnsafeCandidate(element));
  }

  function shouldKeepByViewport(element) {
    const rect = element.getBoundingClientRect();
    const keepTop = window.innerHeight - window.innerHeight * CONFIG.keepScreenfuls;
    return rect.bottom >= keepTop;
  }

  function updateControl() {
    if (state.countText) {
      state.countText.textContent = String(state.removedCount);
    }
  }

  function sweep() {
    const candidates = getMessageCandidates().filter(isVisibleElement);
    if (candidates.length <= CONFIG.maxMessagesToKeep + CONFIG.minMessagesBeforePrune) {
      updateControl();
      return;
    }

    const keepByIndexStart = Math.max(0, candidates.length - CONFIG.maxMessagesToKeep);
    const toPrune = candidates.filter((element, index) => {
      if (index >= keepByIndexStart) {
        return false;
      }
      return !shouldKeepByViewport(element);
    });

    for (const element of toPrune) {
      if (!element.parentNode || isUnsafeCandidate(element)) {
        continue;
      }
      element.remove();
      state.removedCount += 1;
    }

    updateControl();
  }

  function makeButton(label, title) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.style.cssText = [
      "border:1px solid rgba(255,255,255,.25)",
      "border-radius:7px",
      "padding:3px 7px",
      "background:rgba(255,255,255,.12)",
      "color:inherit",
      "cursor:pointer",
      "font:inherit"
    ].join(";");
    return button;
  }

  function installControl() {
    const control = document.createElement("div");
    control.id = CONFIG.controlId;
    control.style.cssText = [
      "position:fixed",
      "right:10px",
      "bottom:10px",
      "z-index:2147483647",
      "display:flex",
      "align-items:center",
      "gap:6px",
      "padding:6px 8px",
      "border:1px solid rgba(255,255,255,.22)",
      "border-radius:10px",
      "box-shadow:0 6px 20px rgba(0,0,0,.25)",
      "background:rgba(24,24,27,.9)",
      "color:#f4f4f5",
      "font:12px/1.25 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    ].join(";");

    const countWrap = document.createElement("span");
    const countText = document.createElement("strong");
    countWrap.append("#: ", countText);

    const sweepButton = makeButton("✂", "Prune older rendered ChatGPT messages now.");
    sweepButton.addEventListener("click", sweep);

    const reloadButton = makeButton("↻", "Reload normally to restore the real ChatGPT page DOM.");
    reloadButton.addEventListener("click", () => window.location.reload());

    const closeButton = makeButton("×", "Remove this tiny control.");
    closeButton.addEventListener("click", () => {
      control.remove();
      delete window.__cgptPrunerBookmarkletState;
    });

    control.append(countWrap, sweepButton, reloadButton, closeButton);
    document.documentElement.appendChild(control);

    state.control = control;
    state.countText = countText;
    updateControl();
  }

  state.sweep = sweep;
  window.__cgptPrunerBookmarkletState = state;
  installControl();
  sweep();
})();
