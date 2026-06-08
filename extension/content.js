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
    maxMessagesToKeep: 24,
    keepScreenfuls: 3,
    minMessagesBeforePrune: 10,
    pruneThrottleMs: 750,
    usePlaceholders: true,
    placeholderClass: "cgpt-pruner-placeholder",
    bannerId: "cgpt-pruner-banner",

    /** Prefer stable, semantic containers first. */
    preferredMessageSelectors: ["main article"],

    /** Fallback selectors are intentionally narrow and easy to edit. */
    fallbackMessageSelectors: [
      'main [data-testid^="conversation-turn-"]',
      'main [data-message-author-role]'
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
    toggleButton: null
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
    const viewportBottom = window.innerHeight;
    const keepTop = viewportBottom - window.innerHeight * CONFIG.keepScreenfuls;

    // Keep anything near or below the visible working area. The bottom tolerance
    // also protects messages currently just below the viewport during scrolling.
    return rect.bottom >= keepTop;
  }

  function pruneNow() {
    state.pruneTimer = 0;
    if (!state.enabled) {
      updateBanner();
      return;
    }

    const candidates = getMessageCandidates().filter(isVisibleElement);
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

    for (const element of toPrune) {
      if (!element.parentNode || isUnsafeCandidate(element)) {
        continue;
      }

      if (CONFIG.usePlaceholders) {
        element.replaceWith(createPlaceholderFor(element));
      } else {
        element.remove();
      }
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

    state.statusText.textContent = state.enabled ? "" : "";
    state.statusText.style.color = state.enabled ? "#56d364" : "#ffb86b";
    state.countText.textContent = String(state.removedCount);
    state.toggleButton.textContent = state.enabled ? "⏸" : "▶";
    state.toggleButton.setAttribute("aria-pressed", String(!state.enabled));
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
      "right:12px",
      "bottom:12px",
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
    label.textContent = "";

    const statusText = document.createElement("strong");
    const countWrap = document.createElement("span");
    const countText = document.createElement("strong");
    countWrap.append(" #: ", countText);

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
      // Ignore mutations caused by our own banner updates/placeholders where possible.
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
