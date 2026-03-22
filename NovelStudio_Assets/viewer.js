let chatData = [];
let scrollObserver = null;
let currentThemes = {};
let activeTheme = "default";
let activeMode = "light";
let currentParsedQuery = { fuseQuery: "", words: [] };
let currentSearchResults = {};
let isMatchFilterActive = false;
let isSidebarFilterActive = false;
let isAllTreesExpanded = false;
let isSmallText = false;
let detailLoadPromises = {};
let appBridge = null;
let bridgeReady = false;
let currentTreeConvIdx = null;
let sidebarFocusKey = null;
let sidebarKeyboardBound = false;
let isSidebarHidden = false;
let promptNavigatorState = null;
let currentPromptMessageIndex = null;
let viewerScrollTicking = false;
let pendingPromptMessageIndex = null;
let pendingPromptLockUntil = 0;
let currentPromptBaselineScrollTop = 0;
let isCommandKeyHeld = false;

const ROOT_DOCK_FADE_DISTANCE = 220;
const ROOT_DOCK_MIN_OPACITY = 0.16;
const ROOT_DOCK_SWITCH_HYSTERESIS = 18;
const PROMPT_NAV_LOCK_MS = 520;
const ROOT_DOCK_FADE_SCROLL_START = 18;
const ANSWER_FADE_START = 24;
const ANSWER_FADE_RANGE = 88;

const STORAGE_KEYS = {
    theme: "novel-archive-theme",
    mode: "novel-archive-mode",
    textSizeSmall: "novel-archive-textsize-small",
    searchQuery: "novel-archive-search-query",
    searchTitle: "novel-archive-search-title",
    searchPrompt: "novel-archive-search-prompt",
    searchAnswer: "novel-archive-search-answer",
    legacyExcludeTitle: "novel-archive-exclude-title",
    legacyExcludePrompt: "novel-archive-exclude-prompt",
    legacyExcludeAnswer: "novel-archive-exclude-answer",
    sidebarFilter: "novel-archive-sidebar-filter",
    treeExpand: "novel-archive-tree-expand",
    matchFilter: "novel-archive-match-filter",
    sortMode: "novel-archive-sort-mode",
    sidebarHidden: "novel-archive-sidebar-hidden",
};

function escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(/[&<>'"]/g, function (match) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;",
        }[match];
    });
}

function escapeJsString(str) {
    return String(str || "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\n/g, "\\n");
}

function createHtmlPlaceholderStore() {
    const values = [];
    return {
        put(html) {
            const token = `@@HTML_PLACEHOLDER_${values.length}@@`;
            values.push(html);
            return token;
        },
        restore(text) {
            return text.replace(/@@HTML_PLACEHOLDER_(\d+)@@/g, (_match, index) => values[Number(index)] || "");
        },
    };
}

function renderMathFragment(source) {
    let html = escapeHTML(String(source || "").trim());
    const replacements = [
        ["\\cdot", "&middot;"],
        ["\\times", "&times;"],
        ["\\div", "&divide;"],
        ["\\pm", "&plusmn;"],
        ["\\mp", "∓"],
        ["\\approx", "≈"],
        ["\\neq", "≠"],
        ["\\ne", "≠"],
        ["\\leq", "≤"],
        ["\\geq", "≥"],
        ["\\le", "≤"],
        ["\\ge", "≥"],
        ["\\to", "→"],
        ["\\rightarrow", "→"],
        ["\\leftarrow", "←"],
        ["\\Rightarrow", "⇒"],
        ["\\Leftarrow", "⇐"],
        ["\\infty", "∞"],
        ["\\partial", "∂"],
        ["\\nabla", "∇"],
        ["\\sum", "∑"],
        ["\\prod", "∏"],
        ["\\int", "∫"],
        ["\\forall", "∀"],
        ["\\exists", "∃"],
        ["\\in", "∈"],
        ["\\notin", "∉"],
        ["\\subseteq", "⊆"],
        ["\\supseteq", "⊇"],
        ["\\subset", "⊂"],
        ["\\supset", "⊃"],
        ["\\cup", "∪"],
        ["\\cap", "∩"],
        ["\\land", "∧"],
        ["\\lor", "∨"],
        ["\\alpha", "α"],
        ["\\beta", "β"],
        ["\\gamma", "γ"],
        ["\\delta", "δ"],
        ["\\epsilon", "ϵ"],
        ["\\theta", "θ"],
        ["\\lambda", "λ"],
        ["\\mu", "μ"],
        ["\\pi", "π"],
        ["\\sigma", "σ"],
        ["\\phi", "φ"],
        ["\\omega", "ω"],
        ["\\Delta", "Δ"],
        ["\\Theta", "Θ"],
        ["\\Lambda", "Λ"],
        ["\\Pi", "Π"],
        ["\\Sigma", "Σ"],
        ["\\Phi", "Φ"],
        ["\\Omega", "Ω"],
        ["\\left", ""],
        ["\\right", ""],
        ["\\,", "&thinsp;"],
        ["\\;", "&nbsp;"],
        ["\\!", ""],
    ];

    replacements.forEach(([pattern, replacement]) => {
        html = html.split(pattern).join(replacement);
    });

    let previous = "";
    while (html !== previous) {
        previous = html;
        html = html.replace(/\\text\{([^{}]+)\}/g, (_match, inner) => `<span class="math-text">${inner}</span>`);
        html = html.replace(/\\sqrt\{([^{}]+)\}/g, (_match, inner) => (
            `<span class="math-sqrt"><span class="math-sqrt-sign">√</span><span class="math-sqrt-body">${renderMathFragment(inner)}</span></span>`
        ));
        html = html.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_match, numerator, denominator) => (
            `<span class="math-frac"><span class="math-frac-num">${renderMathFragment(numerator)}</span><span class="math-frac-den">${renderMathFragment(denominator)}</span></span>`
        ));
        html = html.replace(/\^\{([^{}]+)\}/g, (_match, inner) => `<sup>${renderMathFragment(inner)}</sup>`);
        html = html.replace(/_\{([^{}]+)\}/g, (_match, inner) => `<sub>${renderMathFragment(inner)}</sub>`);
    }

    html = html.replace(/\^([A-Za-z0-9+\-*/=().]+)/g, "<sup>$1</sup>");
    html = html.replace(/_([A-Za-z0-9+\-*/=().]+)/g, "<sub>$1</sub>");
    html = html.replace(/[{}]/g, "");
    return html;
}

function renderMathBlock(source, displayMode = false) {
    const tag = displayMode ? "div" : "span";
    const className = displayMode ? "math-display" : "math-inline";
    return `<${tag} class="${className}"><span class="math-content">${renderMathFragment(source)}</span></${tag}>`;
}

function ensureRenderer() {
    return;
}

function initBridge() {
    if (bridgeReady) return;
    bridgeReady = true;
    if (window.qt && window.qt.webChannelTransport && window.QWebChannel) {
        new QWebChannel(window.qt.webChannelTransport, function (channel) {
            appBridge = channel.objects.bridge || null;
        });
    }
}

function waitForBridge(timeoutMs = 1500) {
    if (appBridge) {
        return Promise.resolve(appBridge);
    }
    return new Promise((resolve) => {
        const startedAt = Date.now();
        const timer = window.setInterval(() => {
            if (appBridge || Date.now() - startedAt >= timeoutMs) {
                window.clearInterval(timer);
                resolve(appBridge);
            }
        }, 50);
    });
}

function hydrateConversation(conv, idx) {
    const messages = Array.isArray(conv.messages) ? conv.messages : [];
    const promptPreviews = Array.isArray(conv.promptPreviews) ? conv.promptPreviews : [];
    const prompts = messages.filter((msg) => msg.role === "user").map((msg) => msg.text || "");
    const answers = messages.filter((msg) => msg.role !== "user").map((msg) => msg.text || "");
    return {
        ...conv,
        _idx: idx,
        _hits: 0,
        messages,
        title: conv.title || "Untitled",
        date: conv.date || "",
        promptCount: typeof conv.promptCount === "number" ? conv.promptCount : prompts.length,
        promptPreviews,
        prompts_text: conv.prompts_text || prompts.join("\n\n"),
        answers_text: conv.answers_text || answers.join("\n\n"),
    };
}

function mergeConversationDetail(convIdx, detail) {
    const hydrated = hydrateConversation(detail, convIdx);
    const current = chatData[convIdx];
    chatData[convIdx] = {
        ...current,
        ...hydrated,
        _idx: convIdx,
        promptPreviews: hydrated.promptPreviews.length > 0 ? hydrated.promptPreviews : current.promptPreviews,
    };
}

function loadConversationDetail(convIdx) {
    const conv = chatData[convIdx];
    if (!conv) {
        return Promise.reject(new Error("Conversation not found"));
    }
    if (Array.isArray(conv.messages) && conv.messages.length > 0) {
        return Promise.resolve(conv);
    }
    if (window.__CHAT_DETAILS__ && window.__CHAT_DETAILS__[conv.id]) {
        mergeConversationDetail(convIdx, window.__CHAT_DETAILS__[conv.id]);
        return Promise.resolve(chatData[convIdx]);
    }
    if (detailLoadPromises[conv.id]) {
        return detailLoadPromises[conv.id];
    }

    detailLoadPromises[conv.id] = waitForBridge().then((bridge) => {
        if (!bridge || !bridge.fetchConversation) {
            throw new Error("Bridge is not ready");
        }
        return new Promise((resolve, reject) => {
            bridge.fetchConversation(conv.id, function (result) {
                if (!result) {
                    reject(new Error(`Detail not found: ${conv.id}`));
                    return;
                }
                try {
                    const detail = JSON.parse(result);
                    window.__CHAT_DETAILS__[conv.id] = detail;
                    mergeConversationDetail(convIdx, detail);
                    resolve(chatData[convIdx]);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }).finally(() => {
        delete detailLoadPromises[conv.id];
    });

    return detailLoadPromises[conv.id];
}

function buildPromptPreviews(conv) {
    if (Array.isArray(conv.messages) && conv.messages.length > 0) {
        return conv.messages
            .map((message, index) => ({ message, index }))
            .filter((item) => item.message.role === "user")
            .map((item) => ({
                messageIndex: item.index,
                preview: (item.message.text || "").split("\n")[0].slice(0, 24),
            }));
    }
    return Array.isArray(conv.promptPreviews) ? conv.promptPreviews : [];
}

function getCurrentConversationIndex() {
    const currentConv = document.getElementById("chat-viewer")?.dataset?.currentConv;
    if (currentConv === "" || currentConv === undefined) return null;
    const parsed = Number.parseInt(currentConv, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function shouldToggleUserTurn(event) {
    if (!event || !event.target) return true;
    return !event.target.closest(".conversation-root-column, a, button, .prompt-nav-popover");
}

function getPromptNavigatorItems(convIdx) {
    const conv = chatData[convIdx];
    if (!conv) return [];
    return buildPromptPreviews(conv);
}

function getCurrentPromptSnapshot(convIdx) {
    const conv = chatData[convIdx];
    if (!conv) return null;
    const items = getPromptNavigatorItems(convIdx);
    if (items.length === 0) return null;

    const currentIndex = getCurrentPromptIndex(convIdx);
    const targetItem = items[Math.max(0, currentIndex)];
    const message = Array.isArray(conv.messages) ? conv.messages[targetItem.messageIndex] : null;
    return {
        messageIndex: targetItem.messageIndex,
        text: message && message.role === "user" ? (message.text || "") : (targetItem.preview || ""),
    };
}

function buildConversationRootDockContent(convIdx, snapshot) {
    if (!snapshot) return "";
    const conv = chatData[convIdx];
    const currentPromptOrder = Math.max(1, getCurrentPromptIndex(convIdx) + 1);
    const totalPromptCount =
        conv && typeof conv.promptCount === "number"
            ? conv.promptCount
            : getPromptNavigatorItems(convIdx).length;
    const pageLabel =
        totalPromptCount > 0 ? `${currentPromptOrder}/${totalPromptCount}` : "";

    return `
        <span class="conversation-root-prompt-body">${renderContent(snapshot.text)}</span>
        ${pageLabel ? `<span class="conversation-root-prompt-page">${pageLabel}</span>` : ""}`;
}

function getPromptDockDensity(text) {
    const length = String(text || "").trim().length;
    if (length >= 72) return "xsmall";
    if (length >= 54) return "small";
    if (length >= 38) return "compact";
    return "normal";
}

function refreshConversationRootDock() {
    const convIdx = getCurrentConversationIndex();
    if (convIdx === null) return;
    const snapshot = getCurrentPromptSnapshot(convIdx);
    const promptButton = document.getElementById("conversation-root-prompt");
    if (!promptButton || !snapshot) return;
    promptButton.dataset.msgIdx = String(snapshot.messageIndex);
    promptButton.dataset.promptDensity = getPromptDockDensity(snapshot.text);
    promptButton.innerHTML = buildConversationRootDockContent(convIdx, snapshot);
}

function syncActivePromptNavItem(targetId) {
    document.querySelectorAll(".prompt-item.active").forEach((el) => el.classList.remove("active"));
    if (!targetId) return;
    const navItem = document.getElementById(`nav-${targetId}`);
    if (navItem) {
        navItem.classList.add("active");
        navItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

function setCurrentPromptFromAnchor(anchorElement) {
    if (!anchorElement) return;
    const viewer = document.getElementById("chat-viewer");
    const parts = String(anchorElement.id || "").split("-");
    const messageIdx = Number.parseInt(parts[parts.length - 1] || "", 10);
    if (Number.isNaN(messageIdx)) return;

    if (currentPromptMessageIndex === messageIdx) {
        return;
    }

    currentPromptMessageIndex = messageIdx;
    currentPromptBaselineScrollTop = viewer ? viewer.scrollTop : 0;
    if (promptNavigatorState) {
        promptNavigatorState.focusIndex = getCurrentPromptIndex(promptNavigatorState.convIdx);
        syncPromptNavigatorPopover(false);
    }
    refreshConversationRootDock();
    syncActivePromptNavItem(anchorElement.id);
}

function updateConversationRootDockByScroll() {
    const viewer = document.getElementById("chat-viewer");
    const promptButton = document.getElementById("conversation-root-prompt");
    if (!viewer || !promptButton) return;

    const anchors = Array.from(viewer.querySelectorAll(".chat-row.user.user-turn-anchor"));
    if (anchors.length === 0) {
        promptButton.style.setProperty("--prompt-fade", "1");
        return;
    }

    const header = viewer.querySelector(".chat-header-area");
    const boundaryY = (header ? header.getBoundingClientRect().bottom : viewer.getBoundingClientRect().top) + 6;

    let activeIndex = anchors.findIndex((anchor) => {
        const parts = String(anchor.id || "").split("-");
        const messageIdx = Number.parseInt(parts[parts.length - 1] || "", 10);
        return messageIdx === currentPromptMessageIndex;
    });

    const pendingLockActive = pendingPromptMessageIndex !== null && Date.now() < pendingPromptLockUntil;
    if (pendingLockActive) {
        const pendingIndex = anchors.findIndex((anchor) => {
            const parts = String(anchor.id || "").split("-");
            const messageIdx = Number.parseInt(parts[parts.length - 1] || "", 10);
            return messageIdx === pendingPromptMessageIndex;
        });
        if (pendingIndex >= 0) {
            activeIndex = pendingIndex;
        }
    }

    if (activeIndex < 0) {
        activeIndex = 0;
        anchors.forEach((anchor, index) => {
            if (anchor.getBoundingClientRect().top <= boundaryY) {
                activeIndex = index;
            }
        });
    }

    if (!pendingLockActive) {
        while (activeIndex < anchors.length - 1) {
            const nextAnchorTop = anchors[activeIndex + 1].getBoundingClientRect().top;
            if (nextAnchorTop <= boundaryY - ROOT_DOCK_SWITCH_HYSTERESIS) {
                activeIndex += 1;
            } else {
                break;
            }
        }

        while (activeIndex > 0) {
            const currentAnchorTop = anchors[activeIndex].getBoundingClientRect().top;
            if (currentAnchorTop > boundaryY + ROOT_DOCK_SWITCH_HYSTERESIS) {
                activeIndex -= 1;
            } else {
                break;
            }
        }
    }

    const activeAnchor = anchors[activeIndex];

    setCurrentPromptFromAnchor(activeAnchor);

    let fade = 1;
    const scrollDelta = Math.max(0, viewer.scrollTop - currentPromptBaselineScrollTop);
    const shouldFadeFromScroll = scrollDelta > ROOT_DOCK_FADE_SCROLL_START;
    const nextAnchor = anchors[activeIndex + 1];
    if (shouldFadeFromScroll && nextAnchor) {
        const distance = nextAnchor.getBoundingClientRect().top - boundaryY;
        const normalized = Math.max(0, Math.min(1, distance / ROOT_DOCK_FADE_DISTANCE));
        fade = ROOT_DOCK_MIN_OPACITY + (1 - ROOT_DOCK_MIN_OPACITY) * normalized;
    }

    promptButton.style.setProperty("--prompt-fade", fade.toFixed(3));
    const textOpacity = 0.48 + fade * 0.52;
    promptButton.style.setProperty("--prompt-text-opacity", textOpacity.toFixed(3));
    promptButton.classList.toggle("is-near-switch", fade < 0.98);

    document.querySelectorAll(".chat-turn").forEach((turn) => {
        turn.style.setProperty("--turn-text-opacity", "1");
        turn.classList.remove("is-fading-turn");
    });

    const activeTurn = activeAnchor.closest(".chat-turn");
    if (activeTurn) {
        const turnTop = activeTurn.getBoundingClientRect().top;
        const distancePastBoundary = boundaryY - turnTop;
        if (distancePastBoundary > ANSWER_FADE_START) {
            const normalized = Math.max(
                0,
                Math.min(1, (distancePastBoundary - ANSWER_FADE_START) / ANSWER_FADE_RANGE)
            );
            const turnTextOpacity = 1 - normalized * 0.72;
            activeTurn.style.setProperty("--turn-text-opacity", turnTextOpacity.toFixed(3));
            activeTurn.classList.add("is-fading-turn");
        }
    }
}

function scheduleConversationRootDockUpdate() {
    if (viewerScrollTicking) return;
    viewerScrollTicking = true;
    window.requestAnimationFrame(() => {
        viewerScrollTicking = false;
        updateConversationRootDockByScroll();
    });
}

function setCommandNavActive(active) {
    document.body.classList.toggle("command-nav-active", Boolean(active) && isSidebarHidden);
}

function setNativeCommandKeyHeld(active) {
    isCommandKeyHeld = Boolean(active);
    setCommandNavActive(isCommandKeyHeld);
}

function getCurrentPromptIndex(convIdx) {
    const items = getPromptNavigatorItems(convIdx);
    if (items.length === 0) return -1;
    const lockedMessageIndex =
        pendingPromptMessageIndex !== null && Date.now() < pendingPromptLockUntil
            ? pendingPromptMessageIndex
            : currentPromptMessageIndex;
    const foundIndex = items.findIndex((item) => item.messageIndex === lockedMessageIndex);
    return foundIndex >= 0 ? foundIndex : 0;
}

function closePromptNavigator(restoreFocus = false) {
    promptNavigatorState = null;
    if (restoreFocus) {
        const anchor = document.querySelector(".conversation-root-trigger");
        if (anchor) {
            anchor.focus({ preventScroll: true });
        }
    }
}

function syncPromptNavigatorPopover(shouldFocusItem = false) {
    void shouldFocusItem;
}

function openPromptNavigator(convIdx, preferredIndex = null, shouldFocusItem = false) {
    void preferredIndex;
    void shouldFocusItem;
    if (isSidebarHidden) {
        toggleSidebarVisibility(false);
        openSidebarAtCurrentPrompt();
    }
}

function togglePromptNavigator(event, convIdx) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (isSidebarHidden) {
        toggleSidebarVisibility(false);
        openSidebarAtCurrentPrompt();
        return;
    }

    const snapshot = getCurrentPromptSnapshot(convIdx);
    if (snapshot) {
        jumpToMessage(convIdx, snapshot.messageIndex);
    }
}

function focusPromptNavigatorItem(index) {
    void index;
}

function handlePromptNavigatorAnchorKeydown(event, convIdx) {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        togglePromptNavigator(event, convIdx);
    }
}

function handlePromptNavigatorItemKeydown(event) {
    void event;
}

function selectPromptNavigatorItem(convIdx, msgIdx) {
    jumpToMessage(convIdx, msgIdx);
}

function navigateCurrentPrompt(delta) {
    const convIdx = getCurrentConversationIndex();
    if (convIdx === null) return false;
    const items = getPromptNavigatorItems(convIdx);
    if (items.length === 0) return false;

    const currentIndex = getCurrentPromptIndex(convIdx);
    const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + delta));
    const nextMessageIndex = items[nextIndex].messageIndex;

    if (nextMessageIndex === currentPromptMessageIndex) {
        return false;
    }

    currentPromptMessageIndex = nextMessageIndex;
    pendingPromptMessageIndex = nextMessageIndex;
    pendingPromptLockUntil = Date.now() + PROMPT_NAV_LOCK_MS;

    if (!isSidebarHidden) {
        currentTreeConvIdx = convIdx;
        sidebarFocusKey = `prompt-${convIdx}-${nextMessageIndex}`;
        renderTree();
        window.requestAnimationFrame(() => {
            focusSidebarItemByKey(sidebarFocusKey);
        });
    }

    jumpToMessage(convIdx, nextMessageIndex, "auto");
    return true;
}

function handleCommandArrowKey(key) {
    const convIdx = getCurrentConversationIndex();
    if (convIdx === null) return false;

    if (key === "ArrowUp") {
        return navigateCurrentPrompt(-1);
    }

    if (key === "ArrowDown") {
        return navigateCurrentPrompt(1);
    }

    if (key === "ArrowRight") {
        if (isSidebarHidden) {
            toggleSidebarVisibility(false);
            openSidebarAtCurrentPrompt();
        } else {
            openSidebarAtCurrentPrompt();
        }
        return true;
    }

    if (key === "ArrowLeft") {
        if (!isSidebarHidden) {
            if (!collapseCurrentSidebarConversation()) {
                toggleSidebarVisibility(true);
            }
            return true;
        }
    }

    return false;
}

function openSidebarAtCurrentPrompt() {
    const convIdx = getCurrentConversationIndex();
    if (convIdx === null) return false;
    currentTreeConvIdx = convIdx;
    sidebarFocusKey =
        currentPromptMessageIndex !== null
            ? `prompt-${convIdx}-${currentPromptMessageIndex}`
            : `conv-${convIdx}`;
    renderTree();
    window.requestAnimationFrame(() => {
        if (!focusSidebarItemByKey(sidebarFocusKey)) {
            focusSidebarItemByKey(`conv-${convIdx}`);
        }
    });
    return true;
}

function collapseCurrentSidebarConversation() {
    const convIdx = getCurrentConversationIndex();
    if (convIdx === null || isAllTreesExpanded) return false;
    if (currentTreeConvIdx !== convIdx) return false;

    currentTreeConvIdx = null;
    sidebarFocusKey = `conv-${convIdx}`;
    renderTree();
    window.requestAnimationFrame(() => {
        focusSidebarItemByKey(`conv-${convIdx}`);
    });
    return true;
}

function ensureHiddenSidebarKeyboardNavigation() {
    if (document.body.dataset.hiddenSidebarNavBound === "true") return;
    document.body.dataset.hiddenSidebarNavBound = "true";

    document.addEventListener("keydown", (event) => {
        if (event.key === "Meta") {
            isCommandKeyHeld = true;
            setCommandNavActive(true);
        }
    });

    document.addEventListener("keyup", (event) => {
        if (event.key === "Meta") {
            isCommandKeyHeld = false;
            setCommandNavActive(false);
        }
    });

    window.addEventListener("blur", () => {
        isCommandKeyHeld = false;
        setCommandNavActive(false);
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            isCommandKeyHeld = false;
            setCommandNavActive(false);
        }
    });

    document.addEventListener("keydown", (event) => {
        if ((!event.metaKey && !isCommandKeyHeld) || event.ctrlKey || event.altKey) {
            return;
        }
        const target = event.target;
        const tagName = target && target.tagName;
        if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(tagName))) {
            return;
        }

        if (handleCommandArrowKey(event.key)) {
            event.preventDefault();
            return;
        }
    });
}

function rememberSidebarFocus(target) {
    if (!target) return;
    const focusKey = target.dataset ? target.dataset.focusKey : "";
    if (focusKey) {
        sidebarFocusKey = focusKey;
    }
}

function getVisibleSidebarItems() {
    return Array.from(
        document.querySelectorAll("#index-tree .tree-summary, #index-tree .prompt-item[data-focus-key]")
    ).filter((element) => element.offsetParent !== null);
}

function scrollSidebarItemIntoView(target, behavior = "smooth") {
    if (!target) return;
    target.scrollIntoView({ behavior, block: "nearest" });
}

function focusSidebarItemByKey(focusKey) {
    if (!focusKey) return false;
    const target = document.querySelector(`#index-tree [data-focus-key="${focusKey}"]`);
    if (!target || target.offsetParent === null) return false;
    target.focus({ preventScroll: true });
    scrollSidebarItemIntoView(target);
    return true;
}

function restoreSidebarFocus() {
    if (focusSidebarItemByKey(sidebarFocusKey)) {
        return;
    }

    const fallback =
        document.querySelector("#index-tree .tree-summary") ||
        document.querySelector("#index-tree .prompt-item[data-focus-key]");
    if (fallback) {
        fallback.focus({ preventScroll: true });
        scrollSidebarItemIntoView(fallback, "auto");
        rememberSidebarFocus(fallback);
    }
}

function expandConversationPrompts(convIdx, revealPosition = 0) {
    currentTreeConvIdx = convIdx;
    return loadConversationDetail(convIdx).then(() => {
        const conv = chatData[convIdx];
        const allPreviews = buildPromptPreviews(conv);
        const targetPreview = allPreviews[Math.min(revealPosition, Math.max(0, allPreviews.length - 1))];
        sidebarFocusKey = targetPreview
            ? `prompt-${convIdx}-${targetPreview.messageIndex}`
            : `conv-${convIdx}`;
        renderTree();
        window.requestAnimationFrame(() => {
            focusSidebarItemByKey(sidebarFocusKey);
        });
    });
}

function moveSidebarFocus(step) {
    const items = getVisibleSidebarItems();
    if (items.length === 0) return;

    const activeIndex = items.findIndex((item) => item === document.activeElement);
    const baseIndex = activeIndex >= 0 ? activeIndex : 0;
    const nextIndex = Math.max(0, Math.min(items.length - 1, baseIndex + step));
    items[nextIndex].focus({ preventScroll: true });
    scrollSidebarItemIntoView(items[nextIndex]);
    rememberSidebarFocus(items[nextIndex]);
}

function ensureSidebarKeyboardNavigation() {
    if (sidebarKeyboardBound) return;
    const treeRoot = document.getElementById("index-tree");
    if (!treeRoot) return;

    sidebarKeyboardBound = true;
    treeRoot.addEventListener("focusin", (event) => {
        rememberSidebarFocus(event.target);
    });

    treeRoot.addEventListener("keydown", (event) => {
        if (event.metaKey || event.ctrlKey || event.altKey) {
            return;
        }

        const target = event.target;
        if (!target || !target.dataset) return;

        const itemType = target.dataset.itemType;
        const convIdx = Number.parseInt(target.dataset.convIdx || "", 10);
        const messageIdx = Number.parseInt(target.dataset.msgIdx || "", 10);

        if (event.key === "ArrowDown") {
            event.preventDefault();
            moveSidebarFocus(1);
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            moveSidebarFocus(-1);
            return;
        }

        if (itemType === "conversation") {
            if (event.key === "ArrowRight") {
                event.preventDefault();
                const treeNode = document.getElementById(`tree-node-${convIdx}`);
                const firstPrompt = document.querySelector(`#tree-node-${convIdx} .prompt-item[data-focus-key]`);
                if (treeNode && !treeNode.open && !isAllTreesExpanded) {
                    sidebarFocusKey = target.dataset.focusKey;
                    currentTreeConvIdx = convIdx;
                    renderTree();
                    window.requestAnimationFrame(() => {
                        focusSidebarItemByKey(`conv-${convIdx}`);
                    });
                    return;
                }
                if (firstPrompt) {
                    firstPrompt.focus({ preventScroll: true });
                    scrollSidebarItemIntoView(firstPrompt);
                    rememberSidebarFocus(firstPrompt);
                }
                return;
            }

            if (event.key === "ArrowLeft") {
                if (!isAllTreesExpanded && currentTreeConvIdx === convIdx) {
                    event.preventDefault();
                    sidebarFocusKey = target.dataset.focusKey;
                    currentTreeConvIdx = null;
                    renderTree();
                    window.requestAnimationFrame(() => {
                        focusSidebarItemByKey(`conv-${convIdx}`);
                    });
                }
                return;
            }

            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openConversationFromTree(event, convIdx);
            }
            return;
        }

        if (itemType === "prompt") {
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                focusSidebarItemByKey(`conv-${convIdx}`);
                return;
            }

            if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                jumpToMessage(convIdx, messageIdx);
            }
            return;
        }

        if (itemType === "more") {
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                focusSidebarItemByKey(`conv-${convIdx}`);
                return;
            }

            if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                expandConversationPrompts(convIdx, Number.parseInt(target.dataset.revealPosition || "0", 10));
            }
        }
    });
}

function getSearchTargetInputs() {
    return [
        document.getElementById("chk-title"),
        document.getElementById("chk-prompt"),
        document.getElementById("chk-answer"),
    ].filter(Boolean);
}

function getSearchConfig() {
    return {
        includeTitle: document.getElementById("chk-title").checked,
        includePrompt: document.getElementById("chk-prompt").checked,
        includeAnswer: document.getElementById("chk-answer").checked,
    };
}

function syncSearchTargetLocks() {
    const inputs = getSearchTargetInputs();
    const targets = document.querySelector(".search-targets");
    const checkedInputs = inputs.filter((input) => input.checked);

    if (checkedInputs.length === 0) {
        const fallback = document.getElementById("chk-title") || inputs[0];
        if (fallback) fallback.checked = true;
    }

    const normalizedCheckedInputs = inputs.filter((input) => input.checked);
    const shouldLockSingle = normalizedCheckedInputs.length === 1;
    inputs.forEach((input) => {
        const label = input.closest(".search-target-label");
        const isLocked = shouldLockSingle && input.checked;
        input.disabled = isLocked;
        if (label) {
            label.classList.toggle("is-locked", isLocked);
        }
    });

    if (targets) {
        targets.classList.remove("selection-count-1", "selection-count-2", "selection-count-3");
        const selectedCount = inputs.filter((input) => input.checked).length;
        targets.classList.add(`selection-count-${Math.max(1, Math.min(3, selectedCount))}`);
    }
}

function saveBooleanPreference(key, value) {
    localStorage.setItem(key, value ? "true" : "false");
}

function readBooleanPreference(key, fallbackValue) {
    const saved = localStorage.getItem(key);
    if (saved === null) return fallbackValue;
    return saved === "true";
}

function readSearchTargetPreference(primaryKey, legacyExcludeKey, fallbackValue) {
    const primary = localStorage.getItem(primaryKey);
    if (primary !== null) {
        return primary === "true";
    }
    const legacy = localStorage.getItem(legacyExcludeKey);
    if (legacy !== null) {
        return legacy !== "true";
    }
    return fallbackValue;
}

function persistSearchPreferences() {
    const searchBar = document.getElementById("searchBar");
    const sortSelect = document.getElementById("sort-select");
    const searchConfig = getSearchConfig();

    if (searchBar) {
        localStorage.setItem(STORAGE_KEYS.searchQuery, searchBar.value);
    }
    if (sortSelect) {
        localStorage.setItem(STORAGE_KEYS.sortMode, sortSelect.value);
    }

    saveBooleanPreference(STORAGE_KEYS.searchTitle, searchConfig.includeTitle);
    saveBooleanPreference(STORAGE_KEYS.searchPrompt, searchConfig.includePrompt);
    saveBooleanPreference(STORAGE_KEYS.searchAnswer, searchConfig.includeAnswer);
    saveBooleanPreference(STORAGE_KEYS.sidebarFilter, isSidebarFilterActive);
    saveBooleanPreference(STORAGE_KEYS.treeExpand, isAllTreesExpanded);
    saveBooleanPreference(STORAGE_KEYS.matchFilter, isMatchFilterActive);
}

function refreshUtilityToggleButtons() {
    const sidebarToggle = document.getElementById("sidebar-toggle");
    if (sidebarToggle) {
        sidebarToggle.classList.toggle("active", isSidebarHidden);
        sidebarToggle.dataset.direction = isSidebarHidden ? "right" : "left";
        sidebarToggle.setAttribute(
            "aria-label",
            isSidebarHidden ? "サイドバーを表示" : "サイドバーを隠す"
        );
        sidebarToggle.title = isSidebarHidden ? "サイドバーを表示" : "サイドバーを隠す";
    }

    const modeToggle = document.getElementById("mode-toggle");
    if (modeToggle) {
        modeToggle.textContent = activeMode === "light" ? "☀︎" : "☾";
        modeToggle.classList.toggle("active", activeMode === "dark");
        modeToggle.setAttribute(
            "aria-label",
            activeMode === "light" ? "ダークモードに切り替え" : "ライトモードに切り替え"
        );
        modeToggle.title = activeMode === "light" ? "ダークモードに切り替え" : "ライトモードに切り替え";
    }

    const textSizeToggle = document.getElementById("text-size-toggle");
    if (textSizeToggle) {
        textSizeToggle.classList.toggle("active", isSmallText);
        textSizeToggle.setAttribute(
            "aria-label",
            isSmallText ? "標準文字サイズに戻す" : "文字を小さくする"
        );
        textSizeToggle.title = isSmallText ? "標準文字サイズに戻す" : "文字を小さくする";
    }

    const treeExpandToggle = document.getElementById("tree-expand-toggle");
    if (treeExpandToggle) {
        treeExpandToggle.classList.toggle("active", isAllTreesExpanded);
        treeExpandToggle.setAttribute(
            "aria-label",
            isAllTreesExpanded ? "ツリー全体を閉じる" : "ツリー全体を開く"
        );
        treeExpandToggle.title = isAllTreesExpanded ? "ツリー全体を閉じる" : "ツリー全体を開く";
    }
}

function applySidebarVisibility() {
    document.body.classList.toggle("sidebar-hidden", isSidebarHidden);
    refreshUtilityToggleButtons();
    setCommandNavActive(false);
    if (!isSidebarHidden) {
        closePromptNavigator(false);
    }
}

function toggleSidebarVisibility(hidden) {
    const currentConv = getCurrentConversationIndex();
    if (!hidden && currentConv !== null) {
        sidebarFocusKey =
            currentPromptMessageIndex !== null
                ? `prompt-${currentConv}-${currentPromptMessageIndex}`
                : `conv-${currentConv}`;
    }

    isSidebarHidden = hidden;
    saveBooleanPreference(STORAGE_KEYS.sidebarHidden, hidden);
    applySidebarVisibility();

    if (currentConv !== null) {
        renderChat(currentConv);
    }

    if (!hidden) {
        window.requestAnimationFrame(() => {
            restoreSidebarFocus();
        });
    }
}

function toggleSidebarVisibilityButton() {
    toggleSidebarVisibility(!isSidebarHidden);
}

function applyTheme() {
    if (!currentThemes[activeTheme]) {
        activeTheme = Object.keys(currentThemes)[0] || "default";
    }
    const theme = currentThemes[activeTheme];
    if (!theme) return;

    const mode = theme[activeMode] ? activeMode : "light";
    const themeData = theme[mode];
    const root = document.documentElement;
    Object.keys(themeData).forEach((key) => {
        root.style.setProperty(`--${key}`, themeData[key]);
    });

    document.querySelectorAll(".theme-btn").forEach((btn) => {
        btn.classList.remove("active");
    });

    const targetBtn = document.getElementById(`btn-theme-${activeTheme}`);
    if (targetBtn) {
        targetBtn.classList.add("active");
    }

    activeMode = mode;
    localStorage.setItem(STORAGE_KEYS.theme, activeTheme);
    localStorage.setItem(STORAGE_KEYS.mode, activeMode);
    refreshUtilityToggleButtons();
}

function setSystemTheme(mode) {
    if (mode === "light" || mode === "dark") {
        activeMode = mode;
        applyTheme();
    }
}

function switchTheme(name) {
    activeTheme = name;
    applyTheme();
}

function toggleColorMode() {
    activeMode = activeMode === "light" ? "dark" : "light";
    applyTheme();
}

function toggleTextSize(checked) {
    isSmallText = checked;
    document.body.classList.toggle("small-text", checked);
    saveBooleanPreference(STORAGE_KEYS.textSizeSmall, checked);
    refreshUtilityToggleButtons();
}

function toggleTextSizeButton() {
    toggleTextSize(!isSmallText);
}

function openExternal(url) {
    if (appBridge && appBridge.openExternal) {
        appBridge.openExternal(url);
        return false;
    }
    window.location.href = url;
    return false;
}

function getSourceButtonMarkup(conv) {
    const source = String(conv.source || "").toLowerCase();
    let url = "";
    let title = "";
    let label = "";

    if (source === "chatgpt" && conv.id && conv.id.length > 20) {
        url = `https://chatgpt.com/c/${escapeJsString(conv.id)}`;
        title = "ChatGPTを開く";
        label = "ChatGPT";
    } else if (source === "claude" && conv.id && conv.id.length > 20) {
        url = `https://claude.ai/chat/${escapeJsString(conv.id)}`;
        title = "Claudeを開く";
        label = "Claude";
    } else if (source === "gemini") {
        url = "https://gemini.google.com/app";
        title = "Geminiを開く";
        label = "Gemini";
    } else {
        return "";
    }

    return `<button class="action-btn header-text-btn source-action-btn" title="${title}" aria-label="${title}" onclick="return openExternal('${url}')"><span class="source-label source-label-${source}">${label}</span></button>`;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderContent(text) {
    let sourceText = text || "";
    const placeholders = createHtmlPlaceholderStore();

    sourceText = sourceText.replace(/```([\s\S]*?)```/g, (_match, code) => {
        return placeholders.put(`<pre><code>${escapeHTML(code.trim())}</code></pre>`);
    });
    sourceText = sourceText.replace(/`([^`\n]+)`/g, (_match, code) => {
        return placeholders.put(`<code>${escapeHTML(code)}</code>`);
    });
    sourceText = sourceText.replace(/\\\[([\s\S]*?)\\\]/g, (_match, expr) => {
        return placeholders.put(renderMathBlock(expr, true));
    });
    sourceText = sourceText.replace(/\$\$([\s\S]*?)\$\$/g, (_match, expr) => {
        return placeholders.put(renderMathBlock(expr, true));
    });
    sourceText = sourceText.replace(/\\\(([\s\S]*?)\\\)/g, (_match, expr) => {
        return placeholders.put(renderMathBlock(expr, false));
    });

    let html = escapeHTML(sourceText);

    html = html.replace(/^###### (.*)$/gm, "<h6>$1</h6>");
    html = html.replace(/^##### (.*)$/gm, "<h5>$1</h5>");
    html = html.replace(/^#### (.*)$/gm, "<h4>$1</h4>");
    html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    html = html.replace(/\n/g, "<br>");
    return placeholders.restore(html);
}

function getCurrentConversationResult(conv) {
    return currentSearchResults[conv.id] || {
        matched: currentParsedQuery.words.length === 0,
        hits: 0,
        matchedMessageIndexes: [],
        titleMatched: false,
    };
}

function turnMatchesQuery(conv, startIndex) {
    if (currentParsedQuery.words.length === 0) return true;
    const result = getCurrentConversationResult(conv);
    return result.matchedMessageIndexes.includes(startIndex);
}

function toggleMatchFilter(checked) {
    isMatchFilterActive = checked;
    persistSearchPreferences();
    applyHighlightsAndFilters(document.getElementById("chat-viewer"));
}

function toggleSidebarFilter(checked) {
    isSidebarFilterActive = checked;
    persistSearchPreferences();
    renderTree();
}

function toggleAllTrees(checked) {
    isAllTreesExpanded = checked;
    persistSearchPreferences();
    refreshUtilityToggleButtons();
    renderTree();
}

function toggleAllTreesButton() {
    toggleAllTrees(!isAllTreesExpanded);
}

function parseSmartQuery(query) {
    if (!query) return { fuseQuery: "", words: [] };
    const words = query.split(/[\s　]+/).filter((word) => word.length > 0);
    if (words.length === 0) return { fuseQuery: "", words: [] };
    return {
        fuseQuery: words.map((word) => `'${word}`).join(" "),
        words,
    };
}

function handleSearchTargetChange() {
    syncSearchTargetLocks();
    persistSearchPreferences();
    executeSearch();
}

function countOccurrences(haystack, needle) {
    if (!haystack || !needle) return 0;
    let count = 0;
    let pos = 0;
    while (true) {
        const found = haystack.indexOf(needle, pos);
        if (found === -1) break;
        count += 1;
        pos = found + needle.length;
    }
    return count;
}

function computeFallbackSearchResults() {
    const config = getSearchConfig();
    const words = currentParsedQuery.words.map((word) => word.toLowerCase());
    const results = {};

    chatData.forEach((conv) => {
        const titleText = config.includeTitle ? String(conv.title || "").toLowerCase() : "";
        const titleMatched = titleText && words.every((word) => titleText.includes(word));

        let hits = 0;
        const matchedMessageIndexes = [];
        buildPromptPreviews(conv).forEach((item) => {
            const promptText = config.includePrompt ? String(item.preview || "").toLowerCase() : "";
            const answerText = config.includeAnswer ? String(conv.answers_text || "").toLowerCase() : "";
            const searchable = `${promptText}\n${answerText}`;
            const matched = searchable && words.every((word) => searchable.includes(word));
            if (matched) {
                hits += 1;
                matchedMessageIndexes.push(item.messageIndex);
            }
        });

        if (titleMatched || hits > 0) {
            results[conv.id] = {
                matched: true,
                hits,
                matchedMessageIndexes,
                titleMatched,
            };
        }
    });

    return results;
}

function requestSearchResults() {
    if (currentParsedQuery.words.length === 0) {
        return Promise.resolve({});
    }

    const payload = JSON.stringify({
        words: currentParsedQuery.words,
        ...getSearchConfig(),
    });

    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.searchConversations) {
            return computeFallbackSearchResults();
        }
        return new Promise((resolve) => {
            bridge.searchConversations(payload, function (result) {
                try {
                    resolve(result ? JSON.parse(result) : {});
                } catch (_error) {
                    resolve({});
                }
            });
        });
    });
}

function setupObserver() {
    scrollObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    scheduleConversationRootDockUpdate();
                }
            });
        },
        {
            root: document.getElementById("chat-viewer"),
            rootMargin: "-10% 0px -75% 0px",
            threshold: 0,
        }
    );
}

function sortConversations(targetData, sortMode) {
    targetData.sort((a, b) => {
        if (sortMode === "original") return a._idx - b._idx;
        if (sortMode === "date-desc") return (b.date || "").localeCompare(a.date || "");
        if (sortMode === "date-asc") return (a.date || "").localeCompare(b.date || "");
        if (sortMode === "hits-desc") return b._hits - a._hits;
        if (sortMode === "hits-asc") return a._hits - b._hits;
        if (sortMode === "prompts-desc") return b.promptCount - a.promptCount;
        if (sortMode === "prompts-asc") return a.promptCount - b.promptCount;
        if (sortMode === "title-asc") return a.title.localeCompare(b.title, "ja");
        if (sortMode === "title-desc") return b.title.localeCompare(a.title, "ja");
        return 0;
    });
}

function renderTree() {
    const treeRoot = document.getElementById("index-tree");
    const sortSelect = document.getElementById("sort-select");
    const isSearch = currentParsedQuery.fuseQuery !== "";

    let targetData = chatData
        .map((conv) => {
            const result = getCurrentConversationResult(conv);
            conv._hits = result.hits || 0;
            return { conv, result };
        })
        .filter((item) => !isSearch || !isSidebarFilterActive || item.result.matched)
        .map((item) => item.conv);

    sortConversations(targetData, sortSelect ? sortSelect.value : "date-desc");

    let htmlStr = "";
    targetData.forEach((conv) => {
        const convIdx = conv._idx;
        const result = getCurrentConversationResult(conv);
        const hitBadge = isSearch && result.hits > 0 ? `<span class="hit-badge">${result.hits} Hits</span> ` : "";
        const shouldRenderPromptList = isAllTreesExpanded || currentTreeConvIdx === convIdx;
        const previewItems = buildPromptPreviews(conv);
        const visiblePreviewItems =
            isSearch && isSidebarFilterActive
                ? previewItems.filter((item) => result.matchedMessageIndexes.includes(item.messageIndex))
                : previewItems;

        let promptsHtml = "";
        if (shouldRenderPromptList) {
            visiblePreviewItems.forEach((item) => {
                const safeText = escapeHTML(item.preview || "");
                const hasMatch = !isSearch || result.matchedMessageIndexes.includes(item.messageIndex);
                promptsHtml += `
                    <a href="javascript:void(0)"
                       class="prompt-item ${hasMatch ? "has-match" : "no-match"}"
                       id="nav-msg-${convIdx}-${item.messageIndex}"
                       tabindex="0"
                       data-item-type="prompt"
                       data-conv-idx="${convIdx}"
                       data-msg-idx="${item.messageIndex}"
                       data-focus-key="prompt-${convIdx}-${item.messageIndex}"
                       onclick="jumpToMessage(${convIdx}, ${item.messageIndex})">💬 ${safeText}...</a>`;
            });

            if (isSearch && isSidebarFilterActive && result.titleMatched && result.hits === 0) {
                promptsHtml += `
                    <div class="prompt-item prompt-item-muted">
                        タイトル一致
                    </div>`;
            }

            const hiddenPreviewCount = Math.max((conv.promptCount || 0) - visiblePreviewItems.length, 0);
            const shouldShowMore =
                hiddenPreviewCount > 0 &&
                (!Array.isArray(conv.messages) || conv.messages.length === 0) &&
                !(isSearch && isSidebarFilterActive);
            if (shouldShowMore) {
                const revealPosition = visiblePreviewItems.length;
                promptsHtml += `
                    <button
                        type="button"
                        class="prompt-item prompt-item-muted prompt-item-more"
                        tabindex="0"
                        data-item-type="more"
                        data-conv-idx="${convIdx}"
                        data-reveal-position="${revealPosition}"
                        data-focus-key="more-${convIdx}"
                        onclick="expandConversationPrompts(${convIdx}, ${revealPosition})">
                        さらに ${hiddenPreviewCount} 件...
                    </button>`;
            }
        }

        htmlStr += `
            <details class="tree-node" id="tree-node-${convIdx}" ${shouldRenderPromptList ? "open" : ""}>
                <summary
                    class="tree-summary"
                    tabindex="0"
                    data-item-type="conversation"
                    data-conv-idx="${convIdx}"
                    data-focus-key="conv-${convIdx}"
                    onclick="openConversationFromTree(event, ${convIdx})"><span class="icon">📁</span> <span class="thread-title">${hitBadge}${escapeHTML(conv.title)}</span></summary>
                <div class="prompt-list">${promptsHtml}</div>
            </details>`;
    });

    treeRoot.innerHTML = htmlStr;
    restoreSidebarFocus();
}

function jumpToMessage(convIdx, msgIdx, scrollBehavior = "smooth") {
    currentPromptMessageIndex = msgIdx;
    pendingPromptMessageIndex = msgIdx;
    pendingPromptLockUntil = Date.now() + PROMPT_NAV_LOCK_MS;
    const renderPromise =
        document.getElementById("chat-viewer").dataset.currentConv !== convIdx.toString()
            ? renderChat(convIdx)
            : Promise.resolve();

    renderPromise.then(() => {
        window.setTimeout(() => {
            const target = document.getElementById(`msg-${convIdx}-${msgIdx}`);
            if (!target) return;
            const turn = target.closest(".chat-turn");
            if (turn) {
                turn.classList.remove("collapsed-answer", "filtered-out");
                turn.scrollIntoView({ behavior: scrollBehavior, block: "start" });
            }
        }, 120);
    });
}

function scrollToTopAndSidebar(convIdx) {
    const viewer = document.getElementById("chat-viewer");
    if (viewer) viewer.scrollTo({ top: 0, behavior: "smooth" });

    if (isSidebarHidden) {
        return;
    }

    const treeNode = document.getElementById(`tree-node-${convIdx}`);
    if (treeNode) {
        treeNode.open = true;
        treeNode.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

function openConversationFromTree(event, convIdx) {
    if (event && event.currentTarget) {
        rememberSidebarFocus(event.currentTarget);
    }
    renderChat(convIdx);
    currentTreeConvIdx = convIdx;
    renderTree();
    if (event && typeof event.stopPropagation === "function") {
        event.stopPropagation();
    }
}

function handleRootPromptClick(event, convIdx) {
    const snapshot = getCurrentPromptSnapshot(convIdx);
    if (!snapshot) return;
    if (isSidebarHidden) {
        togglePromptNavigator(event, convIdx);
        return;
    }
    jumpToMessage(convIdx, snapshot.messageIndex);
}

function highlightTextNode(node, words) {
    const text = node.nodeValue;
    const lowerText = text.toLowerCase();
    const loweredWords = words.map((word) => word.toLowerCase()).filter(Boolean);
    if (loweredWords.length === 0) return;

    let position = 0;
    let matched = false;
    const fragment = document.createDocumentFragment();

    while (position < text.length) {
        let bestIndex = -1;
        let bestWord = "";

        loweredWords.forEach((word) => {
            const foundIndex = lowerText.indexOf(word, position);
            if (foundIndex === -1) return;
            if (bestIndex === -1 || foundIndex < bestIndex || (foundIndex === bestIndex && word.length > bestWord.length)) {
                bestIndex = foundIndex;
                bestWord = word;
            }
        });

        if (bestIndex === -1) {
            fragment.appendChild(document.createTextNode(text.slice(position)));
            break;
        }

        if (bestIndex > position) {
            fragment.appendChild(document.createTextNode(text.slice(position, bestIndex)));
        }

        const mark = document.createElement("mark");
        mark.textContent = text.slice(bestIndex, bestIndex + bestWord.length);
        fragment.appendChild(mark);
        position = bestIndex + bestWord.length;
        matched = true;
    }

    if (matched) {
        node.parentNode.replaceChild(fragment, node);
    }
}

function highlightViewerContent(viewer) {
    if (currentParsedQuery.words.length === 0) return;

    viewer.querySelectorAll(".chat-turn.has-match .bubble").forEach((bubble) => {
        const walker = document.createTreeWalker(
            bubble,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    if (!node.nodeValue || !node.nodeValue.trim()) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    const parentTag = node.parentNode && node.parentNode.nodeName;
                    if (["MARK", "CODE", "PRE", "SCRIPT", "STYLE"].includes(parentTag)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    if (node.parentElement && node.parentElement.closest(".math-inline, .math-display")) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                },
            }
        );

        const nodes = [];
        while (walker.nextNode()) {
            nodes.push(walker.currentNode);
        }
        nodes.forEach((node) => highlightTextNode(node, currentParsedQuery.words));
    });
}

async function renderChat(convIdx) {
    const conv = await loadConversationDetail(convIdx);
    const viewer = document.getElementById("chat-viewer");
    viewer.dataset.currentConv = convIdx;
    currentTreeConvIdx = convIdx;
    if (scrollObserver) scrollObserver.disconnect();

    const result = getCurrentConversationResult(conv);
    const promptItems = getPromptNavigatorItems(convIdx);
    if (promptItems.length > 0) {
        const hasCurrentPrompt = promptItems.some((item) => item.messageIndex === currentPromptMessageIndex);
        if (!hasCurrentPrompt) {
            currentPromptMessageIndex = promptItems[0].messageIndex;
        }
    } else {
        currentPromptMessageIndex = null;
    }
    const sourceLink = getSourceButtonMarkup(conv);
    const viewerControlsHtml =
        document.getElementById("viewer-controls-template")?.innerHTML || "";

    const filterToggleHtml =
        currentParsedQuery.words.length > 0
            ? `
        <label class="filter-toggle">
            <input type="checkbox" id="match-filter-toggle" onchange="toggleMatchFilter(this.checked)" ${isMatchFilterActive ? "checked" : ""}>
            <span class="toggle-slider"></span>
            ヒットのみ抽出
        </label>
    `
            : "";

    let html = `
        <div class="chat-header-area">
            <div class="chat-header-left">
                <h2 style="cursor: pointer; transition: opacity 0.2s;"
                    onmouseover="this.style.opacity=0.7"
                    onmouseout="this.style.opacity=1"
                    title="トップに戻る＆目次を表示"
                    onclick="scrollToTopAndSidebar(${convIdx})">${escapeHTML(conv.title)}</h2>
            </div>
            <div class="chat-header-right">
                ${viewerControlsHtml}
                <div class="header-actions header-source-actions">
                    ${sourceLink}
                    <button class="action-btn header-icon-btn" title="コピー" aria-label="コピー" onclick="copyFullText(${convIdx})">⧉</button>
                </div>
            </div>
        </div>
        ${filterToggleHtml ? `<div class="header-filter-row">${filterToggleHtml}</div>` : ""}`;

    let promptCount = 0;
    let i = 0;
    while (i < conv.messages.length) {
        const startIndex = i;
        const turnMatched = turnMatchesQuery(conv, startIndex);
        const turnClasses = [
            "chat-turn",
            turnMatched ? "has-match" : "no-match",
            !turnMatched && isMatchFilterActive ? "filtered-out" : "",
        ]
            .filter(Boolean)
            .join(" ");
        html += `<div class="${turnClasses}" id="turn-${convIdx}-${startIndex}">`;
        if (conv.messages[i] && conv.messages[i].role === "user") {
            promptCount += 1;
            const prompt = conv.messages[i];
            html += `
                <div class="chat-row user" id="msg-${convIdx}-${i}">
                    <div class="avatar user-icon"></div>
                    <div class="bubble-wrapper">
                        <div class="bubble tex2jax_process">${renderContent(prompt.text || "")}</div>
                    </div>
                </div>`;
            i += 1;
        }

        html += `<div class="answers-container-wrapper"><div class="answers-container">`;
        while (i < conv.messages.length && conv.messages[i].role !== "user") {
            const answer = conv.messages[i];
            html += `
                <div class="chat-row assist" id="msg-${convIdx}-${i}">
                    <div class="avatar assist-icon"></div>
                    <div class="bubble-wrapper">
                        <div class="bubble tex2jax_process">${renderContent(answer.text)}</div>
                    </div>
                </div>`;
            i += 1;
        }
        html += `</div></div></div>`;
    }

    if (currentParsedQuery.words.length > 0 && result.titleMatched && result.hits === 0 && isMatchFilterActive) {
        html += `
            <div class="prompt-item prompt-item-muted" style="margin: 0 0 30px 20px;">
                タイトル一致のみのため、本文に抽出対象はないよ。
            </div>`;
    }

    viewer.innerHTML = html;
    document.querySelectorAll(".chat-row.user").forEach((el) => scrollObserver.observe(el));
    syncPromptNavigatorPopover(false);
    refreshConversationRootDock();
    scheduleConversationRootDockUpdate();
    applyTheme();
    refreshUtilityToggleButtons();
    applyHighlightsAndFilters(viewer);
}

function applyHighlightsAndFilters(viewer) {
    document.querySelectorAll(".chat-turn").forEach((turn) => {
        const isNoMatch = turn.classList.contains("no-match");
        turn.classList.toggle("filtered-out", isNoMatch && isMatchFilterActive);
        if (!isNoMatch && isMatchFilterActive) {
            turn.classList.remove("collapsed-answer");
        }
    });
    highlightViewerContent(viewer);
}

function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("visible");
    window.setTimeout(() => {
        toast.classList.remove("visible");
    }, 1800);
}

function fallbackCopyText(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
}

function copyTextToClipboard(text) {
    if (appBridge && appBridge.copyText) {
        appBridge.copyText(text);
        return Promise.resolve();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve) => {
        fallbackCopyText(text);
        resolve();
    });
}

function copyFullText(idx) {
    const conv = chatData[idx];
    const plainText = conv.messages
        .map((msg) => `【${msg.role === "user" ? "ユーザー" : "AI"}】\n${msg.text}`)
        .join("\n\n");

    copyTextToClipboard(plainText)
        .then(() => showToast("コピー完了！✨"))
        .catch(() => {
            fallbackCopyText(plainText);
            showToast("コピー完了！✨");
        });
}

async function executeSearch() {
    const searchBar = document.getElementById("searchBar");
    currentParsedQuery = parseSmartQuery(searchBar.value.trim());
    persistSearchPreferences();
    currentSearchResults = await requestSearchResults();
    renderTree();

    const currentConv = document.getElementById("chat-viewer").dataset.currentConv;
    if (currentConv !== "") {
        await renderChat(Number.parseInt(currentConv, 10));
    }
}

async function bootViewer(options = {}) {
    try {
        ensureRenderer();
        initBridge();
        chatData = Array.isArray(window.__CHAT_INDEX__) ? window.__CHAT_INDEX__.map(hydrateConversation) : [];
        currentThemes = JSON.parse(document.getElementById("theme-data").textContent);

        activeTheme = localStorage.getItem(STORAGE_KEYS.theme) || "default";
        activeMode = localStorage.getItem(STORAGE_KEYS.mode) || options.systemTheme || "light";

        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)");
        systemPrefersDark.addEventListener("change", (event) => {
            setSystemTheme(event.matches ? "dark" : "light");
        });

        const searchBar = document.getElementById("searchBar");
        const sortSelect = document.getElementById("sort-select");
        const sidebarFilterToggle = document.getElementById("sidebar-filter-toggle");
        const titleToggle = document.getElementById("chk-title");
        const promptToggle = document.getElementById("chk-prompt");
        const answerToggle = document.getElementById("chk-answer");
        const viewer = document.getElementById("chat-viewer");

        if (searchBar) {
            searchBar.value = localStorage.getItem(STORAGE_KEYS.searchQuery) || "";
            searchBar.addEventListener("input", persistSearchPreferences);
        }
        if (sortSelect) {
            sortSelect.value = localStorage.getItem(STORAGE_KEYS.sortMode) || sortSelect.value;
            sortSelect.addEventListener("change", persistSearchPreferences);
        }

        if (titleToggle) {
            titleToggle.checked = readSearchTargetPreference(
                STORAGE_KEYS.searchTitle,
                STORAGE_KEYS.legacyExcludeTitle,
                true
            );
        }
        if (promptToggle) {
            promptToggle.checked = readSearchTargetPreference(
                STORAGE_KEYS.searchPrompt,
                STORAGE_KEYS.legacyExcludePrompt,
                true
            );
        }
        if (answerToggle) {
            answerToggle.checked = readSearchTargetPreference(
                STORAGE_KEYS.searchAnswer,
                STORAGE_KEYS.legacyExcludeAnswer,
                true
            );
        }
        syncSearchTargetLocks();

        isSmallText = readBooleanPreference(STORAGE_KEYS.textSizeSmall, false);
        document.body.classList.toggle("small-text", isSmallText);

        isSidebarFilterActive = readBooleanPreference(STORAGE_KEYS.sidebarFilter, false);
        if (sidebarFilterToggle) sidebarFilterToggle.checked = isSidebarFilterActive;

        isAllTreesExpanded = readBooleanPreference(STORAGE_KEYS.treeExpand, false);

        isMatchFilterActive = readBooleanPreference(STORAGE_KEYS.matchFilter, false);
        isSidebarHidden = readBooleanPreference(STORAGE_KEYS.sidebarHidden, false);

        setupObserver();
        if (viewer) {
            viewer.addEventListener("scroll", scheduleConversationRootDockUpdate, { passive: true });
        }
        ensureSidebarKeyboardNavigation();
        ensureHiddenSidebarKeyboardNavigation();
        applySidebarVisibility();
        applyTheme();
        refreshUtilityToggleButtons();
        await executeSearch();

        if (options.showToast) {
            showToast("✨ 登録完了！");
        }
    } catch (error) {
        console.error("Init Error:", error);
    }
}
