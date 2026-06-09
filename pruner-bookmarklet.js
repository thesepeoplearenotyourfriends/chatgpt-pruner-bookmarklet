(() => {
  "use strict";

  /**
   * ChatGPT Browser Pruner bookmarklet edition.
   *
   * Local-only DOM pruning for very long ChatGPT conversations. It removes
   * already-rendered page elements only; it does not save transcripts, call APIs,
   * intercept requests, touch React internals, or write browser/app storage.
   */

  const CONFIG = {
    enabledByDefault: true,
    maxMessagesToKeep: 12,
    keepScreenfuls: 1,
    minMessagesBeforePrune: 2,
    pruneThrottleMs: 750,
    usePlaceholders: true,
    placeholderClass: "cgpt-pruner-placeholder",
    bannerId: "cgpt-pruner-bookmarklet-banner",
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
  if (!allowedHosts.has(window.location.hostname)) {
    return;
  }

  const existingState = window.__cgptPrunerBookmarkletState;
  if (existingState && existingState.banner && existingState.banner.isConnected) {
    if (typeof existingState.pruneNow === "function") {
      existingState.pruneNow();
    } else if (typeof existingState.schedulePrune === "function") {
      existingState.schedulePrune();
    }
    return;
  }

  const state = {
    enabled: CONFIG.enabledByDefault,
    removedCount: 0,
    lastFound: 0,
    lastCut: 0,
    pruneTimer: 0,
    observer: null,
    banner: null,
    statusText: null,
    countText: null,
    toggleButton: null,
    pruneNow: null,
    schedulePrune: null
  };

  function uniqueElements(elements) {
    return [...new Set(elements)].filter((element) => element instanceof HTMLElement);
  }

  function isVisibleElement(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isUnsafeCandidate(element) {
    if (!element.isConnected || element.id === CONFIG.bannerId) {
      return true;
    }

    if (element.classList.contains(CONFIG.placeholderClass)) {
      return true;
    }

    if (element.closest(`#${CONFIG.bannerId}`)) {
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

  function createPlaceholderFor(element) {
    const rect = element.getBoundingClientRect();
    const placeholder = document.createElement("div");
    placeholder.className = CONFIG.placeholderClass;
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.textContent = "Older ChatGPT message pruned locally. Reload the page to restore it.";
    placeholder.style.cssText = [
      "box-sizing:border-box",
      `min-height:${Math.max(40, Math.round(rect.height))}px`,
      "margin:8px auto",
      "max-width:min(760px, calc(100% - 32px))",
      "padding:10px 12px",
      "border:1px dashed rgba(127,127,127,.35)",
      "border-radius:10px",
      "color:#777",
      "font:12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "background:rgba(127,127,127,.07)"
    ].join(";");
    return placeholder;
  }

  function shouldKeepByViewport(element) {
    const rect = element.getBoundingClientRect();
    const keepTop = window.innerHeight - window.innerHeight * CONFIG.keepScreenfuls;
    return rect.bottom >= keepTop;
  }

  function updateBanner() {
    if (!state.banner) {
      return;
    }

    state.statusText.textContent = state.enabled ? "on" : "paused";
    state.statusText.style.color = state.enabled ? "#56d364" : "#ffb86b";
    state.countText.textContent = `${state.removedCount} f:${state.lastFound} c:${state.lastCut}`;
    state.toggleButton.textContent = state.enabled ? "⏸" : "▶";
    state.toggleButton.setAttribute("aria-pressed", String(!state.enabled));
  }

  function pruneNow() {
    state.pruneTimer = 0;
    if (!state.enabled) {
      updateBanner();
      return;
    }

    const candidates = getMessageCandidates().filter(isVisibleElement);
    state.lastFound = candidates.length;
    state.lastCut = 0;

    if (candidates.length <= CONFIG.maxMessagesToKeep + CONFIG.minMessagesBeforePrune) {
      updateBanner();
      return;
    }

    const keepByIndexStart = Math.max(0, candidates.length - CONFIG.maxMessagesToKeep);
    const toPrune = candidates.filter((element, index) => {
      if (index >= keepByIndexStart) {
        return false;
      }
      return !shouldKeepByViewport(element);
    });

    let cutCount = 0;
    for (const element of toPrune) {
      if (!element.parentNode || isUnsafeCandidate(element)) {
        continue;
      }

      if (CONFIG.usePlaceholders) {
        element.replaceWith(createPlaceholderFor(element));
      } else {
        element.remove();
      }
      cutCount += 1;
      state.removedCount += 1;
    }
    state.lastCut = cutCount;

    updateBanner();
  }

  function schedulePrune() {
    if (state.pruneTimer) {
      return;
    }
    state.pruneTimer = window.setTimeout(pruneNow, CONFIG.pruneThrottleMs);
  }

  function makeButton(label) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.cssText = [
      "border:1px solid rgba(255,255,255,.25)",
      "border-radius:7px",
      "padding:4px 8px",
      "background:rgba(255,255,255,.12)",
      "color:inherit",
      "cursor:pointer",
      "font:inherit"
    ].join(";");
    return button;
  }

  function installBanner() {
    if (document.getElementById(CONFIG.bannerId)) {
      return;
    }

    const banner = document.createElement("div");
    banner.id = CONFIG.bannerId;
    banner.style.cssText = [
      "position:fixed",
      "left:calc(env(safe-area-inset-left, 0px) + 64px)",
      "top:calc(env(safe-area-inset-top, 0px) + 12px)",
      "z-index:2147483647",
      "display:flex",
      "align-items:center",
      "gap:8px",
      "padding:8px 10px",
      "border:1px solid rgba(255,255,255,.22)",
      "border-radius:12px",
      "box-shadow:0 8px 28px rgba(0,0,0,.28)",
      "background:rgba(24,24,27,.92)",
      "color:#f4f4f5",
      "font:12px/1.25 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "backdrop-filter:blur(8px)"
    ].join(";");

    const label = document.createElement("span");
    label.textContent = "prune";

    const statusText = document.createElement("strong");
    const countWrap = document.createElement("span");
    const countText = document.createElement("strong");
    countWrap.append(" ", countText);

    const toggleButton = makeButton("⏸");
    toggleButton.addEventListener("click", () => {
      state.enabled = !state.enabled;
      updateBanner();
      if (state.enabled) {
        schedulePrune();
      }
    });

    const reloadButton = makeButton("↻");
    reloadButton.title = "Reload normally to restore the real ChatGPT page DOM.";
    reloadButton.addEventListener("click", () => window.location.reload());

    banner.append(label, statusText, countWrap, toggleButton, reloadButton);
    document.documentElement.appendChild(banner);

    state.banner = banner;
    state.statusText = statusText;
    state.countText = countText;
    state.toggleButton = toggleButton;
    updateBanner();
  }

  function installObserver() {
    state.observer = new MutationObserver((mutations) => {
      if (mutations.every((mutation) => mutation.target instanceof Element && mutation.target.closest(`#${CONFIG.bannerId}`))) {
        return;
      }
      schedulePrune();
    });

    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    window.addEventListener("scroll", schedulePrune, { passive: true });
    window.addEventListener("resize", schedulePrune, { passive: true });
  }

  function init() {
    state.pruneNow = pruneNow;
    state.schedulePrune = schedulePrune;
    window.__cgptPrunerBookmarkletState = state;
    installBanner();
    installObserver();
    schedulePrune();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
