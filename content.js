(() => {
  "use strict";

  /**
   * ChatGPT Browser Pruner
   *
   * Safety model / non-goals:
   * - This content script only removes already-rendered DOM elements from the live
   *   document. It does not read or preserve transcript data, call APIs, intercept
   *   network requests, touch React internals, or write to IndexedDB/localStorage.
   * - Reloading the page is the only supported way to restore pruned messages.
   * - ChatGPT's DOM changes often. The selector constants below are intentionally
   *   centralized so the conservative candidate-finding logic is easy to update.
   * - The likely breakage point is message-container detection. When in doubt, this
   *   script should prune too little rather than risk deleting controls, composer UI,
   *   sidebars, modals, or navigation.
   */

  const CONFIG = {
    enabledByDefault: true,
    maxMessagesToKeep: 30,
    pruneThrottleMs: 750,
    bannerId: "cgpt-pruner-banner",

    /** Prefer stable, semantic containers first. */
    preferredMessageSelectors: [
      'main [data-testid^="conversation-turn-"]',
      'main [data-testid*="conversation-turn"]',
      'main article[data-testid^="conversation-turn-"]',
      "main article"
    ],

    /** Fallback selectors are intentionally narrow and easy to edit. */
    fallbackMessageSelectors: [
      'main [data-message-author-role]',
      'main [data-message-id]'
    ],

    /** Never prune anything inside these areas. */
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

  const state = {
    enabled: CONFIG.enabledByDefault,
    removedCount: 0,
    pruneTimer: 0,
    observer: null,
    banner: null,
    statusText: null,
    countText: null,
    toggleButton: null,
    pruneButton: null
  };

  function uniqueElements(elements) {
    return [...new Set(elements)].filter((element) => element instanceof HTMLElement);
  }

  function isUnsafeCandidate(element) {
    if (!element.isConnected || element.id === CONFIG.bannerId) {
      return true;
    }

    // Avoid deleting ChatGPT app chrome, controls, composer/input areas, and modal UI.
    if (element.closest(CONFIG.unsafeAncestorSelectors.join(","))) {
      return true;
    }

    const main = element.closest("main");
    if (!main) {
      return true;
    }

    // Very small nodes are more likely to be separators, buttons, or implementation
    // details than full message containers.
    const rect = element.getBoundingClientRect();
    return rect.height < 24;
  }

  function getTopLevelCandidates(elements) {
    const candidates = uniqueElements(
      uniqueElements(elements).map(
        (element) => element.closest('[data-testid^="conversation-turn-"]') || element.closest("article") || element
      )
    )
      .filter((element) => !isUnsafeCandidate(element))
      .sort((first, second) => {
        const position = first.compareDocumentPosition(second);
        return position & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1;
      });

    return candidates.filter((element, index, allCandidates) => {
      return !allCandidates.some((other, otherIndex) => {
        return otherIndex !== index && other.contains(element);
      });
    });
  }

  function getMessageCandidates() {
    const preferred = getTopLevelCandidates(
      CONFIG.preferredMessageSelectors.flatMap((selector) => [...document.querySelectorAll(selector)])
    );

    if (preferred.length > 0) {
      return preferred;
    }

    return getTopLevelCandidates(
      CONFIG.fallbackMessageSelectors.flatMap((selector) => [...document.querySelectorAll(selector)])
    );
  }

  function pruneNow() {
    state.pruneTimer = 0;
    if (!state.enabled) {
      updateBanner();
      return;
    }

    const candidates = getMessageCandidates();

    if (!candidates.length) {
      updateBanner();
      return;
    }

    const keepByIndexStart = Math.max(0, candidates.length - CONFIG.maxMessagesToKeep);
    const toPrune = candidates.filter((element, index) => index < keepByIndexStart);

    for (const element of toPrune) {
      if (!element.parentNode || isUnsafeCandidate(element)) {
        continue;
      }

      element.remove();
      state.removedCount += 1;
    }

    updateBanner();
  }

  function schedulePrune() {
    if (state.pruneTimer) {
      return;
    }
    state.pruneTimer = window.setTimeout(pruneNow, CONFIG.pruneThrottleMs);
  }

  function updateBanner() {
    if (!state.banner) {
      return;
    }

    state.statusText.textContent = state.enabled ? "enabled" : "paused";
    state.statusText.style.color = state.enabled ? "#56d364" : "#ffb86b";
    state.countText.textContent = String(state.removedCount);
    state.toggleButton.textContent = state.enabled ? "Pause" : "Resume";
    state.toggleButton.setAttribute("aria-pressed", String(!state.enabled));
  }

  function makeButton(label) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.cssText = [
      "border:1px solid rgba(255,255,255,.25)",
      "border-radius:999px",
      "padding:2px 6px",
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
      "right:12px",
      "top:12px",
      "z-index:2147483647",
      "display:flex",
      "align-items:center",
      "gap:5px",
      "padding:5px 7px",
      "border:1px solid rgba(255,255,255,.22)",
      "border-radius:999px",
      "box-shadow:0 4px 16px rgba(0,0,0,.22)",
      "background:rgba(24,24,27,.92)",
      "color:#f4f4f5",
      "font:11px/1.2 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "backdrop-filter:blur(8px)"
    ].join(";");

    const label = document.createElement("span");
    label.textContent = "Pruner ";

    const statusText = document.createElement("strong");
    const countWrap = document.createElement("span");
    const countText = document.createElement("strong");
    countWrap.append(" · ", countText);

    const toggleButton = makeButton("Pause");
    toggleButton.addEventListener("click", () => {
      state.enabled = !state.enabled;
      updateBanner();
      if (state.enabled) {
        schedulePrune();
      }
    });

    const pruneButton = makeButton("Prune");
    pruneButton.addEventListener("click", pruneNow);

    banner.append(label, statusText, countWrap, toggleButton, pruneButton);
    document.documentElement.appendChild(banner);

    state.banner = banner;
    state.statusText = statusText;
    state.countText = countText;
    state.toggleButton = toggleButton;
    state.pruneButton = pruneButton;
    updateBanner();
  }

  function installObserver() {
    state.observer = new MutationObserver((mutations) => {
      // Ignore mutations caused by our own banner updates where possible.
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
