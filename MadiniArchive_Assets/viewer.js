let chatData = [];
let scrollObserver = null;
let currentThemes = {};
let activeTheme = "default";
let activeMode = "light";
// currentParsedQuery is the lightweight view-state snapshot used by tree filtering,
// prompt highlighting, and in-view match checks. Backend search requests use the
// richer spec built by buildKeywordSearchSpec().
let currentParsedQuery = { fuseQuery: "", words: [] };
// currentSearchResults is the backend/fallback result payload keyed by conversation id.
let currentSearchResults = {};
let isMatchFilterActive = false;
let isSidebarFilterActive = false;
let isAllTreesExpanded = false;
let isSmallText = false;
let detailLoadPromises = {};
let rawSourceLoadPromises = {};
let rawSourceTextLoadPromises = {};
let appBridge = null;
let bridgeReady = false;
// currentTreeConvIdx controls which conversation tree is expanded in compact mode.
let currentTreeConvIdx = null;
// Keep an explicitly collapsed active conversation collapsed until the user
// explicitly re-enters that tree. Active highlight sync still continues.
let suppressedTreeAutoExpandConvIdx = null;
// sidebarFocusKey remembers keyboard focus/return position independently from
// the current-tab highlight state.
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
let openTabs = [];
let activeTabId = null;
let tabStripFocusTabId = null;
let pendingTabStripFocusRestoreId = null;
let pendingTabStripScrollLeft = null;
let recentlyClosedTabs = [];
let tabSessionPersistTimer = null;
let isRestoringTabSession = false;
let draggedTabId = null;
let tabDropTargetId = null;
let tabDropInsertAfter = false;
let tabMouseDragState = null;
let suppressTabClickUntil = 0;
let pendingTabAnimationRects = null;
let pendingDraggedTabId = null;
let tabDragGhostEl = null;
let tabDragOverlayEl = null;
let sidebarMode = "threads";
let extractFilterOptions = { services: [], models: [], sourceFiles: [] };
let recentExtractFilters = [];
let starredExtractFilters = [];
let starredPromptEntries = [];
let savedExtractViews = [];
let bookmarkTags = [];
let bookmarkTagGroups = [];
let bookmarkGroupOpenByKey = {};
let selectedDirectoryPromptKeys = [];
let directoryPromptSelectionAnchorKey = "";
let selectedStarredPromptKeys = [];
let starredPromptSelectionAnchorKey = "";
let selectedBookmarkTagFilterIds = [];
let bookmarkUndoStack = [];
let editingBookmarkTagId = "";
let editingBookmarkTagName = "";
let bookmarkTagRenameSavingId = "";
let bookmarkSelectionDragState = null;
let bookmarkSelectionDragGhostEl = null;
let bookmarkSelectionDragBound = false;
let bookmarkSelectionSuppressClickUntil = 0;
let bookmarkTagFilterClickSuppressUntil = 0;
let extractPreviewTimer = null;
let isExtractBookmarkTagMenuOpen = false;
let virtualThreadCounter = 0;
// Legacy/global fallback while virtual-tab selection is moving to per-tab state.
let currentVirtualSelectionIndex = 0;
let virtualTabScrollRestoreGuardUntil = 0;
let rawSourceDebugByConvId = {};
let mathFallbackLogCount = 0;

window.addEventListener("error", (event) => {
    const message = String(event?.message || "");
    const filename = String(event?.filename || "");
    const lineno = Number(event?.lineno || 0);
    const colno = Number(event?.colno || 0);
    if (!message && !filename) return;
    console.error(`[WindowError] ${message} @ ${filename}:${lineno}:${colno}`);
});

window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const message = String(reason && (reason.stack || reason.message || reason) || "");
    if (!message) return;
    console.error(`[UnhandledRejection] ${message}`);
});
let bookmarkStatesByKey = {};
let promptBookmarkLoadPromises = {};
let virtualFragmentBookmarkLoadPromises = {};
let savedViewBookmarkLoadPromises = {};
let collapsedMessageStateByKey = {};
let answerCollapseOverrideByKey = {};
let isViewerToolsOpen = false;
let isExtractModelMenuOpen = false;
let appliedExtractConversationIds = null;
let extractPreviewRequestId = 0;
let treeStructureRevision = 0;
let mathJaxRuntimePromise = null;
let pendingVisibleMathTypesetRoot = null;
let pendingVisibleMathTypesetFrame = 0;
const CLOSED_TAB_HISTORY_LIMIT = 20;
const MANAGER_TAB_TITLES = {
    starred_filters: "保存したフィルタ",
    starred_prompts: "タグ",
};
const PINNED_MANAGER_TAB_KINDS = ["starred_prompts"];

const ROOT_DOCK_FADE_DISTANCE = 220;
const ROOT_DOCK_MIN_OPACITY = 0.16;
const ROOT_DOCK_SWITCH_HYSTERESIS = 18;
const PROMPT_NAV_LOCK_MS = 520;
const ROOT_DOCK_FADE_SCROLL_START = 18;
const ANSWER_FADE_START = 24;
const ANSWER_FADE_RANGE = 88;
const TAB_REORDER_ARM_DISTANCE = 24;
const TAB_DRAG_TOP_MARGIN = 10;
const TAB_DRAG_BOTTOM_MARGIN = 10;
const BOOKMARK_SELECTION_DRAG_THRESHOLD = 7;
const BOOKMARK_UNDO_LIMIT = 80;
const ACTIVE_MATH_RENDERER = "mathjax";
const MATH_ISLAND_CSS = `
.math-shell,
.math-shell * {
    box-sizing: border-box;
}

.math-shell {
    color: inherit;
    font-family: "STIX Two Math", "Latin Modern Math", "Cambria Math", "STIX Two Text", "Times New Roman", serif;
    font-style: normal;
    font-weight: 400;
    letter-spacing: normal;
    text-transform: none;
    text-indent: 0;
    word-spacing: normal;
    word-break: normal;
    overflow-wrap: normal;
    hyphens: none;
}

.math-shell.math-inline {
    display: inline-flex;
    align-items: baseline;
    white-space: nowrap;
}

.math-shell.math-display {
    display: inline-block;
    min-width: max-content;
}

.math-content {
    line-height: 1.4;
    font-size: 1.06em;
    font-family: inherit;
    font-style: inherit;
    font-weight: inherit;
    letter-spacing: inherit;
    text-transform: none;
}

.math-shell.math-inline .math-content {
    display: inline-flex;
    align-items: baseline;
}

.math-shell.math-display .math-content {
    display: inline-block;
    min-width: max-content;
}

.math-frac {
    display: inline-flex;
    flex-direction: column;
    align-items: stretch;
    vertical-align: middle;
    margin: 0 0.12em;
    text-align: center;
    line-height: 1.05;
}

.math-frac-num {
    display: block;
    padding: 0 0.2em 0.08em;
    border-bottom: 1px solid currentColor;
}

.math-frac-den {
    display: block;
    padding: 0.08em 0.2em 0;
}

.math-sqrt {
    display: inline-flex;
    align-items: flex-start;
    vertical-align: middle;
}

.math-sqrt-sign {
    font-size: 1.12em;
    line-height: 1;
    padding-right: 0.04em;
}

.math-sqrt-body {
    display: inline-block;
    border-top: 1px solid currentColor;
    padding: 0.08em 0.12em 0;
}

.math-matrix {
    display: inline-flex;
    align-items: stretch;
    vertical-align: middle;
    margin: 0 0.12em;
}

.math-matrix-bracket {
    display: inline-flex;
    align-items: center;
    font-size: 1.6em;
    line-height: 1;
    padding: 0 0.06em;
}

.math-matrix-grid {
    display: inline-flex;
    flex-direction: column;
    gap: 0.08em;
    padding: 0.04em 0.08em;
}

.math-matrix-row {
    display: inline-flex;
    justify-content: center;
    align-items: baseline;
    gap: 0.65em;
    min-height: 1.1em;
}

.math-matrix-cell {
    display: inline-block;
    min-width: 0.8em;
    text-align: center;
}

.math-matrix.math-matrix-cases .math-matrix-grid {
    padding-left: 0.14em;
    padding-right: 0;
}

.math-matrix.math-matrix-cases .math-matrix-row {
    justify-content: flex-start;
    gap: 0.9em;
}

.math-matrix.math-matrix-cases .math-matrix-cell {
    min-width: 0;
    text-align: left;
}

.math-matrix.math-matrix-vmatrix .math-matrix-bracket,
.math-matrix.math-matrix-Vmatrix .math-matrix-bracket {
    font-size: 1.36em;
    font-weight: 500;
    padding: 0 0.12em;
}

.math-accent {
    position: relative;
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    padding-top: 0.2em;
}

.math-accent-mark {
    position: absolute;
    left: 50%;
    top: -0.18em;
    transform: translateX(-50%);
    font-size: 0.82em;
    line-height: 1;
    pointer-events: none;
}

.math-accent-bar .math-accent-mark {
    top: -0.12em;
}

.math-accent-body {
    display: inline-block;
}

.math-boxed {
    display: inline-block;
    padding: 0.06em 0.34em;
    border: 1px solid currentColor;
    border-radius: 0.24em;
    line-height: 1.15;
    vertical-align: middle;
}

.math-tag {
    display: inline-flex;
    align-items: center;
    margin-left: 0.45em;
    padding: 0 0.32em;
    border: 1px solid color-mix(in srgb, currentColor 28%, transparent);
    border-radius: 999px;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Hiragino Sans", sans-serif;
    font-size: 0.8em;
    font-weight: 600;
    line-height: 1.5;
    letter-spacing: 0.01em;
    white-space: nowrap;
    vertical-align: middle;
    opacity: 0.88;
}

.math-text {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Hiragino Sans", sans-serif;
    font-size: 0.95em;
    font-style: normal;
    font-weight: 500;
    letter-spacing: normal;
    text-transform: none;
}

.math-text-roman,
.math-operator {
    font-style: normal;
}

.math-text-bold {
    font-weight: 700;
}

.math-text-italic {
    font-style: italic;
}

.math-text-blackboard {
    font-family: "Times New Roman", "STIX Two Math", "Cambria Math", serif;
    font-weight: 650;
    letter-spacing: 0.01em;
}

.math-text-calligraphic {
    font-family: "Apple Chancery", "Snell Roundhand", "Times New Roman", cursive;
    font-weight: 600;
}

.math-unknown {
    opacity: 0.88;
}

.math-shell sup,
.math-shell sub {
    font-size: 0.72em;
    line-height: 0;
    position: relative;
}

.math-shell sup {
    top: -0.45em;
}

.math-shell sub {
    bottom: -0.1em;
}

.math-fallback .math-content {
    font-size: 0.96em;
}

.math-shell.math-display.math-fallback {
    display: block;
    min-width: 0;
    max-width: 100%;
}

.math-fallback-block {
    display: block;
    width: min(100%, 58rem);
    margin: 0.12em 0;
    border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
    border-radius: 14px;
    background: color-mix(in srgb, currentColor 5%, transparent);
    box-shadow: inset 0 1px 0 color-mix(in srgb, white 14%, transparent);
    overflow: hidden;
}

.math-fallback-inline {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    padding: 0.06em 0.46em;
    border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, currentColor 5%, transparent);
    vertical-align: baseline;
}

.math-fallback-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8em;
    padding: 0.42em 0.72em;
    border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent);
    background: color-mix(in srgb, currentColor 4%, transparent);
}

.math-fallback-label {
    display: inline-flex;
    align-items: center;
    min-height: 1.6em;
    padding: 0 0.5em;
    border-radius: 999px;
    background: color-mix(in srgb, currentColor 9%, transparent);
    color: inherit;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Hiragino Sans", sans-serif;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.86;
}

.math-fallback-note {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Hiragino Sans", sans-serif;
    font-size: 0.76rem;
    line-height: 1.35;
    opacity: 0.68;
}

.math-fallback-pre {
    margin: 0;
    padding: 0.72em 0.86em 0.84em;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: pre;
    line-height: 1.55;
}

.math-tex-raw {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    white-space: inherit;
    word-break: normal;
    overflow-wrap: normal;
    color: inherit;
}
`;
// Phase 2 keyboard model:
// - APP_NATIVE: PyQt/macOS owns the chord, JS owns the resulting state change.
// - VIEWER_NAVIGATION: document-level reading actions when no local widget owns the key.
// - LOCAL_WIDGET: focused tab strip / sidebar tree / popovers own arrows, enter, escape.
// - Reading-context bridges: Tab / Shift+Tab move between the reading surface and
//   widget-local focus targets without redefining any app-level shortcut meaning.
const KEYBOARD_HANDLING_SCOPE = Object.freeze({
    // Browser/app-like shortcuts should be claimed by PyQt first, then forwarded
    // into JS so viewer state stays authoritative without duplicating key parsing.
    APP_NATIVE: "app-native",
    // Viewer-level navigation runs at document scope only when no focused widget
    // with text editing semantics should own the key.
    VIEWER_NAVIGATION: "viewer-navigation",
    // Focused widgets keep their own handlers close to the widget for now
    // (sidebar tree arrows, viewer tools escape, extract model picker escape).
    LOCAL_WIDGET: "local-widget",
});

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
    sidebarWidth: "novel-archive-sidebar-width",
    sidebarMode: "novel-archive-sidebar-mode",
    tabSession: "novel-archive-tab-session",
    bookmarkTagGroups: "novel-archive-bookmark-tag-groups",
};

const SIDEBAR_WIDTH_MIN = 220;
const SIDEBAR_WIDTH_MAX = 520;

const COMMON_MATH_OPERATOR_NAMES = Object.freeze([
    "Im",
    "Re",
    "arg",
    "cos",
    "cosh",
    "cot",
    "coth",
    "csc",
    "deg",
    "det",
    "dim",
    "exp",
    "gcd",
    "hom",
    "inf",
    "ker",
    "lim",
    "ln",
    "log",
    "max",
    "min",
    "mod",
    "Pr",
    "sec",
    "sin",
    "sinh",
    "sup",
    "tan",
    "tanh",
]);

const EXTRACT_TEXT_FILTER_SPECS = [
    { key: "dateFrom", elementId: "extract-date-from", summaryLabel: "from" },
    { key: "dateTo", elementId: "extract-date-to", summaryLabel: "to" },
    { key: "titleContains", elementId: "extract-title", summaryLabel: "title" },
    { key: "promptContains", elementId: "extract-prompt", summaryLabel: "prompt" },
    { key: "responseContains", elementId: "extract-response", summaryLabel: "response" },
    { key: "sourceFile", elementId: "extract-source-file", summaryLabel: "file" },
];

function debugPerfLog(label) {
    const perf = window.performance;
    const now = perf && typeof perf.now === "function" ? perf.now() : Date.now();
    console.log(`[perf] ${Math.round(now)}ms ${label}`);
}

function markTreeStructureDirty() {
    treeStructureRevision += 1;
}

function getTreeStructureSignature() {
    return [
        treeStructureRevision,
        isAllTreesExpanded ? "all" : `single:${currentTreeConvIdx ?? ""}`,
        isSidebarFilterActive ? "sidebar-filter-on" : "sidebar-filter-off",
        currentParsedQuery.fuseQuery || "",
    ].join("|");
}

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

function createHtmlPlaceholderStore(prefix = "HTML_PLACEHOLDER") {
    const values = [];
    const tokenOpen = "\uE000";
    const tokenClose = "\uE001";
    const normalizedPrefix = String(prefix || "HTML_PLACEHOLDER");
    const markerCode =
        0xE100
        + Array.from(normalizedPrefix).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 256;
    const tokenMarker = String.fromCharCode(markerCode);
    return {
        put(html) {
            // Keep placeholders opaque through later markdown/math passes.
            const token = `${tokenOpen}${tokenMarker}${values.length.toString(36)}${tokenClose}`;
            values.push(html);
            return token;
        },
        restore(text) {
            let nextText = String(text || "");
            const patternSource = `${escapeRegex(tokenOpen)}${escapeRegex(tokenMarker)}([0-9a-z]+)${escapeRegex(tokenClose)}`;
            let replaced = true;
            while (replaced) {
                replaced = false;
                nextText = nextText.replace(new RegExp(patternSource, "g"), (_match, index) => {
                    replaced = true;
                    return values[parseInt(index, 36)] || "";
                });
            }
            return nextText;
        },
    };
}

function decodeSafeHtmlEntities(sourceText) {
    let nextText = String(sourceText || "");
    const namedEntities = new Map([
        ["nbsp", " "],
        ["thinsp", "\u2009"],
        ["middot", "·"],
        ["times", "×"],
        ["divide", "÷"],
        ["plusmn", "±"],
        ["apos", "'"],
        ["quot", '"'],
    ]);
    const numericWhitelist = new Map([
        [123, "{"],
        [125, "}"],
        [91, "["],
        [93, "]"],
        [40, "("],
        [41, ")"],
        [34, '"'],
        [39, "'"],
    ]);

    const decodeOnePass = (inputText) => {
        let outputText = String(inputText || "");
        outputText = outputText.replace(/&amp;(?=(?:#\d+|#x[0-9a-f]+|[a-z]+);)/gi, "&");
        outputText = outputText.replace(/&([a-z]+);/gi, (match, name) => {
            return namedEntities.get(String(name || "").toLowerCase()) || match;
        });
        outputText = outputText.replace(/&#(\d+);/g, (match, digits) => {
            const value = Number.parseInt(digits, 10);
            return numericWhitelist.get(value) || match;
        });
        outputText = outputText.replace(/&#x([0-9a-f]+);/gi, (match, digits) => {
            const value = Number.parseInt(digits, 16);
            return numericWhitelist.get(value) || match;
        });
        return outputText;
    };

    let previousText = "";
    while (nextText !== previousText) {
        previousText = nextText;
        nextText = decodeOnePass(nextText);
    }
    return nextText;
}

function normalizeExplicitMathDelimiters(sourceText) {
    let nextText = String(sourceText || "");
    // Some imported logs double-escape TeX delimiters like \\( ... \\).
    // Collapse only the delimiter escapes so explicit TeX survives intact.
    nextText = nextText.replace(/\\\\(?=[()[\]])/g, "\\");
    return nextText;
}

function protectStructuredArtifactSegments(sourceText, placeholders) {
    if (!placeholders) return String(sourceText || "");
    return String(sourceText || "")
        .split("\n")
        .map((line) => {
            const trimmed = String(line || "").trim();
            if (!trimmed || !looksLikeStructuredArtifactText(trimmed)) {
                return line;
            }
            return placeholders.put(`<code class="structured-artifact-inline">${escapeHTML(trimmed)}</code>`);
        })
        .join("\n");
}

function protectSafeHtmlSegments(sourceText, placeholders) {
    if (!placeholders) return String(sourceText || "");
    return String(sourceText || "").replace(/<\s*(br|wbr)\s*\/?\s*>/gi, (match) => {
        const normalized = /^<\s*wbr/i.test(match) ? "<wbr>" : "<br>";
        return placeholders.put(normalized);
    });
}

function containsExplicitTeX(sourceText) {
    return /\\(?:[A-Za-z]+|[\[\](){}])/u.test(String(sourceText || ""));
}

function containsProtectedMathSyntax(sourceText) {
    return (
        /\\\[[\s\S]*?\\\]/.test(String(sourceText || ""))
        || /\\\([\s\S]*?\\\)/.test(String(sourceText || ""))
        || /\$\$[\s\S]*?\$\$/.test(String(sourceText || ""))
        || /(^|[^\\])\$(?!\$)[^\n]+?(?<!\\)\$(?!\$)/.test(String(sourceText || ""))
    );
}

function normalizePlainMathShorthand(sourceText) {
    let nextText = String(sourceText || "");
    nextText = normalizeBareMathCommands(nextText);
    nextText = nextText.replace(
        /\(([^()\n]+)\)\((n|k|m|i|j|\d+|[A-Za-z0-9]+(?:-[A-Za-z0-9]+)?)\)/g,
        (_match, body, order) => `(${body})^{(${order})}`
    );
    nextText = nextText.replace(
        /\b([A-Za-z])\((n|k|m|i|j|\d+|[A-Za-z0-9]+(?:-[A-Za-z0-9]+)?)\)/g,
        (_match, symbol, order) => `${symbol}^{(${order})}`
    );
    nextText = nextText.replace(
        /\\sum\s*([A-Za-z])\s*=\s*([A-Za-z0-9+-]+)\s*([A-Za-z0-9+-]+)/g,
        (_match, variable, lower, upper) => `\\sum_{${variable}=${lower}}^{${upper}}`
    );
    nextText = nextText.replace(
        /\\sum([A-Za-z])=([A-Za-z0-9+-]+)([A-Za-z])(?=[^A-Za-z]|$)/g,
        (_match, variable, lower, upper) => `\\sum_{${variable}=${lower}}^{${upper}}`
    );
    return nextText;
}

function normalizeBareMathWords(sourceText) {
    let nextText = String(sourceText || "");
    const bareWordReplacements = [
        ["langle", "⟨"],
        ["rangle", "⟩"],
        ["delta", "δ"],
        ["cdot", "·"],
        ["times", "×"],
        ["infty", "∞"],
    ];

    bareWordReplacements.forEach(([word, replacement]) => {
        const pattern = new RegExp(`(^|[^A-Za-z])${word}(?=[^A-Za-z]|$)`, "g");
        nextText = nextText.replace(pattern, (_match, prefix) => `${prefix}${replacement}`);
    });

    return nextText;
}

function normalizeBareMathCommands(sourceText) {
    let nextText = String(sourceText || "");
    const bareCommandNames = [
        "langle",
        "rangle",
        "delta",
        "chi",
        "theta",
        "lambda",
        "mu",
        "pi",
        "sigma",
        "phi",
        "psi",
        "omega",
        "sum",
        "prod",
        "int",
        "sqrt",
        "cdot",
        "times",
        "infty",
        "leq",
        "geq",
        "neq",
        "mid",
        "varnothing",
        "bigcup",
        "bigcap",
    ];

    bareCommandNames.forEach((name) => {
        const pattern = new RegExp(`(^|[^\\\\A-Za-z])${name}(?=[^A-Za-z]|$)`, "g");
        nextText = nextText.replace(pattern, (_match, prefix) => `${prefix}\\${name}`);
    });

    nextText = nextText.replace(/(^|[^\\A-Za-z])mathbb\s*([A-Z])(?=[^A-Za-z]|$)/g, (_match, prefix, letter) => `${prefix}\\mathbb{${letter}}`);
    nextText = nextText.replace(/(^|[^\\A-Za-z])mathbb([A-Z])(?=[^A-Za-z]|$)/g, (_match, prefix, letter) => `${prefix}\\mathbb{${letter}}`);
    nextText = nextText.replace(/(^|[^\\A-Za-z])boldsymbol\s*([A-Za-z0-9])(?=[^A-Za-z0-9]|$)/g, (_match, prefix, symbol) => `${prefix}\\boldsymbol{${symbol}}`);
    nextText = nextText.replace(/(^|[^\\A-Za-z])boxed\s*([A-Za-z0-9])(?=[^A-Za-z0-9]|$)/g, (_match, prefix, symbol) => `${prefix}\\boxed{${symbol}}`);
    nextText = nextText.replace(/(^|[^\\A-Za-z])tag\s*([A-Za-z0-9_-]+)(?=[^A-Za-z0-9_-]|$)/g, (_match, prefix, label) => `${prefix}\\tag{${label}}`);
    nextText = nextText.replace(/(?<!\\)\bbinom([A-Za-z0-9()+-]+)/g, (_match, rest) => {
        const raw = String(rest || "");
        const letterIndexes = Array.from(raw).flatMap((char, index) => /[A-Za-z]/.test(char) ? [index] : []);
        if (letterIndexes.length < 2) {
            return `binom${raw}`;
        }
        const splitIndex = letterIndexes[letterIndexes.length - 1];
        const upper = raw.slice(0, splitIndex);
        const lower = raw.slice(splitIndex);
        if (!upper || !lower) {
            return `binom${raw}`;
        }
        return `\\binom{${upper}}{${lower}}`;
    });

    return nextText;
}

function normalizeMathSourceArtifacts(sourceText) {
    let nextText = String(sourceText || "");

    // Normalize common shorthand forms so the renderer can treat them like
    // explicit TeX groups instead of leaking raw commands.
    // Recover common legacy math HTML snippets into TeX-like source before the
    // markdown and math passes run. This keeps old imported logs renderable.
    nextText = nextText.replace(
        /<span\b[^>]*class=(["'])math-frac\1[^>]*>\s*<span\b[^>]*class=(["'])math-frac-num\2[^>]*>([\s\S]*?)<\/span>\s*<span\b[^>]*class=(["'])math-frac-den\4[^>]*>([\s\S]*?)<\/span>\s*<\/span>/gi,
        (_match, _q1, _q2, numerator, _q3, denominator) => `\\frac{${numerator}}{${denominator}}`
    );
    nextText = nextText.replace(
        /<span\b[^>]*class=(["'])math-sqrt\1[^>]*>\s*<span\b[^>]*class=(["'])math-sqrt-sign\2[^>]*>√<\/span>\s*<span\b[^>]*class=(["'])math-sqrt-body\3[^>]*>([\s\S]*?)<\/span>\s*<\/span>/gi,
        (_match, _q1, _q2, _q3, body) => `\\sqrt{${body}}`
    );
    const entityReplacements = [
        ["&middot;", "\\cdot "],
        ["&times;", "\\times "],
        ["&divide;", "\\div "],
        ["&plusmn;", "\\pm "],
        ["&thinsp;", "\\,"],
        ["&nbsp;", " "],
    ];

    const lines = nextText.split("\n").map((line) => {
        const looksMathArtifactLine =
            /class=(["'])math-[^"']+\1/i.test(line)
            || /&(middot|times|divide|plusmn|thinsp|nbsp);/i.test(line)
            || (
                /<(sup|sub)\b/i.test(line)
                && (
                    /\\[A-Za-z]+/.test(line)
                    || /(?:^|[^A-Za-z])(sinh|cosh|tanh|sin|cos|tan|log|ln|lim|exp|max|min|cosh|sinh)(?:[^A-Za-z]|$)/i.test(line)
                    || /[=+/*√^]/.test(line)
                    || /\be<sup\b/i.test(line)
                )
            );

        if (!looksMathArtifactLine) {
            return line;
        }

        let normalizedLine = line;
        normalizedLine = normalizedLine.replace(/<sup\b[^>]*>([\s\S]*?)<\/sup>/gi, (_match, inner) => `^{${inner}}`);
        normalizedLine = normalizedLine.replace(/<sub\b[^>]*>([\s\S]*?)<\/sub>/gi, (_match, inner) => `_{${inner}}`);
        normalizedLine = normalizedLine.replace(/<\/?span\b[^>]*class=(["'])math-[^"']+\1[^>]*>/gi, "");
        normalizedLine = normalizedLine.replace(/<br\s*\/?>/gi, "\\\\");
        entityReplacements.forEach(([pattern, replacement]) => {
            normalizedLine = normalizedLine.split(pattern).join(replacement);
        });
        return normalizedLine;
    });
    nextText = lines.join("\n");

    nextText = nextText
        .split("\n")
        .map((line) => {
            const rawLine = String(line || "");
            if (!rawLine.trim()) return rawLine;
            if (looksLikeStructuredArtifactText(rawLine)) return rawLine;

            if (containsExplicitTeX(rawLine)) {
                return rawLine
                    .replace(
                        /\\(bar|vec|hat|widehat|tilde|overline)\s+((?:\\[A-Za-z]+\{[^{}]+\})|(?:\\[A-Za-z]+)|(?:[A-Za-z0-9]+(?:_[A-Za-z0-9]+)?))/g,
                        (_match, command, operand) => `\\${command}{${operand}}`
                    )
                    .replace(
                        /\\(mathbb|mathcal|mathbf|mathrm|mathit|boldsymbol)\s+((?:\\[A-Za-z]+\{[^{}]+\})|(?:\\[A-Za-z]+)|(?:[A-Za-z0-9]+(?:_[A-Za-z0-9]+)?))/g,
                        (_match, command, operand) => `\\${command}{${operand}}`
                    )
                    .replace(
                        /\\boxed\s+((?:\\[A-Za-z]+\{[^{}]+\})|(?:\\[A-Za-z]+)|(?:[A-Za-z0-9]+(?:_[A-Za-z0-9]+)?))/g,
                        (_match, operand) => `\\boxed{${operand}}`
                    )
                    .replace(
                        /\\tag\s+((?:\\[A-Za-z]+\{[^{}]+\})|(?:\\[A-Za-z]+)|(?:[A-Za-z0-9_-]+))/g,
                        (_match, operand) => `\\tag{${operand}}`
                    );
            }

            return normalizePlainMathShorthand(rawLine);
        })
        .join("\n");

    return nextText;
}

function looksLikeStructuredArtifactText(line) {
    const trimmed = String(line || "").trim();
    if (!trimmed) return false;

    const startsLikeInvocation = /^[A-Za-z_][A-Za-z0-9_.]*\s*\(/.test(trimmed);
    const hasJsonLikePayload =
        /[\[{]\s*"[^"]+"\s*:/.test(trimmed)
        || /[\[{]\s*'[^']+'\s*:/.test(trimmed)
        || /\b[A-Za-z_][A-Za-z0-9_]*\s*:\s*["'\[{0-9A-Za-z_-]/.test(trimmed);
    const hasStructuredDelimiters =
        /[{}[\]]/.test(trimmed)
        && /[:,]/.test(trimmed)
        && /["']/.test(trimmed);
    const looksLikeJsonFragment =
        hasJsonLikePayload
        && /[{}[\],]/.test(trimmed);

    return (startsLikeInvocation && (hasJsonLikePayload || hasStructuredDelimiters))
        || (/^[A-Za-z_][A-Za-z0-9_.]*\s*\{/.test(trimmed) && hasJsonLikePayload)
        || looksLikeJsonFragment;
}

function looksLikeMathishText(line) {
    const trimmed = String(line || "").trim();
    if (!trimmed) return false;
    if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) return false;
    if (/^<\s*\/?\s*[A-Za-z][^>]*>$/.test(trimmed)) return false;
    if (/(?:\*\*|__)/.test(trimmed)) return false;
    if (/^#{1,6}\s/.test(trimmed)) return false;
    if (/[。、「」『』【】]/.test(trimmed)) return false;
    if (looksLikeStructuredArtifactText(trimmed)) return false;
    if (/^[A-Za-z]{2,}[A-Za-z0-9]*(?:_[A-Za-z0-9]{2,})+$/.test(trimmed)) return false;

    const mathSignals = [
        /\\[A-Za-z]+/,
        /[=+/*^_<>≤≥∑∫√∞∈∉⊂⊆∪∩≅↦→←δπμχλσφψωℂℝℤℕℚℙ⟨⟩]/,
        /\b(?:binom|mathbb|boldsymbol|langle|rangle|delta|chi|theta|sum|int|prod|sqrt)\b/,
    ];
    if (!mathSignals.some((pattern) => pattern.test(trimmed))) {
        return false;
    }

    const nonMathResidue = trimmed
        .replace(/\\[A-Za-z]+\*?(?:\{[^{}]*\})?/g, "")
        .replace(/\b(?:binom|mathbb|boldsymbol|langle|rangle|delta|chi|theta|sum|int|prod|sqrt)\b/g, "")
        .replace(/[{}[\]()^_=+\-*/,:;.|<>~`'"\\\d\s≤≥∑∫√∞∈∉⊂⊆∪∩≅↦→←δπμχλσφψωℂℝℤℕℚℙ⟨⟩]/g, "")
        .replace(/[A-Za-z]/g, "");
    return nonMathResidue.length === 0;
}

function replaceInlineImplicitMath(sourceText, placeholders) {
    let nextText = String(sourceText || "");
    const explicitTokenPattern = /(?:\\[A-Za-z]+|[A-Za-z0-9{}_^=+\-*/<>|&.,'"():;\[\]⟨⟩≤≥∑∫√∞∈∉⊂⊆∪∩≅↦→←δπμχλσφψωℂℝℤℕℚℙ¯]| )+/g;
    nextText = nextText.replace(/\\langle\s*([^\\\n]+?)\s*\\rangle/g, (_match, inner) => {
        return placeholders.put(renderMathBlock(`\\langle ${inner} \\rangle`, false));
    });
    nextText = nextText.replace(/⟨([^⟨⟩\n]+?)⟩/g, (_match, inner) => {
        return placeholders.put(renderMathBlock(`\\langle ${inner} \\rangle`, false));
    });

    nextText = nextText.replace(explicitTokenPattern, (candidate) => {
        const trimmed = String(candidate || "").trim();
        if (!trimmed.includes("\\")) return candidate;
        if (trimmed.length < 3) return candidate;
        if (!looksLikeMathishText(trimmed)) return candidate;
        return placeholders.put(renderMathBlock(trimmed, false));
    });

    const tokenPattern = /[A-Za-z0-9\\{}_^=+\-*/<>|&.,'"():;\[\]⟨⟩∑∫√∞∈∉⊂⊆∪∩≅↦→←δπμχλσφψωℂℝℤℕℚℙ¯]+/g;
    return nextText.replace(tokenPattern, (candidate) => {
        if (candidate.length < 3) return candidate;
        if (candidate.includes("\\")) return candidate;
        if (!looksLikeMathishText(candidate)) return candidate;
        return placeholders.put(renderMathBlock(candidate, false));
    });
}

function renderMathFragment(source, htmlPlaceholders = null) {
    const placeholderStore = htmlPlaceholders || createHtmlPlaceholderStore("MATH_HTML");
    const shouldRestore = !htmlPlaceholders;
    let html = escapeHTML(normalizeBareMathWords(String(source || "").trim()));
    const replacements = [
        ["\\displaystyle", ""],
        ["\\textstyle", ""],
        ["\\scriptstyle", ""],
        ["\\scriptscriptstyle", ""],
        ["\\cdot", "·"],
        ["\\times", "×"],
        ["\\div", "÷"],
        ["\\pm", "±"],
        ["\\mp", "∓"],
        ["\\approx", "≈"],
        ["\\neq", "≠"],
        ["\\ne", "≠"],
        ["\\leq", "≤"],
        ["\\geq", "≥"],
        ["\\le", "≤"],
        ["\\ge", "≥"],
        ["\\to", "→"],
        ["\\leftrightarrow", "↔"],
        ["\\longleftrightarrow", "↔"],
        ["\\longrightarrow", "→"],
        ["\\rightarrow", "→"],
        ["\\longmapsto", "↦"],
        ["\\longmapsto", "↦"],
        ["\\mapsto", "↦"],
        ["\\longleftarrow", "←"],
        ["\\leftarrow", "←"],
        ["\\Rightarrow", "⇒"],
        ["\\Longrightarrow", "⇒"],
        ["\\Leftarrow", "⇐"],
        ["\\Longleftarrow", "⇐"],
        ["\\cong", "≅"],
        ["\\infty", "∞"],
        ["\\partial", "∂"],
        ["\\nabla", "∇"],
        ["\\sum", "∑"],
        ["\\prod", "∏"],
        ["\\int", "∫"],
        ["\\bigcup", "⋃"],
        ["\\bigcap", "⋂"],
        ["\\forall", "∀"],
        ["\\exists", "∃"],
        ["\\varnothing", "∅"],
        ["\\in", "∈"],
        ["\\notin", "∉"],
        ["\\mid", "∣"],
        ["\\subseteq", "⊆"],
        ["\\supseteq", "⊇"],
        ["\\subset", "⊂"],
        ["\\supset", "⊃"],
        ["\\setminus", "∖"],
        ["\\cup", "∪"],
        ["\\cap", "∩"],
        ["\\land", "∧"],
        ["\\lor", "∨"],
        ["\\sim", "∼"],
        ["\\alpha", "α"],
        ["\\beta", "β"],
        ["\\gamma", "γ"],
        ["\\delta", "δ"],
        ["\\eta", "η"],
        ["\\varepsilon", "ε"],
        ["\\epsilon", "ϵ"],
        ["\\theta", "θ"],
        ["\\vartheta", "ϑ"],
        ["\\iota", "ι"],
        ["\\kappa", "κ"],
        ["\\lambda", "λ"],
        ["\\mu", "μ"],
        ["\\nu", "ν"],
        ["\\xi", "ξ"],
        ["\\pi", "π"],
        ["\\varpi", "ϖ"],
        ["\\rho", "ρ"],
        ["\\varrho", "ϱ"],
        ["\\sigma", "σ"],
        ["\\varsigma", "ς"],
        ["\\tau", "τ"],
        ["\\upsilon", "υ"],
        ["\\phi", "φ"],
        ["\\varphi", "ϕ"],
        ["\\chi", "χ"],
        ["\\psi", "ψ"],
        ["\\omega", "ω"],
        ["\\Gamma", "Γ"],
        ["\\Delta", "Δ"],
        ["\\Theta", "Θ"],
        ["\\Lambda", "Λ"],
        ["\\Xi", "Ξ"],
        ["\\Pi", "Π"],
        ["\\Sigma", "Σ"],
        ["\\Upsilon", "Υ"],
        ["\\Phi", "Φ"],
        ["\\Psi", "Ψ"],
        ["\\Omega", "Ω"],
        ["\\left", ""],
        ["\\right", ""],
        ["\\bigl", ""],
        ["\\bigr", ""],
        ["\\Bigl", ""],
        ["\\Bigr", ""],
        ["\\biggl", ""],
        ["\\biggr", ""],
        ["\\Biggl", ""],
        ["\\Biggr", ""],
        ["\\quad", " "],
        ["\\qquad", "  "],
        ["\\ldots", "…"],
        ["\\cdots", "⋯"],
        ["\\dots", "…"],
        ["\\,", " "],
        ["\\:", " "],
        ["\\;", " "],
        ["\\!", ""],
        ["\\{", "&#123;"],
        ["\\}", "&#125;"],
    ];

    replacements.forEach(([pattern, replacement]) => {
        html = html.split(pattern).join(replacement);
    });

    let previous = "";
    while (html !== previous) {
        previous = html;
        html = html.replace(
            /\\begin\{(bmatrix|pmatrix|matrix|cases|vmatrix|Vmatrix)\}([\s\S]*?)\\end\{\1\}/g,
            (_match, kind, body) => placeholderStore.put(renderMathMatrix(kind, body, placeholderStore))
        );
        html = html.replace(/\\vec\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(renderMathAccent("vec", inner, placeholderStore)));
        html = html.replace(/\\hat\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(renderMathAccent("hat", inner, placeholderStore)));
        html = html.replace(/\\widehat\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(renderMathAccent("widehat", inner, placeholderStore)));
        html = html.replace(/\\tilde\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(renderMathAccent("tilde", inner, placeholderStore)));
        html = html.replace(/\\bar\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(renderMathAccent("bar", inner, placeholderStore)));
        html = html.replace(/\\overline\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(renderMathAccent("overline", inner, placeholderStore)));
        html = html.replace(
            new RegExp(String.raw`\\(${COMMON_MATH_OPERATOR_NAMES.join("|")})\b`, "g"),
            (_match, operatorName) => placeholderStore.put(renderMathOperator(operatorName))
        );
        html = html.replace(/\\operatorname\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(`<span class="math-text math-operator">${renderMathFragment(inner, placeholderStore)}</span>`));
        html = html.replace(/\\mathrm\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(`<span class="math-text math-text-roman">${renderMathFragment(inner, placeholderStore)}</span>`));
        html = html.replace(/\\mathbf\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(`<span class="math-text math-text-bold">${renderMathFragment(inner, placeholderStore)}</span>`));
        html = html.replace(/\\mathit\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(`<span class="math-text math-text-italic">${renderMathFragment(inner, placeholderStore)}</span>`));
        html = html.replace(/\\boldsymbol\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(`<span class="math-text math-text-bold">${renderMathFragment(inner, placeholderStore)}</span>`));
        html = html.replace(/\\mathbb\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(renderMathAlphabet("mathbb", inner, placeholderStore)));
        html = html.replace(/\\mathcal\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(renderMathAlphabet("mathcal", inner, placeholderStore)));
        html = html.replace(/\\boxed\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(`<span class="math-boxed">${renderMathFragment(inner, placeholderStore)}</span>`));
        html = html.replace(/\\tag\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(`<span class="math-tag">(${renderMathFragment(inner, placeholderStore)})</span>`));
        html = html.replace(/\\text\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(`<span class="math-text">${inner}</span>`));
        html = html.replace(/\\sqrt\{([^{}]+)\}/g, (_match, inner) => (
            placeholderStore.put(`<span class="math-sqrt"><span class="math-sqrt-sign">√</span><span class="math-sqrt-body">${renderMathFragment(inner, placeholderStore)}</span></span>`)
        ));
        html = html.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_match, numerator, denominator) => (
            placeholderStore.put(`<span class="math-frac"><span class="math-frac-num">${renderMathFragment(numerator, placeholderStore)}</span><span class="math-frac-den">${renderMathFragment(denominator, placeholderStore)}</span></span>`)
        ));
        html = html.replace(/\^\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(`<sup>${renderMathFragment(inner, placeholderStore)}</sup>`));
        html = html.replace(/_\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(`<sub>${renderMathFragment(inner, placeholderStore)}</sub>`));
    }

    html = html.replace(/\^([A-Za-z0-9+\-*/=().]+)/g, "<sup>$1</sup>");
    html = html.replace(/_([A-Za-z0-9+\-*/=().]+)/g, "<sub>$1</sub>");
    html = normalizeResidualMathCommands(html);
    html = html.replace(/[{}]/g, "");
    if (shouldRestore) {
        html = placeholderStore.restore(html);
    }
    return html;
}

function evaluateMathRender(source, renderedHtml) {
    const rawSource = String(source || "").trim();
    if (!rawSource) {
        return { ok: true, reason: "empty-source" };
    }
    if (!renderedHtml || !String(renderedHtml).trim()) {
        return { ok: false, reason: "empty-render" };
    }
    if (/\\(?:begin|end)\{/.test(renderedHtml)) {
        return { ok: false, reason: "unresolved-environment" };
    }
    if (/\\[A-Za-z]+/.test(renderedHtml)) {
        return { ok: false, reason: "unresolved-command" };
    }
    if (/[{}]/.test(renderedHtml)) {
        return { ok: false, reason: "structural-residue" };
    }
    return { ok: true, reason: "rendered" };
}

function normalizeResidualMathCommands(html) {
    let nextHtml = String(html || "");
    nextHtml = nextHtml.replace(/\\\\/g, "<br>");
    nextHtml = nextHtml.replace(/\\(?=\s)/g, "");
    nextHtml = nextHtml.replace(/\\([A-Za-z]+)\b/g, (_match, name) => {
        if (name === "begin" || name === "end") {
            return `\\${name}`;
        }
        return `<span class="math-text math-unknown">${escapeHTML(name)}</span>`;
    });
    return nextHtml;
}

function renderMathAccent(kind, inner, htmlPlaceholders = null) {
    const accentMarks = {
        vec: "→",
        hat: "^",
        widehat: "^",
        tilde: "~",
        bar: "¯",
        overline: "¯",
    };
    const accentMark = accentMarks[kind] || "¯";
    return `<span class="math-accent math-accent-${kind}"><span class="math-accent-mark">${accentMark}</span><span class="math-accent-body">${renderMathFragment(inner, htmlPlaceholders)}</span></span>`;
}

function renderMathOperator(name) {
    return `<span class="math-text math-operator">${escapeHTML(String(name || "").trim())}</span>`;
}

function renderMathAlphabet(kind, inner, htmlPlaceholders = null) {
    const normalized = String(inner || "").trim();
    if (!normalized) return "";

    if (kind === "mathbb") {
        const blackboardMap = {
            C: "ℂ",
            H: "ℍ",
            N: "ℕ",
            P: "ℙ",
            Q: "ℚ",
            R: "ℝ",
            Z: "ℤ",
        };
        if (/^[A-Z]$/.test(normalized) && blackboardMap[normalized]) {
            return `<span class="math-text math-text-blackboard">${blackboardMap[normalized]}</span>`;
        }
        return `<span class="math-text math-text-blackboard">${renderMathFragment(normalized, htmlPlaceholders)}</span>`;
    }

    if (kind === "mathcal") {
        return `<span class="math-text math-text-calligraphic">${renderMathFragment(normalized, htmlPlaceholders)}</span>`;
    }

    return renderMathFragment(normalized, htmlPlaceholders);
}

function renderMathMatrix(kind, body, htmlPlaceholders = null) {
    const bracketByKind = {
        bmatrix: ["[", "]"],
        pmatrix: ["(", ")"],
        matrix: ["", ""],
        cases: ["{", ""],
        vmatrix: ["|", "|"],
        Vmatrix: ["‖", "‖"],
    };
    const [leftBracket, rightBracket] = bracketByKind[kind] || ["[", "]"];
    const normalizedBody = String(body || "").trim();
    const rows = normalizedBody
        .split(/\\\\/g)
        .map((row) => row.trim())
        .filter(Boolean);
    const rowHtml = rows
        .map((row) => {
            const cells = row
                .split("&")
                .map((cell) => cell.trim())
                .filter((cell) => cell.length > 0);
            const cellHtml = (cells.length ? cells : [""])
                .map((cell) => `<span class="math-matrix-cell">${renderMathFragment(cell, htmlPlaceholders)}</span>`)
                .join("");
            return `<span class="math-matrix-row">${cellHtml}</span>`;
        })
        .join("");
    const leftHtml = leftBracket ? `<span class="math-matrix-bracket math-matrix-bracket-left">${leftBracket}</span>` : "";
    const rightHtml = rightBracket ? `<span class="math-matrix-bracket math-matrix-bracket-right">${rightBracket}</span>` : "";
    return `<span class="math-matrix math-matrix-${kind}">${leftHtml}<span class="math-matrix-grid">${rowHtml}</span>${rightHtml}</span>`;
}

function renderMathFallback(source, displayMode = false) {
    const rawSource = escapeHTML(String(source || "").trim());
    if (displayMode) {
        return `
            <div class="math-display math-fallback math-fallback-block" data-math-fallback="true">
                <div class="math-fallback-header">
                    <span class="math-fallback-label">Math</span>
                    <span class="math-fallback-note">fallback view</span>
                </div>
                <pre class="math-fallback-pre"><code class="math-tex-raw">${rawSource}</code></pre>
            </div>
        `.trim();
    }
    return `<span class="math-inline math-fallback math-fallback-inline" data-math-fallback="true"><code class="math-tex-raw">${rawSource}</code></span>`;
}

function renderMathJaxNode(source, displayMode = false) {
    const rawSource = String(source || "").trim();
    const tag = displayMode ? "div" : "span";
    const className = displayMode ? "math-display math-renderer-mathjax" : "math-inline math-renderer-mathjax";
    const openDelimiter = displayMode ? "\\[" : "\\(";
    const closeDelimiter = displayMode ? "\\]" : "\\)";
    return `<${tag} class="${className}" data-math-renderer="mathjax" data-math-source="${escapeHTML(encodeURIComponent(rawSource))}">${openDelimiter}${escapeHTML(rawSource)}${closeDelimiter}</${tag}>`;
}

function buildMathHtmlNode({ source, displayMode = false, renderedHtml = "", evaluation = null }) {
    const tag = displayMode ? "div" : "span";
    const className = displayMode ? "math-display" : "math-inline";
    const renderEvaluation = evaluation || evaluateMathRender(source, renderedHtml);
    if (!renderEvaluation.ok) {
        return renderMathFallback(source, displayMode);
    }
    return `<${tag} class="${className}" data-math-rendered="true" data-math-reason="${renderEvaluation.reason}"><span class="math-content">${renderedHtml}</span></${tag}>`;
}

function renderMathBlock(source, displayMode = false) {
    if (ACTIVE_MATH_RENDERER === "mathjax") {
        return renderMathJaxNode(source, displayMode);
    }
    try {
        let rendered = renderMathFragment(source);
        if (displayMode && String(source || "").includes("\n")) {
            rendered = rendered.replace(/\n+/g, "<br>");
        }
        return buildMathHtmlNode({
            source,
            displayMode,
            renderedHtml: rendered,
        });
    } catch (_error) {
        return renderMathFallback(source, displayMode);
    }
}

function ensureRenderer() {
    if (
        ACTIVE_MATH_RENDERER === "mathjax"
        && window.MathJax
        && (
            typeof window.MathJax.typesetPromise === "function"
            || window.MathJax.startup?.promise
            || window.MathJax.startup?.document
        )
    ) {
        return "mathjax";
    }
    return "builtin";
}

function ensureMathJaxTypesetMethods() {
    if (!window.MathJax?.startup?.document) return;
    const startup = window.MathJax.startup;
    if (typeof window.MathJax.typesetPromise === "function") return;

    if (typeof startup.makeTypesetMethods === "function") {
        try {
            startup.makeTypesetMethods();
        } catch (_error) {
            // Fall through to manual method wiring below.
        }
    }
    if (typeof window.MathJax.typesetPromise === "function") return;

    window.MathJax.typesetPromise = (elements = null) => {
        const mathDocument = startup.document;
        const nodes = Array.isArray(elements)
            ? elements.filter(Boolean)
            : (elements ? [elements] : null);
        const previousElements = mathDocument.options?.elements;
        if (mathDocument.options) {
            mathDocument.options.elements = nodes;
        }
        if (typeof mathDocument.reset === "function") {
            mathDocument.reset();
        }
        const renderResult =
            typeof mathDocument.renderPromise === "function"
                ? mathDocument.renderPromise()
                : (typeof mathDocument.render === "function"
                    ? (mathDocument.render(), Promise.resolve())
                    : Promise.reject(new Error("MathJax render method is unavailable")));
        return Promise.resolve(renderResult).finally(() => {
            if (mathDocument.options) {
                mathDocument.options.elements = previousElements;
            }
        });
    };
    if (typeof window.MathJax.typeset !== "function") {
        window.MathJax.typeset = (elements = null) => {
            const mathDocument = startup.document;
            const nodes = Array.isArray(elements)
                ? elements.filter(Boolean)
                : (elements ? [elements] : null);
            const previousElements = mathDocument.options?.elements;
            if (mathDocument.options) {
                mathDocument.options.elements = nodes;
            }
            if (typeof mathDocument.reset === "function") {
                mathDocument.reset();
            }
            if (typeof mathDocument.render === "function") {
                mathDocument.render();
            }
            if (mathDocument.options) {
                mathDocument.options.elements = previousElements;
            }
        };
    }
}

function initMathJaxRuntime(options = {}) {
    const timeoutMs =
        Number.isFinite(options?.timeoutMs) && Number(options.timeoutMs) > 0
            ? Number(options.timeoutMs)
            : null;
    if (ensureRenderer() !== "mathjax") {
        return Promise.resolve("builtin");
    }
    if (typeof window.MathJax?.typesetPromise === "function") {
        return Promise.resolve("mathjax");
    }
    if (mathJaxRuntimePromise) {
        if (timeoutMs == null) {
            return mathJaxRuntimePromise;
        }
        return Promise.race([
            mathJaxRuntimePromise,
            new Promise((resolve) => {
                window.setTimeout(() => resolve("timeout"), timeoutMs);
            }),
        ]);
    }
    const startupPromise = window.MathJax?.startup?.promise;
    if (!startupPromise) {
        ensureMathJaxTypesetMethods();
        return Promise.resolve(ensureRenderer());
    }
    mathJaxRuntimePromise = Promise.resolve(startupPromise)
        .then(() => {
            ensureMathJaxTypesetMethods();
            return ensureRenderer();
        })
        .catch((_error) => {
            mathJaxRuntimePromise = null;
            return "builtin";
        });
    if (timeoutMs == null) {
        return mathJaxRuntimePromise;
    }
    return Promise.race([
        mathJaxRuntimePromise,
        new Promise((resolve) => {
            window.setTimeout(() => resolve("timeout"), timeoutMs);
        }),
    ]);
}

function queueMathJaxTypeset(mathNodes) {
    const nodes = Array.isArray(mathNodes) ? mathNodes.filter(Boolean) : [];
    if (!nodes.length) return Promise.resolve();
    if (!window.MathJax) {
        return Promise.reject(new Error("MathJax is not available"));
    }
    return initMathJaxRuntime().then(() => {
        if (typeof window.MathJax.typesetPromise === "function") {
            return window.MathJax.typesetPromise(nodes);
        }
        throw new Error("MathJax typesetPromise is unavailable");
    });
}

function isMathNodeRenderable(node) {
    if (!node || !node.isConnected) return false;
    if (node.closest('[hidden], [aria-hidden="true"]')) return false;
    const style = window.getComputedStyle(node);
    if (!style || style.display === "none" || style.visibility === "hidden") {
        return false;
    }
    if (typeof node.getClientRects === "function" && node.getClientRects().length > 0) {
        return true;
    }
    const parentElement = node.parentElement;
    if (!parentElement) return false;
    const parentStyle = window.getComputedStyle(parentElement);
    return Boolean(parentStyle && parentStyle.display !== "none" && parentStyle.visibility !== "hidden");
}

function isMathNodeNearViewerViewport(node, marginPx = 420) {
    if (!node || !node.isConnected) return false;
    const viewer = document.getElementById("chat-viewer");
    const nodeRect = typeof node.getBoundingClientRect === "function" ? node.getBoundingClientRect() : null;
    if (!nodeRect) return false;
    if (!viewer || typeof viewer.getBoundingClientRect !== "function") {
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        return nodeRect.bottom >= -marginPx && nodeRect.top <= viewportHeight + marginPx;
    }
    const viewerRect = viewer.getBoundingClientRect();
    return nodeRect.bottom >= viewerRect.top - marginPx && nodeRect.top <= viewerRect.bottom + marginPx;
}

function scheduleVisibleMathTypeset(root = document.getElementById("chat-viewer")) {
    if (!root || ensureRenderer() !== "mathjax") return;
    pendingVisibleMathTypesetRoot = root;
    if (pendingVisibleMathTypesetFrame) return;
    pendingVisibleMathTypesetFrame = window.requestAnimationFrame(() => {
        pendingVisibleMathTypesetFrame = 0;
        const targetRoot = pendingVisibleMathTypesetRoot;
        pendingVisibleMathTypesetRoot = null;
        if (!targetRoot || !targetRoot.isConnected) return;
        isolateRenderedMath(targetRoot, { visibleOnly: true });
    });
}

function isolateRenderedMath(root, options = {}) {
    if (!root?.querySelectorAll) return;

    if (ensureRenderer() === "mathjax") {
        const visibleOnly = options.visibleOnly !== false;
        const viewportMargin = Number.isFinite(options.viewportMargin) ? options.viewportMargin : 420;
        const mathNodes = Array.from(root.querySelectorAll('[data-math-renderer="mathjax"]'))
            .filter((node) => isMathNodeRenderable(node))
            .filter((node) => !visibleOnly || isMathNodeNearViewerViewport(node, viewportMargin))
            .filter((node) => node.dataset.mathPending !== "true")
            .filter((node) => node.dataset.mathReady !== "true");
        if (!mathNodes.length) return;
        let sequence = Promise.resolve();
        mathNodes.forEach((node) => {
            sequence = sequence.then(() => {
                if (node.dataset.mathFallback === "true" || node.dataset.mathReady === "true") {
                    return null;
                }
                node.dataset.mathPending = "true";
                return queueMathJaxTypeset([node])
                    .then(() => {
                        node.dataset.mathReady = "true";
                        delete node.dataset.mathPending;
                    })
                    .catch((nodeError) => {
                        delete node.dataset.mathPending;
                        const source = (() => {
                            try {
                                return decodeURIComponent(String(node.dataset.mathSource || ""));
                            } catch (_decodeError) {
                                return String(node.textContent || "").trim();
                            }
                        })();
                        if (mathFallbackLogCount < 40) {
                            console.error(
                                `[MathFallback] display=${node.classList.contains("math-display") ? "block" : "inline"} source=${source} error=${String(nodeError && (nodeError.stack || nodeError.message || nodeError))}`
                            );
                            mathFallbackLogCount += 1;
                        }
                        node.dataset.mathFallback = "true";
                        node.outerHTML = renderMathFallback(source, node.classList.contains("math-display"));
                        return null;
                    });
            });
        });
        return;
    }

    root.querySelectorAll('[data-math-rendered="true"], [data-math-fallback="true"]').forEach((node) => {
        if (node.dataset.mathIsolated === "true") return;
        if (typeof node.attachShadow !== "function") return;
        if (node.shadowRoot) {
            node.dataset.mathIsolated = "true";
            return;
        }

        const innerHtml = node.innerHTML;
        if (!String(innerHtml || "").trim()) return;

        const shellTag = node.classList.contains("math-display") ? "div" : "span";
        const shellClasses = ["math-shell"];
        if (node.classList.contains("math-display")) {
            shellClasses.push("math-display");
        } else {
            shellClasses.push("math-inline");
        }
        if (node.classList.contains("math-fallback")) {
            shellClasses.push("math-fallback");
        }

        const shadowRoot = node.attachShadow({ mode: "open" });
        shadowRoot.innerHTML = `
            <style>${MATH_ISLAND_CSS}</style>
            <${shellTag} class="${shellClasses.join(" ")}">${innerHtml}</${shellTag}>
        `;
        node.dataset.mathIsolated = "true";
        node.innerHTML = "";
    });
}

function replaceInlineDollarMath(sourceText, placeholders) {
    let result = "";
    let cursor = 0;

    while (cursor < sourceText.length) {
        const start = sourceText.indexOf("$", cursor);
        if (start === -1) {
            result += sourceText.slice(cursor);
            break;
        }

        if (sourceText[start - 1] === "\\") {
            result += sourceText.slice(cursor, start - 1) + "$";
            cursor = start + 1;
            continue;
        }

        if (sourceText[start + 1] === "$") {
            result += sourceText.slice(cursor, start + 2);
            cursor = start + 2;
            continue;
        }

        result += sourceText.slice(cursor, start);

        let end = start + 1;
        let found = false;
        while (end < sourceText.length) {
            if (sourceText[end] === "\n") {
                break;
            }
            if (
                sourceText[end] === "$"
                && sourceText[end - 1] !== "\\"
                && sourceText[end + 1] !== "$"
            ) {
                found = true;
                break;
            }
            end += 1;
        }

        if (!found) {
            result += "$";
            cursor = start + 1;
            continue;
        }

        const expr = sourceText.slice(start + 1, end).trim();
        if (!expr) {
            result += sourceText.slice(start, end + 1);
            cursor = end + 1;
            continue;
        }

        result += placeholders.put(renderMathBlock(expr, false));
        cursor = end + 1;
    }

    return result;
}

function looksLikeStandaloneMathBlockStart(line) {
    const trimmed = String(line || "").trim();
    if (!trimmed) return false;
    return (
        looksLikeMathishText(trimmed)
        || /\\begin\{(?:bmatrix|pmatrix|matrix)\}/.test(trimmed)
    );
}

function looksLikeStandaloneMathBlockContinuation(line) {
    const trimmed = String(line || "").trim();
    if (!trimmed) return false;
    if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) return false;
    if (/[。、「」『』【】]/.test(trimmed)) return false;
    if (looksLikeMathishText(trimmed)) return true;
    if (/[&=+\-*/^_<>]/.test(trimmed)) return true;
    if (/^[A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)*$/.test(trimmed) && trimmed.length <= 16) {
        return true;
    }
    return false;
}

function replaceStandaloneMathBlocks(sourceText, placeholders) {
    const lines = String(sourceText || "").split("\n");
    const output = [];
    let blockLines = [];

    const flushBlock = () => {
        if (!blockLines.length) return;
        output.push(placeholders.put(renderMathBlock(blockLines.join("\n"), true)));
        blockLines = [];
    };

    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
            flushBlock();
            output.push(line);
            return;
        }

        if (!blockLines.length) {
            if (looksLikeStandaloneMathBlockStart(trimmed)) {
                blockLines.push(trimmed);
            } else {
                output.push(line);
            }
            return;
        }

        if (looksLikeStandaloneMathBlockContinuation(trimmed)) {
            blockLines.push(trimmed);
            return;
        }

        flushBlock();
        output.push(line);
    });

    flushBlock();
    return output.join("\n");
}

function looksLikeStandaloneMathLine(line) {
    const trimmed = String(line || "").trim();
    return looksLikeMathishText(trimmed);
}

function replaceStandaloneMathLines(sourceText, placeholders) {
    return sourceText.replace(/(^|\n)([^\n]+)/g, (match, prefix, line) => {
        if (!looksLikeStandaloneMathLine(line)) {
            return match;
        }
        return `${prefix}${placeholders.put(renderMathBlock(line.trim(), true))}`;
    });
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
    markTreeStructureDirty();
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

function getRawSourceDebugEntry(convId) {
    if (!convId) return null;
    if (!rawSourceDebugByConvId[convId]) {
        rawSourceDebugByConvId[convId] = {
            loading: false,
            error: "",
            data: null,
            fullTextLoading: false,
            fullTextError: "",
        };
    }
    return rawSourceDebugByConvId[convId];
}

function isConversationRawDebugOpen(convIdx) {
    return Boolean(
        openTabs.find((tab) => tab.type === "conversation" && tab.convIdx === convIdx)?.rawDebugOpen
    );
}

function loadConversationRawSource(convId) {
    const entry = getRawSourceDebugEntry(convId);
    if (!entry) {
        return Promise.resolve(null);
    }
    if (entry.data) {
        return Promise.resolve(entry.data);
    }
    if (rawSourceLoadPromises[convId]) {
        return rawSourceLoadPromises[convId];
    }

    entry.loading = true;
    entry.error = "";
    rawSourceLoadPromises[convId] = waitForBridge().then((bridge) => {
        if (!bridge || !bridge.fetchConversationRawSource) {
            throw new Error("Raw source bridge is not ready");
        }
        return new Promise((resolve, reject) => {
            bridge.fetchConversationRawSource(convId, function (result) {
                if (!result) {
                    resolve(null);
                    return;
                }
                try {
                    resolve(JSON.parse(result));
                } catch (error) {
                    reject(error);
                }
            });
        });
    }).then((detail) => {
        entry.data = detail || { available: false, rawText: "" };
        entry.loading = false;
        entry.error = "";
        return entry.data;
    }).catch((error) => {
        entry.loading = false;
        entry.error = error && error.message ? error.message : "Failed to load raw source";
        throw error;
    }).finally(() => {
        delete rawSourceLoadPromises[convId];
    });

    return rawSourceLoadPromises[convId];
}

function loadConversationRawText(convId) {
    const entry = getRawSourceDebugEntry(convId);
    if (!entry) {
        return Promise.resolve("");
    }
    if (rawSourceTextLoadPromises[convId]) {
        return rawSourceTextLoadPromises[convId];
    }

    entry.fullTextLoading = true;
    entry.fullTextError = "";
    rawSourceTextLoadPromises[convId] = waitForBridge().then((bridge) => {
        if (!bridge || !bridge.fetchConversationRawText) {
            throw new Error("Raw text bridge is not ready");
        }
        return new Promise((resolve, reject) => {
            bridge.fetchConversationRawText(convId, function (result) {
                if (!result) {
                    resolve(null);
                    return;
                }
                try {
                    resolve(JSON.parse(result));
                } catch (error) {
                    reject(error);
                }
            });
        });
    }).then((detail) => {
        entry.fullTextLoading = false;
        entry.fullTextError = "";
        return detail?.rawText || "";
    }).catch((error) => {
        entry.fullTextLoading = false;
        entry.fullTextError = error && error.message ? error.message : "Failed to load raw text";
        throw error;
    }).finally(() => {
        delete rawSourceTextLoadPromises[convId];
    });

    return rawSourceTextLoadPromises[convId];
}

function toggleConversationRawDebug(convIdx, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const conv = chatData[convIdx];
    if (!conv || !conv.id) return;
    const tab = openTabs.find((item) => item.type === "conversation" && item.convIdx === convIdx)
        || ensureConversationTab(convIdx);
    const entry = getRawSourceDebugEntry(conv.id);
    const renderRawDebugView = () =>
        renderChat(convIdx, { skipTabStripReveal: true, preserveTabStripScroll: true });
    tab.rawDebugOpen = !tab.rawDebugOpen;
    scheduleTabSessionPersist();
    if (!tab.rawDebugOpen) {
        renderRawDebugView();
        return;
    }
    if (!entry.data && !entry.loading) {
        entry.loading = true;
        entry.error = "";
        const expectedTabId = tab.id;
        renderRawDebugView();
        loadConversationRawSource(conv.id)
            .catch(() => {})
            .finally(() => {
                const activeTab = getActiveTab();
                if (
                    activeTab &&
                    activeTab.id === expectedTabId &&
                    activeTab.type === "conversation" &&
                    activeTab.convIdx === convIdx
                ) {
                    renderRawDebugView();
                }
            });
        return;
    }
    renderRawDebugView();
}

function rerenderRawDebugConversation(convId) {
    const convIdx = getConversationIndexById(convId);
    if (convIdx < 0) return;
    const activeTab = getActiveTab();
    if (
        activeTab &&
        activeTab.type === "conversation" &&
        activeTab.convIdx === convIdx &&
        activeTab.rawDebugOpen
    ) {
        renderChat(convIdx, { skipTabStripReveal: true, preserveTabStripScroll: true });
    }
}

function getConversationTabId(convIdx) {
    return `conv:${convIdx}`;
}

function getVirtualTabId() {
    virtualThreadCounter += 1;
    return `virtual:${Date.now()}:${virtualThreadCounter}`;
}

function getManagerTabId(kind) {
    return `manager:${String(kind || "").trim()}`;
}

function buildManagerTabState(kind) {
    const normalizedKind = String(kind || "").trim();
    if (!MANAGER_TAB_TITLES[normalizedKind]) return null;
    return {
        id: getManagerTabId(normalizedKind),
        type: "manager",
        kind: normalizedKind,
        title: MANAGER_TAB_TITLES[normalizedKind],
    };
}

function ensurePinnedManagerTabs() {
    const pinnedTabs = [];
    PINNED_MANAGER_TAB_KINDS.forEach((kind) => {
        let tab = openTabs.find((item) => item.type === "manager" && item.kind === kind);
        if (!tab) {
            tab = buildManagerTabState(kind);
        } else {
            tab.title = MANAGER_TAB_TITLES[kind];
        }
        if (tab) {
            pinnedTabs.push(tab);
        }
    });
    const otherTabs = openTabs.filter(
        (tab) => !(tab.type === "manager" && PINNED_MANAGER_TAB_KINDS.includes(tab.kind))
    );
    openTabs = [...pinnedTabs, ...otherTabs];
    if (!activeTabId && openTabs.length > 0) {
        activeTabId = openTabs[0].id;
    }
}

function getActiveTab() {
    // Source of truth for tab-derived reading context. Sidebar "active" sync,
    // virtual fragment selection, and session restore should all anchor here first.
    return openTabs.find((tab) => tab.id === activeTabId) || null;
}

function getVirtualTabSelectionIndex(tab = getActiveTab()) {
    // Virtual tabs own their fragment selection locally. The global fallback remains
    // only for older paths until the per-tab model is fully universal.
    if (!tab || tab.type !== "virtual") {
        return currentVirtualSelectionIndex;
    }
    const items = Array.isArray(tab.virtualThread?.items) ? tab.virtualThread.items : [];
    const rawIndex = Number.isInteger(tab.selectedFragmentIndex)
        ? tab.selectedFragmentIndex
        : currentVirtualSelectionIndex;
    if (items.length === 0) return 0;
    return Math.max(0, Math.min(items.length - 1, rawIndex));
}

function setVirtualTabSelectionIndex(index, tab = getActiveTab()) {
    const safeTab = tab && tab.type === "virtual" ? tab : null;
    const items = Array.isArray(safeTab?.virtualThread?.items) ? safeTab.virtualThread.items : [];
    const normalizedIndex =
        items.length === 0
            ? 0
            : Math.max(0, Math.min(items.length - 1, Number.isInteger(index) ? index : 0));
    currentVirtualSelectionIndex = normalizedIndex;
    if (safeTab) {
        safeTab.selectedFragmentIndex = normalizedIndex;
    }
    scheduleTabSessionPersist();
    return normalizedIndex;
}

function getVirtualTabScrollTop(tab = getActiveTab()) {
    if (!tab || tab.type !== "virtual") {
        return null;
    }
    return Number.isFinite(tab.scrollTop) && tab.scrollTop >= 0 ? tab.scrollTop : null;
}

function setVirtualTabScrollTop(scrollTop, tab = getActiveTab()) {
    const safeTab = tab && tab.type === "virtual" ? tab : null;
    const normalizedScrollTop =
        Number.isFinite(scrollTop) && scrollTop >= 0 ? scrollTop : null;
    if (safeTab) {
        safeTab.scrollTop = normalizedScrollTop;
    }
    scheduleTabSessionPersist();
    return normalizedScrollTop;
}

function captureActiveVirtualTabScrollState(viewer = document.getElementById("chat-viewer")) {
    const activeTab = getActiveTab();
    if (!viewer || !activeTab || activeTab.type !== "virtual") return;
    setVirtualTabScrollTop(viewer.scrollTop, activeTab);
}

function restoreVirtualTabScrollPosition(tab, viewer = document.getElementById("chat-viewer")) {
    const savedScrollTop = getVirtualTabScrollTop(tab);
    if (!viewer || !tab || tab.type !== "virtual" || savedScrollTop === null) {
        return false;
    }

    virtualTabScrollRestoreGuardUntil = Date.now() + 220;
    window.requestAnimationFrame(() => {
        viewer.scrollTo({ top: savedScrollTop, behavior: "auto" });
        window.requestAnimationFrame(() => {
            setVirtualTabScrollTop(viewer.scrollTop, tab);
        });
    });
    return true;
}

function buildTabSessionSnapshot() {
    ensurePinnedManagerTabs();
    const viewer = document.getElementById("chat-viewer");
    const activeTab = getActiveTab();
    if (viewer && activeTab && activeTab.type === "virtual") {
        activeTab.scrollTop = Math.max(0, viewer.scrollTop);
    }
    // Phase 2 restore contract: persist only enough tab-local state to rebuild the
    // current reading surface. View/UI focus memory such as sidebarFocusKey stays
    // out so restore cannot revive stale DOM-only targets.
    return {
        activeTabId,
        // Keep session restore minimal: only tab identity plus the smallest
        // state needed to rebuild current reading context. Scroll positions and
        // deeper UI state stay out of scope for now. sidebarFocusKey stays out on
        // purpose because it is DOM-focus/UI-layer state; we rebuild it from the
        // restored active tab instead of persisting potentially stale focus targets.
        tabs: openTabs
            .map((tab) => {
                if (!tab) return null;
                if (tab.type === "conversation") {
                    const conv = chatData[tab.convIdx];
                    if (!conv?.id) return null;
                    return {
                        id: tab.id,
                        type: "conversation",
                        convId: conv.id,
                        rawDebugOpen: Boolean(tab.rawDebugOpen),
                    };
                }
                if (tab.type === "virtual") {
                    return {
                        id: tab.id,
                        type: "virtual",
                        title: tab.title || "仮想スレッド",
                        filters: tab.virtualThread?.filters || {},
                        selectedFragmentIndex: getVirtualTabSelectionIndex(tab),
                        scrollTop: getVirtualTabScrollTop(tab),
                    };
                }
                if (tab.type === "manager") {
                    return {
                        id: tab.id,
                        type: "manager",
                        kind: tab.kind,
                        title: tab.title || MANAGER_TAB_TITLES[tab.kind] || "Manager",
                    };
                }
                return null;
            })
            .filter(Boolean),
    };
}

function clearStoredTabSession() {
    localStorage.removeItem(STORAGE_KEYS.tabSession);
}

function persistTabSessionState() {
    if (isRestoringTabSession) return;
    const snapshot = buildTabSessionSnapshot();
    if (!snapshot.tabs.length) {
        clearStoredTabSession();
        return;
    }
    try {
        localStorage.setItem(STORAGE_KEYS.tabSession, JSON.stringify(snapshot));
    } catch (_error) {
        // Ignore storage failures and keep the in-memory tab session alive.
    }
}

function scheduleTabSessionPersist() {
    if (isRestoringTabSession) return;
    if (tabSessionPersistTimer) {
        window.clearTimeout(tabSessionPersistTimer);
    }
    tabSessionPersistTimer = window.setTimeout(() => {
        tabSessionPersistTimer = null;
        persistTabSessionState();
    }, 80);
}

function flushTabSessionPersist() {
    if (tabSessionPersistTimer) {
        window.clearTimeout(tabSessionPersistTimer);
        tabSessionPersistTimer = null;
    }
    persistTabSessionState();
}

function readStoredTabSession() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.tabSession);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.tabs)) return null;
        return parsed;
    } catch (_error) {
        return null;
    }
}

function normalizeVirtualTabRestoreState(tab) {
    if (!tab || tab.type !== "virtual") return tab;
    const items = Array.isArray(tab.virtualThread?.items) ? tab.virtualThread.items : [];
    const rawIndex = Number.isInteger(tab.selectedFragmentIndex) ? tab.selectedFragmentIndex : 0;
    return {
        ...tab,
        // Keep restore/session snapshots tab-local first. The legacy global selection
        // is only a fallback for older paths that still lack per-tab state.
        selectedFragmentIndex:
            items.length === 0
                ? 0
                : Math.max(0, Math.min(items.length - 1, rawIndex)),
        scrollTop:
            Number.isFinite(tab.scrollTop) && tab.scrollTop >= 0 ? tab.scrollTop : null,
    };
}

function normalizeTabStateForRestore(tab) {
    if (!tab) return null;
    if (tab.type === "virtual") {
        return normalizeVirtualTabRestoreState(tab);
    }
    if (tab.type === "manager") {
        return {
            ...tab,
            title: tab.title || MANAGER_TAB_TITLES[tab.kind] || "Manager",
        };
    }
    return tab;
}

async function restoreTabFromSessionSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return null;

    if (snapshot.type === "conversation") {
        const convIdx = getConversationIndexById(snapshot.convId);
        if (convIdx < 0) return null;
        const conv = chatData[convIdx];
        return {
            id: getConversationTabId(convIdx),
            type: "conversation",
            convIdx,
            title: conv?.title || "Untitled",
            rawDebugOpen: Boolean(snapshot.rawDebugOpen),
        };
    }

    if (snapshot.type === "virtual") {
        try {
            const virtualThread = await requestVirtualThread(snapshot.filters || {});
            if (!virtualThread) return null;
            return normalizeVirtualTabRestoreState({
                id: typeof snapshot.id === "string" ? snapshot.id : getVirtualTabId(),
                type: "virtual",
                title: virtualThread.title || snapshot.title || "仮想スレッド",
                virtualThread,
                selectedFragmentIndex: snapshot.selectedFragmentIndex,
                scrollTop: snapshot.scrollTop,
            });
        } catch (_error) {
            return null;
        }
    }

    if (snapshot.type === "manager") {
        const kind = String(snapshot.kind || "").trim();
        if (!MANAGER_TAB_TITLES[kind]) {
            return null;
        }
        return {
            id: getManagerTabId(kind),
            type: "manager",
            kind,
            title: MANAGER_TAB_TITLES[kind],
        };
    }

    return null;
}

async function restoreOpenTabsFromSession() {
    const snapshot = readStoredTabSession();
    if (!snapshot || !Array.isArray(snapshot.tabs) || snapshot.tabs.length === 0) {
        ensurePinnedManagerTabs();
        return false;
    }

    isRestoringTabSession = true;
    try {
        const restoredTabs = [];
        for (const tabSnapshot of snapshot.tabs) {
            const restored = await restoreTabFromSessionSnapshot(tabSnapshot);
            if (restored) {
                restoredTabs.push(restored);
            }
        }

        if (restoredTabs.length === 0) {
            openTabs = [];
            activeTabId = null;
            ensurePinnedManagerTabs();
            clearStoredTabSession();
            return false;
        }

        openTabs = restoredTabs;
        ensurePinnedManagerTabs();
        const nextActiveTab =
            openTabs.find((tab) => tab.id === snapshot.activeTabId) || openTabs[0];
        activeTabId = nextActiveTab ? nextActiveTab.id : null;
        if (nextActiveTab?.type === "virtual") {
            setVirtualTabSelectionIndex(nextActiveTab.selectedFragmentIndex, nextActiveTab);
        }
    } finally {
        isRestoringTabSession = false;
    }

    primeSidebarFocusToCurrentView();
    renderActiveTab();
    syncSidebarStateToCurrentView({
        renderTreeIfNeeded: true,
        updateFocusKey: false,
        scroll: false,
    });
    persistTabSessionState();
    return true;
}

function cloneTabForRestore(tab) {
    if (!tab) return null;
    if (tab.type === "conversation") {
        return {
            id: tab.id,
            type: "conversation",
            convIdx: tab.convIdx,
            title: tab.title,
            rawDebugOpen: Boolean(tab.rawDebugOpen),
        };
    }
    if (tab.type === "virtual") {
        return normalizeVirtualTabRestoreState({
            id: tab.id,
            type: "virtual",
            title: tab.title,
            virtualThread: tab.virtualThread,
            selectedFragmentIndex: getVirtualTabSelectionIndex(tab),
            scrollTop: getVirtualTabScrollTop(tab),
        });
    }
    if (tab.type === "manager") {
        return {
            id: tab.id,
            type: "manager",
            kind: tab.kind,
            title: tab.title,
        };
    }
    return null;
}

function getConversationIndexById(convId) {
    return chatData.findIndex((conv) => conv.id === convId);
}

function normalizeBookmarkedFilterValue(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "bookmarked") return "bookmarked";
    if (normalized === "not-bookmarked") return "not-bookmarked";
    return "all";
}

function updateConversationBookmarkState(convId, bookmarked) {
    const convIdx = getConversationIndexById(convId);
    if (convIdx >= 0) {
        chatData[convIdx].bookmarked = Boolean(bookmarked);
        if (!Boolean(bookmarked)) {
            chatData[convIdx].starredPromptCount = 0;
        }
        markTreeStructureDirty();
    }
}

function updateConversationStarredPromptCount(convId, delta) {
    const convIdx = getConversationIndexById(convId);
    if (convIdx < 0) return;
    const currentCount = Number.isInteger(chatData[convIdx].starredPromptCount)
        ? chatData[convIdx].starredPromptCount
        : 0;
    const nextCount = Math.max(0, currentCount + delta);
    chatData[convIdx].starredPromptCount = nextCount;
    chatData[convIdx].bookmarked = nextCount > 0;
    markTreeStructureDirty();
}

function buildBookmarkTargetSpec(targetType, targetId, payload = {}) {
    // Phase 2 bookmark target boundary. New bookmarkable surfaces should extend this
    // normalized target-spec shape before adding one-off viewer-only state.
    const normalizedTargetType = String(targetType || "").trim();
    const normalizedTargetId = String(targetId || "").trim();
    return {
        targetType: normalizedTargetType,
        targetId: normalizedTargetId,
        payload: payload && typeof payload === "object" ? payload : {},
    };
}

function getBookmarkToggleGlyphHtml(bookmarked, labels = {}) {
    const iconKind = bookmarked
        ? labels.activeIconKind || labels.iconKind || ""
        : labels.inactiveIconKind || labels.iconKind || "";
    if (iconKind === "tab-button-kind-tag") {
        return buildTagOutlineIconHtml("bookmark-toggle-glyph", { filled: bookmarked });
    }
    if (iconKind) {
        return `<span class="bookmark-toggle-glyph ${escapeHTML(iconKind)}" aria-hidden="true"></span>`;
    }
    return bookmarked ? "★" : "☆";
}

function buildTagOutlineIconHtml(extraClasses = "", options = {}) {
    const className = [
        "tag-outline-icon",
        extraClasses,
        options?.filled ? "is-filled" : "",
    ].filter(Boolean).join(" ");
    return `
        <svg class="${escapeHTML(className)}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path class="tag-outline-shape" d="M6.2 2.5h6.1l1.2 1.2v6.1l-4.4 4.4H3.7L2.5 13V6.9z"></path>
            <circle class="tag-outline-hole" cx="10.1" cy="5.9" r="1.15"></circle>
        </svg>
    `;
}

function buildThreadBookmarkTargetSpec(conv) {
    if (!conv?.id) {
        return buildBookmarkTargetSpec("", "", {});
    }
    return buildBookmarkTargetSpec("thread", conv.id, {
        title: conv.title || "Untitled",
        parentConversationId: conv.id,
        source: conv.source || "",
        model: conv.model || "",
    });
}

function getBookmarkStateKey(targetOrType, targetId = "") {
    const bookmarkTarget =
        targetOrType && typeof targetOrType === "object" && !Array.isArray(targetOrType)
            ? normalizeBookmarkTargetSpec(targetOrType)
            : normalizeBookmarkTargetSpec(targetOrType, targetId);
    return `${bookmarkTarget.targetType}::${bookmarkTarget.targetId}`;
}

function cacheBookmarkState(state) {
    const bookmarkTarget = normalizeBookmarkTargetSpec(state);
    if (!bookmarkTarget.targetType || !bookmarkTarget.targetId) return null;
    const currentState = bookmarkStatesByKey[getBookmarkStateKey(bookmarkTarget)] || null;
    const nextTags = Boolean(state?.bookmarked)
        ? (
            Array.isArray(state?.tags)
                ? state.tags
                : Array.isArray(currentState?.tags)
                    ? currentState.tags
                    : []
        )
        : [];
    const normalizedState = {
        targetType: bookmarkTarget.targetType,
        targetId: bookmarkTarget.targetId,
        payload:
            state && typeof state.payload === "object" && !Array.isArray(state.payload)
                ? state.payload
                : bookmarkTarget.payload,
        bookmarked: Boolean(state?.bookmarked),
        updatedAt: state?.updatedAt || null,
        tags: nextTags,
    };
    bookmarkStatesByKey[getBookmarkStateKey(bookmarkTarget)] = normalizedState;
    return normalizedState;
}

function getCachedBookmarkState(targetOrType, targetId = "") {
    return bookmarkStatesByKey[getBookmarkStateKey(targetOrType, targetId)] || null;
}

function buildPromptBookmarkTargetSpec(conv, messageIndex, promptText = "") {
    if (!conv?.id || !Number.isInteger(messageIndex) || messageIndex < 0) {
        return buildBookmarkTargetSpec("", "", {});
    }
    const titleSource = String(promptText || "").trim();
    const titleLine = titleSource.split(/\r?\n/, 1)[0] || "";
    const title = titleLine.length > 72 ? `${titleLine.slice(0, 72)}…` : titleLine;
    return buildBookmarkTargetSpec("prompt", `${conv.id}:${messageIndex}`, {
        parentConversationId: conv.id,
        messageIndex,
        role: "user",
        title: title || `Prompt ${messageIndex + 1}`,
    });
}

function buildDirectoryPromptSelectionKey(conversationId, messageIndex) {
    const normalizedConversationId = String(conversationId || "").trim();
    if (!normalizedConversationId || !Number.isInteger(messageIndex) || messageIndex < 0) {
        return "";
    }
    return `${normalizedConversationId}:${messageIndex}`;
}

function parseDirectoryPromptSelectionKey(selectionKey) {
    const normalizedKey = String(selectionKey || "").trim();
    const delimiterIndex = normalizedKey.lastIndexOf(":");
    if (delimiterIndex <= 0) return null;
    const conversationId = normalizedKey.slice(0, delimiterIndex);
    const messageIndex = Number.parseInt(normalizedKey.slice(delimiterIndex + 1), 10);
    if (!conversationId || !Number.isInteger(messageIndex) || messageIndex < 0) {
        return null;
    }
    return { conversationId, messageIndex };
}

function buildStableBookmarkHash(source) {
    const text = String(source || "");
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
}

function buildVirtualThreadBookmarkIdentity(virtualThread) {
    const filters = virtualThread?.filters && typeof virtualThread.filters === "object"
        ? virtualThread.filters
        : {};
    return buildStableBookmarkHash(JSON.stringify(filters));
}

function buildVirtualFragmentBookmarkTargetSpec(tabOrThread, item) {
    const virtualThread =
        tabOrThread?.type === "virtual" ? tabOrThread.virtualThread : tabOrThread;
    if (!virtualThread || !item?.id || !item?.convId) {
        return buildBookmarkTargetSpec("", "", {});
    }
    const threadIdentity = buildVirtualThreadBookmarkIdentity(virtualThread);
    return buildBookmarkTargetSpec("virtual_fragment", `${threadIdentity}:${item.id}`, {
        parentConversationId: item.convId,
        messageIndex: item.messageIndex,
        role: item.role || "",
        threadTitle: item.threadTitle || "",
        virtualThreadTitle: virtualThread.title || "",
    });
}

function buildSavedViewBookmarkTargetSpec(entry) {
    // Bookmark target specs also work for view-state records like Saved Views.
    // Saved Views store reusable filter definitions; bookmarks annotate that view
    // record rather than duplicating any derived result body.
    const savedViewId = entry?.id;
    if (savedViewId === null || savedViewId === undefined || String(savedViewId).trim() === "") {
        return buildBookmarkTargetSpec("", "", {});
    }
    return buildBookmarkTargetSpec("saved_view", String(savedViewId), {
        savedViewId: Number(savedViewId),
        name: entry?.name || entry?.label || "Saved View",
        targetType: entry?.targetType || "virtual_thread",
        filterLabel: entry?.label || "",
    });
}

function buildBookmarkToggleButtonHtml(targetSpec, bookmarked, clickHandler, extraClass = "", labels = {}) {
    const bookmarkTarget = normalizeBookmarkTargetSpec(targetSpec);
    const buttonClasses = [
        "bookmark-target-toggle",
        "prompt-bookmark-btn",
        "circle-pill",
        "circle-pill-sm",
        extraClass,
        bookmarked ? "is-active" : "",
    ]
        .filter(Boolean)
        .join(" ");
    const title = bookmarked
        ? labels.activeTitle || "マーク中"
        : labels.inactiveTitle || "この項目をマーク";
    return `
        <button
            class="${buttonClasses}"
            type="button"
            data-bookmark-target-type="${escapeHTML(bookmarkTarget.targetType)}"
            data-bookmark-target-id="${escapeHTML(bookmarkTarget.targetId)}"
            data-bookmark-active-icon-kind="${escapeHTML(labels.activeIconKind || labels.iconKind || "")}"
            data-bookmark-inactive-icon-kind="${escapeHTML(labels.inactiveIconKind || labels.iconKind || "")}"
            aria-pressed="${bookmarked ? "true" : "false"}"
            title="${escapeHTML(title)}"
            onclick="${clickHandler}"
        >${getBookmarkToggleGlyphHtml(bookmarked, labels)}</button>
    `;
}

function buildPromptSidebarTagIndicatorHtml(bookmarked) {
    return `
        <span
            class="prompt-nav-tag-indicator${bookmarked ? " is-active" : " is-empty"}"
            aria-hidden="true"
        >${bookmarked ? buildTagOutlineIconHtml("bookmark-toggle-glyph", { filled: true }) : ""}</span>
    `;
}

function syncConversationTagCountsFromStarredPrompts() {
    const countsByConversationId = new Map();
    (starredPromptEntries || []).forEach((entry) => {
        const conversationId = String(entry?.parentConversationId || "").trim();
        const hasTags = Array.isArray(entry?.tags) && entry.tags.length > 0;
        if (!conversationId || !hasTags) {
            return;
        }
        countsByConversationId.set(
            conversationId,
            (countsByConversationId.get(conversationId) || 0) + 1
        );
    });
    chatData.forEach((conv) => {
        const count = countsByConversationId.get(String(conv?.id || "").trim()) || 0;
        conv.starredPromptCount = count;
        conv.bookmarked = count > 0;
    });
}

function animateCirclePillToggle(button, becameActive) {
    if (!button?.classList?.contains("circle-pill")) return;
    button.classList.remove("circle-pill-activated", "circle-pill-deactivated");
    void button.offsetWidth;
    button.classList.add(becameActive ? "circle-pill-activated" : "circle-pill-deactivated");
    if (button._circlePillAnimationTimer) {
        window.clearTimeout(button._circlePillAnimationTimer);
    }
    button._circlePillAnimationTimer = window.setTimeout(() => {
        button.classList.remove("circle-pill-activated", "circle-pill-deactivated");
    }, 320);
}

function updateBookmarkTargetButtonState(targetSpec, bookmarked, labels = {}) {
    const bookmarkTarget = normalizeBookmarkTargetSpec(targetSpec);
    if (!bookmarkTarget.targetType || !bookmarkTarget.targetId) return;
    document
        .querySelectorAll(
            `.bookmark-target-toggle[data-bookmark-target-type="${escapeJsString(bookmarkTarget.targetType)}"][data-bookmark-target-id="${escapeJsString(bookmarkTarget.targetId)}"]`
        )
        .forEach((button) => {
            const wasActive = button.classList.contains("is-active");
            button.classList.toggle("is-active", Boolean(bookmarked));
            button.setAttribute("aria-pressed", bookmarked ? "true" : "false");
            button.setAttribute(
                "title",
                bookmarked
                    ? labels.activeTitle || "マーク中"
                    : labels.inactiveTitle || "この項目をマーク"
            );
            const activeIconKind = button.dataset.bookmarkActiveIconKind || labels.activeIconKind || labels.iconKind || "";
            const inactiveIconKind = button.dataset.bookmarkInactiveIconKind || labels.inactiveIconKind || labels.iconKind || "";
            button.innerHTML = getBookmarkToggleGlyphHtml(bookmarked, {
                activeIconKind,
                inactiveIconKind,
                iconKind: labels.iconKind || "",
            });
            if (wasActive !== Boolean(bookmarked)) {
                animateCirclePillToggle(button, Boolean(bookmarked));
            }
        });
}

async function toggleConversationBookmarkByIndex(convIdx, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const conv = chatData[convIdx];
    if (!conv || !conv.id) return;
    const nextState = !conv.bookmarked;
    const bookmarkTarget = buildThreadBookmarkTargetSpec(conv);
    const result = await requestBookmarkChange(bookmarkTarget, nextState);
    updateConversationBookmarkState(conv.id, result.bookmarked);
    renderTree();
    refreshCurrentTabStrip();
    scheduleVirtualThreadPreview();
    if (isSidebarFilterActive) {
        refreshDirectoryFromExtractFilters(true).catch(() => {});
    }
}

function ensureConversationTab(convIdx) {
    captureActiveVirtualTabScrollState();
    ensurePinnedManagerTabs();
    const tabId = getConversationTabId(convIdx);
    let tab = openTabs.find((item) => item.id === tabId);
    if (!tab) {
        const conv = chatData[convIdx];
        tab = {
            id: tabId,
            type: "conversation",
            convIdx,
            title: conv ? conv.title : "Untitled",
            rawDebugOpen: false,
        };
        openTabs.push(tab);
    } else {
        tab.title = chatData[convIdx] ? chatData[convIdx].title : tab.title;
        tab.rawDebugOpen = Boolean(tab.rawDebugOpen);
    }
    activeTabId = tabId;
    const syncTarget = buildConversationSidebarSyncTarget(convIdx, currentPromptMessageIndex);
    if (syncTarget?.focusKey) {
        sidebarFocusKey = syncTarget.focusKey;
    }
    scheduleTabSessionPersist();
    return tab;
}

function openVirtualTab(virtualThread) {
    captureActiveVirtualTabScrollState();
    ensurePinnedManagerTabs();
    const tab = {
        id: getVirtualTabId(),
        type: "virtual",
        title: virtualThread.title || "仮想スレッド",
        virtualThread,
        selectedFragmentIndex: 0,
        scrollTop: null,
    };
    openTabs.push(tab);
    activeTabId = tab.id;
    setVirtualTabSelectionIndex(0, tab);
    primeSidebarFocusToCurrentView();
    scheduleTabSessionPersist();
    return tab;
}

function openManagerTab(kind) {
    const normalizedKind = String(kind || "").trim();
    if (!MANAGER_TAB_TITLES[normalizedKind]) return null;
    captureActiveVirtualTabScrollState();
    ensurePinnedManagerTabs();
    let tab = openTabs.find((item) => item.type === "manager" && item.kind === normalizedKind);
    if (!tab) {
        tab = buildManagerTabState(normalizedKind);
        openTabs.push(tab);
        ensurePinnedManagerTabs();
    } else {
        tab.title = MANAGER_TAB_TITLES[normalizedKind];
    }
    activeTabId = tab.id;
    primeSidebarFocusToCurrentView();
    scheduleTabSessionPersist();
    renderActiveTab();
    return tab;
}

function isPinnedManagerTab(tab) {
    return Boolean(tab?.type === "manager" && PINNED_MANAGER_TAB_KINDS.includes(tab.kind));
}

function getCloseFallbackTab(closedIndex) {
    if (!Array.isArray(openTabs) || openTabs.length === 0) return null;
    const preferredIndex = Math.min(Math.max(Number(closedIndex) || 0, 0), openTabs.length - 1);
    let bestTab = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestIndex = Number.POSITIVE_INFINITY;

    openTabs.forEach((tab, index) => {
        if (isPinnedManagerTab(tab)) return;
        const distance = Math.abs(index - preferredIndex);
        if (distance < bestDistance || (distance === bestDistance && index < bestIndex)) {
            bestTab = tab;
            bestDistance = distance;
            bestIndex = index;
        }
    });

    return bestTab || openTabs[preferredIndex] || openTabs[0] || null;
}

function closeTab(tabId, rememberHistory = true) {
    captureActiveVirtualTabScrollState();
    const index = openTabs.findIndex((tab) => tab.id === tabId);
    if (index < 0) return;
    const closedTab = openTabs[index];
    if (closedTab?.type === "manager" && PINNED_MANAGER_TAB_KINDS.includes(closedTab.kind)) {
        return;
    }
    if (rememberHistory) {
        const snapshot = cloneTabForRestore(closedTab);
        if (snapshot) {
            recentlyClosedTabs.push(snapshot);
            if (recentlyClosedTabs.length > CLOSED_TAB_HISTORY_LIMIT) {
                recentlyClosedTabs = recentlyClosedTabs.slice(-CLOSED_TAB_HISTORY_LIMIT);
            }
        }
    }
    openTabs.splice(index, 1);
    ensurePinnedManagerTabs();
    const fallback = getCloseFallbackTab(index);

    if (tabStripFocusTabId === tabId) {
        tabStripFocusTabId = fallback ? fallback.id : null;
    }
    if (pendingTabStripFocusRestoreId === tabId) {
        pendingTabStripFocusRestoreId = fallback ? fallback.id : null;
    }

    if (activeTabId === tabId) {
        activeTabId = fallback ? fallback.id : null;
    }

    if (openTabs.length === 0) {
        const viewer = document.getElementById("chat-viewer");
        viewer.dataset.currentConv = "";
        viewer.innerHTML = `<div style="text-align:center; margin-top:150px; color:#999;">左のツリーから物語を読み返そう</div>`;
        clearStoredTabSession();
        return;
    }
    scheduleTabSessionPersist();
    renderActiveTab();
}

function moveTab(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return false;
    const fromIndex = openTabs.findIndex((tab) => tab.id === fromId);
    const toIndex = openTabs.findIndex((tab) => tab.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return false;
    const [movedTab] = openTabs.splice(fromIndex, 1);
    openTabs.splice(toIndex, 0, movedTab);
    scheduleTabSessionPersist();
    return true;
}

function moveTabToIndex(fromId, insertIndex) {
    if (!fromId) return false;
    const fromIndex = openTabs.findIndex((tab) => tab.id === fromId);
    if (fromIndex < 0) return false;
    const boundedIndex = Math.max(0, Math.min(insertIndex, openTabs.length));
    const [movedTab] = openTabs.splice(fromIndex, 1);
    const adjustedIndex = fromIndex < boundedIndex ? boundedIndex - 1 : boundedIndex;
    openTabs.splice(adjustedIndex, 0, movedTab);
    scheduleTabSessionPersist();
    return true;
}

function snapshotTabRects() {
    const rects = {};
    document.querySelectorAll(".tab-button[data-tab-id]").forEach((node) => {
        const id = node.dataset.tabId;
        if (!id) return;
        const rect = node.getBoundingClientRect();
        rects[id] = {
            left: rect.left,
            top: rect.top,
        };
    });
    return rects;
}

function queueTabReorderAnimation() {
    pendingTabAnimationRects = snapshotTabRects();
    pendingDraggedTabId = draggedTabId;
}

function destroyTabDragGhost() {
    if (tabDragGhostEl) {
        tabDragGhostEl.remove();
        tabDragGhostEl = null;
    }
}

function getTabDragOverlay() {
    if (tabDragOverlayEl && document.body.contains(tabDragOverlayEl)) {
        return tabDragOverlayEl;
    }

    const overlay = document.createElement("div");
    overlay.id = "tab-drag-overlay";
    document.body.appendChild(overlay);
    tabDragOverlayEl = overlay;
    return overlay;
}

function createTabDragGhost(sourceNode, pointerX, pointerY) {
    destroyTabDragGhost();
    if (!sourceNode) return null;
    const rect = sourceNode.getBoundingClientRect();
    const ghost = sourceNode.cloneNode(true);
    ghost.classList.remove("active", "drop-before", "drop-after", "drag-source");
    ghost.classList.add("tab-drag-ghost");
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.dataset.originTabId = sourceNode.dataset.tabId || "";
    getTabDragOverlay().appendChild(ghost);
    tabDragGhostEl = ghost;
    return {
        rect,
        offsetX: pointerX - rect.left,
        offsetY: pointerY - rect.top,
    };
}

function getTabDragBounds(ghostWidth = 0, ghostHeight = 0) {
    const tabStrip = document.querySelector(".tab-strip");
    const tabStripRect = tabStrip ? tabStrip.getBoundingClientRect() : null;
    const stripTop = tabStripRect?.top || 0;
    const stripBottom = tabStripRect?.bottom || 0;
    const minTopWithinStrip = stripBottom
        ? stripBottom - ghostHeight - 2
        : TAB_DRAG_TOP_MARGIN;
    const minTop = Math.max(TAB_DRAG_TOP_MARGIN, stripTop + 6, minTopWithinStrip);
    const maxTop = Math.max(minTop, window.innerHeight - ghostHeight - TAB_DRAG_BOTTOM_MARGIN);
    const maxLeft = Math.max(0, window.innerWidth - ghostWidth - 8);
    return {
        minTop,
        maxTop,
        minLeft: 0,
        maxLeft,
    };
}

function playPendingTabReorderAnimation() {
    if (!pendingTabAnimationRects) return;
    const rects = pendingTabAnimationRects;
    const draggedId = pendingDraggedTabId;
    pendingTabAnimationRects = null;
    pendingDraggedTabId = null;

    const nodes = Array.from(document.querySelectorAll(".tab-button[data-tab-id]"));
    nodes.forEach((node) => {
        const id = node.dataset.tabId;
        const prev = rects[id];
        if (!prev) return;
        const next = node.getBoundingClientRect();
        const dx = prev.left - next.left;
        const dy = prev.top - next.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        const lift = id === draggedId ? " scale(1.02)" : "";
        node.style.transition = "none";
        node.style.transform = `translate(${dx}px, ${dy}px)${lift}`;
        window.requestAnimationFrame(() => {
            node.style.transition = "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)";
            node.style.transform = "";
            window.setTimeout(() => {
                node.style.transition = "";
            }, 260);
        });
    });
}

function activateTab(tabId, event) {
    if (event && Date.now() < suppressTabClickUntil) {
        event.preventDefault?.();
        event.stopPropagation?.();
        return;
    }
    if (!openTabs.some((tab) => tab.id === tabId)) return;
    if (document.activeElement?.closest?.(".tab-strip-tabs")) {
        tabStripFocusTabId = tabId;
        pendingTabStripFocusRestoreId = tabId;
    }
    captureActiveVirtualTabScrollState();
    activeTabId = tabId;
    primeSidebarFocusToCurrentView();
    scheduleTabSessionPersist();
    renderActiveTab();
}

function activateAdjacentTab(step) {
    if (openTabs.length <= 1) return false;
    const currentIndex = openTabs.findIndex((tab) => tab.id === activeTabId);
    if (currentIndex < 0) return false;
    const nextIndex = (currentIndex + step + openTabs.length) % openTabs.length;
    activateTab(openTabs[nextIndex].id);
    return true;
}

function selectTabByIndex(tabIndex) {
    if (openTabs.length === 0) return false;
    const numericTabIndex = Number(tabIndex);
    if (!Number.isInteger(numericTabIndex) || numericTabIndex < 1) {
        return false;
    }

    // Safari/browser convention: Cmd+9 jumps to the rightmost tab. PyQt owns the
    // app-level chord, but JS still owns the actual tab-state transition by
    // flowing back through activateTab().
    const targetIndex = numericTabIndex === 9 ? openTabs.length - 1 : numericTabIndex - 1;
    const targetTab = openTabs[targetIndex];
    if (!targetTab) return false;
    activateTab(targetTab.id);
    return true;
}

function restoreLastClosedTab() {
    while (recentlyClosedTabs.length > 0) {
        captureActiveVirtualTabScrollState();
        const restored = normalizeTabStateForRestore(recentlyClosedTabs.pop());
        if (!restored) continue;
        if (restored.type === "conversation") {
            const conv = chatData[restored.convIdx];
            if (!conv) continue;
            const existing = openTabs.find((tab) => tab.type === "conversation" && tab.convIdx === restored.convIdx);
            if (existing) {
                activeTabId = existing.id;
                primeSidebarFocusToCurrentView();
                scheduleTabSessionPersist();
                renderActiveTab();
                return true;
            }
        }
        openTabs.push(restored);
        activeTabId = restored.id;
        if (restored.type === "virtual") {
            setVirtualTabSelectionIndex(restored.selectedFragmentIndex, restored);
        }
        primeSidebarFocusToCurrentView();
        scheduleTabSessionPersist();
        renderActiveTab();
        return true;
    }
    return false;
}

function handleNativeTabShortcut(action, context = {}) {
    if (action === "selectTabByIndex") {
        return selectTabByIndex(context.tabIndex);
    }
    if (action === "close" || action === "closeTab") {
        const activeTab = getActiveTab();
        if (!activeTab) return false;
        closeTab(activeTab.id, true);
        return true;
    }
    if (action === "restore" || action === "restoreTab") {
        return restoreLastClosedTab();
    }
    if (action === "next" || action === "nextTab") {
        return activateAdjacentTab(1);
    }
    if (action === "previous" || action === "previousTab") {
        return activateAdjacentTab(-1);
    }
    return false;
}

function dispatchKeyboardShortcut(scope, action, context = {}) {
    if (scope === KEYBOARD_HANDLING_SCOPE.APP_NATIVE) {
        if (action === "back") {
            return navigateActiveContent(-1);
        }
        if (action === "forward") {
            return navigateActiveContent(1);
        }
        if (
            action === "selectTabByIndex" ||
            action === "previousTab" ||
            action === "nextTab" ||
            action === "closeTab" ||
            action === "restoreTab"
        ) {
            return handleNativeTabShortcut(action, context);
        }
        if (action === "showSidebar") {
            return showSidebarFromAppShortcut();
        }
        if (action === "hideSidebar") {
            return hideSidebarFromAppShortcut();
        }
        if (action === "focusSidebarTree" || action === "focusSidebarFilter") {
            // Legacy compatibility for older native bindings. Sidebar open/close
            // now has dedicated app-level actions, but JS still owns the actual
            // tree-focus state transition either way.
            return focusSidebarTreeFromReadingContext();
        }
        if (action === "findInTab") {
            return focusLegacyFindTarget();
        }
        if (action === "openSettings") {
            return openViewerSettingsShortcut();
        }
        if (action === "scrollTop") {
            return scrollCurrentViewBoundary("start");
        }
        if (action === "scrollBottom") {
            return scrollCurrentViewBoundary("end");
        }
        return false;
    }

    if (scope === KEYBOARD_HANDLING_SCOPE.VIEWER_NAVIGATION) {
        const activeTab =
            context.tab && context.tab.id === activeTabId ? context.tab : getActiveTab();
        if (!activeTab || activeTab.type !== "virtual") {
            return false;
        }

        if (action === "virtualFragmentNext") {
            return moveVirtualFragment(1);
        }
        if (action === "virtualFragmentPrevious") {
            return moveVirtualFragment(-1);
        }
        if (action === "virtualFragmentOpenOrigin") {
            const item = activeTab.virtualThread?.items?.[getVirtualTabSelectionIndex(activeTab)];
            if (!item) return false;
            openOriginConversation(item.convId, item.messageIndex);
            return true;
        }
        if (action === "closeTab") {
            closeTab(activeTab.id);
            return true;
        }
    }

    return false;
}

function isEditableTarget(target) {
    const tagName = target && target.tagName;
    return Boolean(
        target &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(tagName))
    );
}

function focusShortcutTarget(target, options = {}) {
    if (!target || target.disabled || target.offsetParent === null) return false;
    target.focus({ preventScroll: true });
    if (options.selectAll && typeof target.select === "function") {
        target.select();
    }
    return true;
}

function focusSidebarFilterInput() {
    const performFocus = () => {
        const searchBar = document.getElementById("searchBar");
        if (searchBar && searchBar.offsetParent !== null) {
            switchSidebarMode("threads");
            return focusShortcutTarget(searchBar, { selectAll: true });
        }

        switchSidebarMode("extract");
        closeExtractModelMenu();
        const extractTargets = [
            document.getElementById("extract-title"),
            document.getElementById("extract-prompt"),
            document.getElementById("extract-response"),
            document.getElementById("extract-source-file"),
            document.getElementById("extract-date-from"),
            document.getElementById("extract-date-to"),
            document.getElementById("extract-model-trigger"),
        ];
        return extractTargets.some((target) =>
            focusShortcutTarget(target, { selectAll: isEditableTarget(target) })
        );
    };

    if (isSidebarHidden) {
        toggleSidebarVisibility(false);
    }
    window.requestAnimationFrame(() => {
        performFocus();
    });
    return true;
}

function navigateActiveContent(step) {
    const activeElement = document.activeElement;
    if (activeElement && activeElement.closest && activeElement.closest("#index-tree")) {
        moveSidebarFocus(step);
        return true;
    }
    if (isEditableTarget(activeElement)) {
        return false;
    }

    const activeTab = getActiveTab();
    if (activeTab && activeTab.type === "virtual") {
        return moveVirtualFragment(step);
    }

    const convIdx = getCurrentConversationIndex();
    if (convIdx === null) return false;
    return navigateCurrentPrompt(step);
}

function openViewerSettingsShortcut() {
    if (!getActiveTab()) return false;
    openViewerTools();
    return focusShortcutTarget(document.querySelector(".viewer-settings-trigger"));
}

function scrollCurrentViewBoundary(direction) {
    const isEnd = direction === "end";
    const activeElement = document.activeElement;
    if (activeElement && activeElement.closest && activeElement.closest("#index-tree")) {
        const items = getVisibleSidebarItems();
        if (items.length === 0) return false;
        const target = items[isEnd ? items.length - 1 : 0];
        target.focus({ preventScroll: true });
        scrollSidebarItemIntoView(target);
        rememberSidebarFocus(target);
        return true;
    }
    if (isEditableTarget(activeElement)) {
        return false;
    }

    const activeTab = getActiveTab();
    if (activeTab && activeTab.type === "virtual") {
        const itemCount = activeTab.virtualThread?.items?.length || 0;
        if (!itemCount) return false;
        focusVirtualFragment(isEnd ? itemCount - 1 : 0, "smooth");
        return true;
    }

    const viewer = document.getElementById("chat-viewer");
    if (!viewer) return false;
    viewer.scrollTo({ top: isEnd ? viewer.scrollHeight : 0, behavior: "smooth" });
    return true;
}

function focusLegacyFindTarget() {
    const searchBar = document.getElementById("searchBar");
    if (!searchBar || searchBar.offsetParent === null) return false;
    if (isSidebarHidden) {
        toggleSidebarVisibility(false);
        window.requestAnimationFrame(() => {
            focusShortcutTarget(searchBar, { selectAll: true });
        });
        return true;
    }
    return focusShortcutTarget(searchBar, { selectAll: true });
}

function handleNativeAppShortcut(action, context = {}) {
    return dispatchKeyboardShortcut(KEYBOARD_HANDLING_SCOPE.APP_NATIVE, action, context);
}

function getStoredTabStripFocusTabId() {
    if (openTabs.some((tab) => tab.id === tabStripFocusTabId)) {
        return tabStripFocusTabId;
    }
    if (openTabs.some((tab) => tab.id === activeTabId)) {
        return activeTabId;
    }
    return openTabs[0]?.id || null;
}

function getFocusedTabStripButton() {
    const candidate = document.activeElement?.closest?.(".tab-button[data-tab-id]");
    if (!candidate || !candidate.closest(".tab-strip-tabs")) {
        return null;
    }
    return candidate;
}

function getTabStripButtons() {
    return Array.from(document.querySelectorAll(".tab-strip-tabs .tab-button[data-tab-id]"));
}

function captureTabStripScrollLeft() {
    const strip = document.querySelector(".tab-strip-tabs");
    if (!strip) return null;
    return strip.scrollLeft;
}

function restorePendingTabStripScrollLeft() {
    const strip = document.querySelector(".tab-strip-tabs");
    if (!strip || !Number.isFinite(pendingTabStripScrollLeft)) {
        pendingTabStripScrollLeft = null;
        return false;
    }
    strip.scrollLeft = pendingTabStripScrollLeft;
    pendingTabStripScrollLeft = null;
    return true;
}

function getCurrentTabStripFocusTabId() {
    const focusedButton = getFocusedTabStripButton();
    if (focusedButton?.dataset?.tabId) {
        return focusedButton.dataset.tabId;
    }
    return getStoredTabStripFocusTabId();
}

function syncTabStripRovingFocus() {
    const buttons = getTabStripButtons();
    if (buttons.length === 0) return false;
    const focusTabId = getCurrentTabStripFocusTabId();
    buttons.forEach((button) => {
        const tabId = button.dataset.tabId || "";
        button.tabIndex = tabId === focusTabId ? 0 : -1;
        button.setAttribute("aria-selected", tabId === activeTabId ? "true" : "false");
    });
    return true;
}

function scrollTabStripButtonIntoView(button, behavior = "smooth") {
    if (!button) return;
    button.scrollIntoView({ behavior, block: "nearest", inline: "nearest" });
}

function playTabStripRevealMotion(button, direction = "center") {
    if (!button) return;
    if (button._tabRevealTimer) {
        window.clearTimeout(button._tabRevealTimer);
    }
    button.classList.remove("reveal-from-left", "reveal-from-right");
    void button.offsetWidth;
    button.classList.add(direction === "left" ? "reveal-from-left" : "reveal-from-right");
    button._tabRevealTimer = window.setTimeout(() => {
        button.classList.remove("reveal-from-left", "reveal-from-right");
        button._tabRevealTimer = null;
    }, 320);
}

function revealActiveTabStripButton(options = {}) {
    const activeTab = getActiveTab();
    if (!activeTab) return false;
    const target = document.querySelector(`.tab-button[data-tab-id="${CSS.escape(activeTab.id)}"]`);
    const strip = target?.closest?.(".tab-strip-tabs");
    if (!target || !strip) return false;

    const stripRect = strip.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const clipTolerance = Number.isFinite(options.tolerance) ? options.tolerance : 1;
    const isClippedLeft = targetRect.left < stripRect.left - clipTolerance;
    const isClippedRight = targetRect.right > stripRect.right + clipTolerance;

    if (isClippedLeft || isClippedRight) {
        const revealDirection = isClippedLeft ? "left" : "right";
        target.scrollIntoView({
            behavior: options.behavior || "smooth",
            block: "nearest",
            inline: options.inline || "nearest",
        });
        if (options.motion !== false) {
            playTabStripRevealMotion(target, revealDirection);
        }
    }
    return true;
}

function focusTabStripButton(tabId, options = {}) {
    if (!tabId) return false;
    tabStripFocusTabId = tabId;
    syncTabStripRovingFocus();
    const target = document.querySelector(`.tab-button[data-tab-id="${CSS.escape(tabId)}"]`);
    if (!target) return false;
    target.focus({ preventScroll: true });
    if (options.scroll !== false) {
        scrollTabStripButtonIntoView(target, options.behavior || "smooth");
    }
    return true;
}

function focusViewerReadingSurface() {
    const viewer = document.getElementById("chat-viewer");
    if (!viewer) return false;
    if (!viewer.hasAttribute("tabindex")) {
        viewer.tabIndex = -1;
    }
    return focusShortcutTarget(viewer);
}

function focusActiveReadingContext() {
    const activeTab = getActiveTab();

    if (activeTab?.type === "virtual") {
        const items = activeTab.virtualThread?.items || [];
        if (items.length > 0) {
            setVirtualFragmentActiveIndex(getVirtualTabSelectionIndex(activeTab), {
                tab: activeTab,
                focus: true,
                scrollIntoView: false,
                syncSidebar: false,
            });
            return true;
        }
    }

    return focusViewerReadingSurface();
}

function ensureInitialAppFocus() {
    const activeElement = document.activeElement;
    const hasMeaningfulFocus =
        activeElement &&
        activeElement !== document.body &&
        activeElement !== document.documentElement;
    if (hasMeaningfulFocus) {
        return false;
    }
    if (getActiveTab()) {
        return focusActiveReadingContext();
    }
    return focusViewerReadingSurface();
}

function focusTabStripFromReadingContext() {
    return focusTabStripButton(getStoredTabStripFocusTabId(), { behavior: "auto" });
}

function getPreferredSidebarTreeFocusKeyFromReadingContext() {
    // App-level sidebar entry / reading-context -> tree entry priority:
    // 1. current reading context target
    // 2. same conversation fallback
    // 3. remembered sidebarFocusKey
    const target = getSidebarSyncTargetFromCurrentView();
    if (target?.focusKey) {
        return target.focusKey;
    }
    if (Number.isInteger(target?.convIdx)) {
        return `conv-${target.convIdx}`;
    }
    return sidebarFocusKey || null;
}

function focusSidebarTreeTarget(preferredFocusKey = null) {
    if (focusSidebarItemByKey(sidebarFocusKey)) {
        return true;
    }
    if (preferredFocusKey && focusSidebarItemByKey(preferredFocusKey)) {
        return true;
    }
    return false;
}

function focusSidebarTreeFromReadingContext() {
    const preferredFocusKey = getPreferredSidebarTreeFocusKeyFromReadingContext();
    if (preferredFocusKey) {
        sidebarFocusKey = preferredFocusKey;
    }
    suppressedTreeAutoExpandConvIdx = null;

    const needsThreadsMode = sidebarMode !== "threads";
    const needsReveal = isSidebarHidden;

    // Unlike tab strip, the tree is only focusable when the sidebar is visible
    // and in threads mode. App-level sidebar open delegates into this prep step,
    // while JS still owns the resulting focus/state transition.
    if (needsThreadsMode) {
        switchSidebarMode("threads");
    }
    if (needsReveal) {
        toggleSidebarVisibility(false);
    }

    if (needsThreadsMode || needsReveal) {
        window.requestAnimationFrame(() => {
            focusSidebarTreeTarget(preferredFocusKey);
        });
        return true;
    }

    return focusSidebarTreeTarget(preferredFocusKey);
}

function showSidebarFromAppShortcut() {
    // App-level "move left into sidebar": reveal threads mode if needed, then
    // hand focus to the tree's remembered/current reading target.
    return focusSidebarTreeFromReadingContext();
}

function hideSidebarFromAppShortcut() {
    if (isSidebarHidden) return false;
    focusActiveReadingContext();
    toggleSidebarVisibility(true);
    return true;
}

function exitTabStripFocusToReadingContext() {
    pendingTabStripFocusRestoreId = null;
    tabStripFocusTabId = getCurrentTabStripFocusTabId();
    return focusActiveReadingContext();
}

function restorePendingTabStripFocus() {
    const targetTabId = pendingTabStripFocusRestoreId;
    if (!targetTabId) return false;
    pendingTabStripFocusRestoreId = null;
    window.requestAnimationFrame(() => {
        focusTabStripButton(targetTabId);
    });
    return true;
}

function clearTabDropMarkers() {
    document.querySelectorAll(".tab-button.drop-before, .tab-button.drop-after").forEach((node) => {
        node.classList.remove("drop-before", "drop-after");
    });
}

function getTabDropPlacement(clientX) {
    const tabs = Array.from(document.querySelectorAll(".tab-button[data-tab-id]")).filter(
        (tab) => tab.dataset.tabId !== draggedTabId
    );
    if (tabs.length === 0) return null;

    for (let index = 0; index < tabs.length; index += 1) {
        const tab = tabs[index];
        const rect = tab.getBoundingClientRect();
        const midpoint = rect.left + rect.width / 2;
        const activationGap = Math.min(18, rect.width * 0.18);
        if (clientX < midpoint - activationGap) {
            return {
                targetId: tab.dataset.tabId,
                insertIndex: index,
                after: false,
            };
        }
        if (clientX > midpoint + activationGap && clientX <= rect.right) {
            return {
                targetId: tab.dataset.tabId,
                insertIndex: index + 1,
                after: true,
            };
        }
    }

    const lastTab = tabs[tabs.length - 1];
    return {
        targetId: lastTab.dataset.tabId,
        insertIndex: tabs.length,
        after: true,
    };
}

function applyTabDropPlacement(placement) {
    clearTabDropMarkers();
    tabDropTargetId = placement?.targetId || null;
    tabDropInsertAfter = Boolean(placement?.after);
    if (!placement?.targetId) return;
    const target = document.querySelector(`.tab-button[data-tab-id="${CSS.escape(placement.targetId)}"]`);
    if (!target) return;
    target.classList.add(placement.after ? "drop-after" : "drop-before");
}

function handleTabDragEnd() {
    if (draggedTabId && tabDropTargetId) {
        const targetIndex = openTabs.findIndex((tab) => tab.id === tabDropTargetId);
        if (targetIndex >= 0) {
            const insertIndex = tabDropInsertAfter ? targetIndex + 1 : targetIndex;
            if (moveTabToIndex(draggedTabId, insertIndex)) {
                queueTabReorderAnimation();
                renderActiveTab();
            }
        }
    }
    document.body.classList.remove("tab-dragging");
    draggedTabId = null;
    tabDropTargetId = null;
    tabDropInsertAfter = false;
    destroyTabDragGhost();
    document.querySelectorAll(".tab-button.dragging, .tab-button.drag-source, .tab-button.drop-before, .tab-button.drop-after").forEach((node) => {
        node.classList.remove("dragging", "drag-source", "drop-before", "drop-after");
        node.style.transform = "";
        node.style.zIndex = "";
    });
}

function handleTabMouseDown(tabId, event) {
    if (!event || event.button !== 0) return;
    if (event.target && event.target.closest && event.target.closest(".tab-close")) return;
    event.preventDefault?.();
    tabMouseDragState = {
        tabId,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        pointerOffsetX: 0,
        pointerOffsetY: 0,
    };
}

function ensureTabMouseDragInteractions() {
    if (document.body.dataset.tabMouseDragBound === "true") return;
    document.body.dataset.tabMouseDragBound = "true";

    window.addEventListener("mousemove", (event) => {
        if (!tabMouseDragState) return;
        const dx = event.clientX - tabMouseDragState.startX;
        const dy = event.clientY - tabMouseDragState.startY;
        if (!tabMouseDragState.active) {
            if (Math.hypot(dx, dy) < 3) return;
            tabMouseDragState.active = true;
            draggedTabId = tabMouseDragState.tabId;
            document.body.classList.add("tab-dragging");
            const sourceNode = document
                .querySelector(`.tab-button[data-tab-id="${CSS.escape(tabMouseDragState.tabId)}"]`);
            sourceNode?.classList.add("drag-source");
            const ghostMeta = createTabDragGhost(sourceNode, event.clientX, event.clientY);
            if (ghostMeta) {
                tabMouseDragState.pointerOffsetX = ghostMeta.offsetX;
                tabMouseDragState.pointerOffsetY = ghostMeta.offsetY;
            }
        }

        if (tabDragGhostEl) {
            const ghostRect = tabDragGhostEl.getBoundingClientRect();
            const bounds = getTabDragBounds(ghostRect.width, ghostRect.height);
            const nextLeft = Math.min(
                bounds.maxLeft,
                Math.max(bounds.minLeft, event.clientX - tabMouseDragState.pointerOffsetX)
            );
            const nextTop = Math.min(
                bounds.maxTop,
                Math.max(bounds.minTop, event.clientY - tabMouseDragState.pointerOffsetY)
            );
            tabDragGhostEl.style.left = `${nextLeft}px`;
            tabDragGhostEl.style.top = `${nextTop}px`;
        }

        if (Math.abs(dx) < TAB_REORDER_ARM_DISTANCE) {
            clearTabDropMarkers();
            tabDropTargetId = null;
            tabDropInsertAfter = false;
            event.preventDefault();
            return;
        }

        const placement = getTabDropPlacement(event.clientX);
        if (!placement || placement.targetId === draggedTabId) {
            clearTabDropMarkers();
            tabDropTargetId = null;
            tabDropInsertAfter = false;
            return;
        }
        applyTabDropPlacement(placement);
        event.preventDefault();
    }, true);

    window.addEventListener("mouseup", (event) => {
        if (!tabMouseDragState) return;
        const wasActive = tabMouseDragState.active;
        if (wasActive) {
            suppressTabClickUntil = Date.now() + 240;
            event.preventDefault?.();
        }
        handleTabDragEnd();
        tabMouseDragState = null;
    }, true);

    window.addEventListener("blur", () => {
        if (!tabMouseDragState) return;
        handleTabDragEnd();
        tabMouseDragState = null;
    }, true);
}

function scrollActiveViewToTop() {
    const viewer = document.getElementById("chat-viewer");
    if (!viewer) return;
    viewer.scrollTo({ top: 0, behavior: "smooth" });
}

function handleTabDoubleClick(tabId, event) {
    if (event?.stopPropagation) event.stopPropagation();
    if (activeTabId !== tabId) {
        activeTabId = tabId;
        renderActiveTab();
        window.requestAnimationFrame(() => scrollActiveViewToTop());
        return;
    }
    scrollActiveViewToTop();
}

function refreshCurrentTabStrip() {
    const viewer = document.getElementById("chat-viewer");
    if (!viewer || !getActiveTab()) return;
    const currentStrip = viewer.querySelector(":scope > .tab-strip");
    if (!currentStrip) return;
    if (currentStrip.contains(document.activeElement)) {
        pendingTabStripFocusRestoreId = getCurrentTabStripFocusTabId();
    }
    pendingTabStripScrollLeft = captureTabStripScrollLeft();

    const template = document.createElement("template");
    template.innerHTML = buildTabStripHtml().trim();
    const nextStrip = template.content.firstElementChild;
    if (!nextStrip) return;

    currentStrip.replaceWith(nextStrip);
    syncTabStripRovingFocus();
    restorePendingTabStripFocus();
    const restoredScroll = restorePendingTabStripScrollLeft();
    if (!restoredScroll) {
        revealActiveTabStripButton({ behavior: "auto" });
    }
    syncViewerToolsState();
    updateToolbarCollapse();
    syncTabStripInsets();
}

function buildPageTopControlsHtml(activeTab = getActiveTab()) {
    if (!activeTab) return "";
    const activeConv =
        activeTab.type === "conversation" ? chatData[activeTab.convIdx] : null;
    const sourceActionsHtml = activeConv
        ? `
            <div class="header-actions header-source-actions page-top-source-actions">
                ${getSourceButtonMarkup(activeConv)}
                <button
                    class="action-btn header-text-btn raw-toggle-btn ${activeTab.rawDebugOpen ? "active" : ""}"
                    title="${activeTab.rawDebugOpen ? "Raw debug を閉じる" : "Raw debug を開く"}"
                    aria-label="${activeTab.rawDebugOpen ? "Raw debug を閉じる" : "Raw debug を開く"}"
                    aria-expanded="${activeTab.rawDebugOpen ? "true" : "false"}"
                    onclick="toggleConversationRawDebug(${activeTab.convIdx}, event)"
                ><span class="raw-toggle-label">Raw</span><span class="viewer-settings-trigger-caret raw-toggle-caret" aria-hidden="true"></span></button>
                                <button class="action-btn header-icon-btn circle-pill circle-pill-md" title="コピー" aria-label="コピー" onclick="copyFullText(${activeTab.convIdx})">⧉</button>
            </div>
        `
        : "";
    return sourceActionsHtml ? `<div class="page-top-tools">${sourceActionsHtml}</div>` : "";
}

function buildTabStripHtml() {
    ensurePinnedManagerTabs();
    if (openTabs.length === 0) return "";
    const viewerControlsMenuHtml =
        document.getElementById("viewer-controls-menu-template")?.innerHTML || "";
    const focusableTabId = getStoredTabStripFocusTabId();
    const toolbarHtml = `
        <div class="viewer-toolbar-shell ${isViewerToolsOpen ? "is-open" : ""}" data-toolbar-collapsed="false">
            <div class="viewer-settings-shell">
                <button class="viewer-settings-trigger" type="button" aria-label="ビュー設定" aria-expanded="${isViewerToolsOpen ? "true" : "false"}" title="ビュー設定" onclick="toggleViewerTools(event)">
                    <span class="viewer-settings-trigger-label">Aa</span>
                    <span class="viewer-settings-trigger-caret" aria-hidden="true"></span>
                </button>
                <div class="viewer-settings-popover">
                    ${viewerControlsMenuHtml}
                </div>
            </div>
        </div>
    `;
    const pinnedTabsHtml = openTabs
        .filter((tab) => tab.type === "manager" && PINNED_MANAGER_TAB_KINDS.includes(tab.kind))
        .map((tab) => {
            const kindIcon = getManagerTabKindIconHtml(tab.kind, "");
            const label = escapeHTML(tab.title || "Untitled");
            return `
                <div
                    class="tab-button ${tab.id === activeTabId ? "active" : ""} tab-button-manager tab-button-manager-pinned"
                    data-tab-id="${escapeHTML(tab.id)}"
                    role="tab"
                    aria-label="管理タブ: ${label}"
                    aria-selected="${tab.id === activeTabId ? "true" : "false"}"
                    tabindex="${tab.id === focusableTabId ? "0" : "-1"}"
                    onclick="activateTab('${escapeJsString(tab.id)}', event)"
                    onmousedown="handleTabMouseDown('${escapeJsString(tab.id)}', event)"
                    ondblclick="handleTabDoubleClick('${escapeJsString(tab.id)}', event)"
                >
                    ${kindIcon}
                    <span class="tab-button-label">${label}</span>
                </div>
            `;
        })
        .join("");
    const scrollableTabsHtml = openTabs
        .filter((tab) => !(tab.type === "manager" && PINNED_MANAGER_TAB_KINDS.includes(tab.kind)))
        .map((tab) => {
            const tabConv = tab.type === "conversation" ? chatData[tab.convIdx] : null;
            const sourceClass = getConversationSourceClass(tabConv);
            const starredPromptCount = Number.isInteger(tabConv?.starredPromptCount)
                ? tabConv.starredPromptCount
                : 0;
            const kindIcon = tab.type === "conversation"
                ? getCountFolderBadgeHtml(
                    starredPromptCount,
                    sourceClass,
                    "tab-button-kind tab-button-kind-icon tab-star-count",
                    "Starred prompts in this thread"
                )
                : getManagerTabKindIconHtml(tab.kind, "");
            const kindLabel = tab.type === "conversation"
                ? "会話タブ"
                : tab.type === "manager"
                    ? "管理タブ"
                    : "抽出タブ";
            const label = escapeHTML(tab.title || "Untitled");
            return `
                <div
                    class="tab-button ${tab.id === activeTabId ? "active" : ""} ${tab.type === "manager" ? "tab-button-manager" : ""}"
                    data-tab-id="${escapeHTML(tab.id)}"
                    role="tab"
                    aria-label="${kindLabel}: ${label}"
                    aria-selected="${tab.id === activeTabId ? "true" : "false"}"
                    tabindex="${tab.id === focusableTabId ? "0" : "-1"}"
                    onclick="activateTab('${escapeJsString(tab.id)}', event)"
                    onmousedown="handleTabMouseDown('${escapeJsString(tab.id)}', event)"
                    ondblclick="handleTabDoubleClick('${escapeJsString(tab.id)}', event)"
                >
                    ${kindIcon}
                    <span class="tab-button-label">${label}</span>
                    <span class="tab-close" role="button" aria-label="タブを閉じる" onclick="event.stopPropagation(); closeTab('${escapeJsString(tab.id)}')">×</span>
                </div>
            `;
        })
        .join("");
    return `
        <div class="tab-strip">
            <div class="tab-strip-pinned" role="tablist" aria-label="Pinned tabs">
                ${pinnedTabsHtml}
            </div>
            <div class="tab-strip-scroll-shell">
                <div class="tab-strip-tabs" role="tablist" aria-label="Open tabs">
                    ${scrollableTabsHtml}
                </div>
            </div>
            ${toolbarHtml}
        </div>
    `;
}

function moveTabStripFocus(command) {
    const buttons = getTabStripButtons();
    if (buttons.length === 0) return false;
    const currentTabId = getCurrentTabStripFocusTabId();
    const currentIndex = Math.max(
        0,
        buttons.findIndex((button) => button.dataset.tabId === currentTabId)
    );
    let targetIndex = currentIndex;
    if (command === "previous") {
        targetIndex = Math.max(0, currentIndex - 1);
    } else if (command === "next") {
        targetIndex = Math.min(buttons.length - 1, currentIndex + 1);
    } else if (command === "first") {
        targetIndex = 0;
    } else if (command === "last") {
        targetIndex = buttons.length - 1;
    } else {
        return false;
    }
    return focusTabStripButton(buttons[targetIndex]?.dataset?.tabId || null);
}

function activateFocusedTabStripButton() {
    const targetTabId = getCurrentTabStripFocusTabId();
    if (!targetTabId) return false;
    tabStripFocusTabId = targetTabId;
    activateTab(targetTabId);
    return true;
}

function handleTabStripKeydown(event) {
    const tabButton = event.target?.closest?.(".tab-button[data-tab-id]");
    if (!tabButton || !tabButton.closest(".tab-strip-tabs")) {
        return;
    }

    let handled = false;
    let shouldConsume = false;
    if (event.key === "ArrowLeft") {
        shouldConsume = true;
        handled = moveTabStripFocus("previous");
    } else if (event.key === "ArrowRight") {
        shouldConsume = true;
        handled = moveTabStripFocus("next");
    } else if (event.key === "Home") {
        shouldConsume = true;
        handled = moveTabStripFocus("first");
    } else if (event.key === "End") {
        shouldConsume = true;
        handled = moveTabStripFocus("last");
    } else if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        shouldConsume = true;
        handled = activateFocusedTabStripButton();
    } else if (event.key === "Escape") {
        shouldConsume = true;
        handled = exitTabStripFocusToReadingContext();
    }

    if (shouldConsume || handled) {
        event.preventDefault();
        event.stopPropagation();
    }
}

function ensureTabStripKeyboardNavigation() {
    const viewer = document.getElementById("chat-viewer");
    if (!viewer || viewer.dataset.tabStripKeyboardBound === "true") return;
    viewer.dataset.tabStripKeyboardBound = "true";

    // Tab strip arrows/home/end stay widget-local. Unlike Cmd+1..9 app-level
    // shortcuts, these keys only mean "move focus inside this tablist" when the
    // user is already focused on a tab button. Escape also stays local here and
    // exits back to the active reading surface instead of behaving like an
    // app-level shortcut.
    viewer.addEventListener("focusin", (event) => {
        const tabButton = event.target?.closest?.(".tab-button[data-tab-id]");
        if (!tabButton || !tabButton.closest(".tab-strip-tabs")) {
            return;
        }
        tabStripFocusTabId = tabButton.dataset.tabId || null;
        syncTabStripRovingFocus();
    });

    viewer.addEventListener("keydown", (event) => {
        handleTabStripKeydown(event);
    });
}

function syncViewerToolsState() {
    const shell = document.querySelector(".viewer-toolbar-shell");
    if (!shell) return;
    shell.classList.toggle("is-open", isViewerToolsOpen);
    const trigger = shell.querySelector(".viewer-settings-trigger");
    if (trigger) {
        trigger.setAttribute("aria-expanded", isViewerToolsOpen ? "true" : "false");
    }
}

function updateToolbarCollapse() {
    const viewer = document.getElementById("chat-viewer");
    const strip = document.querySelector(".tab-strip");
    const tabs = document.querySelector(".tab-strip-tabs");
    const shell = document.querySelector(".viewer-toolbar-shell");
    if (!strip || !tabs || !shell) {
        updateCodeBlockStickyOffset(viewer);
        return;
    }
    const inline = shell.querySelector(".viewer-toolbar-inline");
    const settingsShell = shell.querySelector(".viewer-settings-shell");
    const sourceActions = shell.querySelector(".header-source-actions");
    if (!inline || !settingsShell) {
        updateCodeBlockStickyOffset(viewer);
        return;
    }

    shell.classList.remove("is-collapsed");
    const inlineWidth = inline.scrollWidth;
    const essentialWidth =
        (settingsShell.offsetWidth || 0) +
        (sourceActions?.offsetWidth || 0) +
        18;
    const availableInlineWidth = strip.clientWidth - tabs.scrollWidth - essentialWidth - 16;
    const shouldCollapse = availableInlineWidth < inlineWidth;
    shell.classList.toggle("is-collapsed", shouldCollapse);
    shell.dataset.toolbarCollapsed = shouldCollapse ? "true" : "false";
    syncTabStripInsets();
    updateCodeBlockStickyOffset(viewer);
}

function syncTabStripInsets() {
    const strip = document.querySelector(".tab-strip");
    if (!strip) return;
    const pinned = strip.querySelector(".tab-strip-pinned");
    const toolbar = strip.querySelector(".viewer-toolbar-shell");
    const leftInset = Math.ceil(pinned?.getBoundingClientRect?.().width || 0);
    const rightInset = Math.ceil(toolbar?.getBoundingClientRect?.().width || 0);
    strip.style.setProperty("--tab-strip-left-inset", `${leftInset}px`);
    strip.style.setProperty("--tab-strip-right-inset", `${rightInset}px`);
}

function openViewerTools() {
    if (isViewerToolsOpen) return;
    isViewerToolsOpen = true;
    syncViewerToolsState();
}

function closeViewerTools() {
    if (!isViewerToolsOpen) return;
    isViewerToolsOpen = false;
    syncViewerToolsState();
}

function toggleViewerTools(event) {
    if (event && typeof event.stopPropagation === "function") {
        event.stopPropagation();
    }
    isViewerToolsOpen = !isViewerToolsOpen;
    syncViewerToolsState();
}

function ensureViewerToolsInteractions() {
    if (document.body.dataset.viewerToolsBound === "true") return;
    document.body.dataset.viewerToolsBound = "true";

    document.addEventListener("click", (event) => {
        const shell = event.target && event.target.closest
            ? event.target.closest(".viewer-toolbar-shell")
            : null;
        if (!shell) {
            closeViewerTools();
        }
    }, true);

    document.addEventListener("focusin", (event) => {
        const shell = event.target && event.target.closest
            ? event.target.closest(".viewer-toolbar-shell")
            : null;
        if (!shell) {
            closeViewerTools();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeViewerTools();
        }
    });

    window.addEventListener("resize", () => {
        updateToolbarCollapse();
    });
}

function renderActiveTab() {
    const activeTab = getActiveTab();
    if (!activeTab) {
        return;
    }
    if (activeTab.type === "virtual") {
        renderVirtualThreadTab(activeTab);
        return;
    }
    if (activeTab.type === "manager") {
        renderManagerTab(activeTab);
        return;
    }
    renderChat(activeTab.convIdx);
}

function buildPromptPreviews(conv) {
    // Future prompt-level bookmarks can anchor to these messageIndex-based preview
    // entries without changing how the tree/sidebar currently reads prompt items.
    if (Array.isArray(conv.messages) && conv.messages.length > 0) {
        return conv.messages
            .map((message, index) => ({ message, index }))
            .filter((item) => item.message.role === "user")
            .map((item) => ({
                messageIndex: item.index,
                preview: decodeSafeHtmlEntities(item.message.text || "").split("\n")[0].slice(0, 24),
            }));
    }
    return Array.isArray(conv.promptPreviews) ? conv.promptPreviews : [];
}

function getCurrentConversationIndex() {
    const activeTab = getActiveTab();
    if (activeTab && activeTab.type === "conversation") {
        return activeTab.convIdx;
    }
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

function buildConversationSidebarSyncTarget(convIdx, messageIndex = currentPromptMessageIndex) {
    if (!Number.isInteger(convIdx)) return null;
    const hasPromptItem =
        Number.isInteger(messageIndex) &&
        getPromptNavigatorItems(convIdx).some((item) => item.messageIndex === messageIndex);

    return {
        convIdx,
        msgIdx: hasPromptItem ? messageIndex : null,
        preferConversation: !hasPromptItem,
        focusKey: hasPromptItem ? `prompt-${convIdx}-${messageIndex}` : `conv-${convIdx}`,
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

function shouldScrollSidebarItemIntoView(target) {
    const treeRoot = document.getElementById("index-tree");
    if (!treeRoot || !target) return false;
    const itemRect = target.getBoundingClientRect();
    const rootRect = treeRoot.getBoundingClientRect();
    const margin = 18;
    return itemRect.top < rootRect.top + margin || itemRect.bottom > rootRect.bottom - margin;
}

function syncSidebarActiveState(target = {}, options = {}) {
    // Visual active/highlight state only. This should stay separate from the
    // remembered keyboard-focus target in sidebarFocusKey.
    const treeRoot = document.getElementById("index-tree");
    if (!treeRoot) return;
    const safeTarget = target && typeof target === "object" ? target : {};

    const convIdx = Number.isInteger(safeTarget.convIdx) ? safeTarget.convIdx : null;
    const msgIdx = Number.isInteger(safeTarget.msgIdx) ? safeTarget.msgIdx : null;
    const preferConversation = options.preferConversation === true;
    const shouldScroll = options.scroll === true;
    const scrollBehavior = options.behavior || "auto";

    treeRoot.querySelectorAll(".tree-summary.active").forEach((el) => el.classList.remove("active"));
    treeRoot.querySelectorAll(".prompt-item.active").forEach((el) => el.classList.remove("active"));
    treeRoot.querySelectorAll(".tree-node.has-active-prompt").forEach((el) => el.classList.remove("has-active-prompt"));

    if (convIdx === null) return;

    const summaryItem = treeRoot.querySelector(`[data-focus-key="conv-${convIdx}"]`);
    const promptItem =
        !preferConversation && msgIdx !== null
            ? treeRoot.querySelector(`[data-focus-key="prompt-${convIdx}-${msgIdx}"]`)
            : null;

    if (summaryItem) {
        summaryItem.classList.add("active");
    }
    if (promptItem) {
        promptItem.classList.add("active");
        promptItem.closest(".tree-node")?.classList.add("has-active-prompt");
    }

    const scrollTarget = promptItem || summaryItem;
    if (shouldScroll && scrollTarget && shouldScrollSidebarItemIntoView(scrollTarget)) {
        scrollSidebarItemIntoView(scrollTarget, scrollBehavior);
    }
}

function getSidebarSyncTargetFromCurrentView() {
    const activeTab = getActiveTab();
    if (!activeTab) return null;

    if (activeTab.type === "conversation") {
        const convIdx = getCurrentConversationIndex();
        if (convIdx === null) return null;
        return buildConversationSidebarSyncTarget(convIdx, currentPromptMessageIndex);
    }

    if (activeTab.type === "virtual") {
        const selectedIndex = getVirtualTabSelectionIndex(activeTab);
        const item = activeTab.virtualThread?.items?.[selectedIndex];
        if (!item) return null;
        const convIdx = getConversationIndexById(item.convId);
        if (convIdx < 0) return null;
        return buildConversationSidebarSyncTarget(convIdx, item.messageIndex);
    }

    return null;
}

function primeSidebarFocusToCurrentView() {
    // sidebarFocusKey is rebuilt from the active tab/current reading target rather
    // than persisted in session snapshots.
    const target = getSidebarSyncTargetFromCurrentView();
    if (target?.focusKey) {
        sidebarFocusKey = target.focusKey;
    }
}

function syncSidebarStateToCurrentView(options = {}) {
    // Current-tab sync entry point. This keeps expanded tree context aligned with
    // the active reading surface without collapsing keyboard-focus memory into
    // the same responsibility.
    const target = getSidebarSyncTargetFromCurrentView();
    let nextTreeConvIdx = target ? target.convIdx : null;
    if (
        suppressedTreeAutoExpandConvIdx !== null &&
        nextTreeConvIdx !== suppressedTreeAutoExpandConvIdx
    ) {
        suppressedTreeAutoExpandConvIdx = null;
    }
    if (
        !isAllTreesExpanded &&
        suppressedTreeAutoExpandConvIdx !== null &&
        nextTreeConvIdx === suppressedTreeAutoExpandConvIdx
    ) {
        nextTreeConvIdx = null;
    }
    const shouldRenderTree =
        options.renderTreeIfNeeded !== false &&
        !isAllTreesExpanded &&
        currentTreeConvIdx !== nextTreeConvIdx;

    if (!isAllTreesExpanded) {
        currentTreeConvIdx = nextTreeConvIdx;
    } else if (target && currentTreeConvIdx === null) {
        currentTreeConvIdx = target.convIdx;
    }

    if (options.updateFocusKey !== false) {
        sidebarFocusKey = target?.focusKey || sidebarFocusKey;
    }

    if (shouldRenderTree) {
        renderTree();
        return;
    }

    if (!target) {
        syncSidebarActiveState({}, options);
        return;
    }

    syncSidebarActiveState(target, {
        ...options,
        preferConversation:
            options.preferConversation === true ? true : target.preferConversation === true,
    });

    if (options.focus === true && !isSidebarHidden) {
        window.requestAnimationFrame(() => {
            if (!focusSidebarItemByKey(target.focusKey)) {
                focusSidebarItemByKey(`conv-${target.convIdx}`);
            }
        });
    }
}

function syncSidebarActiveStateToCurrentView(options = {}) {
    syncSidebarStateToCurrentView({
        ...options,
        renderTreeIfNeeded: false,
        updateFocusKey: false,
    });
}

function getViewerScrollBoundaryY(viewer) {
    if (!viewer) return 0;
    const viewerRect = viewer.getBoundingClientRect();
    const tabStrip = viewer.querySelector(":scope > .tab-strip");
    const filterRow = viewer.querySelector(":scope > .header-filter-row");
    const stickyHeight =
        (tabStrip ? tabStrip.offsetHeight || 0 : 0) +
        (filterRow ? filterRow.offsetHeight || 0 : 0);
    return viewerRect.top + stickyHeight + 6;
}

function getConversationScrollTargets(viewer) {
    if (!viewer) return [];
    return Array.from(viewer.querySelectorAll(".chat-turn"))
        .map((turn) => {
            const match = String(turn.id || "").match(/^turn-(\d+)-(\d+)$/);
            if (!match) return null;
            return {
                turnElement: turn,
                convIdx: Number.parseInt(match[1], 10),
                messageIndex: Number.parseInt(match[2], 10),
            };
        })
        .filter((item) => item && !Number.isNaN(item.messageIndex) && item.turnElement.offsetParent !== null);
}

function setCurrentPromptFromTurn(turnTarget, options = {}) {
    if (!turnTarget) return;
    const convIdx = Number.isInteger(turnTarget.convIdx) ? turnTarget.convIdx : getCurrentConversationIndex();
    const messageIdx = Number.isInteger(turnTarget.messageIndex) ? turnTarget.messageIndex : null;
    if (convIdx === null || messageIdx === null) return;

    const viewer = document.getElementById("chat-viewer");
    const shouldScrollSidebar = options.scrollSidebar === true;
    const scrollBehavior = options.behavior || "auto";
    const currentConvIdx = getCurrentConversationIndex();

    if (currentPromptMessageIndex === messageIdx && currentConvIdx === convIdx) {
        syncSidebarActiveState({ convIdx, msgIdx: messageIdx }, { scroll: shouldScrollSidebar, behavior: scrollBehavior });
        return;
    }

    currentPromptMessageIndex = messageIdx;
    currentPromptBaselineScrollTop = viewer ? viewer.scrollTop : 0;
    if (promptNavigatorState) {
        promptNavigatorState.focusIndex = getCurrentPromptIndex(promptNavigatorState.convIdx);
        syncPromptNavigatorPopover(false);
    }
    refreshConversationRootDock();
    syncSidebarActiveState({ convIdx, msgIdx: messageIdx }, { scroll: shouldScrollSidebar, behavior: scrollBehavior });
}

function updateConversationRootDockByScroll() {
    const viewer = document.getElementById("chat-viewer");
    const promptButton = document.getElementById("conversation-root-prompt");
    if (!viewer) return;

    const targets = getConversationScrollTargets(viewer);
    if (targets.length === 0) {
        if (promptButton) {
            promptButton.style.setProperty("--prompt-fade", "1");
        }
        return;
    }

    const boundaryY = getViewerScrollBoundaryY(viewer);

    let activeIndex = targets.findIndex((target) => target.messageIndex === currentPromptMessageIndex);

    const pendingLockActive = pendingPromptMessageIndex !== null && Date.now() < pendingPromptLockUntil;
    if (pendingLockActive) {
        const pendingIndex = targets.findIndex((target) => target.messageIndex === pendingPromptMessageIndex);
        if (pendingIndex >= 0) {
            activeIndex = pendingIndex;
        }
    }

    if (activeIndex < 0) {
        activeIndex = 0;
        targets.forEach((target, index) => {
            if (target.turnElement.getBoundingClientRect().top <= boundaryY) {
                activeIndex = index;
            }
        });
    }

    if (!pendingLockActive) {
        while (activeIndex < targets.length - 1) {
            const nextAnchorTop = targets[activeIndex + 1].turnElement.getBoundingClientRect().top;
            if (nextAnchorTop <= boundaryY - ROOT_DOCK_SWITCH_HYSTERESIS) {
                activeIndex += 1;
            } else {
                break;
            }
        }

        while (activeIndex > 0) {
            const currentAnchorTop = targets[activeIndex].turnElement.getBoundingClientRect().top;
            if (currentAnchorTop > boundaryY + ROOT_DOCK_SWITCH_HYSTERESIS) {
                activeIndex -= 1;
            } else {
                break;
            }
        }
    }

    const activeTarget = targets[activeIndex];
    setCurrentPromptFromTurn(activeTarget, { scrollSidebar: !isSidebarHidden, behavior: "auto" });

    if (!promptButton) {
        return;
    }

    let fade = 1;
    const scrollDelta = Math.max(0, viewer.scrollTop - currentPromptBaselineScrollTop);
    const shouldFadeFromScroll = scrollDelta > ROOT_DOCK_FADE_SCROLL_START;
    const nextTarget = targets[activeIndex + 1];
    if (shouldFadeFromScroll && nextTarget) {
        const distance = nextTarget.turnElement.getBoundingClientRect().top - boundaryY;
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

    const activeTurn = activeTarget.turnElement;
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

function updateVirtualThreadSidebarByScroll() {
    const viewer = document.getElementById("chat-viewer");
    const activeTab = getActiveTab();
    if (!viewer || !activeTab || activeTab.type !== "virtual") return;
    if (Date.now() < virtualTabScrollRestoreGuardUntil) return;

    const fragments = Array.from(viewer.querySelectorAll(".virtual-fragment")).filter((item) => item.offsetParent !== null);
    if (fragments.length === 0) return;

    const boundaryY = getViewerScrollBoundaryY(viewer);
    let activeIndex = Math.max(0, Math.min(fragments.length - 1, getVirtualTabSelectionIndex(activeTab)));

    fragments.forEach((fragment, index) => {
        if (fragment.getBoundingClientRect().top <= boundaryY) {
            activeIndex = index;
        }
    });

    while (activeIndex < fragments.length - 1) {
        const nextTop = fragments[activeIndex + 1].getBoundingClientRect().top;
        if (nextTop <= boundaryY - ROOT_DOCK_SWITCH_HYSTERESIS) {
            activeIndex += 1;
        } else {
            break;
        }
    }

    while (activeIndex > 0) {
        const currentTop = fragments[activeIndex].getBoundingClientRect().top;
        if (currentTop > boundaryY + ROOT_DOCK_SWITCH_HYSTERESIS) {
            activeIndex -= 1;
        } else {
            break;
        }
    }

    setVirtualFragmentActiveIndex(activeIndex, {
        tab: activeTab,
        focus: false,
        scrollIntoView: false,
        syncSidebar: !isSidebarHidden,
    });
}

function scheduleConversationRootDockUpdate() {
    if (viewerScrollTicking) return;
    viewerScrollTicking = true;
    window.requestAnimationFrame(() => {
        viewerScrollTicking = false;
        const activeTab = getActiveTab();
        if (activeTab && activeTab.type === "virtual") {
            updateVirtualThreadSidebarByScroll();
            return;
        }
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

function openSidebarAtCurrentPrompt() {
    const convIdx = getCurrentConversationIndex();
    if (convIdx === null) return false;
    suppressedTreeAutoExpandConvIdx = null;
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

    suppressedTreeAutoExpandConvIdx = convIdx;
    currentTreeConvIdx = null;
    sidebarFocusKey = `conv-${convIdx}`;
    renderTree();
    window.requestAnimationFrame(() => {
        focusSidebarItemByKey(`conv-${convIdx}`);
    });
    return true;
}

function collapseSidebarConversationByIndex(convIdx) {
    if (!Number.isFinite(convIdx) || isAllTreesExpanded) return false;
    const treeNode = document.getElementById(`tree-node-${convIdx}`);
    const isExpandedConversation =
        currentTreeConvIdx === convIdx || Boolean(treeNode && treeNode.open);
    if (!isExpandedConversation) return false;

    suppressedTreeAutoExpandConvIdx = convIdx;
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
}

function ensureGlobalViewerKeyboardNavigation() {
    if (document.body.dataset.globalViewerNavBound === "true") return;
    document.body.dataset.globalViewerNavBound = "true";

    document.addEventListener("keydown", (event) => {
        if (isEditableTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
            return;
        }

        let action = null;
        if (event.key === "ArrowDown") {
            action = "virtualFragmentNext";
        } else if (event.key === "ArrowUp") {
            action = "virtualFragmentPrevious";
        } else if (event.key === "Enter") {
            action = "virtualFragmentOpenOrigin";
        } else if (event.key === "Escape") {
            action = "closeTab";
        }

        if (action && dispatchKeyboardShortcut(KEYBOARD_HANDLING_SCOPE.VIEWER_NAVIGATION, action)) {
            event.preventDefault();
        }
    });
}

function ensureNativeShortcutFallbacks() {
    if (document.body.dataset.nativeShortcutFallbackBound === "true") return;
    document.body.dataset.nativeShortcutFallbackBound = "true";

    document.addEventListener("keydown", (event) => {
        if (isEditableTarget(event.target) || !event.metaKey || event.ctrlKey || event.altKey) {
            return;
        }

        if (event.key.toLowerCase() === "z" && !event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();
            void undoLastBookmarkAction();
            return;
        }

        let action = null;
        let context = {};
        if (event.key === "[" || event.key === "{") {
            action = event.shiftKey ? "previousTab" : "back";
        } else if (event.key === "]" || event.key === "}") {
            action = event.shiftKey ? "nextTab" : "forward";
        } else if (event.key === "ArrowLeft") {
            action = "hideSidebar";
        } else if (event.key === "ArrowRight") {
            action = "showSidebar";
        } else if (event.key === "ArrowUp" && !event.shiftKey) {
            action = "scrollTop";
        } else if (event.key === "ArrowDown" && !event.shiftKey) {
            action = "scrollBottom";
        } else if (event.key === "," && !event.shiftKey) {
            action = "openSettings";
        } else if (event.key.toLowerCase() === "t" && event.shiftKey) {
            action = "restoreTab";
        }

        if (action && dispatchKeyboardShortcut(KEYBOARD_HANDLING_SCOPE.APP_NATIVE, action, context)) {
            event.preventDefault();
            event.stopPropagation();
        }
    });
}

function ensureTabSessionLifecyclePersistence() {
    if (document.body.dataset.tabSessionLifecycleBound === "true") return;
    document.body.dataset.tabSessionLifecycleBound = "true";

    window.addEventListener("beforeunload", () => {
        flushTabSessionPersist();
    });
    window.addEventListener("pagehide", () => {
        flushTabSessionPersist();
    });
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            flushTabSessionPersist();
        }
    });
}

function isReadingContextFocusTarget(target = document.activeElement) {
    const viewer = document.getElementById("chat-viewer");
    if (!target || !viewer) return false;
    if (target === viewer) return true;

    const activeTab = getActiveTab();
    return Boolean(
        activeTab?.type === "virtual" &&
        target.matches?.(".virtual-fragment.active")
    );
}

function ensureReadingContextWidgetFocusBridges() {
    if (document.body.dataset.readingContextFocusBridgeBound === "true") return;
    document.body.dataset.readingContextFocusBridgeBound = "true";

    // These bridges are the inverse of local-widget Escape exits: from the
    // reading surface we can step back into a widget's remembered focus target
    // without turning Tab navigation into an app-level shortcut.
    document.addEventListener("keydown", (event) => {
        if (event.metaKey || event.ctrlKey || event.altKey || event.key !== "Tab") {
            return;
        }

        const activeElement = document.activeElement;
        if (!isReadingContextFocusTarget(activeElement)) {
            return;
        }

        let handled = false;
        if (event.shiftKey) {
            handled = focusTabStripFromReadingContext();
        } else if (activeElement?.id === "chat-viewer") {
            handled = focusSidebarTreeFromReadingContext();
        }

        if (handled) {
            event.preventDefault();
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

function setSidebarFocusedState(target) {
    // Keyboard-focus styling only. Visual "active" highlighting stays in
    // syncSidebarActiveState() so current-reading context and focus can diverge safely.
    const treeRoot = document.getElementById("index-tree");
    if (!treeRoot) return;
    treeRoot.querySelectorAll(".tree-summary.focused, .prompt-item.focused").forEach((node) => {
        node.classList.remove("focused");
    });
    if (target && target.matches?.(".tree-summary, .prompt-item[data-focus-key]")) {
        target.classList.add("focused");
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
    setSidebarFocusedState(target);
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
        setSidebarFocusedState(fallback);
        scrollSidebarItemIntoView(fallback, "auto");
        rememberSidebarFocus(fallback);
    }
}

function expandConversationPrompts(convIdx, revealPosition = 0) {
    suppressedTreeAutoExpandConvIdx = null;
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

function exitSidebarTreeFocusToReadingContext() {
    rememberSidebarFocus(document.activeElement);
    return focusActiveReadingContext();
}

function handleSidebarTreeKeydown(event) {
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

    if (event.key === "Escape") {
        event.preventDefault();
        exitSidebarTreeFocusToReadingContext();
        return;
    }

    if (itemType === "conversation") {
        if (event.key === "ArrowRight") {
            event.preventDefault();
            const treeNode = document.getElementById(`tree-node-${convIdx}`);
            const firstPrompt = document.querySelector(`#tree-node-${convIdx} .prompt-item[data-focus-key]`);
            if (treeNode && !treeNode.open && !isAllTreesExpanded) {
                suppressedTreeAutoExpandConvIdx = null;
                sidebarFocusKey = target.dataset.focusKey;
                currentTreeConvIdx = convIdx;
                renderTree();
                window.requestAnimationFrame(() => {
                    const expandedFirstPrompt = document.querySelector(
                        `#tree-node-${convIdx} .prompt-item[data-focus-key]`
                    );
                    if (expandedFirstPrompt) {
                        expandedFirstPrompt.focus({ preventScroll: true });
                        scrollSidebarItemIntoView(expandedFirstPrompt);
                        rememberSidebarFocus(expandedFirstPrompt);
                        return;
                    }
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
            if (collapseSidebarConversationByIndex(convIdx)) {
                event.preventDefault();
            }
            return;
        }

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openConversationFromTree(event, convIdx, {
                toggleTree: false,
                activateViewer: true,
            });
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
}

function ensureSidebarKeyboardNavigation() {
    if (sidebarKeyboardBound) return;
    const treeRoot = document.getElementById("index-tree");
    if (!treeRoot) return;

    sidebarKeyboardBound = true;
    treeRoot.addEventListener("focusin", (event) => {
        setSidebarFocusedState(event.target);
        rememberSidebarFocus(event.target);
    });
    treeRoot.addEventListener("focusout", () => {
        window.requestAnimationFrame(() => {
            const activeElement = document.activeElement;
            if (!activeElement || !treeRoot.contains(activeElement)) {
                setSidebarFocusedState(null);
            }
        });
    });

    // Sidebar arrows/enter/space/escape stay widget-local. They should only
    // apply while focus is inside the tree, not as app-level or viewer-level
    // shortcuts.
    treeRoot.addEventListener("keydown", (event) => {
        handleSidebarTreeKeydown(event);
    });
}

function getSearchTargetInputs() {
    return [
        document.getElementById("chk-title"),
        document.getElementById("chk-prompt"),
        document.getElementById("chk-answer"),
    ].filter(Boolean);
}

function getKeywordSearchTargetConfig() {
    const titleToggle = document.getElementById("chk-title");
    const promptToggle = document.getElementById("chk-prompt");
    const answerToggle = document.getElementById("chk-answer");
    return {
        includeTitle: titleToggle ? titleToggle.checked : true,
        includePrompt: promptToggle ? promptToggle.checked : true,
        includeAnswer: answerToggle ? answerToggle.checked : true,
    };
}

function buildKeywordSearchSpec(queryOverride = null) {
    const rawQuery = queryOverride !== null
        ? String(queryOverride || "")
        : String(document.getElementById("searchBar")?.value || "");
    const parsedQuery = parseSmartQuery(rawQuery.trim());
    return {
        query: rawQuery,
        fuseQuery: parsedQuery.fuseQuery,
        words: parsedQuery.words,
        ...getKeywordSearchTargetConfig(),
    };
}

function hasActiveKeywordSearch(searchSpec) {
    return Boolean(searchSpec && Array.isArray(searchSpec.words) && searchSpec.words.length > 0);
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
    // Keep legacy exclude-key fallback for older localStorage state until a later
    // cleanup pass can safely drop compatibility.
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
    const searchSpec = buildKeywordSearchSpec();

    if (searchBar) {
        localStorage.setItem(STORAGE_KEYS.searchQuery, searchBar.value);
    }
    if (sortSelect) {
        localStorage.setItem(STORAGE_KEYS.sortMode, sortSelect.value);
    }

    saveBooleanPreference(STORAGE_KEYS.searchTitle, searchSpec.includeTitle);
    saveBooleanPreference(STORAGE_KEYS.searchPrompt, searchSpec.includePrompt);
    saveBooleanPreference(STORAGE_KEYS.searchAnswer, searchSpec.includeAnswer);
    saveBooleanPreference(STORAGE_KEYS.sidebarFilter, isSidebarFilterActive);
    saveBooleanPreference(STORAGE_KEYS.treeExpand, isAllTreesExpanded);
    saveBooleanPreference(STORAGE_KEYS.matchFilter, isMatchFilterActive);
}

function refreshUtilityToggleButtons() {
    document.querySelectorAll('[data-view-setting="mode"]').forEach((modeToggle) => {
        const icon = modeToggle.querySelector(".viewer-menu-toggle-icon") || modeToggle;
        icon.textContent = activeMode === "light" ? "☀︎" : "☾";
        modeToggle.classList.toggle("active", activeMode === "dark");
        modeToggle.setAttribute(
            "aria-label",
            activeMode === "light" ? "ダークモードに切り替え" : "ライトモードに切り替え"
        );
        modeToggle.title = activeMode === "light" ? "ダークモードに切り替え" : "ライトモードに切り替え";
    });

    document.querySelectorAll('[data-view-setting="text-size"]').forEach((textSizeToggle) => {
        textSizeToggle.classList.toggle("active", isSmallText);
        textSizeToggle.setAttribute(
            "aria-label",
            isSmallText ? "標準文字サイズに戻す" : "文字を小さくする"
        );
        textSizeToggle.title = isSmallText ? "標準文字サイズに戻す" : "文字を小さくする";
    });

    const treeExpandToggle = document.getElementById("tree-expand-toggle");
    if (treeExpandToggle) {
        const treeExpandLabel = treeExpandToggle.querySelector(".branch-toggle-label");
        treeExpandToggle.classList.toggle("active", isAllTreesExpanded);
        treeExpandToggle.setAttribute("aria-pressed", isAllTreesExpanded ? "true" : "false");
        treeExpandToggle.setAttribute(
            "aria-label",
            isAllTreesExpanded
                ? "固定展開: ツリー全体を開いたまま"
                : "通常表示: 会話ごとに開閉"
        );
        treeExpandToggle.title = isAllTreesExpanded
            ? "固定展開: ツリー全体を開いたまま"
            : "通常表示: 会話ごとに開閉";
        if (treeExpandLabel) {
            treeExpandLabel.textContent = isAllTreesExpanded ? "固定" : "個別";
        }
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

function clampSidebarWidth(value) {
    const numeric = Number.parseInt(value, 10);
    if (!Number.isFinite(numeric)) return 292;
    return Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, numeric));
}

function applySidebarWidth(width) {
    const nextWidth = clampSidebarWidth(width);
    document.documentElement.style.setProperty("--sidebar-width", `${nextWidth}px`);
    localStorage.setItem(STORAGE_KEYS.sidebarWidth, String(nextWidth));
}

function ensureSidebarResizer() {
    const resizer = document.getElementById("resizer");
    const sidebar = document.getElementById("sidebar");
    if (!resizer || !sidebar || resizer.dataset.bound === "true") return;
    resizer.dataset.bound = "true";

    let resizing = false;
    let activePointerId = null;

    const stopResize = () => {
        if (!resizing) return;
        resizing = false;
        activePointerId = null;
        document.body.classList.remove("sidebar-resizing");
    };

    const updateWidth = (clientX) => {
        if (!resizing || isSidebarHidden) return;
        const nextWidth = clampSidebarWidth(clientX);
        document.documentElement.style.setProperty("--sidebar-width", `${nextWidth}px`);
    };

    resizer.addEventListener("pointerdown", (event) => {
        if ((event.button ?? 0) !== 0 || isSidebarHidden) return;
        resizing = true;
        activePointerId = event.pointerId ?? null;
        document.body.classList.add("sidebar-resizing");
        resizer.setPointerCapture?.(event.pointerId);
        updateWidth(event.clientX ?? sidebar.getBoundingClientRect().width);
        event.preventDefault();
    });

    const handlePointerMove = (event) => {
        if (activePointerId !== null && event.pointerId !== activePointerId) return;
        updateWidth(event.clientX ?? 0);
    };

    const handlePointerUp = (event) => {
        if (activePointerId !== null && event.pointerId !== activePointerId) return;
        if (resizing) {
            applySidebarWidth(event.clientX ?? sidebar.getBoundingClientRect().width);
        }
        stopResize();
    };

    resizer.addEventListener("pointermove", handlePointerMove);
    resizer.addEventListener("pointerup", handlePointerUp);
    resizer.addEventListener("pointercancel", stopResize);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", stopResize);
    window.addEventListener("blur", stopResize);
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
    document.body.classList.toggle("dark", activeMode === "dark");
    document.body.classList.toggle("light", activeMode !== "dark");

    document.querySelectorAll(".theme-btn").forEach((btn) => {
        btn.classList.remove("active");
    });

    document.querySelectorAll(`.theme-btn[data-theme-key="${CSS.escape(activeTheme)}"]`).forEach((btn) => {
        btn.classList.add("active");
    });

    activeMode = mode;
    localStorage.setItem(STORAGE_KEYS.theme, activeTheme);
    localStorage.setItem(STORAGE_KEYS.mode, activeMode);
    refreshUtilityToggleButtons();
    updateToolbarCollapse();
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
    const source = getConversationSourceClass(conv);
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

function getConversationSourceClass(conv) {
    return String(conv?.source || "").toLowerCase();
}

function getCountFolderBadgeHtml(
    count,
    sourceClass = "",
    extraClasses = "",
    title = "Starred prompts",
    options = {}
) {
    const normalizedCount = Math.max(0, Number.parseInt(count, 10) || 0);
    const expanded = Boolean(options.expanded);
    const className = [
        "count-folder-badge",
        extraClasses,
        normalizedCount <= 0 ? "is-empty" : "",
        expanded ? "is-open" : "is-closed",
        sourceClass ? `source-label-${sourceClass}` : "",
    ].filter(Boolean).join(" ");
    const iconMarkup = `
        <span class="${className}" title="${escapeHTML(title)}" aria-hidden="true">
            <svg viewBox="0 0 28 22" focusable="false" aria-hidden="true">
                ${
                    expanded
                        ? `
                <path d="M4.35 5.35A2.35 2.35 0 0 1 6.7 3h4.12c.72 0 1.41.29 1.91.81l.92.96c.34.36.82.57 1.32.57h5.98a2.35 2.35 0 0 1 2.35 2.35v1.11H4.35V5.35Z" fill="currentColor" fill-opacity="0.14"></path>
                <path d="M5.1 7.55h6.56c.7 0 1.37-.27 1.87-.77l.62-.61c.37-.36.86-.57 1.37-.57h5.26c.85 0 1.54.69 1.54 1.54v.55H5.1v-.14Z" fill="currentColor" fill-opacity="0.24"></path>
                <path d="M3 10.15c.23-1.08 1.18-1.85 2.28-1.85h18.03c1.44 0 2.46 1.38 2.01 2.75l-1.68 5.17a2.35 2.35 0 0 1-2.24 1.62H4.82c-1.56 0-2.67-1.5-2.24-2.99L3 10.15Z" fill="currentColor" fill-opacity="0.28"></path>
                <path d="M6.05 8.3h16.47c.96 0 1.72.85 1.6 1.8l-.09.68H4.59l.11-.54A2.02 2.02 0 0 1 6.05 8.3Z" fill="currentColor" fill-opacity="0.42"></path>
                        `
                        : `
                <path d="M2.75 6.5A2.75 2.75 0 0 1 5.5 3.75h4.15c.74 0 1.43.33 1.91.89l.93 1.1c.24.28.59.45.97.45H22.5A2.75 2.75 0 0 1 25.25 8.94v8.81A2.75 2.75 0 0 1 22.5 20.5h-17A2.75 2.75 0 0 1 2.75 17.75V6.5Z" fill="currentColor" fill-opacity="0.14"></path>
                <path d="M2.75 8.2A2.75 2.75 0 0 1 5.5 5.45h4.37c.56 0 1.09.22 1.49.6l.74.72c.4.39.93.6 1.49.6H22.5A2.75 2.75 0 0 1 25.25 10.12v7.63A2.75 2.75 0 0 1 22.5 20.5h-17A2.75 2.75 0 0 1 2.75 17.75V8.2Z" fill="currentColor" fill-opacity="0.24"></path>
                        `
                }
                <text x="14" y="16.1" text-anchor="middle">${normalizedCount > 0 ? escapeHTML(String(normalizedCount)) : ""}</text>
            </svg>
        </span>
    `;
    if (!options.interactive) {
        return iconMarkup;
    }
    return `
        <button
            class="count-folder-toggle"
            type="button"
            title="${escapeHTML(title)}"
            aria-label="${escapeHTML(title)}"
            aria-expanded="${expanded ? "true" : "false"}"
            onclick="${options.clickHandler || ""}"
        >${iconMarkup}</button>
    `;
}

function getConversationStarredPromptCount(convId) {
    const convIdx = getConversationIndexById(convId);
    if (convIdx < 0) return 0;
    return Number.isInteger(chatData[convIdx]?.starredPromptCount)
        ? chatData[convIdx].starredPromptCount
        : 0;
}

function getPromptBookmarkTags(targetSpec) {
    const cachedState = getCachedBookmarkState(targetSpec);
    if (Array.isArray(cachedState?.tags) && cachedState.tags.length) {
        return cachedState.tags;
    }
    const normalizedTarget = normalizeBookmarkTargetSpec(targetSpec);
    const entry = (starredPromptEntries || []).find(
        (item) => String(item.targetType || "") === normalizedTarget.targetType &&
            String(item.targetId || "") === normalizedTarget.targetId
    );
    return Array.isArray(entry?.tags) ? entry.tags : [];
}

function buildPromptTagBadgesHtml(targetSpec) {
    const tags = getPromptBookmarkTags(targetSpec);
    if (!tags.length) {
        return "";
    }
    return tags.map((tag) => `
        <span class="prompt-inline-tag">${escapeHTML(tag?.name || "")}</span>
    `).join("");
}

function getManagerTabKindIconHtml(kind, extraClasses = "") {
    if (kind === "starred_prompts") {
        return buildTagOutlineIconHtml(`tab-button-kind tab-button-kind-icon ${extraClasses}`);
    }
    const iconClass = kind === "recent_filters"
        ? "tab-button-kind-clock"
        : "tab-button-kind-filter";
    return `<span class="tab-button-kind tab-button-kind-icon ${iconClass} ${extraClasses}" aria-hidden="true"></span>`;
}

function buildRawSourceDebugPanelHtml(conv, tab) {
    if (!conv || !conv.id) return "";
    if (!tab || tab.type !== "conversation" || !tab.rawDebugOpen) return "";
    const convIdx = Number.isInteger(tab.convIdx) ? tab.convIdx : conv._idx;
    const entry = getRawSourceDebugEntry(conv.id);
    if (!entry) return "";

    const raw = entry.data;
    const rows = [];
    const addRow = (label, value) => {
        if (value === null || value === undefined || value === "") return;
        rows.push(`
            <div style="display:grid; grid-template-columns: 150px 1fr; gap: 10px; padding: 6px 0; border-top: 1px solid var(--border-color);">
                <div style="font-size: 12px; opacity: 0.7;">${escapeHTML(label)}</div>
                <div style="font-size: 12px; overflow-wrap:anywhere;">${escapeHTML(String(value))}</div>
            </div>
        `);
    };

    if (entry.loading) {
        return `
            <section style="margin: 12px 0 18px; padding: 14px 16px; border: 1px solid var(--border-color); border-radius: 12px; background: rgba(127,127,127,0.06);">
                <div style="font-size: 13px; opacity: 0.78;">Loading raw source provenance...</div>
            </section>
        `;
    }

    if (entry.error) {
        return `
            <section style="margin: 12px 0 18px; padding: 14px 16px; border: 1px solid var(--border-color); border-radius: 12px; background: rgba(127,127,127,0.06);">
                <div style="font-size: 12px; font-weight: 600; margin-bottom: 6px;">Raw Source Debug</div>
                <div style="font-size: 13px; color: #b91c1c;">${escapeHTML(entry.error)}</div>
            </section>
        `;
    }

    addRow("source_format", raw?.sourceFormat);
    addRow("source_path", raw?.sourcePath);
    addRow("source_created_at", raw?.sourceCreatedAt);
    addRow("imported_at", raw?.importedAt);
    addRow("source_hash", raw?.sourceHash);
    addRow("mime_type", raw?.mimeType);
    addRow("size_bytes", raw?.sizeBytes);
    addRow("text_encoding", raw?.textEncoding);
    addRow("raw_source_id", raw?.rawSourceId);

    const previewText = raw?.rawTextPreview || "";
    const rawTextLength = Number.isFinite(Number(raw?.rawTextLength)) ? Number(raw.rawTextLength) : previewText.length;
    const rawTextLengthLabel = rawTextLength > 0 ? rawTextLength.toLocaleString("ja-JP") : "0";
    const isTruncated = Boolean(raw?.rawTextTruncated);
    const displayedRawText = previewText;
    const hasCopyableRawText = raw?.available !== false;
    const rawBody = raw?.available === false
        ? '<div style="font-size: 13px; opacity: 0.76;">No linked raw source is stored for this conversation yet.</div>'
        : `
            <div style="margin-top: 12px;">
                <div style="font-size: 12px; opacity: 0.7; margin-bottom: 6px;">raw_text${isTruncated ? ` preview (${rawTextLengthLabel} chars)` : rawTextLength > 0 ? ` (${rawTextLengthLabel} chars)` : ""}</div>
                ${isTruncated ? '<div style="font-size: 11px; opacity: 0.62; margin-bottom: 8px;">長い raw_text は最初は preview だけ表示してるよ。</div>' : ""}
                <pre style="margin: 0; max-height: 320px; overflow: auto; padding: 12px; border-radius: 10px; border: 1px solid var(--border-color); background: rgba(127,127,127,0.08); color: inherit; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; word-break: break-word;">${escapeHTML(displayedRawText)}</pre>
            </div>
        `;

    return `
        <section style="margin: 12px 0 18px; padding: 14px 16px; border: 1px solid var(--border-color); border-radius: 12px; background: rgba(127,127,127,0.06);">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom: 6px;">
                <div style="font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.82;">Raw Source Debug</div>
                <div class="raw-debug-panel-actions">
                    <button
                        class="raw-debug-panel-btn circle-pill circle-pill-sm"
                        type="button"
                        onclick="downloadConversationRawText(${Number.isInteger(convIdx) ? convIdx : -1}, this, event)"
                        ${hasCopyableRawText ? "" : "disabled"}
                        ${hasCopyableRawText ? 'aria-label="raw_text をダウンロード" title="raw_text をダウンロード"' : 'aria-label="ダウンロードできる raw_text がありません" title="ダウンロードできる raw_text がありません"'}
                    ><span class="raw-debug-panel-btn-icon" aria-hidden="true">↓</span></button>
                    <button
                        class="raw-debug-panel-btn circle-pill circle-pill-sm"
                        type="button"
                        onclick="copyConversationRawText(${Number.isInteger(convIdx) ? convIdx : -1}, this, event)"
                        ${hasCopyableRawText ? "" : "disabled"}
                        ${hasCopyableRawText ? 'aria-label="raw_text をコピー"' : 'aria-label="コピーできる raw_text がありません" title="コピーできる raw_text がありません"'}
                    ><span class="raw-debug-panel-btn-icon" aria-hidden="true">⧉</span></button>
                </div>
            </div>
            ${rows.join("")}
            ${rawBody}
        </section>
    `;
}

function getConversationPrimaryTimeInfo(conv) {
    // Keep this precedence aligned with archive_store._conversation_primary_time_expr
    // so displayed time, extract filtering, preview counts, and date sorting keep
    // the same meaning across the app.
    const sourceCreatedAt = String(conv?.source_created_at || "").trim();
    const importedAt = String(conv?.imported_at || "").trim();
    const legacyDate = String(conv?.date || "").trim();

    if (sourceCreatedAt) {
        return {
            value: sourceCreatedAt,
            field: "source_created_at",
            label: "Original time",
            note: "primary archive time",
        };
    }
    if (importedAt) {
        return {
            value: importedAt,
            field: "imported_at",
            label: "Imported time",
            note: "fallback while original time is unavailable",
        };
    }
    if (legacyDate) {
        return {
            value: legacyDate,
            field: "date",
            label: "Archive time",
            note: "legacy fallback",
        };
    }
    return {
        value: "unknown",
        field: "unknown",
        label: "Time",
        note: "no provenance time available",
    };
}

function buildConversationHeaderTimeHtml(conv) {
    if (!conv || !conv.id) return "";
    const primaryTime = getConversationPrimaryTimeInfo(conv);
    return `
        <div style="display:flex; flex-wrap:wrap; align-items:baseline; gap:8px 10px; margin:10px 0 8px;">
            <span style="font-size:11px; font-weight:600; letter-spacing:0.05em; text-transform:uppercase; opacity:0.72;">Time</span>
            <span style="font-size:13px; font-weight:600;">${escapeHTML(String(primaryTime.value))}</span>
            <span style="font-size:12px; opacity:0.7;">${escapeHTML(primaryTime.label)} via ${escapeHTML(primaryTime.field)}</span>
            <span style="font-size:12px; opacity:0.58;">${escapeHTML(primaryTime.note)}</span>
        </div>
    `;
}

function buildConversationProvenanceStatusHtml(conv) {
    if (!conv || !conv.id) return "";

    const isLinked =
        conv.raw_source_id !== null &&
        conv.raw_source_id !== undefined &&
        String(conv.raw_source_id).trim() !== "";
    const statusLabel = isLinked ? "raw linked" : "raw not linked";
    const statusTone = isLinked ? "rgba(22, 101, 52, 0.12)" : "rgba(148, 163, 184, 0.12)";
    const primaryTime = getConversationPrimaryTimeInfo(conv);
    const sourceCreatedAt = conv.source_created_at || "unavailable";
    const importedAt = conv.imported_at || "unavailable";
    const sourceFormat = conv.source_format || "";

    const chips = [
        `<span style="display:inline-flex; align-items:center; padding:4px 8px; border-radius:999px; background:${statusTone}; border:1px solid var(--border-color); font-size:11px; font-weight:600; letter-spacing:0.02em; text-transform:uppercase;">${escapeHTML(statusLabel)}</span>`,
        `<span style="font-size:12px; opacity:0.78;">primary_from: ${escapeHTML(primaryTime.field)}</span>`,
        `<span style="font-size:12px; opacity:0.78;">source_created_at: ${escapeHTML(String(sourceCreatedAt))}</span>`,
        `<span style="font-size:12px; opacity:0.78;">imported_at: ${escapeHTML(String(importedAt))}</span>`,
    ];
    if (sourceFormat) {
        chips.push(`<span style="font-size:12px; opacity:0.78;">source_format: ${escapeHTML(String(sourceFormat))}</span>`);
    }
    if (!isLinked) {
        chips.push('<span style="font-size:12px; opacity:0.7;">using conversation-level metadata only</span>');
    }

    return `
        <div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px 10px; margin:10px 0 14px; padding:10px 12px; border:1px solid var(--border-color); border-radius:12px; background:rgba(127,127,127,0.04);">
            <span style="font-size:11px; font-weight:600; letter-spacing:0.05em; text-transform:uppercase; opacity:0.72;">Provenance</span>
            ${chips.join("")}
        </div>
    `;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function protectCodeSegments(sourceText, placeholders) {
    const source = String(sourceText || "");
    const lines = source.match(/[^\r\n]*(?:\r?\n|$)/g) || [];
    const output = [];

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line) continue;

        const openMatch = line.match(/^(?: {0,3})(`{3,}|~{3,})([^\r\n]*)\r?\n?$/);
        if (!openMatch) {
            output.push(line);
            continue;
        }

        const [, fence, infoRaw] = openMatch;
        const fenceChar = fence[0];
        const fenceLength = fence.length;
        const info = String(infoRaw || "").trim().split(/\s+/, 1)[0] || "";
        const contentLines = [];
        let closeIndex = -1;

        for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
            const candidate = lines[cursor];
            const closePattern = new RegExp(`^(?: {0,3})${escapeRegex(fenceChar.repeat(fenceLength))}${fenceChar}*[ \\t]*\\r?\\n?$`);
            if (closePattern.test(candidate)) {
                closeIndex = cursor;
                break;
            }
            contentLines.push(candidate);
        }

        if (closeIndex === -1) {
            output.push(line);
            continue;
        }

        let code = contentLines.join("");
        code = code.replace(/\r?\n$/, "");
        const languageClass = info ? ` class="language-${escapeHTML(info.toLowerCase())}"` : "";
        output.push(
            placeholders.put(`<pre><code${languageClass}>${escapeHTML(code)}</code></pre>`)
        );
        index = closeIndex;
    }

    return output.join("").replace(/`([^`\n]+)`/g, (_match, code) => {
        return placeholders.put(`<code>${escapeHTML(code)}</code>`);
    });
}

function renderExplicitMathSegments(sourceText, placeholders) {
    let nextText = sourceText;
    nextText = nextText.replace(/\\\[([\s\S]*?)\\\]/g, (_match, expr) => {
        return placeholders.put(renderMathBlock(expr, true));
    });
    nextText = nextText.replace(/\$\$([\s\S]*?)\$\$/g, (_match, expr) => {
        return placeholders.put(renderMathBlock(expr, true));
    });
    nextText = nextText.replace(/\\\(([\s\S]*?)\\\)/g, (_match, expr) => {
        return placeholders.put(renderMathBlock(expr, false));
    });
    return replaceInlineDollarMath(nextText, placeholders);
}

function renderMathSegments(sourceText, placeholders) {
    let nextText = sourceText;
    nextText = replaceInlineImplicitMath(nextText, placeholders);
    nextText = replaceStandaloneMathBlocks(nextText, placeholders);
    return replaceStandaloneMathLines(nextText, placeholders);
}

function isMarkdownTableSeparator(line) {
    const trimmed = String(line || "").trim();
    if (!trimmed.includes("|")) return false;
    return /^\|?(?:\s*:?-{3,}:?\s*\|)+(?:\s*:?-{3,}:?\s*)\|?$/.test(trimmed);
}

function parseMarkdownTableRow(line) {
    const normalized = String(line || "").trim().replace(/^\|/, "").replace(/\|$/, "");
    return normalized.split("|").map((cell) => cell.trim());
}

function renderMarkdownTableCell(cell) {
    let value = String(cell || "");
    const replacements = [
        [/&amp;lt;\s*br\s*\/?\s*&amp;gt;/gi, "<br>"],
        [/&amp;lt;\s*wbr\s*\/?\s*&amp;gt;/gi, "<wbr>"],
        [/&#0*60;\s*br\s*\/?\s*&#0*62;/gi, "<br>"],
        [/&#x0*3c;\s*br\s*\/?\s*&#x0*3e;/gi, "<br>"],
        [/&#0*60;\s*wbr\s*\/?\s*&#0*62;/gi, "<wbr>"],
        [/&#x0*3c;\s*wbr\s*\/?\s*&#x0*3e;/gi, "<wbr>"],
        [/&lt;\s*br\s*\/?\s*&gt;/gi, "<br>"],
        [/&lt;\s*wbr\s*\/?\s*&gt;/gi, "<wbr>"],
        [/<\s*br\s*\/?\s*>/gi, "<br>"],
        [/<\s*wbr\s*\/?\s*>/gi, "<wbr>"],
    ];
    replacements.forEach(([pattern, replacement]) => {
        value = value.replace(pattern, replacement);
    });
    return value;
}

function buildMarkdownTableHtml(lines) {
    if (!Array.isArray(lines) || lines.length < 2) return null;
    const headerCells = parseMarkdownTableRow(lines[0]);
    const alignCells = parseMarkdownTableRow(lines[1]);
    if (!headerCells.length || headerCells.length !== alignCells.length) return null;

    const alignments = alignCells.map((cell) => {
        const trimmed = cell.trim();
        const alignLeft = trimmed.startsWith(":");
        const alignRight = trimmed.endsWith(":");
        if (alignLeft && alignRight) return "center";
        if (alignRight) return "right";
        return "left";
    });

    const bodyRows = lines.slice(2)
        .map((line) => parseMarkdownTableRow(line))
        .filter((cells) => cells.some((cell) => cell.length > 0));

    if (!bodyRows.length) return null;

    const headerHtml = headerCells
        .map((cell, index) => `<th style="text-align:${alignments[index]};">${renderMarkdownTableCell(cell) || "&nbsp;"}</th>`)
        .join("");
    const bodyHtml = bodyRows
        .map((cells) => {
            const normalizedCells = headerCells.map((_, index) => cells[index] || "");
            const cellHtml = normalizedCells
                .map((cell, index) => `<td style="text-align:${alignments[index]};">${renderMarkdownTableCell(cell) || "&nbsp;"}</td>`)
                .join("");
            return `<tr>${cellHtml}</tr>`;
        })
        .join("");

    return `<div class="markdown-table-wrap"><table class="markdown-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
}

function replaceMarkdownTables(html) {
    const lines = String(html || "").split("\n");
    const output = [];

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const nextLine = lines[index + 1];
        const looksLikeHeader = String(line || "").includes("|");
        const looksLikeSeparator = isMarkdownTableSeparator(nextLine);

        if (!looksLikeHeader || !looksLikeSeparator) {
            output.push(line);
            continue;
        }

        const tableLines = [line, nextLine];
        let cursor = index + 2;
        while (cursor < lines.length) {
            const candidate = lines[cursor];
            if (!String(candidate || "").trim()) break;
            if (!String(candidate || "").includes("|")) break;
            tableLines.push(candidate);
            cursor += 1;
        }

        const tableHtml = buildMarkdownTableHtml(tableLines);
        if (tableHtml) {
            output.push(tableHtml);
            index = cursor - 1;
            continue;
        }

        output.push(line);
    }

    return output.join("\n");
}

function applyBasicMarkdown(html) {
    let nextHtml = html;
    nextHtml = nextHtml.replace(/^###### (.*)$/gm, "<h6>$1</h6>");
    nextHtml = nextHtml.replace(/^##### (.*)$/gm, "<h5>$1</h5>");
    nextHtml = nextHtml.replace(/^#### (.*)$/gm, "<h4>$1</h4>");
    nextHtml = nextHtml.replace(/^### (.*)$/gm, "<h3>$1</h3>");
    nextHtml = nextHtml.replace(/^## (.*)$/gm, "<h2>$1</h2>");
    nextHtml = nextHtml.replace(/^# (.*)$/gm, "<h1>$1</h1>");
    nextHtml = nextHtml.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    nextHtml = nextHtml.replace(/\*(.+?)\*/g, "<em>$1</em>");
    nextHtml = nextHtml.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    nextHtml = replaceMarkdownTables(nextHtml);
    nextHtml = nextHtml.replace(/\n/g, "<br>");
    return nextHtml;
}

function renderContent(text) {
    let sourceText = text || "";
    const codePlaceholders = createHtmlPlaceholderStore("CODE_PLACEHOLDER");
    const htmlPlaceholders = createHtmlPlaceholderStore("HTML_PLACEHOLDER");
    const mathPlaceholders = createHtmlPlaceholderStore("MATH_PLACEHOLDER");

    // Keep code segments opaque so later markdown/math passes cannot corrupt them.
    sourceText = protectCodeSegments(sourceText, codePlaceholders);
    sourceText = decodeSafeHtmlEntities(sourceText);
    sourceText = normalizeExplicitMathDelimiters(sourceText);
    sourceText = protectStructuredArtifactSegments(sourceText, codePlaceholders);
    sourceText = protectSafeHtmlSegments(sourceText, htmlPlaceholders);
    const hasProtectedMathSyntax = containsProtectedMathSyntax(sourceText);
    // Explicit TeX delimiters are already trustworthy source. Isolate them
    // before shorthand repair so normal math is never rewritten by heuristics.
    sourceText = renderExplicitMathSegments(sourceText, mathPlaceholders);
    if (!hasProtectedMathSyntax) {
        sourceText = normalizeMathSourceArtifacts(sourceText);
        sourceText = renderMathSegments(sourceText, mathPlaceholders);
    }

    let html = escapeHTML(sourceText);
    html = applyBasicMarkdown(html);
    html = htmlPlaceholders.restore(html);
    html = mathPlaceholders.restore(html);
    return codePlaceholders.restore(html);
}

function renderPromptContent(text) {
    return renderContent(text);
}

function getCollapsedMessageStateKey(convOrId, messageIndex) {
    const convId =
        convOrId && typeof convOrId === "object"
            ? String(convOrId.id || "")
            : String(convOrId || "");
    return `${convId}:${Number.isInteger(messageIndex) ? messageIndex : -1}`;
}

function isMessageCollapsed(convOrId, messageIndex) {
    return Boolean(collapsedMessageStateByKey[getCollapsedMessageStateKey(convOrId, messageIndex)]);
}

function setMessageCollapsed(convOrId, messageIndex, collapsed) {
    const key = getCollapsedMessageStateKey(convOrId, messageIndex);
    if (collapsed) {
        collapsedMessageStateByKey[key] = true;
        return;
    }
    delete collapsedMessageStateByKey[key];
}

function getTurnStartMessageIndex(conv, messageIndex) {
    if (!conv || !Array.isArray(conv.messages) || !Number.isInteger(messageIndex)) {
        return messageIndex;
    }
    for (let index = Math.min(messageIndex, conv.messages.length - 1); index >= 0; index -= 1) {
        if (conv.messages[index]?.role === "user") {
            return index;
        }
    }
    return messageIndex;
}

function getAnswerCollapseOverrideStateKey(convOrId, messageIndex) {
    const convId =
        convOrId && typeof convOrId === "object"
            ? String(convOrId.id || "")
            : String(convOrId || "");
    return `${convId}:${Number.isInteger(messageIndex) ? messageIndex : -1}`;
}

function getAnswerCollapseOverride(convOrId, messageIndex) {
    return answerCollapseOverrideByKey[getAnswerCollapseOverrideStateKey(convOrId, messageIndex)] || null;
}

function setAnswerCollapseOverride(convOrId, messageIndex, nextOverride) {
    const key = getAnswerCollapseOverrideStateKey(convOrId, messageIndex);
    if (nextOverride === "open" || nextOverride === "closed") {
        answerCollapseOverrideByKey[key] = nextOverride;
        return;
    }
    delete answerCollapseOverrideByKey[key];
}

function isAnswerMessageCollapsed(conv, messageIndex) {
    const turnStartIndex = getTurnStartMessageIndex(conv, messageIndex);
    const turnCollapsed = isMessageCollapsed(conv, turnStartIndex);
    const override = getAnswerCollapseOverride(conv, messageIndex);
    if (turnCollapsed) {
        return override !== "open";
    }
    return override === "closed";
}

function buildMessageAvatarButtonHtml(convIdx, messageIndex, role, options = {}) {
    const conv = chatData[convIdx];
    const isUser = role === "user";
    if (isUser) {
        const collapsed = isMessageCollapsed(conv, messageIndex);
        const title = collapsed ? "プロンプトと回答を開く" : "プロンプトと回答を折りたたむ";
        return `
            <button
                class="avatar user-icon message-avatar-toggle${collapsed ? " is-collapsed" : ""}"
                type="button"
                aria-pressed="${collapsed ? "true" : "false"}"
                title="${title}"
                onclick="toggleMessageCollapsed(${convIdx}, ${messageIndex}, event)"
            ></button>`;
    }
    const collapsed = isAnswerMessageCollapsed(conv, messageIndex);
    const title = collapsed ? "回答を開く" : "回答を折りたたむ";
    return `
        <button
            class="avatar assist-icon message-avatar-toggle${collapsed ? " is-collapsed" : ""}"
            type="button"
            aria-pressed="${collapsed ? "true" : "false"}"
            title="${title}"
            aria-label="${title}"
            onclick="toggleAnswerMessageCollapsed(${convIdx}, ${messageIndex}, event)"
        ></button>`;
}

function buildCollapsedMessagePreview(text, maxLength = 120) {
    const normalized = decodeSafeHtmlEntities(String(text || "")).replace(/\s+/g, " ").trim();
    if (!normalized) return "…";
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

function buildPromptCopyButtonHtml(convIdx, messageIndex) {
    return `
        <div class="prompt-bubble-copy-track">
            <button
                class="prompt-bubble-copy"
                type="button"
                title="プロンプトをコピー"
                aria-label="プロンプトをコピー"
                onclick="copyPromptMessage(${convIdx}, ${messageIndex}, event)"
            ><span aria-hidden="true">⧉</span></button>
        </div>`;
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

function getDirectoryFilterState() {
    // Single entry point for tree/directory filtering. This combines keyword-search
    // view state with extract-derived conversation scoping without changing either
    // subsystem's own payload shape.
    const hasKeywordSearch = currentParsedQuery.fuseQuery !== "";
    const shouldFilterToKeywordMatches = hasKeywordSearch && isSidebarFilterActive;
    const extractConversationIds =
        isSidebarFilterActive && appliedExtractConversationIds instanceof Set
            ? appliedExtractConversationIds
            : null;

    return {
        hasKeywordSearch,
        shouldFilterToKeywordMatches,
        extractConversationIds,
    };
}

function shouldIncludeConversationInDirectory(conv, result, directoryFilterState) {
    if (directoryFilterState.extractConversationIds && !directoryFilterState.extractConversationIds.has(conv.id)) {
        return false;
    }
    if (directoryFilterState.shouldFilterToKeywordMatches && !result.matched) {
        return false;
    }
    return true;
}

function getVisibleDirectoryPreviewItems(previewItems, result, directoryFilterState) {
    if (!directoryFilterState.shouldFilterToKeywordMatches) {
        return previewItems;
    }
    return previewItems.filter((item) => result.matchedMessageIndexes.includes(item.messageIndex));
}

function toggleMatchFilter(checked) {
    isMatchFilterActive = checked;
    persistSearchPreferences();
    applyHighlightsAndFilters(document.getElementById("chat-viewer"));
}

function toggleSidebarFilter(checked) {
    isSidebarFilterActive = checked;
    persistSearchPreferences();
    syncSidebarFilterButton();
    renderTree();
}

function syncSidebarFilterButton() {
    const button = document.getElementById("sidebar-filter-toggle");
    if (!button) return;
    button.classList.toggle("active", Boolean(isSidebarFilterActive));
    button.setAttribute("aria-pressed", isSidebarFilterActive ? "true" : "false");
    const label = isSidebarFilterActive ? "フィルタ反映中" : "フィルタを反映";
    button.setAttribute("title", label);
    button.setAttribute("aria-label", label);
}

function toggleSidebarFilterButton() {
    toggleSidebarFilter(!isSidebarFilterActive);
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

function computeFallbackSearchResults(searchSpec = buildKeywordSearchSpec()) {
    // Legacy client-side fallback while the main keyword search path still depends on
    // the bridge-backed LIKE query in archive_store.search_conversations.
    const words = searchSpec.words.map((word) => word.toLowerCase());
    const results = {};

    chatData.forEach((conv) => {
        const titleText = searchSpec.includeTitle ? String(conv.title || "").toLowerCase() : "";
        const titleMatched = titleText && words.every((word) => titleText.includes(word));

        let hits = 0;
        const matchedMessageIndexes = [];
        buildPromptPreviews(conv).forEach((item) => {
            const promptText = searchSpec.includePrompt ? String(item.preview || "").toLowerCase() : "";
            const answerText = searchSpec.includeAnswer ? String(conv.answers_text || "").toLowerCase() : "";
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

function requestSearchResults(searchSpec = buildKeywordSearchSpec()) {
    if (!hasActiveKeywordSearch(searchSpec)) {
        return Promise.resolve({});
    }

    const payload = JSON.stringify(searchSpec);

    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.searchConversations) {
            return computeFallbackSearchResults(searchSpec);
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

function switchSidebarMode(mode) {
    sidebarMode = mode === "extract" ? "extract" : "threads";
    localStorage.setItem(STORAGE_KEYS.sidebarMode, sidebarMode);

    const modeSwitch = document.querySelector(".sidebar-mode-switch");
    if (modeSwitch) {
        modeSwitch.setAttribute("data-active-mode", sidebarMode);
    }

    document.querySelectorAll(".sidebar-mode-btn").forEach((button) => {
        const isActive = button.id === `sidebar-mode-${sidebarMode}`;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    const threadPanel = document.getElementById("thread-list-panel");
    const extractPanel = document.getElementById("extract-panel");
    if (threadPanel) threadPanel.classList.toggle("active", sidebarMode === "threads");
    if (extractPanel) extractPanel.classList.toggle("active", sidebarMode === "extract");
    if (getActiveTab()) {
        refreshCurrentTabStrip();
    }

    if (sidebarMode === "threads") {
        refreshDirectoryFromExtractFilters(true);
    } else {
        renderTree();
    }
}

function readExtractMultiValue(id) {
    const input = document.getElementById(id);
    if (!input) return [];
    const rawValue = String(input.value || "").trim();
    if (!rawValue) return [];
    try {
        const parsed = JSON.parse(rawValue);
        if (Array.isArray(parsed)) {
            return parsed.map((value) => String(value || "").trim()).filter(Boolean);
        }
    } catch (_error) {
        return rawValue.split(",").map((value) => value.trim()).filter(Boolean);
    }
    return [];
}

function writeExtractMultiValue(id, values) {
    const input = document.getElementById(id);
    if (!input) return;
    const normalized = [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
    input.value = JSON.stringify(normalized);
}

function normalizeBookmarkTagNameGroup(group) {
    return [...new Set((Array.isArray(group) ? group : []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalizeBookmarkTagNameGroups(groups) {
    const normalized = [];
    const seen = new Set();
    (Array.isArray(groups) ? groups : []).forEach((group) => {
        const nextGroup = normalizeBookmarkTagNameGroup(group);
        if (nextGroup.length < 2) return;
        const key = nextGroup.join("\u0001");
        if (seen.has(key)) return;
        seen.add(key);
        normalized.push(nextGroup);
    });
    return normalized;
}

function readExtractGroupValue(id) {
    const input = document.getElementById(id);
    if (!input) return [];
    const rawValue = String(input.value || "").trim();
    if (!rawValue) return [];
    try {
        return normalizeBookmarkTagNameGroups(JSON.parse(rawValue));
    } catch (_error) {
        return [];
    }
}

function writeExtractGroupValue(id, groups) {
    const input = document.getElementById(id);
    if (!input) return;
    input.value = JSON.stringify(normalizeBookmarkTagNameGroups(groups));
}

function formatExtractServiceLabel(service) {
    if (service === "chatgpt") return "ChatGPT";
    if (service === "claude") return "Claude";
    if (service === "gemini") return "Gemini";
    return service;
}

function getSelectedExtractServices() {
    return readExtractMultiValue("extract-service");
}

function getSelectedExtractModels() {
    return readExtractMultiValue("extract-model");
}

function getSelectedExtractBookmarkTags() {
    return readExtractMultiValue("extract-bookmark-tags");
}

function getSelectedExtractBookmarkTagGroups() {
    return readExtractGroupValue("extract-bookmark-tag-groups");
}

function getAvailableExtractModels() {
    const selectedServices = getSelectedExtractServices();
    const modelsByService = extractFilterOptions.modelsByService || {};
    if (!selectedServices.length) return [];
    const merged = [];
    selectedServices.forEach((service) => {
        (modelsByService[service] || []).forEach((model) => {
            if (!merged.includes(model)) merged.push(model);
        });
    });
    return merged;
}

function getAvailableExtractBookmarkTags() {
    return (bookmarkTags || []).map((tag) => String(tag?.name || "").trim()).filter(Boolean);
}

function getAvailableExtractBookmarkTagEntries() {
    return (bookmarkTags || []).filter((tag) => String(tag?.name || "").trim());
}

function getBookmarkTagByName(tagName) {
    const normalizedName = String(tagName || "").trim();
    if (!normalizedName) return null;
    return (bookmarkTags || []).find((tag) => String(tag?.name || "").trim() === normalizedName) || null;
}

function getBookmarkTagOrderMap() {
    const order = new Map();
    (bookmarkTags || []).forEach((tag, index) => {
        order.set(String(tag?.id || "").trim(), index);
        order.set(String(tag?.name || "").trim(), index);
    });
    return order;
}

function normalizeBookmarkTagIdGroup(tagIds) {
    const availableIds = new Set((bookmarkTags || []).map((tag) => String(tag?.id || "").trim()).filter(Boolean));
    const orderMap = getBookmarkTagOrderMap();
    const normalized = [...new Set((Array.isArray(tagIds) ? tagIds : []).map((value) => String(value || "").trim()).filter(Boolean))]
        .filter((tagId) => availableIds.has(tagId))
        .sort((left, right) => (orderMap.get(left) ?? 9999) - (orderMap.get(right) ?? 9999));
    return normalized;
}

function buildBookmarkTagGroupKeyFromIds(tagIds) {
    return normalizeBookmarkTagIdGroup(tagIds).join("\u0001");
}

function buildBookmarkTagGroupKeyFromNames(tagNames) {
    const orderMap = getBookmarkTagOrderMap();
    const normalized = [...new Set((Array.isArray(tagNames) ? tagNames : []).map((value) => String(value || "").trim()).filter(Boolean))]
        .sort((left, right) => (orderMap.get(left) ?? 9999) - (orderMap.get(right) ?? 9999));
    return normalized.join("\u0001");
}

function hydrateBookmarkTagGroup(group) {
    const sourceTagIds = Array.isArray(group?.tagIds) && group.tagIds.length
        ? group.tagIds
        : (Array.isArray(group?.tagNames) ? group.tagNames.map((tagName) => getBookmarkTagByName(tagName)?.id || "") : []);
    const normalizedTagIds = normalizeBookmarkTagIdGroup(sourceTagIds);
    if (normalizedTagIds.length < 2) return null;
    const tags = normalizedTagIds
        .map((tagId) => getBookmarkTagById(tagId))
        .filter(Boolean);
    if (tags.length < 2) return null;
    const tagNames = tags.map((tag) => String(tag?.name || "").trim()).filter(Boolean);
    if (tagNames.length < 2) return null;
    return {
        id: buildBookmarkTagGroupKeyFromIds(normalizedTagIds),
        tagIds: normalizedTagIds,
        tagNames,
        label: tagNames.join(" & "),
    };
}

function normalizeBookmarkTagGroups(groups) {
    const normalized = [];
    const seen = new Set();
    (Array.isArray(groups) ? groups : []).forEach((group) => {
        const hydrated = hydrateBookmarkTagGroup(group);
        if (!hydrated) return;
        if (seen.has(hydrated.id)) return;
        seen.add(hydrated.id);
        normalized.push({ id: hydrated.id, tagIds: hydrated.tagIds });
    });
    return normalized;
}

function loadBookmarkTagGroupsFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.bookmarkTagGroups);
        if (!raw) {
            bookmarkTagGroups = [];
            return;
        }
        bookmarkTagGroups = normalizeBookmarkTagGroups(JSON.parse(raw));
    } catch (_error) {
        bookmarkTagGroups = [];
    }
}

function saveBookmarkTagGroupsToStorage() {
    localStorage.setItem(STORAGE_KEYS.bookmarkTagGroups, JSON.stringify(bookmarkTagGroups));
}

function refreshBookmarkTagGroups() {
    bookmarkTagGroups = normalizeBookmarkTagGroups(bookmarkTagGroups);
    saveBookmarkTagGroupsToStorage();
}

function getBookmarkTagGroupEntries() {
    return normalizeBookmarkTagGroups([
        ...(Array.isArray(bookmarkTagGroups) ? bookmarkTagGroups : []),
        ...getSelectedExtractBookmarkTagGroups().map((group) => ({ tagNames: group })),
    ])
        .map((group) => hydrateBookmarkTagGroup(group))
        .filter(Boolean);
}

function isExtractBookmarkTagGroupSelected(tagNames) {
    const targetKey = buildBookmarkTagGroupKeyFromNames(tagNames);
    return getSelectedExtractBookmarkTagGroups().some((group) => buildBookmarkTagGroupKeyFromNames(group) === targetKey);
}

function getSelectedExtractBookmarkTagGroupByTagId(tagId) {
    const normalizedTagId = String(tagId || "").trim();
    if (!normalizedTagId) return null;
    return getSelectedExtractBookmarkTagGroups()
        .map((group) => hydrateBookmarkTagGroup({ tagNames: group }))
        .filter(Boolean)
        .find((group) => group.tagIds.includes(normalizedTagId)) || null;
}

function getSelectedExtractBookmarkTagGroupByName(tagName) {
    const normalizedTagName = String(tagName || "").trim();
    if (!normalizedTagName) return null;
    return getSelectedExtractBookmarkTagGroups()
        .map((group) => hydrateBookmarkTagGroup({ tagNames: group }))
        .filter(Boolean)
        .find((group) => group.tagNames.includes(normalizedTagName)) || null;
}

function replaceExtractBookmarkTagGroupSelection(previousTagNames, nextTagNames = []) {
    const previousKey = buildBookmarkTagGroupKeyFromNames(previousTagNames);
    const selectedGroups = getSelectedExtractBookmarkTagGroups();
    const remainingGroups = selectedGroups.filter((group) => buildBookmarkTagGroupKeyFromNames(group) !== previousKey);
    const normalizedNextGroup = normalizeBookmarkTagNameGroup(nextTagNames);
    if (normalizedNextGroup.length >= 2) {
        remainingGroups.push(normalizedNextGroup);
    } else if (normalizedNextGroup.length === 1) {
        const selectedTags = getSelectedExtractBookmarkTags();
        if (!selectedTags.includes(normalizedNextGroup[0])) {
            writeExtractMultiValue("extract-bookmark-tags", [...selectedTags, normalizedNextGroup[0]]);
        }
    }
    writeExtractGroupValue("extract-bookmark-tag-groups", remainingGroups);
}

function getExtractFilterState() {
    // Canonical viewer-side extract filter state. Summary chips, preview requests,
    // directory scoping, and saved-filter payloads should all read from here.
    const filters = {
        service: getSelectedExtractServices(),
        model: getSelectedExtractModels(),
        bookmarkTags: getSelectedExtractBookmarkTags(),
        bookmarkTagGroups: getSelectedExtractBookmarkTagGroups(),
        bookmarked: normalizeBookmarkedFilterValue(
            document.getElementById("extract-bookmarked")?.value || "all"
        ),
        sortMode: document.getElementById("extract-sort")?.value || "date-asc",
    };
    EXTRACT_TEXT_FILTER_SPECS.forEach(({ key, elementId }) => {
        filters[key] = document.getElementById(elementId)?.value || "";
    });
    return filters;
}

function getVirtualThreadFilters() {
    // Legacy alias while extract filters still flow into the virtual-thread backend.
    return getExtractFilterState();
}

function buildBookmarkTagLogicExpression() {
    const singleTerms = getSelectedExtractBookmarkTags()
        .map((tagName) => String(tagName || "").trim())
        .filter(Boolean);
    const groupTerms = getSelectedExtractBookmarkTagGroups()
        .map((group) => normalizeBookmarkTagNameGroup(group))
        .filter((group) => group.length > 0)
        .map((group) => (group.length === 1 ? group[0] : `(${group.join(" ∧ ")})`));
    const terms = [...singleTerms, ...groupTerms];
    return terms.join(" ∨ ");
}

function syncExtractServiceButtons() {
    const root = document.getElementById("extract-service-buttons");
    if (!root) return;
    const selectedServices = getSelectedExtractServices();
    root.querySelectorAll(".extract-service-btn").forEach((button) => {
        button.classList.toggle("active", selectedServices.includes(button.dataset.value || ""));
    });
}

function setExtractService(value, event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    const selectedServices = getSelectedExtractServices();
    const nextServices = selectedServices.includes(value)
        ? selectedServices.filter((item) => item !== value)
        : [...selectedServices, value];
    writeExtractMultiValue("extract-service", nextServices);
    const allowedModels = getAvailableExtractModels();
    const selectedModels = getSelectedExtractModels().filter((model) => allowedModels.includes(model));
    writeExtractMultiValue("extract-model", selectedModels);
    syncExtractServiceButtons();
    renderExtractModelMenu();
    syncExtractModelTrigger();
    scheduleVirtualThreadPreview();
}

function syncExtractModelTrigger() {
    const label = document.getElementById("extract-model-trigger-label");
    const trigger = document.getElementById("extract-model-trigger");
    if (!label || !trigger) return;
    const services = getSelectedExtractServices();
    const selectedModels = getSelectedExtractModels();
    const availableModels = getAvailableExtractModels();
    if (!services.length) {
        label.textContent = "serviceを選ぶ";
        trigger.disabled = true;
    } else if (!availableModels.length) {
        label.textContent = "modelなし";
        trigger.disabled = true;
    } else if (!selectedModels.length) {
        label.textContent = "modelを選ぶ";
        trigger.disabled = false;
    } else if (selectedModels.length === 1) {
        label.textContent = selectedModels[0];
        trigger.disabled = false;
    } else {
        label.textContent = `${selectedModels.length}件選択`;
        trigger.disabled = false;
    }
}

function syncExtractBookmarkTagTrigger() {
    const label = document.getElementById("extract-bookmark-tags-trigger-label");
    const trigger = document.getElementById("extract-bookmark-tags-trigger");
    if (!label || !trigger) return;
    const availableTags = getAvailableExtractBookmarkTagEntries().map((tag) => String(tag.name || "").trim());
    const selectedTags = getSelectedExtractBookmarkTags().filter((tagName) => availableTags.includes(tagName));
    const selectedGroups = getSelectedExtractBookmarkTagGroups();
    const logicExpression = buildBookmarkTagLogicExpression();
    const selectionCount = selectedTags.length + selectedGroups.length;
    if (!availableTags.length) {
        label.textContent = "タグなし";
        trigger.disabled = true;
    } else if (!selectionCount) {
        label.textContent = "タグを選ぶ";
        trigger.disabled = false;
    } else if (logicExpression) {
        label.textContent = logicExpression;
        trigger.disabled = false;
    } else {
        label.textContent = "タグを選ぶ";
        trigger.disabled = false;
    }
}

function renderExtractModelMenu() {
    const menu = document.getElementById("extract-model-menu");
    if (!menu) return;
    const services = getSelectedExtractServices();
    const availableModels = getAvailableExtractModels();
    const selectedModels = getSelectedExtractModels();
    if (!services.length) {
        menu.innerHTML = '<div class="extract-model-empty">serviceを選ぶとmodelを選べるよ</div>';
        return;
    }
    if (!availableModels.length) {
        menu.innerHTML = '<div class="extract-model-empty">選べるmodelがまだないよ</div>';
        return;
    }
    menu.innerHTML = availableModels.map((model) => {
        const active = selectedModels.includes(model) ? " active" : "";
        return `<button class="extract-model-option${active}" type="button" data-value="${escapeHTML(model)}" onclick="toggleExtractModel('${escapeJsString(model)}', event)">${escapeHTML(model)}</button>`;
    }).join("");
}

function renderExtractBookmarkTagMenu() {
    const menu = document.getElementById("extract-bookmark-tags-menu");
    if (!menu) return;
    const availableTags = getAvailableExtractBookmarkTagEntries();
    const selectedTags = getSelectedExtractBookmarkTags();
    if (!availableTags.length) {
        menu.innerHTML = '<div class="extract-model-empty">タグがまだないよ</div>';
        return;
    }
    menu.innerHTML = availableTags.map((tag) => {
        const tagName = String(tag.name || "").trim();
        const active = selectedTags.includes(tagName) ? " is-filter-active" : "";
        const selectedGroup = getSelectedExtractBookmarkTagGroupByName(tagName);
        const locked = !!selectedGroup;
        return `
            <button
                class="bookmark-tag-dropzone extract-bookmark-tag-option${active}${locked ? " is-filter-locked" : ""}"
                type="button"
                data-value="${escapeHTML(tagName)}"
                title="${locked ? `「${escapeHTML(selectedGroup.label)}」の一部だから単独では選べないよ` : ""}"
                onclick="toggleExtractBookmarkTag('${escapeJsString(tagName)}', event)"
            >
                <span class="bookmark-tag-dropzone-label">${escapeHTML(tagName)}</span>
                <span class="bookmark-tag-dropzone-count">${escapeHTML(String(tag.bookmarkCount || 0))}</span>
            </button>
        `;
    }).join("");
}

function setExtractModelMenuOpen(isOpen) {
    isExtractModelMenuOpen = !!isOpen;
    const picker = document.getElementById("extract-model-picker");
    if (picker) picker.classList.toggle("open", isExtractModelMenuOpen);
}

function setExtractBookmarkTagMenuOpen(isOpen) {
    isExtractBookmarkTagMenuOpen = !!isOpen;
    const picker = document.getElementById("extract-bookmark-tags-picker");
    if (picker) picker.classList.toggle("open", isExtractBookmarkTagMenuOpen);
}

function toggleExtractModelMenu(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    const trigger = document.getElementById("extract-model-trigger");
    if (!trigger || trigger.disabled) return;
    closeExtractBookmarkTagMenu();
    setExtractModelMenuOpen(!isExtractModelMenuOpen);
}

function toggleExtractBookmarkTagMenu(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    const trigger = document.getElementById("extract-bookmark-tags-trigger");
    if (!trigger || trigger.disabled) return;
    closeExtractModelMenu();
    setExtractBookmarkTagMenuOpen(!isExtractBookmarkTagMenuOpen);
}

function closeExtractModelMenu() {
    setExtractModelMenuOpen(false);
}

function closeExtractBookmarkTagMenu() {
    setExtractBookmarkTagMenuOpen(false);
}

function toggleExtractModel(model, event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    const selectedModels = getSelectedExtractModels();
    const nextModels = selectedModels.includes(model)
        ? selectedModels.filter((item) => item !== model)
        : [...selectedModels, model];
    writeExtractMultiValue("extract-model", nextModels);
    renderExtractModelMenu();
    syncExtractModelTrigger();
    scheduleVirtualThreadPreview();
}

function toggleExtractBookmarkTag(tagName, event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    const selectedGroup = getSelectedExtractBookmarkTagGroupByName(tagName);
    if (selectedGroup) {
        showToast(`「${selectedGroup.label}」が有効だから、このタグだけは選べないよ`);
        return;
    }
    const selectedTags = getSelectedExtractBookmarkTags();
    const nextTags = selectedTags.includes(tagName)
        ? selectedTags.filter((item) => item !== tagName)
        : [...selectedTags, tagName];
    writeExtractMultiValue("extract-bookmark-tags", nextTags);
    renderExtractBookmarkTagMenu();
    syncExtractBookmarkTagTrigger();
    syncBookmarkWorkspaceFiltersFromExtract();
    rerenderBookmarkManagerIfActive();
    scheduleVirtualThreadPreview();
}

function toggleExtractBookmarkTagGroupByKey(groupKey, event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    const targetGroup = getBookmarkTagGroupEntries().find((group) => group.id === String(groupKey || ""));
    if (!targetGroup) return;
    const selectedGroups = getSelectedExtractBookmarkTagGroups();
    const targetKey = buildBookmarkTagGroupKeyFromNames(targetGroup.tagNames);
    const nextGroups = selectedGroups.some((group) => buildBookmarkTagGroupKeyFromNames(group) === targetKey)
        ? selectedGroups.filter((group) => buildBookmarkTagGroupKeyFromNames(group) !== targetKey)
        : [...selectedGroups, targetGroup.tagNames];
    writeExtractGroupValue("extract-bookmark-tag-groups", nextGroups);
    syncExtractBookmarkTagTrigger();
    syncBookmarkWorkspaceFiltersFromExtract();
    rerenderBookmarkManagerIfActive();
    scheduleVirtualThreadPreview();
}

function syncExtractSortButton() {
    const input = document.getElementById("extract-sort");
    const button = document.getElementById("extract-sort-toggle");
    if (!input || !button) return;
    const isDesc = input.value === "date-desc";
    button.dataset.direction = isDesc ? "desc" : "asc";
    const label = isDesc ? "降順" : "昇順";
    button.setAttribute("title", label);
    button.setAttribute("aria-label", label);
}

function toggleExtractSort(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    const input = document.getElementById("extract-sort");
    if (!input) return;
    input.value = input.value === "date-desc" ? "date-asc" : "date-desc";
    syncExtractSortButton();
    scheduleVirtualThreadPreview();
}

function renderActiveFilterSummary(filters) {
    const root = document.getElementById("extract-active-filters");
    if (!root) return;

    const chips = [];
    (filters.service || []).forEach((service) => {
        chips.push(`<button class="extract-chip" type="button" onclick="removeExtractFilterValue('service', '${escapeJsString(service)}')"><span class="extract-chip-label">service: ${escapeHTML(formatExtractServiceLabel(service))}</span><span class="extract-chip-remove" aria-hidden="true">×</span></button>`);
    });
    (filters.model || []).forEach((model) => {
        chips.push(`<button class="extract-chip" type="button" onclick="removeExtractFilterValue('model', '${escapeJsString(model)}')"><span class="extract-chip-label">model: ${escapeHTML(model)}</span><span class="extract-chip-remove" aria-hidden="true">×</span></button>`);
    });
    (filters.bookmarkTags || []).forEach((tagName) => {
        chips.push(`<button class="extract-chip" type="button" onclick="removeExtractFilterValue('bookmarkTags', '${escapeJsString(tagName)}')"><span class="extract-chip-label">Tag: ${escapeHTML(tagName)}</span><span class="extract-chip-remove" aria-hidden="true">×</span></button>`);
    });
    (filters.bookmarkTagGroups || []).forEach((group, index) => {
        const label = normalizeBookmarkTagNameGroup(group).join(" & ");
        if (!label) return;
        chips.push(`<button class="extract-chip extract-chip-compound" type="button" onclick="removeExtractFilterGroup('bookmarkTagGroups', ${index})"><span class="extract-chip-label">Tag: ${escapeHTML(label)}</span><span class="extract-chip-remove" aria-hidden="true">×</span></button>`);
    });
    EXTRACT_TEXT_FILTER_SPECS.forEach(({ key, summaryLabel }) => {
        const value = filters[key];
        if (String(value || "").trim()) {
            chips.push(`<button class="extract-chip" type="button" onclick="clearExtractFilterField('${escapeJsString(key)}')"><span class="extract-chip-label">${escapeHTML(summaryLabel)}: ${escapeHTML(value)}</span><span class="extract-chip-remove" aria-hidden="true">×</span></button>`);
        }
    });
    if (normalizeBookmarkedFilterValue(filters.bookmarked) === "bookmarked") {
        chips.push(`<button class="extract-chip" type="button" onclick="clearExtractFilterField('bookmarked')"><span class="extract-chip-label">Tag: あり</span><span class="extract-chip-remove" aria-hidden="true">×</span></button>`);
    } else if (normalizeBookmarkedFilterValue(filters.bookmarked) === "not-bookmarked") {
        chips.push(`<button class="extract-chip" type="button" onclick="clearExtractFilterField('bookmarked')"><span class="extract-chip-label">Tag: なし</span><span class="extract-chip-remove" aria-hidden="true">×</span></button>`);
    }

    root.innerHTML = chips.join("");
}

function removeExtractFilterGroup(kind, index) {
    if (kind !== "bookmarkTagGroups") return;
    const nextGroups = getSelectedExtractBookmarkTagGroups().filter((_group, groupIndex) => groupIndex !== Number(index));
    writeExtractGroupValue("extract-bookmark-tag-groups", nextGroups);
    syncExtractBookmarkTagTrigger();
    syncBookmarkWorkspaceFiltersFromExtract();
    rerenderBookmarkManagerIfActive();
    scheduleVirtualThreadPreview();
}

function removeExtractFilterValue(kind, value) {
    if (kind === "service") {
        const nextServices = getSelectedExtractServices().filter((item) => item !== value);
        writeExtractMultiValue("extract-service", nextServices);
        const allowedModels = getAvailableExtractModels();
        const nextModels = getSelectedExtractModels().filter((model) => allowedModels.includes(model));
        writeExtractMultiValue("extract-model", nextModels);
        syncExtractServiceButtons();
        renderExtractModelMenu();
        syncExtractModelTrigger();
    } else if (kind === "model") {
        const nextModels = getSelectedExtractModels().filter((item) => item !== value);
        writeExtractMultiValue("extract-model", nextModels);
        renderExtractModelMenu();
        syncExtractModelTrigger();
    } else if (kind === "bookmarkTags") {
        const nextTags = getSelectedExtractBookmarkTags().filter((item) => item !== value);
        writeExtractMultiValue("extract-bookmark-tags", nextTags);
        renderExtractBookmarkTagMenu();
        syncExtractBookmarkTagTrigger();
        syncBookmarkWorkspaceFiltersFromExtract();
        rerenderBookmarkManagerIfActive();
    }
    scheduleVirtualThreadPreview();
}

function clearExtractFilterField(key) {
    const spec = EXTRACT_TEXT_FILTER_SPECS.find((item) => item.key === key);
    if (key === "bookmarkTags") {
        writeExtractMultiValue("extract-bookmark-tags", []);
        writeExtractGroupValue("extract-bookmark-tag-groups", []);
        renderExtractBookmarkTagMenu();
        syncExtractBookmarkTagTrigger();
        syncBookmarkWorkspaceFiltersFromExtract();
        rerenderBookmarkManagerIfActive();
    } else {
        const elementId = spec ? spec.elementId : key === "bookmarked" ? "extract-bookmarked" : "";
        if (!elementId) return;
        const element = document.getElementById(elementId);
        if (element) {
            element.value = key === "bookmarked" ? "all" : "";
        }
    }
    scheduleVirtualThreadPreview();
}

function setVirtualThreadFilters(filters) {
    const nextFilters = filters || {};
    [
        ...EXTRACT_TEXT_FILTER_SPECS.map(({ key, elementId }) => [elementId, nextFilters[key] || ""]),
        ["extract-sort", nextFilters.sortMode || "date-asc"],
        ["extract-bookmarked", normalizeBookmarkedFilterValue(nextFilters.bookmarked)],
    ].forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.value = value;
    });

    writeExtractMultiValue("extract-service", Array.isArray(nextFilters.service) ? nextFilters.service : []);
    syncExtractServiceButtons();

    const allowedModels = getAvailableExtractModels();
    writeExtractMultiValue(
        "extract-model",
        (Array.isArray(nextFilters.model) ? nextFilters.model : []).filter((model) => allowedModels.includes(model))
    );
    renderExtractModelMenu();
    syncExtractModelTrigger();
    writeExtractMultiValue("extract-bookmark-tags", Array.isArray(nextFilters.bookmarkTags) ? nextFilters.bookmarkTags : []);
    writeExtractGroupValue("extract-bookmark-tag-groups", Array.isArray(nextFilters.bookmarkTagGroups) ? nextFilters.bookmarkTagGroups : []);
    renderExtractBookmarkTagMenu();
    syncExtractBookmarkTagTrigger();
    syncBookmarkWorkspaceFiltersFromExtract();
    rerenderBookmarkManagerIfActive();
    syncExtractSortButton();
    closeExtractModelMenu();
    closeExtractBookmarkTagMenu();
    scheduleVirtualThreadPreview();
}

function requestRecentFilters() {
    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.fetchRecentFilters) {
            return [];
        }
        return new Promise((resolve) => {
            bridge.fetchRecentFilters(function (result) {
                try {
                    resolve(result ? JSON.parse(result) : []);
                } catch (_error) {
                    resolve([]);
                }
            });
        });
    });
}

function requestStarredFilters() {
    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.fetchStarredFilters) {
            return [];
        }
        return new Promise((resolve) => {
            bridge.fetchStarredFilters(function (result) {
                try {
                    resolve(result ? JSON.parse(result) : []);
                } catch (_error) {
                    resolve([]);
                }
            });
        });
    });
}

function requestStarredPrompts() {
    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.fetchStarredPrompts) {
            return [];
        }
        return new Promise((resolve) => {
            bridge.fetchStarredPrompts(function (result) {
                try {
                    resolve(result ? JSON.parse(result) : []);
                } catch (_error) {
                    resolve([]);
                }
            });
        });
    });
}

function requestBookmarkTags() {
    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.fetchBookmarkTags) {
            return [];
        }
        return new Promise((resolve) => {
            bridge.fetchBookmarkTags(function (result) {
                try {
                    resolve(result ? JSON.parse(result) : []);
                } catch (_error) {
                    resolve([]);
                }
            });
        });
    });
}

function requestCreateBookmarkTag(name) {
    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.createBookmarkTag) {
            return null;
        }
        return new Promise((resolve) => {
            bridge.createBookmarkTag(JSON.stringify({ name }), function (result) {
                try {
                    resolve(result ? JSON.parse(result) : null);
                } catch (_error) {
                    resolve(null);
                }
            });
        });
    });
}

function requestRenameBookmarkTag(tagId, name) {
    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.renameBookmarkTag) {
            return { renamed: 0, error: "bridge_unavailable" };
        }
        return new Promise((resolve) => {
            bridge.renameBookmarkTag(JSON.stringify({ tagId, name }), function (result) {
                try {
                    resolve(result ? JSON.parse(result) : { renamed: 0 });
                } catch (_error) {
                    resolve({ renamed: 0 });
                }
            });
        });
    });
}

function requestBookmarkTagMembership(tagId, targets, assigned) {
    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.setBookmarkTagMembership) {
            return { tagId, assigned, affected: 0 };
        }
        return new Promise((resolve) => {
            bridge.setBookmarkTagMembership(
                JSON.stringify({
                    tagId,
                    targets,
                    assigned,
                }),
                function (result) {
                    try {
                        resolve(result ? JSON.parse(result) : { tagId, assigned, affected: 0 });
                    } catch (_error) {
                        resolve({ tagId, assigned, affected: 0 });
                    }
                }
            );
        });
    });
}

function requestDeleteBookmarkTag(tagId) {
    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.deleteBookmarkTag) {
            return { deleted: 0 };
        }
        return new Promise((resolve) => {
            bridge.deleteBookmarkTag(JSON.stringify({ tagId }), function (result) {
                try {
                    resolve(result ? JSON.parse(result) : { deleted: 0 });
                } catch (_error) {
                    resolve({ deleted: 0 });
                }
            });
        });
    });
}

function saveRecentFilterEntry(filters) {
    // Saved filter persistence stays at the bridge boundary so Phase 2 Saved Views
    // can reuse the same normalized filter payload shape.
    if (!hasActiveVirtualFilters(filters)) {
        return Promise.resolve(null);
    }
    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.saveRecentFilter) {
            return null;
        }
        return new Promise((resolve) => {
            bridge.saveRecentFilter(JSON.stringify(filters || {}), function (result) {
                try {
                    resolve(result ? JSON.parse(result) : null);
                } catch (_error) {
                    resolve(null);
                }
            });
        });
    });
}

function saveStarredFilterEntry(name, filters, starredFilterId = null) {
    if (!hasActiveExtractFilters(filters)) {
        return Promise.resolve(null);
    }
    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.saveStarredFilter) {
            return null;
        }
        return new Promise((resolve) => {
            bridge.saveStarredFilter(
                JSON.stringify({
                    id: starredFilterId,
                    name,
                    filters: filters || {},
                    targetType: "virtual_thread",
                }),
                function (result) {
                    try {
                        resolve(result ? JSON.parse(result) : null);
                    } catch (_error) {
                        resolve(null);
                    }
                }
            );
        });
    });
}

function deleteStarredFilterEntry(starredFilterId) {
    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.deleteStarredFilter) {
            return { deleted: false };
        }
        return new Promise((resolve) => {
            bridge.deleteStarredFilter(
                JSON.stringify({
                    id: starredFilterId,
                    targetType: "virtual_thread",
                }),
                function (result) {
                    try {
                        resolve(result ? JSON.parse(result) : { deleted: false });
                    } catch (_error) {
                        resolve({ deleted: false });
                    }
                }
            );
        });
    });
}

function requestSavedViews() {
    return requestStarredFilters();
}

function saveSavedViewEntry(name, filters, savedViewId = null) {
    return saveStarredFilterEntry(name, filters, savedViewId);
}

function deleteSavedViewEntry(savedViewId) {
    return deleteStarredFilterEntry(savedViewId);
}

function normalizeBookmarkTargetSpec(targetOrType, targetId = "", payload = {}) {
    if (targetOrType && typeof targetOrType === "object" && !Array.isArray(targetOrType)) {
        return buildBookmarkTargetSpec(
            targetOrType.targetType,
            targetOrType.targetId,
            targetOrType.payload || {}
        );
    }
    return buildBookmarkTargetSpec(targetOrType, targetId, payload);
}

function requestBookmarkStates(targetSpecs = []) {
    const normalizedSpecs = (Array.isArray(targetSpecs) ? targetSpecs : [])
        .map((spec) => normalizeBookmarkTargetSpec(spec))
        .filter((spec) => spec.targetType && spec.targetId);

    if (normalizedSpecs.length === 0) {
        return Promise.resolve([]);
    }

    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.fetchBookmarkStates) {
            return normalizedSpecs.map((spec) => ({
                ...spec,
                bookmarked: false,
                updatedAt: null,
            }));
        }
        return new Promise((resolve) => {
            bridge.fetchBookmarkStates(JSON.stringify(normalizedSpecs), function (result) {
                try {
                    resolve(result ? JSON.parse(result) : []);
                } catch (_error) {
                    resolve([]);
                }
            });
        });
    }).then((states) => {
        (Array.isArray(states) ? states : []).forEach((state) => {
            cacheBookmarkState(state);
        });
        return Array.isArray(states) ? states : [];
    });
}

function requestBookmarkChange(targetOrType, targetIdOrBookmarked, bookmarkedOrPayload, payload = {}) {
    // Bookmark writes also stay on the bridge boundary; later bookmark/view features
    // should reuse a bookmark target spec here instead of mutating viewer-only state.
    const bookmarkTarget =
        targetOrType && typeof targetOrType === "object" && !Array.isArray(targetOrType)
            ? normalizeBookmarkTargetSpec(targetOrType)
            : normalizeBookmarkTargetSpec(targetOrType, targetIdOrBookmarked, payload);
    const bookmarked =
        targetOrType && typeof targetOrType === "object" && !Array.isArray(targetOrType)
            ? Boolean(targetIdOrBookmarked)
            : Boolean(bookmarkedOrPayload);

    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.setBookmark) {
            return cacheBookmarkState({ ...bookmarkTarget, bookmarked });
        }
        return new Promise((resolve) => {
            bridge.setBookmark(
                JSON.stringify({
                    ...bookmarkTarget,
                    bookmarked,
                }),
                function (result) {
                    try {
                        resolve(
                            cacheBookmarkState(
                                result ? JSON.parse(result) : { ...bookmarkTarget, bookmarked }
                            )
                        );
                    } catch (_error) {
                        resolve(cacheBookmarkState({ ...bookmarkTarget, bookmarked }));
                    }
                }
            );
        });
    });
}

function parseBookmarkPayload(payload) {
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        return payload;
    }
    try {
        const parsed = JSON.parse(decodeURIComponent(String(payload || "")));
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
        return {};
    }
}

function collectPromptBookmarkTargets(conv) {
    if (!conv?.id || !Array.isArray(conv.messages)) return [];
    return conv.messages
        .map((message, messageIndex) => ({ message, messageIndex }))
        .filter(({ message }) => message?.role === "user")
        .map(({ message, messageIndex }) =>
            buildPromptBookmarkTargetSpec(conv, messageIndex, message.text || "")
        )
        .filter((target) => target.targetType && target.targetId);
}

function collectVirtualFragmentBookmarkTargets(tab) {
    const virtualThread = tab?.virtualThread;
    const items = Array.isArray(virtualThread?.items) ? virtualThread.items : [];
    return items
        .map((item) => buildVirtualFragmentBookmarkTargetSpec(tab, item))
        .filter((target) => target.targetType && target.targetId);
}

function collectSavedViewBookmarkTargets(entries) {
    return (Array.isArray(entries) ? entries : [])
        .map((entry) => buildSavedViewBookmarkTargetSpec(entry))
        .filter((target) => target.targetType && target.targetId);
}

function collectBookmarkTargetsForType(targetType, context) {
    if (targetType === "prompt") {
        return collectPromptBookmarkTargets(context);
    }
    if (targetType === "virtual_fragment") {
        return collectVirtualFragmentBookmarkTargets(context);
    }
    if (targetType === "saved_view") {
        return collectSavedViewBookmarkTargets(context);
    }
    return [];
}

function ensureBookmarkStatesForTargetType(targetType, scopeKey, context, loadRegistry, options = {}) {
    // Bookmark writes are already generic. Reads are still expanding target type by
    // target type, so keep collection helpers small and explicit at this boundary.
    if (!scopeKey) {
        return Promise.resolve([]);
    }
    const bookmarkTargets = collectBookmarkTargetsForType(targetType, context);
    const missingTargets = bookmarkTargets.filter((target) => !getCachedBookmarkState(target));
    if (missingTargets.length === 0) {
        return Promise.resolve(bookmarkTargets.map((target) => getCachedBookmarkState(target)));
    }
    if (loadRegistry[scopeKey]) {
        return loadRegistry[scopeKey];
    }
    loadRegistry[scopeKey] = requestBookmarkStates(missingTargets)
        .then(() => {
            if (typeof options.onHydrated === "function") {
                options.onHydrated();
            }
            return bookmarkTargets.map((target) => getCachedBookmarkState(target));
        })
        .finally(() => {
            delete loadRegistry[scopeKey];
        });
    return loadRegistry[scopeKey];
}

function ensureConversationPromptBookmarkStates(conv) {
    if (!conv?.id) {
        return Promise.resolve([]);
    }
    return ensureBookmarkStatesForTargetType(
        "prompt",
        conv.id,
        conv,
        promptBookmarkLoadPromises
    );
}

function ensureVirtualThreadBookmarkStates(tab) {
    if (!tab?.id || tab.type !== "virtual") {
        return Promise.resolve([]);
    }
    return ensureBookmarkStatesForTargetType(
        "virtual_fragment",
        tab.id,
        tab,
        virtualFragmentBookmarkLoadPromises,
        {
            onHydrated() {
            if (getActiveTab()?.id === tab.id) {
                renderVirtualThreadTab(tab);
            }
            },
        }
    );
}

function ensureSavedViewBookmarkStates(entries = savedExtractViews) {
    return ensureBookmarkStatesForTargetType(
        "saved_view",
        "saved_views",
        entries,
        savedViewBookmarkLoadPromises,
        {
            onHydrated() {
                renderSavedViews();
            },
        }
    );
}

function getVisibleDirectoryPromptSelectionKeys() {
    return Array.from(document.querySelectorAll("#index-tree .prompt-item-row[data-selection-key]"))
        .map((row) => String(row.dataset.selectionKey || "").trim())
        .filter(Boolean);
}

function syncDirectoryPromptSelectionClasses(options = {}) {
    const rows = Array.from(document.querySelectorAll("#index-tree .prompt-item-row[data-selection-key]"));
    const visibleKeys = rows
        .map((row) => String(row.dataset.selectionKey || "").trim())
        .filter(Boolean);
    if (options.pruneToVisible) {
        const visibleKeySet = new Set(visibleKeys);
        selectedDirectoryPromptKeys = selectedDirectoryPromptKeys.filter((key) => visibleKeySet.has(key));
        if (
            directoryPromptSelectionAnchorKey &&
            !visibleKeySet.has(directoryPromptSelectionAnchorKey)
        ) {
            directoryPromptSelectionAnchorKey = selectedDirectoryPromptKeys[0] || "";
        }
    }
    const selectedKeySet = new Set(selectedDirectoryPromptKeys);
    rows.forEach((row) => {
        const selectionKey = String(row.dataset.selectionKey || "").trim();
        const isSelected = selectedKeySet.has(selectionKey);
        row.classList.toggle("is-selected", isSelected);
        row.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
    syncStarredPromptSelectionControls();
}

function setDirectoryPromptSelection(keys, options = {}) {
    const uniqueKeys = Array.from(
        new Set(
            (Array.isArray(keys) ? keys : [])
                .map((key) => String(key || "").trim())
                .filter(Boolean)
        )
    );
    selectedDirectoryPromptKeys = uniqueKeys;
    if (Object.prototype.hasOwnProperty.call(options, "anchorKey")) {
        directoryPromptSelectionAnchorKey = String(options.anchorKey || "").trim();
    } else if (!uniqueKeys.length) {
        directoryPromptSelectionAnchorKey = "";
    } else if (!directoryPromptSelectionAnchorKey) {
        directoryPromptSelectionAnchorKey = uniqueKeys[0];
    }
    syncDirectoryPromptSelectionClasses();
    return uniqueKeys;
}

function clearDirectoryPromptSelection(nextAnchorKey = "") {
    return setDirectoryPromptSelection([], { anchorKey: nextAnchorKey });
}

function armDirectoryPromptDrag(convIdx, messageIndex, event) {
    if ((event?.button ?? 0) !== 0) return;
    const convId = String(chatData[convIdx]?.id || "");
    const selectionKey = buildDirectoryPromptSelectionKey(convId, messageIndex);
    if (!selectionKey) return;
    const selectedKeys = selectedDirectoryPromptKeys.includes(selectionKey)
        ? selectedDirectoryPromptKeys.slice()
        : [selectionKey];
    bookmarkSelectionDragState = {
        dragKind: "directory-prompt-selection",
        selectionKey,
        selectedKeys,
        filterIdsSnapshot: selectedBookmarkTagFilterIds.slice(),
        startX: event?.clientX ?? 0,
        startY: event?.clientY ?? 0,
        active: false,
        hoverKind: "",
        hoverTagId: "",
    };
}

function armDirectoryFolderDrag(convIdx, event) {
    if ((event?.button ?? 0) !== 0) return;
    if (!Number.isInteger(convIdx) || convIdx < 0) return;
    bookmarkSelectionDragState = {
        dragKind: "directory-folder",
        convIdx,
        filterIdsSnapshot: selectedBookmarkTagFilterIds.slice(),
        startX: event?.clientX ?? 0,
        startY: event?.clientY ?? 0,
        active: false,
        hoverKind: "",
        hoverTagId: "",
    };
}

function selectDirectoryPromptRange(targetSelectionKey) {
    const normalizedTargetKey = String(targetSelectionKey || "").trim();
    if (!normalizedTargetKey) return [];
    if (!directoryPromptSelectionAnchorKey) {
        return setDirectoryPromptSelection([normalizedTargetKey], {
            anchorKey: normalizedTargetKey,
        });
    }
    const visibleKeys = getVisibleDirectoryPromptSelectionKeys();
    const anchorIndex = visibleKeys.indexOf(directoryPromptSelectionAnchorKey);
    const targetIndex = visibleKeys.indexOf(normalizedTargetKey);
    if (anchorIndex < 0 || targetIndex < 0) {
        return setDirectoryPromptSelection([normalizedTargetKey], {
            anchorKey: normalizedTargetKey,
        });
    }
    const startIndex = Math.min(anchorIndex, targetIndex);
    const endIndex = Math.max(anchorIndex, targetIndex);
    return setDirectoryPromptSelection(visibleKeys.slice(startIndex, endIndex + 1), {
        anchorKey: directoryPromptSelectionAnchorKey,
    });
}

async function resolveDirectoryPromptSelectionEntries(selectionKeys) {
    const normalizedSelections = Array.from(
        new Set(
            (Array.isArray(selectionKeys) ? selectionKeys : [])
                .map((key) => String(key || "").trim())
                .filter(Boolean)
        )
    );
    const parsedSelections = normalizedSelections
        .map((selectionKey) => ({
            selectionKey,
            parsed: parseDirectoryPromptSelectionKey(selectionKey),
        }))
        .filter((entry) => entry.parsed?.conversationId);
    const convIndexes = Array.from(
        new Set(
            parsedSelections
                .map((entry) => getConversationIndexById(entry.parsed.conversationId))
                .filter((convIdx) => Number.isInteger(convIdx) && convIdx >= 0)
        )
    );
    await Promise.all(convIndexes.map((convIdx) => loadConversationDetail(convIdx).catch(() => null)));
    const entries = parsedSelections
        .map((entry) => {
            const convIdx = getConversationIndexById(entry.parsed.conversationId);
            if (!Number.isInteger(convIdx) || convIdx < 0) return null;
            const conv = chatData[convIdx];
            const messageIndex = entry.parsed.messageIndex;
            const message = conv?.messages?.[messageIndex];
            if (!conv?.id || message?.role !== "user") return null;
            const bookmarkTarget = buildPromptBookmarkTargetSpec(conv, messageIndex, message.text || "");
            return {
                selectionKey: entry.selectionKey,
                conv,
                convIdx,
                messageIndex,
                bookmarkTarget,
                currentState: getCachedBookmarkState(bookmarkTarget),
            };
        })
        .filter(Boolean);
    const missingTargets = entries
        .filter((entry) => !entry.currentState)
        .map((entry) => entry.bookmarkTarget);
    if (missingTargets.length) {
        await requestBookmarkStates(missingTargets);
    }
    return entries.map((entry) => ({
        ...entry,
        currentState: getCachedBookmarkState(entry.bookmarkTarget),
    }));
}

async function resolveVisibleConversationPromptEntries(convIdx) {
    if (!Number.isInteger(convIdx) || convIdx < 0) return [];
    const conv = await loadConversationDetail(convIdx).catch(() => null);
    if (!conv?.id) return [];
    const result = getCurrentConversationResult(conv);
    const directoryFilterState = getDirectoryFilterState();
    const visiblePreviewItems = getVisibleDirectoryPreviewItems(
        buildPromptPreviews(conv),
        result,
        directoryFilterState
    );
    const entries = visiblePreviewItems
        .map((item) => {
            const message = conv?.messages?.[item.messageIndex];
            if (message?.role !== "user") return null;
            const bookmarkTarget = buildPromptBookmarkTargetSpec(conv, item.messageIndex, message.text || item.preview || "");
            return {
                selectionKey: buildDirectoryPromptSelectionKey(conv.id, item.messageIndex),
                conv,
                convIdx,
                messageIndex: item.messageIndex,
                bookmarkTarget,
                currentState: getCachedBookmarkState(bookmarkTarget),
            };
        })
        .filter(Boolean);
    const missingTargets = entries
        .filter((entry) => !entry.currentState)
        .map((entry) => entry.bookmarkTarget);
    if (missingTargets.length) {
        await requestBookmarkStates(missingTargets);
    }
    return entries.map((entry) => ({
        ...entry,
        currentState: getCachedBookmarkState(entry.bookmarkTarget),
    }));
}

async function resolveDirectoryPromptDragEntries(dragState) {
    if (!dragState || typeof dragState !== "object") {
        return [];
    }
    if (dragState.dragKind === "directory-folder") {
        return resolveVisibleConversationPromptEntries(dragState.convIdx);
    }
    if (dragState.dragKind === "directory-prompt-selection") {
        return resolveDirectoryPromptSelectionEntries(dragState.selectedKeys || []);
    }
    return [];
}

async function applyPromptBookmarkState(entries, nextBookmarked) {
    const normalizedEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
    if (!normalizedEntries.length) return;
    const conversationDeltas = new Map();
    const changedItems = [];
    let didChange = false;
    await Promise.all(
        normalizedEntries.map(async (entry) => {
            const previousBookmarked = Boolean(entry.currentState?.bookmarked);
            if (previousBookmarked === Boolean(nextBookmarked)) {
                updateBookmarkTargetButtonState(entry.bookmarkTarget, previousBookmarked, {
                    activeTitle: "タグ対象に入ってる",
                    inactiveTitle: "この prompt をタグ対象に入れる",
                });
                return;
            }
            const result = await requestBookmarkChange(entry.bookmarkTarget, nextBookmarked);
            const finalBookmarked = Boolean(result?.bookmarked);
            updateBookmarkTargetButtonState(entry.bookmarkTarget, finalBookmarked, {
                activeTitle: "タグ対象に入ってる",
                inactiveTitle: "この prompt をタグ対象に入れる",
            });
            const delta = (finalBookmarked ? 1 : 0) - (previousBookmarked ? 1 : 0);
            if (!delta) return;
            didChange = true;
            changedItems.push({
                target: entry.bookmarkTarget,
                beforeBookmarked: previousBookmarked,
                afterBookmarked: finalBookmarked,
                parentConversationId: entry.conv?.id || "",
            });
            conversationDeltas.set(
                entry.conv.id,
                (conversationDeltas.get(entry.conv.id) || 0) + delta
            );
        })
    );
    conversationDeltas.forEach((delta, convId) => {
        updateConversationStarredPromptCount(convId, delta);
    });
    if (didChange) {
        pushBookmarkUndoAction({
            type: "bookmark-state",
            items: changedItems,
        });
        renderTree();
        refreshCurrentTabStrip();
        if (isSidebarFilterActive) {
            refreshDirectoryFromExtractFilters(true).catch(() => {});
        }
    } else {
        syncDirectoryPromptSelectionClasses();
    }
    void refreshStarredPrompts();
}

async function togglePromptBookmark(convIdx, messageIndex, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const convId = String(chatData[convIdx]?.id || "");
    const selectionKey = buildDirectoryPromptSelectionKey(convId, messageIndex);
    if (event?.shiftKey && selectionKey) {
        selectDirectoryPromptRange(selectionKey);
    } else if (selectionKey && selectedDirectoryPromptKeys.length <= 1) {
        directoryPromptSelectionAnchorKey = selectionKey;
    }
    const selectedKeysForTarget = selectionKey && selectedDirectoryPromptKeys.includes(selectionKey)
        ? selectedDirectoryPromptKeys.slice()
        : [];
    const shouldApplySelection = selectedKeysForTarget.length > 1;
    if (shouldApplySelection) {
        const entries = await resolveDirectoryPromptSelectionEntries(selectedKeysForTarget);
        const targetEntry = entries.find((entry) => entry.selectionKey === selectionKey);
        if (!targetEntry) return;
        const nextState = !Boolean(targetEntry.currentState?.bookmarked);
        await applyPromptBookmarkState(entries, nextState);
        return;
    }
    const conv = await loadConversationDetail(convIdx);
    const message = conv?.messages?.[messageIndex];
    if (!conv?.id || message?.role !== "user") return;
    const bookmarkTarget = buildPromptBookmarkTargetSpec(conv, messageIndex, message.text || "");
    let currentState = getCachedBookmarkState(bookmarkTarget);
    if (!currentState) {
        await requestBookmarkStates([bookmarkTarget]);
        currentState = getCachedBookmarkState(bookmarkTarget);
    }
    const nextState = !Boolean(currentState?.bookmarked);
    await applyPromptBookmarkState([
        {
            selectionKey,
            conv,
            convIdx,
            messageIndex,
            bookmarkTarget,
            currentState,
        },
    ], nextState);
}

async function copyPromptMessage(convIdx, messageIndex, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const conv = await loadConversationDetail(convIdx);
    const message = conv?.messages?.[messageIndex];
    if (!message || message.role !== "user") return;
    const text = String(message.text || "");
    copyTextToClipboard(text)
        .then(() => showToast("プロンプトをコピーしたよ"))
        .catch(() => {
            fallbackCopyText(text);
            showToast("プロンプトをコピーしたよ");
        });
}

function toggleMessageCollapsed(convIdx, messageIndex, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const conv = chatData[convIdx];
    if (!conv?.id) return;
    const turnStartIndex = getTurnStartMessageIndex(conv, messageIndex);
    const nextCollapsed = !isMessageCollapsed(conv, turnStartIndex);
    setMessageCollapsed(conv, turnStartIndex, nextCollapsed);
    const viewer = document.getElementById("chat-viewer");
    const previousScrollTop = viewer ? viewer.scrollTop : 0;
    window.setTimeout(() => {
        renderChat(convIdx, { preserveTabStripScroll: true });
        window.requestAnimationFrame(() => {
            const nextViewer = document.getElementById("chat-viewer");
            if (nextViewer) {
                nextViewer.scrollTop = previousScrollTop;
            }
        });
    }, 95);
}

function toggleAnswerMessageCollapsed(convIdx, messageIndex, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const conv = chatData[convIdx];
    const message = conv?.messages?.[messageIndex];
    if (!conv?.id || !message || message.role === "user") return;

    const turnStartIndex = getTurnStartMessageIndex(conv, messageIndex);
    const turnCollapsed = isMessageCollapsed(conv, turnStartIndex);
    const currentlyCollapsed = isAnswerMessageCollapsed(conv, messageIndex);

    if (turnCollapsed) {
        setAnswerCollapseOverride(conv, messageIndex, currentlyCollapsed ? "open" : null);
    } else {
        setAnswerCollapseOverride(conv, messageIndex, currentlyCollapsed ? null : "closed");
    }

    const viewer = document.getElementById("chat-viewer");
    const previousScrollTop = viewer ? viewer.scrollTop : 0;
    window.setTimeout(() => {
        renderChat(convIdx, { preserveTabStripScroll: true });
        window.requestAnimationFrame(() => {
            const nextViewer = document.getElementById("chat-viewer");
            if (nextViewer) {
                nextViewer.scrollTop = previousScrollTop;
            }
        });
    }, 95);
}

async function toggleVirtualFragmentBookmark(tabId, fragmentIndex, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const tab = openTabs.find((item) => item.id === tabId && item.type === "virtual");
    const fragment = tab?.virtualThread?.items?.[fragmentIndex];
    if (!tab || !fragment) return;
    const bookmarkTarget = buildVirtualFragmentBookmarkTargetSpec(tab, fragment);
    const currentState = getCachedBookmarkState(bookmarkTarget);
    const nextState = !Boolean(currentState?.bookmarked);
    const result = await requestBookmarkChange(bookmarkTarget, nextState);
    if (Boolean(result?.bookmarked) !== Boolean(currentState?.bookmarked)) {
        pushBookmarkUndoAction({
            type: "bookmark-state",
            items: [{
                target: bookmarkTarget,
                beforeBookmarked: Boolean(currentState?.bookmarked),
                afterBookmarked: Boolean(result?.bookmarked),
                parentConversationId: fragment.parentConversationId || "",
            }],
        });
    }
    updateBookmarkTargetButtonState(bookmarkTarget, result?.bookmarked, {
        activeTitle: "断片をマーク中",
        inactiveTitle: "この断片をマーク",
    });
}

async function toggleSavedViewBookmark(savedViewId, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const entry = (savedExtractViews || []).find((item) => String(item.id) === String(savedViewId));
    if (!entry) return;
    const bookmarkTarget = buildSavedViewBookmarkTargetSpec(entry);
    const currentState = getCachedBookmarkState(bookmarkTarget);
    const nextState = !Boolean(currentState?.bookmarked);
    const result = await requestBookmarkChange(bookmarkTarget, nextState);
    if (Boolean(result?.bookmarked) !== Boolean(currentState?.bookmarked)) {
        pushBookmarkUndoAction({
            type: "bookmark-state",
            items: [{
                target: bookmarkTarget,
                beforeBookmarked: Boolean(currentState?.bookmarked),
                afterBookmarked: Boolean(result?.bookmarked),
                parentConversationId: "",
            }],
        });
    }
    updateBookmarkTargetButtonState(bookmarkTarget, result?.bookmarked, {
        activeTitle: "保存ビューをマーク中",
        inactiveTitle: "この保存ビューをマーク",
    });
}

async function openBookmarkEntry(targetType, targetId, payload) {
    const bookmarkPayload = parseBookmarkPayload(payload);
    if (targetType === "thread") {
        const convId = bookmarkPayload.parentConversationId || targetId;
        const convIdx = getConversationIndexById(convId);
        if (convIdx >= 0) {
            ensureConversationTab(convIdx);
            await renderChat(convIdx);
        }
        return;
    }
    if (targetType === "prompt") {
        const convIdx = getConversationIndexById(bookmarkPayload.parentConversationId || "");
        if (convIdx >= 0 && Number.isInteger(bookmarkPayload.messageIndex)) {
            jumpToMessage(convIdx, bookmarkPayload.messageIndex, "auto");
        }
        return;
    }
    if (targetType === "virtual_fragment") {
        const convId = bookmarkPayload.parentConversationId || "";
        if (convId) {
            openOriginConversation(convId, bookmarkPayload.messageIndex ?? null);
        }
        return;
    }
    if (targetType === "saved_view") {
        const entry = (savedExtractViews || []).find((item) => String(item.id) === String(targetId));
        if (entry?.filters) {
            loadStoredFilterIntoExtractPanel(encodeURIComponent(JSON.stringify(entry.filters || {})));
            return;
        }
        showToast("Saved View がまだ読み込まれていないよ");
    }
}

function formatFilterHistoryDate(value) {
    if (!value) return "";
    const text = String(value);
    return text.length >= 16 ? text.slice(0, 16) : text;
}

function serializeFilterPayload(filters) {
    try {
        return JSON.stringify(filters || {});
    } catch (_error) {
        return "{}";
    }
}

function findMatchingStarredFilter(filters) {
    const serializedFilters = serializeFilterPayload(filters);
    return (starredExtractFilters || []).find(
        (entry) => serializeFilterPayload(entry.filters || {}) === serializedFilters
    ) || null;
}

function buildRecentFiltersMarkup() {
    if (!Array.isArray(recentExtractFilters) || recentExtractFilters.length === 0) {
        return '<div class="extract-history-empty">まだフィルタ履歴はないよ</div>';
    }
    return recentExtractFilters.map((entry) => {
        const serializedFilters = encodeURIComponent(JSON.stringify(entry.filters || {}));
        const usedAt = formatFilterHistoryDate(entry.lastUsedAt || entry.createdAt || "");
        const matchingStarredFilter = findMatchingStarredFilter(entry.filters || {});
        const starTargetSpec = buildBookmarkTargetSpec(
            "recent_filter",
            String(entry.id || serializedFilters),
            entry.filters || {}
        );
        return `
            <article
                class="extract-history-item extract-history-item-draggable${matchingStarredFilter ? " is-pinned" : ""}"
                data-filter-history-payload="${serializedFilters}"
                data-filter-history-label="${escapeHTML(entry.label || "Recent Filter")}"
                onpointerdown="armRecentFilterDrag('${serializedFilters}', '${escapeJsString(entry.label || "Recent Filter")}', event)"
            >
                <div class="extract-history-meta">
                    <div class="extract-history-meta-main">
                        <span class="extract-history-label">${escapeHTML(entry.label || "Recent Filter")}</span>
                        <span class="extract-history-date">${escapeHTML(usedAt)}</span>
                    </div>
                    <div class="extract-history-tools">
                        ${buildBookmarkToggleButtonHtml(
                            starTargetSpec,
                            Boolean(matchingStarredFilter),
                            `toggleRecentFilterStarByPayload('${serializedFilters}', event)`,
                            "prompt-bookmark-btn",
                            {
                                iconKind: "tab-button-kind-pin",
                                activeTitle: "固定を外す",
                                inactiveTitle: "固定する",
                            }
                        )}
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

function buildStarredFiltersMarkup() {
    if (!Array.isArray(starredExtractFilters) || starredExtractFilters.length === 0) {
        return '<div class="extract-history-empty">まだ starred filter はないよ</div>';
    }
    return starredExtractFilters.map((entry) => {
        const serializedFilters = encodeURIComponent(JSON.stringify(entry.filters || {}));
        const updatedAt = formatFilterHistoryDate(entry.updatedAt || entry.lastUsedAt || entry.createdAt || "");
        const safeId = Number.parseInt(entry.id, 10);
        return `
            <article class="extract-history-item">
                <div class="extract-history-meta">
                    <div class="extract-history-meta-main">
                        <span class="extract-history-label">${escapeHTML(entry.name || entry.label || "Starred Filter")}</span>
                        <span class="extract-history-date">${escapeHTML(updatedAt ? `updated ${updatedAt}` : "")}</span>
                    </div>
                    <div class="extract-history-tools">
                        <button class="extract-history-btn" type="button" onclick="applyStoredFilterToDirectory('${serializedFilters}')">開く</button>
                        <button class="extract-history-btn extract-history-icon-btn circle-pill circle-pill-md" type="button" title="編集" aria-label="編集" onclick="loadStoredFilterIntoExtractPanel('${serializedFilters}')">✎</button>
                        <button class="extract-history-btn" type="button" onclick="deleteStarredFilterById(${Number.isNaN(safeId) ? 0 : safeId})">Delete</button>
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

function getStarredPromptEntrySelectionKey(entry) {
    return String(entry?.targetId || "").trim();
}

function getVisibleStarredPromptSelectionKeys() {
    return Array.from(document.querySelectorAll(".extract-history-prompt-row[data-bookmark-selection-key]"))
        .filter((row) => row.offsetParent !== null)
        .map((row) => String(row.dataset.bookmarkSelectionKey || "").trim())
        .filter(Boolean);
}

function getSelectedStarredPromptEntries() {
    const selectedKeySet = new Set(selectedStarredPromptKeys);
    return (starredPromptEntries || []).filter((entry) =>
        selectedKeySet.has(getStarredPromptEntrySelectionKey(entry))
    );
}

function getBookmarkTagById(tagId) {
    return (bookmarkTags || []).find((tag) => String(tag.id) === String(tagId)) || null;
}

function migrateBookmarkTagNameInExtractFilters(previousName, nextName) {
    const oldName = String(previousName || "").trim();
    const newName = String(nextName || "").trim();
    if (!oldName || !newName || oldName === newName) return;
    const nextSelectedTags = getSelectedExtractBookmarkTags().map((tagName) =>
        String(tagName || "").trim() === oldName ? newName : tagName
    );
    const dedupedTags = Array.from(new Set(nextSelectedTags.map((tagName) => String(tagName || "").trim()).filter(Boolean)));
    writeExtractMultiValue("extract-bookmark-tags", dedupedTags);
    const nextSelectedGroups = getSelectedExtractBookmarkTagGroups().map((group) =>
        normalizeBookmarkTagNameGroup(group.map((tagName) =>
            String(tagName || "").trim() === oldName ? newName : tagName
        ))
    ).filter((group) => group.length >= 2);
    writeExtractGroupValue("extract-bookmark-tag-groups", nextSelectedGroups);
}

function syncBookmarkWorkspaceFiltersFromExtract() {
    const selectedTagNames = new Set(getSelectedExtractBookmarkTags());
    selectedBookmarkTagFilterIds = (bookmarkTags || [])
        .filter((tag) => selectedTagNames.has(String(tag?.name || "").trim()))
        .map((tag) => String(tag.id));
}

function rerenderBookmarkManagerIfActive() {
    if (getActiveTab()?.type === "manager" && getActiveTab()?.kind === "starred_prompts") {
        renderActiveTab();
    }
}

function addTagToExtractFilters(tagId) {
    const tag = getBookmarkTagById(tagId);
    if (!tag) {
        showToast("タグを見つけられなかったよ");
        return false;
    }
    const tagName = String(tag.name || "").trim();
    if (!tagName) {
        showToast("タグ名が空だったよ");
        return false;
    }
    const selectedGroup = getSelectedExtractBookmarkTagGroupByName(tagName);
    if (selectedGroup) {
        showToast(`「${selectedGroup.label}」が有効だから、このタグだけは足せないよ`);
        return false;
    }
    const selectedTags = getSelectedExtractBookmarkTags();
    if (selectedTags.includes(tagName)) {
        showToast(`Tag に「${tagName}」はもう入ってるよ`);
        return false;
    }
    writeExtractMultiValue("extract-bookmark-tags", [...selectedTags, tagName]);
    renderExtractBookmarkTagMenu();
    syncExtractBookmarkTagTrigger();
    syncBookmarkWorkspaceFiltersFromExtract();
    rerenderBookmarkManagerIfActive();
    scheduleVirtualThreadPreview();
    showToast(`Tag 条件に「${tagName}」を足したよ`);
    return true;
}

function startBookmarkTagRename(tagId, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const tag = getBookmarkTagById(tagId);
    if (!tag) {
        showToast("タグを見つけられなかったよ");
        return false;
    }
    editingBookmarkTagId = String(tag.id);
    editingBookmarkTagName = String(tag.name || "").trim();
    rerenderBookmarkManagerIfActive();
    window.requestAnimationFrame(() => {
        const input = document.getElementById(`bookmark-tag-rename-input-${editingBookmarkTagId}`);
        if (input instanceof HTMLInputElement) {
            input.focus();
            input.select();
        }
    });
    return true;
}

function updateBookmarkTagRenameDraft(tagId, value) {
    if (String(tagId) !== String(editingBookmarkTagId)) return;
    editingBookmarkTagName = String(value || "");
}

function cancelBookmarkTagRename(tagId, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (String(tagId) !== String(editingBookmarkTagId)) return false;
    editingBookmarkTagId = "";
    editingBookmarkTagName = "";
    bookmarkTagRenameSavingId = "";
    rerenderBookmarkManagerIfActive();
    return true;
}

async function commitBookmarkTagRename(tagId, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const normalizedTagId = String(tagId || "").trim();
    if (!normalizedTagId || normalizedTagId !== String(editingBookmarkTagId)) {
        return false;
    }
    if (bookmarkTagRenameSavingId === normalizedTagId) {
        return false;
    }
    const tag = getBookmarkTagById(normalizedTagId);
    if (!tag) {
        cancelBookmarkTagRename(normalizedTagId);
        showToast("タグを見つけられなかったよ");
        return false;
    }
    const currentName = String(tag.name || "").trim();
    const nextName = String(editingBookmarkTagName || "").trim();
    if (!nextName) {
        showToast("タグ名を入れてね");
        return false;
    }
    if (nextName === currentName) {
        cancelBookmarkTagRename(normalizedTagId);
        return false;
    }
    bookmarkTagRenameSavingId = normalizedTagId;
    const renamed = await requestRenameBookmarkTag(tag.id, nextName);
    bookmarkTagRenameSavingId = "";
    if (!renamed?.renamed) {
        if (renamed?.error === "duplicate") {
            showToast(`タグ「${nextName}」はもうあるよ`);
        } else {
            showToast("タグ名を変えられなかったよ");
        }
        return false;
    }
    editingBookmarkTagId = "";
    editingBookmarkTagName = "";
    migrateBookmarkTagNameInExtractFilters(currentName, renamed.name || nextName);
    await Promise.all([
        refreshBookmarkTags(),
        refreshRecentFilters(),
        refreshStarredFilters(),
    ]);
    showToast(`タグ名を「${renamed.name || nextName}」に変えたよ`);
    return true;
}

function handleBookmarkTagRenameKeydown(tagId, event) {
    if (event?.key === "Enter") {
        commitBookmarkTagRename(tagId, event);
        return;
    }
    if (event?.key === "Escape") {
        cancelBookmarkTagRename(tagId, event);
    }
}

function handleBookmarkTagRenameBlur(tagId, event) {
    const nextFocus = event?.relatedTarget;
    if (nextFocus?.closest?.(".bookmark-tag-inline-editor")) {
        return;
    }
    commitBookmarkTagRename(tagId, event);
}

function addTagGroupToExtractFilters(groupKey) {
    const group = getBookmarkTagGroupEntries().find((entry) => entry.id === String(groupKey || ""));
    if (!group) {
        showToast("結合タグを見つけられなかったよ");
        return false;
    }
    const selectedGroups = getSelectedExtractBookmarkTagGroups();
    const targetKey = buildBookmarkTagGroupKeyFromNames(group.tagNames);
    if (selectedGroups.some((entry) => buildBookmarkTagGroupKeyFromNames(entry) === targetKey)) {
        showToast(`Tag 条件に「${group.label}」はもう入ってるよ`);
        return false;
    }
    writeExtractGroupValue("extract-bookmark-tag-groups", [...selectedGroups, group.tagNames]);
    syncExtractBookmarkTagTrigger();
    syncBookmarkWorkspaceFiltersFromExtract();
    rerenderBookmarkManagerIfActive();
    scheduleVirtualThreadPreview();
    showToast(`結合タグ「${group.label}」を Tag 条件に足したよ`);
    return true;
}

function buildBookmarkTagGroupFromIds(tagIds) {
    return hydrateBookmarkTagGroup({ tagIds });
}

function createBookmarkTagGroupFromTagIds(tagIds) {
    const created = buildBookmarkTagGroupFromIds(tagIds);
    if (!created) {
        showToast("2つ以上のタグで結合してね");
        return false;
    }
    const targetNames = created.tagNames;
    const targetNameSet = new Set(targetNames);
    const selectedGroups = getSelectedExtractBookmarkTagGroups();
    const targetKey = buildBookmarkTagGroupKeyFromNames(created.tagNames);
    const nextGroups = selectedGroups.filter((group) => {
        const normalizedGroup = normalizeBookmarkTagNameGroup(group);
        const groupKey = buildBookmarkTagGroupKeyFromNames(normalizedGroup);
        if (groupKey === targetKey) {
            return false;
        }
        return !normalizedGroup.every((tagName) => targetNameSet.has(tagName));
    });
    nextGroups.push(targetNames);
    const nextSingleTags = getSelectedExtractBookmarkTags().filter((tagName) => !targetNameSet.has(String(tagName || "").trim()));
    bookmarkTagGroups = normalizeBookmarkTagGroups([
        ...(Array.isArray(bookmarkTagGroups) ? bookmarkTagGroups : []),
        { tagIds: created.tagIds },
    ]);
    saveBookmarkTagGroupsToStorage();
    writeExtractMultiValue("extract-bookmark-tags", nextSingleTags);
    writeExtractGroupValue("extract-bookmark-tag-groups", nextGroups);
    syncExtractBookmarkTagTrigger();
    syncBookmarkWorkspaceFiltersFromExtract();
    rerenderBookmarkManagerIfActive();
    scheduleVirtualThreadPreview();
    showToast(`タグを結合して「${created.label}」にしたよ`);
    return true;
}

function removeBookmarkTagFromGroup(groupKey, tagId, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const targetKey = String(groupKey || "").trim();
    const targetTagId = String(tagId || "").trim();
    if (!targetKey || !targetTagId) return false;
    const hydratedGroup = getBookmarkTagGroupEntries().find((group) => String(group?.id || "").trim() === targetKey);
    if (!hydratedGroup) {
        showToast("結合タグを見つけられなかったよ");
        return false;
    }
    const remainingTagIds = hydratedGroup.tagIds.filter((candidateId) => candidateId !== targetTagId);
    if (remainingTagIds.length === hydratedGroup.tagIds.length) {
        showToast("そのタグは結合タグに入っていなかったよ");
        return false;
    }
    let nextGroup = null;
    if (remainingTagIds.length >= 2) {
        nextGroup = buildBookmarkTagGroupFromIds(remainingTagIds);
    }
    bookmarkTagGroups = normalizeBookmarkTagGroups(
        (Array.isArray(bookmarkTagGroups) ? bookmarkTagGroups : []).flatMap((group) => {
            const hydrated = hydrateBookmarkTagGroup(group);
            if (!hydrated || hydrated.id !== targetKey) {
                return group;
            }
            return nextGroup ? [{ tagIds: nextGroup.tagIds }] : [];
        })
    );
    saveBookmarkTagGroupsToStorage();
    if (isExtractBookmarkTagGroupSelected(hydratedGroup.tagNames)) {
        replaceExtractBookmarkTagGroupSelection(hydratedGroup.tagNames, nextGroup?.tagNames || remainingTagIds.map((id) => getBookmarkTagById(id)?.name || "").filter(Boolean));
    }
    renderExtractBookmarkTagMenu();
    syncExtractBookmarkTagTrigger();
    syncBookmarkWorkspaceFiltersFromExtract();
    rerenderBookmarkManagerIfActive();
    scheduleVirtualThreadPreview();
    if (nextGroup) {
        showToast(`結合タグを「${nextGroup.label}」に更新したよ`);
    } else if (remainingTagIds.length === 1) {
        const remainingTag = getBookmarkTagById(remainingTagIds[0]);
        showToast(`結合タグを外して「${remainingTag?.name || "Tag"}」に戻したよ`);
    } else {
        showToast("結合タグを外したよ");
    }
    return true;
}

function handleBookmarkTagGroupCardClick(groupKey, event) {
    if (event?.target?.closest?.(".bookmark-tag-group-member-chip")) {
        return;
    }
    toggleExtractBookmarkTagGroupByKey(groupKey, event);
}

function buildBookmarkWorkspaceFilterChipsMarkup() {
    const activeFilterSet = new Set((selectedBookmarkTagFilterIds || []).map((id) => String(id)));
    const singleTagMarkup = (bookmarkTags || [])
        .filter((tag) => activeFilterSet.has(String(tag.id)))
        .map((tag) => `
            <button class="extract-chip" type="button" onclick="removeExtractFilterValue('bookmarkTags', '${escapeJsString(String(tag.name || '').trim())}')">
                <span class="extract-chip-label">${escapeHTML(tag.name || "Tag")}</span>
                <span class="extract-chip-remove" aria-hidden="true">×</span>
            </button>
        `);
    const groupMarkup = getSelectedExtractBookmarkTagGroups()
        .map((group) => hydrateBookmarkTagGroup({ tagNames: group }))
        .filter(Boolean)
        .map((group) => `
            <div class="bookmark-workspace-filter-group" title="結合: ${escapeHTML(group.label)}">
                ${group.tagIds.map((tagId, index) => {
                    const memberTag = getBookmarkTagById(tagId);
                    const memberName = String(memberTag?.name || "").trim();
                    if (!memberName) return "";
                    const separator = index > 0
                        ? `<span class="bookmark-workspace-filter-separator" aria-hidden="true">&</span>`
                        : "";
                    return `
                        ${separator}
                        <button
                            class="extract-chip extract-chip-compound"
                            type="button"
                            onclick="removeBookmarkTagFromGroup('${escapeJsString(group.id)}', '${escapeJsString(tagId)}', event)"
                        >
                            <span class="extract-chip-label">${escapeHTML(memberName)}</span>
                            <span class="extract-chip-remove" aria-hidden="true">×</span>
                        </button>
                    `;
                }).join("")}
            </div>
        `);
    const markup = [...singleTagMarkup, ...groupMarkup].join("");
    if (markup) return markup;
    return '<span class="bookmark-workspace-chip">複数選択: OR / ドラッグで結合: AND</span>';
}

function applyRecentFilterPayloadToExtractSummary(payload) {
    const normalizedPayload = String(payload || "").trim();
    if (!normalizedPayload) return false;
    loadStoredFilterIntoExtractPanel(normalizedPayload);
    showToast("履歴の条件を検索パネルへ適用したよ");
    return true;
}

function getBookmarkWorkspaceSelectionSummary() {
    const selectedCount = selectedDirectoryPromptKeys.length;
    if (selectedCount > 0) {
        return `サイドバーで ${selectedCount} 件選択中`;
    }
    return "サイドバーのフォルダや prompt を直接ドラッグ";
}

function getBookmarkWorkspaceScopeLabel(entries, fallbackLabel = "この対象") {
    const normalizedEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
    if (!normalizedEntries.length) {
        return fallbackLabel;
    }
    return normalizedEntries.length === 1
        ? "この prompt"
        : `${normalizedEntries.length} 件の prompt`;
}

function entryHasBookmarkTag(entry, tagId) {
    return Array.isArray(entry?.tags) && entry.tags.some((tag) => String(tag?.id) === String(tagId));
}

function getBookmarkTagGroupPromptCount(group) {
    const requiredTagIds = Array.isArray(group?.tagIds)
        ? group.tagIds.map((tagId) => String(tagId || "").trim()).filter(Boolean)
        : [];
    if (!requiredTagIds.length) return 0;
    return (starredPromptEntries || []).filter((entry) =>
        requiredTagIds.every((tagId) => entryHasBookmarkTag(entry, tagId))
    ).length;
}

function getFilteredStarredPromptEntries() {
    const selectedFilterIds = Array.isArray(selectedBookmarkTagFilterIds)
        ? selectedBookmarkTagFilterIds.map((id) => String(id))
        : [];
    const selectedTagGroups = getSelectedExtractBookmarkTagGroups();
    if (!selectedFilterIds.length && !selectedTagGroups.length) {
        return Array.isArray(starredPromptEntries) ? starredPromptEntries.slice() : [];
    }
    return (starredPromptEntries || []).filter((entry) => {
        const matchesSingle = selectedFilterIds.length
            ? selectedFilterIds.some((tagId) => entryHasBookmarkTag(entry, tagId))
            : false;
        const matchesGroup = selectedTagGroups.some((group) =>
            normalizeBookmarkTagNameGroup(group).every((tagName) =>
                Array.isArray(entry?.tags) && entry.tags.some((tag) => String(tag?.name || "").trim() === tagName)
            )
        );
        return matchesSingle || matchesGroup;
    });
}

function restoreBookmarkTagFilters(filterIds) {
    selectedBookmarkTagFilterIds = Array.from(
        new Set(
            (Array.isArray(filterIds) ? filterIds : [])
                .map((id) => String(id || "").trim())
                .filter(Boolean)
        )
    );
}

function syncStarredPromptSelectionControls() {
    const summaryNode = document.getElementById("starred-prompts-selection-summary");
    const filterSummaryNode = document.getElementById("starred-prompts-filter-summary");
    if (summaryNode) {
        summaryNode.textContent = getBookmarkWorkspaceSelectionSummary();
    }
    if (filterSummaryNode) {
        const logicExpression = buildBookmarkTagLogicExpression();
        filterSummaryNode.textContent = logicExpression || "複数選択: OR / ドラッグで結合: AND";
    }
}

function syncStarredPromptSelectionClasses(options = {}) {
    const rows = Array.from(document.querySelectorAll(".extract-history-prompt-row[data-bookmark-selection-key]"));
    const visibleKeys = rows
        .filter((row) => row.offsetParent !== null)
        .map((row) => String(row.dataset.bookmarkSelectionKey || "").trim())
        .filter(Boolean);
    if (options.pruneToVisible) {
        const visibleKeySet = new Set(visibleKeys);
        selectedStarredPromptKeys = selectedStarredPromptKeys.filter((key) => visibleKeySet.has(key));
        if (
            starredPromptSelectionAnchorKey &&
            !visibleKeySet.has(starredPromptSelectionAnchorKey)
        ) {
            starredPromptSelectionAnchorKey = selectedStarredPromptKeys[0] || "";
        }
    }
    const selectedKeySet = new Set(selectedStarredPromptKeys);
    rows.forEach((row) => {
        const selectionKey = String(row.dataset.bookmarkSelectionKey || "").trim();
        const isSelected = selectedKeySet.has(selectionKey);
        row.classList.toggle("is-selected", isSelected);
        row.setAttribute("aria-selected", isSelected ? "true" : "false");
        const selectButton = row.querySelector(".extract-history-prompt-select");
        if (selectButton) {
            selectButton.setAttribute("aria-pressed", isSelected ? "true" : "false");
        }
    });
    syncStarredPromptSelectionControls();
}

function setStarredPromptSelection(keys, options = {}) {
    const uniqueKeys = Array.from(
        new Set(
            (Array.isArray(keys) ? keys : [])
                .map((key) => String(key || "").trim())
                .filter(Boolean)
        )
    );
    selectedStarredPromptKeys = uniqueKeys;
    if (Object.prototype.hasOwnProperty.call(options, "anchorKey")) {
        starredPromptSelectionAnchorKey = String(options.anchorKey || "").trim();
    } else if (!uniqueKeys.length) {
        starredPromptSelectionAnchorKey = "";
    } else if (!starredPromptSelectionAnchorKey) {
        starredPromptSelectionAnchorKey = uniqueKeys[0];
    }
    syncStarredPromptSelectionClasses();
    return uniqueKeys;
}

function selectStarredPromptRange(targetKey) {
    const normalizedTargetKey = String(targetKey || "").trim();
    if (!normalizedTargetKey) return [];
    if (!starredPromptSelectionAnchorKey) {
        return setStarredPromptSelection([normalizedTargetKey], {
            anchorKey: normalizedTargetKey,
        });
    }
    const visibleKeys = getVisibleStarredPromptSelectionKeys();
    const anchorIndex = visibleKeys.indexOf(starredPromptSelectionAnchorKey);
    const targetIndex = visibleKeys.indexOf(normalizedTargetKey);
    if (anchorIndex < 0 || targetIndex < 0) {
        return setStarredPromptSelection([normalizedTargetKey], {
            anchorKey: normalizedTargetKey,
        });
    }
    const startIndex = Math.min(anchorIndex, targetIndex);
    const endIndex = Math.max(anchorIndex, targetIndex);
    return setStarredPromptSelection(visibleKeys.slice(startIndex, endIndex + 1), {
        anchorKey: starredPromptSelectionAnchorKey,
    });
}

function selectStarredPromptEntry(targetKey, event) {
    if (Date.now() < bookmarkSelectionSuppressClickUntil) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        return;
    }
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const normalizedTargetKey = String(targetKey || "").trim();
    if (!normalizedTargetKey) return;
    if (event?.shiftKey) {
        selectStarredPromptRange(normalizedTargetKey);
        return;
    }
    setStarredPromptSelection([normalizedTargetKey], {
        anchorKey: normalizedTargetKey,
    });
}

function buildStarredPromptManagerControlsHtml() {
    const regularTags = bookmarkTags || [];
    const activeFilterSet = new Set((selectedBookmarkTagFilterIds || []).map((id) => String(id)));
    const compoundGroups = getBookmarkTagGroupEntries()
        .filter((group) => isExtractBookmarkTagGroupSelected(group.tagNames));
    const compoundMemberIdSet = new Set(
        compoundGroups.flatMap((group) => group.tagIds.map((tagId) => String(tagId || "").trim()).filter(Boolean))
    );
    const visibleRegularTags = regularTags.filter((tag) => !compoundMemberIdSet.has(String(tag.id || "").trim()));
    return `
        <div class="manager-tab-toolbar">
            <div class="manager-tab-toolbar-left">
                <div class="manager-tab-toolbar-meta">
                    <span class="manager-tab-toolbar-title">タグ操作台</span>
                    <span class="manager-tab-toolbar-summary" id="starred-prompts-selection-summary">${getBookmarkWorkspaceSelectionSummary()}</span>
                </div>
            </div>
            <div class="bookmark-tag-panel">
                <div class="manager-tab-toolbar-meta bookmark-tag-filter-meta">
                    <span class="manager-tab-toolbar-title">タグ</span>
                    <span class="manager-tab-toolbar-summary" id="starred-prompts-filter-summary">${
                        buildBookmarkTagLogicExpression() || "複数選択: OR / ドラッグで結合: AND"
                    }</span>
                </div>
                <div class="bookmark-tag-create">
                    <input id="bookmark-tag-name-input" type="text" placeholder="新しいタグ" onkeydown="handleBookmarkTagCreateKeydown(event)">
                    <button class="extract-history-btn" type="button" onclick="createBookmarkTagFromInput()">タグを作成</button>
                </div>
                <div class="bookmark-tag-dropzones">
                    ${visibleRegularTags.map((tag) => `
                        <div
                            class="bookmark-tag-dropzone ${activeFilterSet.has(String(tag.id)) ? "is-filter-active" : ""} ${String(editingBookmarkTagId) === String(tag.id) ? "is-editing" : ""}"
                            role="button"
                            tabindex="0"
                            data-bookmark-dropzone-kind="assign-tag"
                            data-bookmark-tag-id="${escapeHTML(String(tag.id))}"
                            aria-pressed="${activeFilterSet.has(String(tag.id)) ? "true" : "false"}"
                            title="クリックで絞り込み / ✎ で名前変更 / タグをサイドバーへ落とすと付与 / サイドバーの対象をここへ落としても付与"
                            ${String(editingBookmarkTagId) === String(tag.id)
                                ? ""
                                : `onclick="toggleBookmarkTagFilter(${Number.parseInt(tag.id, 10)}, event)" onpointerdown="armBookmarkTagDrag(${Number.parseInt(tag.id, 10)}, event)"`}
                        >
                            ${String(editingBookmarkTagId) === String(tag.id) ? `
                                <span class="bookmark-tag-inline-editor" onclick="event.stopPropagation()" onpointerdown="event.stopPropagation()">
                                    <input
                                        id="bookmark-tag-rename-input-${escapeHTML(String(tag.id))}"
                                        class="bookmark-tag-inline-input"
                                        type="text"
                                        value="${escapeHTML(editingBookmarkTagName || tag.name || "")}"
                                        oninput="updateBookmarkTagRenameDraft('${escapeJsString(String(tag.id))}', this.value)"
                                        onkeydown="handleBookmarkTagRenameKeydown('${escapeJsString(String(tag.id))}', event)"
                                        onblur="handleBookmarkTagRenameBlur('${escapeJsString(String(tag.id))}', event)"
                                    >
                                    <button
                                        class="bookmark-tag-inline-action"
                                        type="button"
                                        title="保存"
                                        onclick="commitBookmarkTagRename('${escapeJsString(String(tag.id))}', event)"
                                    >✓</button>
                                    <button
                                        class="bookmark-tag-inline-action"
                                        type="button"
                                        title="キャンセル"
                                        onclick="cancelBookmarkTagRename('${escapeJsString(String(tag.id))}', event)"
                                    >×</button>
                                </span>
                            ` : `
                                <span class="bookmark-tag-dropzone-label">${escapeHTML(tag.name || "Tag")}</span>
                                <span
                                    class="bookmark-tag-dropzone-edit"
                                    role="button"
                                    tabindex="-1"
                                    title="タグ名を変更"
                                    onclick="startBookmarkTagRename('${escapeJsString(String(tag.id))}', event)"
                                >✎</span>
                            `}
                            <span class="bookmark-tag-dropzone-count">${escapeHTML(String(tag.bookmarkCount || 0))}</span>
                        </div>
                    `).join("")}
                    ${compoundGroups.length ? compoundGroups.map((group) => `
                        <div
                            class="bookmark-tag-dropzone bookmark-tag-group-card is-filter-active"
                            data-bookmark-dropzone-kind="compound-tag-group"
                            data-bookmark-tag-group-key="${escapeHTML(group.id)}"
                            role="button"
                            tabindex="0"
                            title="結合タグ: ${escapeHTML(group.label)}"
                            aria-pressed="true"
                            onclick="handleBookmarkTagGroupCardClick('${escapeJsString(group.id)}', event)"
                        >
                            <div class="bookmark-tag-group-members">
                                ${group.tagIds.map((tagId, index) => {
                                    const memberTag = getBookmarkTagById(tagId);
                                    const memberName = String(memberTag?.name || "").trim();
                                    if (!memberName) return "";
                                    const separator = index > 0
                                        ? `<span class="bookmark-tag-group-separator" aria-hidden="true">&</span>`
                                        : "";
                                    return `
                                        ${separator}
                                        <button
                                            class="extract-chip bookmark-tag-group-member-chip"
                                            type="button"
                                            title="結合から ${escapeHTML(memberName)} を外す"
                                            onclick="removeBookmarkTagFromGroup('${escapeJsString(group.id)}', '${escapeJsString(tagId)}', event)"
                                        >
                                            <span class="extract-chip-label">${escapeHTML(memberName)}</span>
                                            <span class="extract-chip-remove" aria-hidden="true">×</span>
                                        </button>
                                    `;
                                }).join("")}
                            </div>
                            <span class="bookmark-tag-dropzone-count">${escapeHTML(String(getBookmarkTagGroupPromptCount(group)))}</span>
                        </div>
                    `).join("") : ""}
                    <button
                        class="bookmark-tag-dropzone bookmark-tag-dropzone-remove"
                        type="button"
                        data-bookmark-dropzone-kind="remove-tag"
                        title="クリックで絞り込み解除 / サイドバーの対象をここへ落とすとタグをまとめて外す / タグチップをドロップするとそのタグだけ外す"
                        onclick="clearBookmarkTagFilters(event)"
                        onpointerdown="armBookmarkRemoveToolDrag(event)"
                    >
                        <span class="bookmark-tag-dropzone-remove-icon" aria-hidden="true">×</span>
                        <span class="bookmark-tag-dropzone-label">絞り込み解除</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function buildBookmarkTagWorkspaceMarkup() {
    const selectedCount = selectedDirectoryPromptKeys.length;
    const targetSummary = selectedCount > 0
        ? `サイドバーで選んだ ${selectedCount} 件の prompt をまとめて操作できるよ。`
        : "サイドバーのフォルダや prompt をタグボタンか × にドラッグして操作してね。";
    const logicExpression = buildBookmarkTagLogicExpression();
    const filterSummary = logicExpression
        ? `いまは ${logicExpression}。`
        : "複数選択: OR / ドラッグで結合: AND";
    return `
        <div class="bookmark-workspace">
            <details class="bookmark-workspace-card bookmark-workspace-collapsible">
                <summary class="bookmark-workspace-summary-toggle">
                    <span class="bookmark-workspace-title">操作対象・使い方・フィルタ</span>
                    <span class="bookmark-workspace-caret" aria-hidden="true"></span>
                </summary>
                <div class="bookmark-workspace-group">
                    <h4 class="bookmark-workspace-subtitle">操作対象</h4>
                    <p class="bookmark-workspace-summary">${targetSummary}</p>
                    <div class="bookmark-workspace-chip-list">
                        <span class="bookmark-workspace-chip">Shift+クリックで範囲選択</span>
                        <span class="bookmark-workspace-chip">フォルダは今見えている prompt 全体</span>
                    </div>
                </div>
                <div class="bookmark-workspace-group">
                    <h4 class="bookmark-workspace-subtitle">使い方</h4>
                    <ul class="bookmark-workspace-list">
                        <li>タグボタン → サイドバー: そのフォルダや prompt にタグ付与</li>
                        <li>サイドバー → タグボタン: 選んだ対象へタグ付与</li>
                        <li>サイドバー → ×: 対象についているタグをまとめて解除</li>
                    </ul>
                </div>
                <div class="bookmark-workspace-group">
                    <h4 class="bookmark-workspace-subtitle">フィルタ</h4>
                    <p class="bookmark-workspace-summary">${filterSummary}</p>
                    <div class="bookmark-workspace-filter-list">
                        ${buildBookmarkWorkspaceFilterChipsMarkup()}
                    </div>
                </div>
            </details>
            <section class="bookmark-workspace-card extract-history-section bookmark-workspace-history">
                <div class="extract-history-header">
                    <div class="extract-history-heading">
                        <h3><span class="tab-button-kind tab-button-kind-icon tab-button-kind-clock extract-history-title-icon" aria-hidden="true"></span><span>履歴</span></h3>
                        <div class="extract-history-note">ここから検索パネルへドラッグできるよ</div>
                    </div>
                </div>
                <div id="extract-history-list" class="extract-history-list"></div>
            </section>
        </div>
    `;
}

function renderRecentFilters() {
    const root = document.getElementById("extract-history-list");
    if (root) {
        root.innerHTML = buildRecentFiltersMarkup();
    }
}

function renderSavedViews() {
    const root = document.getElementById("extract-saved-view-list");
    if (root) {
        root.innerHTML = buildStarredFiltersMarkup();
    }
}

async function refreshRecentFilters() {
    recentExtractFilters = await requestRecentFilters();
    if (getActiveTab()?.type === "manager" && getActiveTab()?.kind === "recent_filters") {
        renderActiveTab();
    }
    renderRecentFilters();
}

async function refreshStarredFilters() {
    starredExtractFilters = await requestStarredFilters();
    savedExtractViews = starredExtractFilters;
    if (getActiveTab()?.type === "manager" && getActiveTab()?.kind === "starred_filters") {
        renderActiveTab();
    }
    renderSavedViews();
}

async function refreshStarredPrompts() {
    starredPromptEntries = await requestStarredPrompts();
    const visiblePromptTargetIds = new Set(
        (starredPromptEntries || [])
            .map((entry) => String(entry?.targetId || "").trim())
            .filter(Boolean)
    );
    Object.keys(bookmarkStatesByKey).forEach((stateKey) => {
        const state = bookmarkStatesByKey[stateKey];
        if (
            state?.targetType === "prompt"
            && !visiblePromptTargetIds.has(String(state?.targetId || "").trim())
        ) {
            cacheBookmarkState({
                ...state,
                bookmarked: false,
                tags: [],
            });
        }
    });
    (starredPromptEntries || []).forEach((entry) => {
        cacheBookmarkState({
            targetType: entry.targetType,
            targetId: entry.targetId,
            payload: entry.payload || {},
            bookmarked: entry.bookmarked !== false,
            updatedAt: entry.updatedAt || null,
            tags: Array.isArray(entry.tags) ? entry.tags : [],
        });
    });
    syncConversationTagCountsFromStarredPrompts();
    if (getActiveTab()?.type === "manager" && getActiveTab()?.kind === "starred_prompts") {
        renderActiveTab();
    }
    renderTree();
    refreshCurrentTabStrip();
}

async function refreshBookmarkTags() {
    loadBookmarkTagGroupsFromStorage();
    bookmarkTags = await requestBookmarkTags();
    syncBookmarkWorkspaceFiltersFromExtract();
    const visibleTagIds = new Set((bookmarkTags || []).map((tag) => String(tag.id)));
    selectedBookmarkTagFilterIds = selectedBookmarkTagFilterIds.filter((tagId) => visibleTagIds.has(String(tagId)));
    const visibleTagNames = new Set((bookmarkTags || []).map((tag) => String(tag.name || "").trim()).filter(Boolean));
    writeExtractMultiValue(
        "extract-bookmark-tags",
        getSelectedExtractBookmarkTags().filter((tagName) => visibleTagNames.has(String(tagName || "").trim()))
    );
    writeExtractGroupValue(
        "extract-bookmark-tag-groups",
        getSelectedExtractBookmarkTagGroups().filter((group) =>
            normalizeBookmarkTagNameGroup(group).every((tagName) => visibleTagNames.has(String(tagName || "").trim()))
        )
    );
    bookmarkTagGroups = normalizeBookmarkTagGroups(
        (Array.isArray(bookmarkTagGroups) ? bookmarkTagGroups : []).filter((group) => {
            const hydrated = hydrateBookmarkTagGroup(group);
            return hydrated && hydrated.tagNames.every((tagName) => visibleTagNames.has(String(tagName || "").trim()));
        })
    );
    saveBookmarkTagGroupsToStorage();
    renderExtractBookmarkTagMenu();
    syncExtractBookmarkTagTrigger();
    syncBookmarkWorkspaceFiltersFromExtract();
    if (getActiveTab()?.type === "manager" && getActiveTab()?.kind === "starred_prompts") {
        renderActiveTab();
    }
}

function buildSelectedStarredPromptTargets() {
    return getSelectedStarredPromptEntries().map((entry) => ({
        targetType: entry.targetType,
        targetId: entry.targetId,
        payload: entry.payload || {},
    }));
}

function getSelectedStarredPromptTagSummaries() {
    const tagMap = new Map();
    getSelectedStarredPromptEntries().forEach((entry) => {
        (Array.isArray(entry.tags) ? entry.tags : []).forEach((tag) => {
            const tagId = String(tag?.id || "").trim();
            if (!tagId) return;
            if (!tagMap.has(tagId)) {
                tagMap.set(tagId, {
                    tagId,
                    tagName: tag?.name || "",
                });
            }
        });
    });
    return Array.from(tagMap.values());
}

function clearBookmarkSelectionDropzones() {
    document.querySelectorAll(".bookmark-tag-dropzone.is-drag-over, .prompt-item-row.is-drag-over, .tree-summary.is-drag-over, .extract-summary.is-drag-over, .sidebar-mode-btn.is-drag-over, #sidebar.is-drag-over, #thread-list-panel.is-drag-over").forEach((node) => {
        node.classList.remove("is-drag-over");
        if (node instanceof HTMLElement && node.dataset.dropLabel) {
            delete node.dataset.dropLabel;
        }
    });
}

function finishStarredPromptDrag(_event) {
    bookmarkSelectionDragState = null;
    document.body.classList.remove("bookmark-dragging");
    clearBookmarkSelectionDropzones();
    if (bookmarkSelectionDragGhostEl?.parentNode) {
        bookmarkSelectionDragGhostEl.parentNode.removeChild(bookmarkSelectionDragGhostEl);
    }
    bookmarkSelectionDragGhostEl = null;
}

function armStarredPromptDrag(selectionKey, event) {
    if ((event?.button ?? 0) !== 0) return;
    const normalizedKey = String(selectionKey || "").trim();
    if (!normalizedKey) return;
    const selectedKeys = selectedStarredPromptKeys.includes(normalizedKey)
        ? selectedStarredPromptKeys.slice()
        : [normalizedKey];
    bookmarkSelectionDragState = {
        dragKind: "bookmark-selection",
        selectionKey: normalizedKey,
        selectedKeys,
        filterIdsSnapshot: selectedBookmarkTagFilterIds.slice(),
        startX: event?.clientX ?? 0,
        startY: event?.clientY ?? 0,
        active: false,
        hoverKind: "",
        hoverTagId: "",
    };
    event?.preventDefault?.();
}

function armBookmarkTagDrag(tagId, event) {
    if ((event?.button ?? 0) !== 0) return;
    const tag = getBookmarkTagById(tagId);
    if (!tag) return;
    bookmarkSelectionDragState = {
        dragKind: "tag",
        tagId: String(tag.id),
        tagName: tag.name || "",
        filterIdsSnapshot: selectedBookmarkTagFilterIds.slice(),
        startX: event?.clientX ?? 0,
        startY: event?.clientY ?? 0,
        active: false,
        hoverKind: "",
        hoverTagId: "",
    };
    event?.preventDefault?.();
}

function armRecentFilterDrag(payload, label, event) {
    if ((event?.button ?? 0) !== 0) return;
    if (event?.target?.closest?.("button")) return;
    const normalizedPayload = String(payload || "").trim();
    if (!normalizedPayload) return;
    bookmarkSelectionDragState = {
        dragKind: "recent-filter",
        filterPayload: normalizedPayload,
        filterLabel: String(label || "Recent Filter"),
        startX: event?.clientX ?? 0,
        startY: event?.clientY ?? 0,
        active: false,
        hoverKind: "",
        hoverTagId: "",
    };
    event?.preventDefault?.();
}

function armBookmarkRemoveToolDrag(event) {
    if ((event?.button ?? 0) !== 0) return;
    bookmarkSelectionDragState = {
        dragKind: "tag-remove-tool",
        startX: event?.clientX ?? 0,
        startY: event?.clientY ?? 0,
        filterIdsSnapshot: selectedBookmarkTagFilterIds.slice(),
        active: false,
        hoverKind: "",
        hoverTagId: "",
    };
    event?.preventDefault?.();
}

function armBookmarkEntryTagDrag(tagId, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    armBookmarkTagDrag(tagId, event);
}

function ensureBookmarkSelectionDragGhost(label) {
    if (!bookmarkSelectionDragGhostEl) {
        const ghost = document.createElement("div");
        ghost.className = "bookmark-drag-ghost";
        document.body.appendChild(ghost);
        bookmarkSelectionDragGhostEl = ghost;
    }
    bookmarkSelectionDragGhostEl.textContent = label;
}

function isValidBookmarkDropTarget(dragKind, hoverKind) {
    if (dragKind === "bookmark-selection") {
        return hoverKind === "assign-tag" || hoverKind === "remove-tag";
    }
    if (dragKind === "directory-prompt-selection" || dragKind === "directory-folder") {
        return hoverKind === "assign-tag" || hoverKind === "remove-tag";
    }
    if (dragKind === "tag") {
        return (
            hoverKind === "remove-tag" ||
            hoverKind === "assign-tag" ||
            hoverKind === "compound-tag-group" ||
            hoverKind === "extract-summary" ||
            hoverKind === "directory-prompt" ||
            hoverKind === "directory-folder"
        );
    }
    if (dragKind === "recent-filter") {
        return hoverKind === "extract-summary" || hoverKind === "directory-mode";
    }
    if (dragKind === "tag-remove-tool") {
        return hoverKind === "directory-prompt" || hoverKind === "directory-folder";
    }
    return false;
}

function updateBookmarkSelectionDropTarget(clientX, clientY) {
    const rawHoveredNode = document.elementFromPoint(clientX, clientY);
    const hoveredNode = rawHoveredNode
        ?.closest(".bookmark-tag-dropzone, .prompt-item-row[data-directory-drop-kind], .tree-summary[data-directory-drop-kind], .extract-summary[data-extract-drop-kind], .sidebar-mode-btn[data-sidebar-drop-kind], #extract-panel, #sidebar");
    let hovered = hoveredNode;
    const isInsideSidebar = rawHoveredNode instanceof HTMLElement && Boolean(rawHoveredNode.closest("#sidebar"));
    clearBookmarkSelectionDropzones();
    if (
        bookmarkSelectionDragState &&
        bookmarkSelectionDragState.dragKind === "recent-filter" &&
        isInsideSidebar
    ) {
        document.getElementById("sidebar")?.classList.add("is-drag-over");
        if (sidebarMode === "threads") {
            const threadPanel = document.getElementById("thread-list-panel");
            threadPanel?.classList.add("is-drag-over");
            if (threadPanel instanceof HTMLElement) {
                threadPanel.dataset.dropLabel = "この条件でディレクトリを見る";
            }
        }
        hovered = sidebarMode === "threads"
            ? document.getElementById("sidebar-mode-threads")
            : document.getElementById("extract-summary-dropzone");
    } else if (
        hoveredNode instanceof HTMLElement &&
        hoveredNode.id === "extract-panel" &&
        bookmarkSelectionDragState &&
        bookmarkSelectionDragState.dragKind === "tag"
    ) {
        hovered = document.getElementById("extract-summary-dropzone");
    }
    if (!hovered) {
        if (bookmarkSelectionDragState) {
            bookmarkSelectionDragState.hoverKind = "";
            bookmarkSelectionDragState.hoverTagId = "";
            bookmarkSelectionDragState.hoverTagGroupKey = "";
            bookmarkSelectionDragState.hoverDirectoryConvIdx = "";
            bookmarkSelectionDragState.hoverDirectoryMsgIdx = "";
        }
        return;
    }
    if (bookmarkSelectionDragState) {
        const hoverKind = String(
            hovered.dataset.bookmarkDropzoneKind || hovered.dataset.directoryDropKind || hovered.dataset.extractDropKind || hovered.dataset.sidebarDropKind || ""
        );
        const hoverTagId = String(hovered.dataset.bookmarkTagId || "");
        const hoverTagGroupKey = String(hovered.dataset.bookmarkTagGroupKey || "");
        const hoverDirectoryConvIdx = String(hovered.dataset.directoryConvIdx || "");
        const hoverDirectoryMsgIdx = String(hovered.dataset.directoryMsgIdx || "");
        if (isValidBookmarkDropTarget(bookmarkSelectionDragState.dragKind, hoverKind)) {
            hovered.classList.add("is-drag-over");
            if (hoverKind === "extract-summary" && hovered instanceof HTMLElement) {
                hovered.dataset.dropLabel = bookmarkSelectionDragState.dragKind === "recent-filter"
                    ? "履歴を適用"
                    : "Tag を追加";
            } else if (hoverKind === "directory-mode" && hovered instanceof HTMLElement) {
                hovered.dataset.dropLabel = "この条件でディレクトリを見る";
            } else if (hoverKind === "remove-tag" && hovered instanceof HTMLElement) {
                hovered.dataset.dropLabel = bookmarkSelectionDragState.dragKind === "tag"
                    ? "タグを解除"
                    : "ここにドロップでタグ解除";
            } else if (hovered instanceof HTMLElement && bookmarkSelectionDragState.dragKind === "tag") {
                if (hoverKind === "assign-tag" && hoverTagId && hoverTagId !== String(bookmarkSelectionDragState.tagId || "")) {
                    hovered.dataset.dropLabel = "結合 作成";
                } else if (hoverKind === "compound-tag-group" && hoverTagGroupKey) {
                    hovered.dataset.dropLabel = "結合 追加";
                }
            }
            bookmarkSelectionDragState.hoverKind = hoverKind;
            bookmarkSelectionDragState.hoverTagId = hoverTagId;
            bookmarkSelectionDragState.hoverTagGroupKey = hoverTagGroupKey;
            bookmarkSelectionDragState.hoverDirectoryConvIdx = hoverDirectoryConvIdx;
            bookmarkSelectionDragState.hoverDirectoryMsgIdx = hoverDirectoryMsgIdx;
        } else {
            bookmarkSelectionDragState.hoverKind = "";
            bookmarkSelectionDragState.hoverTagId = "";
            bookmarkSelectionDragState.hoverTagGroupKey = "";
            bookmarkSelectionDragState.hoverDirectoryConvIdx = "";
            bookmarkSelectionDragState.hoverDirectoryMsgIdx = "";
        }
    }
}

function handleBookmarkSelectionPointerMove(event) {
    if (!bookmarkSelectionDragState) return;
    const pointerX = event?.clientX ?? 0;
    const pointerY = event?.clientY ?? 0;
    if (!bookmarkSelectionDragState.active) {
        const dx = pointerX - bookmarkSelectionDragState.startX;
        const dy = pointerY - bookmarkSelectionDragState.startY;
        if (Math.hypot(dx, dy) < BOOKMARK_SELECTION_DRAG_THRESHOLD) {
            return;
        }
        if (bookmarkSelectionDragState.dragKind === "bookmark-selection") {
            setStarredPromptSelection(bookmarkSelectionDragState.selectedKeys, {
                anchorKey: bookmarkSelectionDragState.selectionKey,
            });
            ensureBookmarkSelectionDragGhost(`${bookmarkSelectionDragState.selectedKeys.length}件のprompt`);
        } else if (bookmarkSelectionDragState.dragKind === "directory-prompt-selection") {
            setDirectoryPromptSelection(bookmarkSelectionDragState.selectedKeys, {
                anchorKey: bookmarkSelectionDragState.selectionKey,
            });
            ensureBookmarkSelectionDragGhost(`${bookmarkSelectionDragState.selectedKeys.length}件のprompt`);
        } else if (bookmarkSelectionDragState.dragKind === "directory-folder") {
            ensureBookmarkSelectionDragGhost("このフォルダのprompt");
        } else if (bookmarkSelectionDragState.dragKind === "recent-filter") {
            ensureBookmarkSelectionDragGhost(`履歴「${bookmarkSelectionDragState.filterLabel || ""}」`);
        } else if (bookmarkSelectionDragState.dragKind === "tag-remove-tool") {
            ensureBookmarkSelectionDragGhost("タグ解除");
        } else {
            ensureBookmarkSelectionDragGhost(`タグ「${bookmarkSelectionDragState.tagName || ""}」`);
        }
        bookmarkSelectionDragState.active = true;
        document.body.classList.add("bookmark-dragging");
    }
    if (bookmarkSelectionDragGhostEl) {
        bookmarkSelectionDragGhostEl.style.transform = `translate(${pointerX + 16}px, ${pointerY + 16}px)`;
    }
    updateBookmarkSelectionDropTarget(pointerX, pointerY);
    event?.preventDefault?.();
}

async function handleBookmarkSelectionPointerUp(event) {
    if (!bookmarkSelectionDragState) return;
    const dragState = {
        ...bookmarkSelectionDragState,
        selectedKeys: Array.isArray(bookmarkSelectionDragState.selectedKeys)
            ? bookmarkSelectionDragState.selectedKeys.slice()
            : [],
    };
    const wasActive = Boolean(bookmarkSelectionDragState.active);
    const dragKind = bookmarkSelectionDragState.dragKind;
    const dragTagId = bookmarkSelectionDragState.tagId;
    const filterIdsSnapshot = Array.isArray(bookmarkSelectionDragState.filterIdsSnapshot)
        ? bookmarkSelectionDragState.filterIdsSnapshot.slice()
        : [];
    const hoverKind = bookmarkSelectionDragState.hoverKind;
    const hoverTagId = bookmarkSelectionDragState.hoverTagId;
    const hoverTagGroupKey = bookmarkSelectionDragState.hoverTagGroupKey;
    const hoverDirectoryConvIdx = Number.parseInt(bookmarkSelectionDragState.hoverDirectoryConvIdx || "", 10);
    const hoverDirectoryMsgIdx = Number.parseInt(bookmarkSelectionDragState.hoverDirectoryMsgIdx || "", 10);
    finishStarredPromptDrag(event);
    if (!wasActive) return;
    bookmarkSelectionSuppressClickUntil = Date.now() + 900;
    bookmarkTagFilterClickSuppressUntil = Date.now() + 900;
    if (dragKind === "bookmark-selection" && hoverKind === "assign-tag" && hoverTagId) {
        await applySelectedBookmarksToTag(hoverTagId);
        restoreBookmarkTagFilters(filterIdsSnapshot);
        if (getActiveTab()?.type === "manager" && getActiveTab()?.kind === "starred_prompts") {
            renderActiveTab();
        }
        return;
    }
    if (dragKind === "bookmark-selection" && hoverKind === "remove-tag") {
        await removeAllTagsFromSelectedBookmarks();
        restoreBookmarkTagFilters(filterIdsSnapshot);
        if (getActiveTab()?.type === "manager" && getActiveTab()?.kind === "starred_prompts") {
            renderActiveTab();
        }
        return;
    }
    if (dragKind === "tag" && hoverKind === "remove-tag") {
        await removeDraggedTagFromSelectedBookmarks(dragTagId || hoverTagId);
        restoreBookmarkTagFilters(filterIdsSnapshot);
        if (getActiveTab()?.type === "manager" && getActiveTab()?.kind === "starred_prompts") {
            renderActiveTab();
        }
        return;
    }
    if (dragKind === "tag" && hoverKind === "assign-tag" && hoverTagId && hoverTagId !== dragTagId) {
        const combinedIds = new Set([String(dragTagId || "").trim(), String(hoverTagId || "").trim()]);
        const dragGroup = getSelectedExtractBookmarkTagGroupByTagId(dragTagId);
        const hoverGroup = getSelectedExtractBookmarkTagGroupByTagId(hoverTagId);
        (dragGroup?.tagIds || []).forEach((tagId) => combinedIds.add(String(tagId)));
        (hoverGroup?.tagIds || []).forEach((tagId) => combinedIds.add(String(tagId)));
        createBookmarkTagGroupFromTagIds(Array.from(combinedIds));
        return;
    }
    if (dragKind === "tag" && hoverKind === "compound-tag-group" && hoverTagGroupKey) {
        const targetGroup = getBookmarkTagGroupEntries().find((group) => group.id === String(hoverTagGroupKey || ""));
        if (targetGroup) {
            createBookmarkTagGroupFromTagIds([...targetGroup.tagIds, dragTagId]);
        }
        return;
    }
    if (dragKind === "tag" && hoverKind === "extract-summary") {
        addTagToExtractFilters(dragTagId);
        if (getActiveTab()?.type === "manager" && getActiveTab()?.kind === "starred_prompts") {
            renderActiveTab();
        }
        return;
    }
    if (dragKind === "recent-filter" && hoverKind === "extract-summary") {
        applyRecentFilterPayloadToExtractSummary(dragState.filterPayload || "");
        return;
    }
    if (dragKind === "recent-filter" && hoverKind === "directory-mode") {
        await applyStoredFilterToDirectory(dragState.filterPayload || "");
        showToast("履歴の条件でディレクトリを絞り込んだよ");
        return;
    }
    if (dragKind === "tag" && hoverKind === "directory-prompt" && Number.isInteger(hoverDirectoryConvIdx) && Number.isInteger(hoverDirectoryMsgIdx)) {
        await applyTagToDirectoryPrompt(dragTagId, hoverDirectoryConvIdx, hoverDirectoryMsgIdx);
        restoreBookmarkTagFilters(filterIdsSnapshot);
        return;
    }
    if (dragKind === "tag" && hoverKind === "directory-folder" && Number.isInteger(hoverDirectoryConvIdx)) {
        await applyTagToDirectoryFolder(dragTagId, hoverDirectoryConvIdx);
        restoreBookmarkTagFilters(filterIdsSnapshot);
        return;
    }
    if (dragKind === "tag-remove-tool" && hoverKind === "directory-prompt" && Number.isInteger(hoverDirectoryConvIdx) && Number.isInteger(hoverDirectoryMsgIdx)) {
        await removeTagsFromDirectoryPrompt(hoverDirectoryConvIdx, hoverDirectoryMsgIdx);
        restoreBookmarkTagFilters(filterIdsSnapshot);
        return;
    }
    if (dragKind === "tag-remove-tool" && hoverKind === "directory-folder" && Number.isInteger(hoverDirectoryConvIdx)) {
        await removeTagsFromDirectoryFolder(hoverDirectoryConvIdx);
        restoreBookmarkTagFilters(filterIdsSnapshot);
        return;
    }
    if (
        (dragKind === "directory-prompt-selection" || dragKind === "directory-folder") &&
        hoverKind === "assign-tag" &&
        hoverTagId
    ) {
        const entries = await resolveDirectoryPromptDragEntries(dragState);
        await applyTagToPromptEntries(
            hoverTagId,
            entries,
            getBookmarkWorkspaceScopeLabel(entries, dragKind === "directory-folder" ? "このフォルダ" : "選択中")
        );
        restoreBookmarkTagFilters(filterIdsSnapshot);
        if (getActiveTab()?.type === "manager" && getActiveTab()?.kind === "starred_prompts") {
            renderActiveTab();
        }
        return;
    }
    if (
        (dragKind === "directory-prompt-selection" || dragKind === "directory-folder") &&
        hoverKind === "remove-tag"
    ) {
        const entries = await resolveDirectoryPromptDragEntries(dragState);
        await removeTagsFromPromptEntries(
            entries,
            getBookmarkWorkspaceScopeLabel(entries, dragKind === "directory-folder" ? "このフォルダ" : "選択中")
        );
        restoreBookmarkTagFilters(filterIdsSnapshot);
        if (getActiveTab()?.type === "manager" && getActiveTab()?.kind === "starred_prompts") {
            renderActiveTab();
        }
    }
}

function ensureBookmarkSelectionDragInteractions() {
    if (bookmarkSelectionDragBound) return;
    bookmarkSelectionDragBound = true;
    document.addEventListener("pointermove", (event) => {
        void handleBookmarkSelectionPointerMove(event);
    });
    document.addEventListener("pointerup", (event) => {
        void handleBookmarkSelectionPointerUp(event);
    });
    document.addEventListener("pointercancel", (event) => {
        finishStarredPromptDrag(event);
    });
    window.addEventListener("blur", () => {
        finishStarredPromptDrag();
    });
}

async function applySelectedBookmarksToTag(tagId) {
    const tag = getBookmarkTagById(tagId);
    const targets = buildSelectedStarredPromptTargets();
    if (!tag || !targets.length) {
        showToast("先に prompt を選んでね");
        return;
    }
    const result = await requestBookmarkTagMembership(tag.id, targets, true);
    if ((result?.affected || 0) > 0) {
        pushBookmarkUndoAction({
            type: "tag-membership",
            tagId: String(tag.id),
            tagName: tag.name || "",
            targets,
            assigned: true,
        });
    }
    await refreshBookmarkTags();
    await refreshStarredPrompts();
    if ((result?.affected || 0) <= 0) {
        showToast(`タグ「${tag.name}」はもう全部についてるよ`);
        return;
    }
    showToast(`タグ「${tag.name}」を ${result?.affected || 0} 件に付けたよ`);
}

async function resolveDirectoryPromptEntry(convIdx, messageIndex) {
    if (!Number.isInteger(convIdx) || convIdx < 0 || !Number.isInteger(messageIndex) || messageIndex < 0) {
        return null;
    }
    const conv = await loadConversationDetail(convIdx).catch(() => null);
    const message = conv?.messages?.[messageIndex];
    if (!conv?.id || message?.role !== "user") {
        return null;
    }
    const bookmarkTarget = buildPromptBookmarkTargetSpec(conv, messageIndex, message.text || "");
    let currentState = getCachedBookmarkState(bookmarkTarget);
    if (!currentState) {
        await requestBookmarkStates([bookmarkTarget]);
        currentState = getCachedBookmarkState(bookmarkTarget);
    }
    return {
        selectionKey: buildDirectoryPromptSelectionKey(conv.id, messageIndex),
        conv,
        convIdx,
        messageIndex,
        bookmarkTarget,
        currentState,
    };
}

async function ensurePromptEntriesBookmarked(entries) {
    const entriesNeedingBookmark = (Array.isArray(entries) ? entries : []).filter(
        (entry) => !Boolean(entry?.currentState?.bookmarked)
    );
    if (!entriesNeedingBookmark.length) {
        return;
    }
    await applyPromptBookmarkState(entriesNeedingBookmark, true);
}

async function applyTagToPromptEntries(tagId, entries, scopeLabel) {
    const tag = getBookmarkTagById(tagId);
    const normalizedEntries = (Array.isArray(entries) ? entries : []).filter(Boolean);
    if (!tag || !normalizedEntries.length) {
        showToast("タグ付けできる対象がないよ");
        return;
    }
    await ensurePromptEntriesBookmarked(normalizedEntries);
    const targets = normalizedEntries.map((entry) => entry.bookmarkTarget);
    const result = await requestBookmarkTagMembership(tag.id, targets, true);
    if ((result?.affected || 0) > 0) {
        pushBookmarkUndoAction({
            type: "tag-membership",
            tagId: String(tag.id),
            tagName: tag.name || "",
            targets,
            assigned: true,
        });
    }
    await refreshBookmarkTags();
    await refreshStarredPrompts();
    renderTree();
    if ((result?.affected || 0) <= 0) {
        showToast(`${scopeLabel}にはもうタグ「${tag.name}」がついてるよ`);
        return;
    }
    showToast(`${scopeLabel}にタグ「${tag.name}」を付けたよ`);
}

async function applyTagToDirectoryPrompt(tagId, convIdx, messageIndex) {
    const entry = await resolveDirectoryPromptEntry(convIdx, messageIndex);
    if (!entry) {
        showToast("この prompt には付けられなかったよ");
        return;
    }
    await applyTagToPromptEntries(tagId, [entry], "この prompt");
}

async function applyTagToDirectoryFolder(tagId, convIdx) {
    const entries = await resolveVisibleConversationPromptEntries(convIdx);
    if (!entries.length) {
        showToast("このフォルダに対象の prompt はないよ");
        return;
    }
    await applyTagToPromptEntries(tagId, entries, `このフォルダの ${entries.length} 件`);
}

async function removeDraggedTagFromSelectedBookmarks(tagId) {
    const tag = getBookmarkTagById(tagId);
    const targets = buildSelectedStarredPromptTargets();
    if (!tag || !targets.length) {
        showToast("先に prompt を選んでね");
        return;
    }
    const result = await requestBookmarkTagMembership(tag.id, targets, false);
    if ((result?.affected || 0) > 0) {
        pushBookmarkUndoAction({
            type: "tag-membership",
            tagId: String(tag.id),
            tagName: tag.name || "",
            targets,
            assigned: false,
        });
    }
    await refreshBookmarkTags();
    await refreshStarredPrompts();
    if ((result?.affected || 0) <= 0) {
        showToast(`選択中にはタグ「${tag.name}」がついていないよ`);
        return;
    }
    showToast(`タグ「${tag.name}」を ${result?.affected || 0} 件から外したよ`);
}

async function removeTagsFromPromptEntries(entries, scopeLabel) {
    const normalizedEntries = (Array.isArray(entries) ? entries : []).filter(Boolean);
    if (!normalizedEntries.length) {
        showToast("タグ解除できる対象がないよ");
        return;
    }
    const targets = normalizedEntries.map((entry) => entry.bookmarkTarget);
    const tagSummaries = [];
    normalizedEntries.forEach((entry) => {
        const entryState = (starredPromptEntries || []).find(
            (item) => String(item.targetId || "") === String(entry.bookmarkTarget.targetId || "")
        );
        (Array.isArray(entryState?.tags) ? entryState.tags : []).forEach((tag) => {
            const nextTagId = String(tag?.id || "").trim();
            if (!nextTagId || tagSummaries.some((item) => item.tagId === nextTagId)) {
                return;
            }
            tagSummaries.push({
                tagId: nextTagId,
                tagName: tag?.name || "",
            });
        });
    });
    if (!tagSummaries.length) {
        showToast(`${scopeLabel}に外せるタグはないよ`);
        return;
    }

    const undoItems = [];
    for (const summary of tagSummaries) {
        const result = await requestBookmarkTagMembership(summary.tagId, targets, false);
        if ((result?.affected || 0) > 0) {
            undoItems.push({
                tagId: summary.tagId,
                tagName: summary.tagName,
                targets,
                assigned: false,
            });
        }
    }

    await refreshBookmarkTags();
    await refreshStarredPrompts();
    renderTree();
    if (!undoItems.length) {
        showToast(`${scopeLabel}に外せるタグはないよ`);
        return;
    }
    pushBookmarkUndoAction({
        type: "tag-membership-batch",
        items: undoItems,
    });
    showToast(`${scopeLabel}のタグを外したよ`);
}

async function removeAllTagsFromSelectedBookmarks() {
    const targets = buildSelectedStarredPromptTargets();
    const tagSummaries = getSelectedStarredPromptTagSummaries();
    if (!targets.length) {
        showToast("先に prompt を選んでね");
        return;
    }
    if (!tagSummaries.length) {
        showToast("選択中に外せるタグはないよ");
        return;
    }

    const undoItems = [];
    let affectedTotal = 0;
    for (const summary of tagSummaries) {
        const result = await requestBookmarkTagMembership(summary.tagId, targets, false);
        if ((result?.affected || 0) > 0) {
            undoItems.push({
                tagId: String(summary.tagId),
                tagName: summary.tagName || "",
                targets,
                assigned: false,
            });
            affectedTotal += result.affected || 0;
        }
    }

    await refreshBookmarkTags();
    await refreshStarredPrompts();
    if (!undoItems.length) {
        showToast("選択中に外せるタグはないよ");
        return;
    }
    pushBookmarkUndoAction({
        type: "tag-membership-batch",
        items: undoItems,
    });
    showToast(`選択中のタグを ${affectedTotal} 件ぶん外したよ`);
}

async function removeTagsFromDirectoryPrompt(convIdx, messageIndex) {
    const entry = await resolveDirectoryPromptEntry(convIdx, messageIndex);
    if (!entry) {
        showToast("この prompt には外せるタグがないよ");
        return;
    }
    await removeTagsFromPromptEntries([entry], "この prompt");
}

async function removeTagsFromDirectoryFolder(convIdx) {
    const entries = await resolveVisibleConversationPromptEntries(convIdx);
    if (!entries.length) {
        showToast("このフォルダに対象の prompt はないよ");
        return;
    }
    await removeTagsFromPromptEntries(entries, `このフォルダの ${entries.length} 件`);
}

function toggleBookmarkTagFilter(tagId, event) {
    if (
        Date.now() < bookmarkSelectionSuppressClickUntil ||
        Date.now() < bookmarkTagFilterClickSuppressUntil
    ) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        return;
    }
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const normalizedTagId = String(tagId || "").trim();
    if (!normalizedTagId) return;
    const tag = getBookmarkTagById(normalizedTagId);
    if (!tag) return;
    toggleExtractBookmarkTag(String(tag.name || "").trim(), event);
    if (getActiveTab()?.type === "manager" && getActiveTab()?.kind === "starred_prompts") {
        renderActiveTab();
    }
}

function clearBookmarkTagFilters(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!selectedBookmarkTagFilterIds.length && !getSelectedExtractBookmarkTagGroups().length) return;
    writeExtractMultiValue("extract-bookmark-tags", []);
    writeExtractGroupValue("extract-bookmark-tag-groups", []);
    renderExtractBookmarkTagMenu();
    syncExtractBookmarkTagTrigger();
    syncBookmarkWorkspaceFiltersFromExtract();
    scheduleVirtualThreadPreview();
    if (getActiveTab()?.type === "manager" && getActiveTab()?.kind === "starred_prompts") {
        renderActiveTab();
    }
}

function handleBookmarkTagCreateKeydown(event) {
    if (event?.key !== "Enter") return;
    event.preventDefault();
    createBookmarkTagFromInput();
}

async function createBookmarkTagFromInput() {
    const input = document.getElementById("bookmark-tag-name-input");
    const name = String(input?.value || "").trim();
    if (!name) {
        showToast("タグ名を入れてね");
        return;
    }
    const created = await requestCreateBookmarkTag(name);
    if (!created?.id) {
        showToast("タグを作れなかったよ");
        return;
    }
    if (input) {
        input.value = "";
    }
    pushBookmarkUndoAction({
        type: "tag-create",
        tagId: String(created.id),
        tagName: created.name || name,
    });
    await refreshBookmarkTags();
    showToast(`タグ「${created.name}」を作ったよ`);
}

function pushBookmarkUndoAction(action) {
    if (!action || typeof action !== "object") return;
    bookmarkUndoStack.push(action);
    if (bookmarkUndoStack.length > BOOKMARK_UNDO_LIMIT) {
        bookmarkUndoStack.shift();
    }
}

function refreshBookmarkPromptChrome() {
    renderTree();
    refreshCurrentTabStrip();
    const activeTab = getActiveTab();
    if (activeTab?.type === "conversation") {
        renderChat(activeTab.convIdx, { preserveTabStripScroll: true });
    } else if (activeTab) {
        renderActiveTab();
    }
    if (isSidebarFilterActive) {
        refreshDirectoryFromExtractFilters(true).catch(() => {});
    }
}

async function undoLastBookmarkAction() {
    const action = bookmarkUndoStack.pop();
    if (!action) {
        showToast("戻せるマーク操作はまだないよ");
        return;
    }
    if (action.type === "bookmark-state") {
        const conversationDeltas = new Map();
        await Promise.all(
            (action.items || []).map(async (item) => {
                const target = normalizeBookmarkTargetSpec(item.target);
                await requestBookmarkChange(target, Boolean(item.beforeBookmarked));
                const delta = (item.beforeBookmarked ? 1 : 0) - (item.afterBookmarked ? 1 : 0);
                if (delta && item.parentConversationId) {
                    conversationDeltas.set(
                        item.parentConversationId,
                        (conversationDeltas.get(item.parentConversationId) || 0) + delta
                    );
                }
            })
        );
        conversationDeltas.forEach((delta, convId) => {
            updateConversationStarredPromptCount(convId, delta);
        });
        refreshBookmarkPromptChrome();
        await refreshStarredPrompts();
        showToast("マーク操作を元に戻したよ");
        return;
    }
    if (action.type === "tag-membership") {
        await requestBookmarkTagMembership(action.tagId, action.targets || [], !action.assigned);
        await refreshBookmarkTags();
        await refreshStarredPrompts();
        showToast(`タグ「${action.tagName || ""}」の操作を元に戻したよ`);
        return;
    }
    if (action.type === "tag-membership-batch") {
        for (const item of action.items || []) {
            await requestBookmarkTagMembership(item.tagId, item.targets || [], !item.assigned);
        }
        await refreshBookmarkTags();
        await refreshStarredPrompts();
        showToast("タグ解除の操作を元に戻したよ");
        return;
    }
    if (action.type === "tag-create") {
        const result = await requestDeleteBookmarkTag(action.tagId);
        await refreshBookmarkTags();
        if ((result?.deleted || 0) > 0) {
            showToast(`タグ「${action.tagName || ""}」の作成を取り消したよ`);
        } else {
            showToast("タグ作成の取り消しはできなかったよ");
        }
    }
}

async function applyStarredPromptBookmarkState(entries, nextBookmarked) {
    const normalizedEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
    if (!normalizedEntries.length) return;
    const conversationDeltas = new Map();
    const changedItems = [];
    let didChange = false;
    await Promise.all(
        normalizedEntries.map(async (entry) => {
            const bookmarkTarget = buildBookmarkTargetSpec(entry.targetType, entry.targetId, entry.payload || {});
            const previousBookmarked = entry.bookmarked !== false;
            if (previousBookmarked === Boolean(nextBookmarked)) return;
            const result = await requestBookmarkChange(bookmarkTarget, nextBookmarked);
            const finalBookmarked = Boolean(result?.bookmarked);
            entry.bookmarked = finalBookmarked;
            const delta = (finalBookmarked ? 1 : 0) - (previousBookmarked ? 1 : 0);
            if (!delta) return;
            didChange = true;
            changedItems.push({
                target: bookmarkTarget,
                beforeBookmarked: previousBookmarked,
                afterBookmarked: finalBookmarked,
                parentConversationId: entry.parentConversationId || "",
            });
            if (entry.parentConversationId) {
                conversationDeltas.set(
                    entry.parentConversationId,
                    (conversationDeltas.get(entry.parentConversationId) || 0) + delta
                );
            }
        })
    );
    conversationDeltas.forEach((delta, convId) => {
        updateConversationStarredPromptCount(convId, delta);
    });
    if (didChange) {
        pushBookmarkUndoAction({
            type: "bookmark-state",
            items: changedItems,
        });
        renderTree();
        refreshCurrentTabStrip();
        if (isSidebarFilterActive) {
            refreshDirectoryFromExtractFilters(true).catch(() => {});
        }
    }
    if (getActiveTab()?.type === "manager" && getActiveTab()?.kind === "starred_prompts") {
        renderActiveTab();
    } else {
        syncStarredPromptSelectionClasses();
    }
}

async function bulkSetSelectedStarredPrompts(nextBookmarked) {
    const selectedEntries = getSelectedStarredPromptEntries();
    if (!selectedEntries.length) return;
    await applyStarredPromptBookmarkState(selectedEntries, nextBookmarked);
}

async function refreshSavedViews() {
    await refreshStarredFilters();
}

function parseSavedFilterPayload(payload) {
    try {
        const parsed = JSON.parse(decodeURIComponent(payload));
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
        return {};
    }
}

function loadStoredFilterIntoExtractPanel(payload) {
    setVirtualThreadFilters(parseSavedFilterPayload(payload));
    switchSidebarMode("extract");
}

function reuseSavedFilter(payload) {
    loadStoredFilterIntoExtractPanel(payload);
}

async function saveRecentFilterAsStarred(payload, options = {}) {
    const filters = parseSavedFilterPayload(payload);
    if (!hasActiveExtractFilters(filters)) {
        showToast("条件を入れてから保存してね");
        return;
    }
    const matchingRecentEntry = (recentExtractFilters || []).find(
        (entry) => serializeFilterPayload(entry.filters || {}) === serializeFilterPayload(filters)
    );
    const normalizedName = String(
        matchingRecentEntry?.label || buildSavedViewDraftName(filters) || "Starred Filter"
    ).trim();
    if (!normalizedName) {
        showToast("保存名を作れなかったよ");
        return;
    }
    const saved = await saveStarredFilterEntry(normalizedName, filters);
    if (!saved) {
        showToast("Starred Filter を保存できなかったよ");
        return;
    }
    await refreshStarredFilters();
    showToast(`Starred Filter saved: ${normalizedName}`);
    if (options.openManagerTab !== false) {
        openManagerTab("starred_filters");
    }
}

async function toggleRecentFilterStarByPayload(payload, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const filters = parseSavedFilterPayload(payload);
    const matchingStarredFilter = findMatchingStarredFilter(filters);
    if (matchingStarredFilter) {
        const deleted = await deleteStarredFilterEntry(matchingStarredFilter.id);
        if (!deleted?.deleted) {
            showToast("保存したフィルタを外せなかったよ");
            return;
        }
        await refreshStarredFilters();
        renderRecentFilters();
        if (getActiveTab()?.type === "manager" && getActiveTab()?.kind === "recent_filters") {
            renderActiveTab();
        }
        showToast("保存を外したよ");
        return;
    }
    await saveRecentFilterAsStarred(payload, { openManagerTab: false });
    renderRecentFilters();
    if (getActiveTab()?.type === "manager" && getActiveTab()?.kind === "recent_filters") {
        renderActiveTab();
    }
}

function buildSavedViewDraftName(filters) {
    const nextFilters = filters || {};
    if (String(nextFilters.titleContains || "").trim()) {
        return `title: ${String(nextFilters.titleContains).trim()}`;
    }
    if (String(nextFilters.promptContains || "").trim()) {
        return `prompt: ${String(nextFilters.promptContains).trim()}`;
    }
    if (String(nextFilters.responseContains || "").trim()) {
        return `response: ${String(nextFilters.responseContains).trim()}`;
    }
    if (Array.isArray(nextFilters.service) && nextFilters.service.length > 0) {
        return `service: ${formatExtractServiceLabel(nextFilters.service[0])}`;
    }
    if (Array.isArray(nextFilters.model) && nextFilters.model.length > 0) {
        return `model: ${nextFilters.model[0]}`;
    }
    if (Array.isArray(nextFilters.bookmarkTags) && nextFilters.bookmarkTags.length > 0) {
        return `tag: ${nextFilters.bookmarkTags[0]}`;
    }
    if (Array.isArray(nextFilters.bookmarkTagGroups) && nextFilters.bookmarkTagGroups.length > 0) {
        return `tag: ${normalizeBookmarkTagNameGroup(nextFilters.bookmarkTagGroups[0]).join(" & ")}`;
    }
    if (String(nextFilters.dateFrom || "").trim() || String(nextFilters.dateTo || "").trim()) {
        return `${nextFilters.dateFrom || "..."} -> ${nextFilters.dateTo || "..."}`;
    }
    if (normalizeBookmarkedFilterValue(nextFilters.bookmarked) === "bookmarked") {
        return "has starred prompt";
    }
    return "Starred Filter";
}

async function saveCurrentSavedView() {
    const filters = getExtractFilterState();
    if (!hasActiveExtractFilters(filters)) {
        showToast("条件を入れてから保存してね");
        return;
    }
    const suggestedName = buildSavedViewDraftName(filters);
    const enteredName = window.prompt("Starred Filter name (same name overwrites)", suggestedName);
    if (enteredName === null) return;
    const normalizedName = String(enteredName || "").trim();
    if (!normalizedName) {
        showToast("名前を入れてね");
        return;
    }
    const saved = await saveStarredFilterEntry(normalizedName, filters);
    if (!saved) {
        showToast("Starred Filter を保存できなかったよ");
        return;
    }
    await refreshStarredFilters();
    showToast(`Starred Filter saved: ${normalizedName}`);
    openManagerTab("starred_filters");
}

async function deleteSavedViewById(savedViewId) {
    const entry = (starredExtractFilters || []).find((item) => String(item.id) === String(savedViewId));
    if (!entry) return;
    const confirmed = window.confirm(`Delete starred filter "${entry.name || entry.label || "Starred Filter"}"?`);
    if (!confirmed) return;
    const result = await deleteStarredFilterEntry(savedViewId);
    if (!result || !result.deleted) {
        showToast("Starred Filter を削除できなかったよ");
        return;
    }
    await refreshStarredFilters();
    showToast("Starred Filter deleted");
}

async function deleteStarredFilterById(starredFilterId) {
    await deleteSavedViewById(starredFilterId);
}

function saveCurrentStarredFilter() {
    return saveCurrentSavedView();
}

function jumpToStarredPrompt(convId, messageIndex) {
    const convIdx = getConversationIndexById(convId);
    if (convIdx < 0) return;
    openOriginConversation(convId, messageIndex);
}

async function toggleStarredPromptCard(targetId, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const entry = (starredPromptEntries || []).find((item) => item.targetId === targetId);
    if (!entry) return;
    const selectionKey = getStarredPromptEntrySelectionKey(entry);
    if (event?.shiftKey && selectionKey) {
        selectStarredPromptRange(selectionKey);
    }
    const selectedEntries = selectionKey && selectedStarredPromptKeys.includes(selectionKey)
        ? getSelectedStarredPromptEntries()
        : [];
    if (selectedEntries.length > 1) {
        await applyStarredPromptBookmarkState(selectedEntries, entry.bookmarked === false);
        return;
    }
    await applyStarredPromptBookmarkState([entry], entry.bookmarked === false);
}

function requestFilterOptions() {
    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.fetchFilterOptions) {
            return { services: [], models: [], modelsByService: {}, sourceFiles: [] };
        }
        return new Promise((resolve) => {
            bridge.fetchFilterOptions(function (result) {
                try {
                    resolve(result ? JSON.parse(result) : { services: [], models: [], modelsByService: {}, sourceFiles: [] });
                } catch (_error) {
                    resolve({ services: [], models: [], modelsByService: {}, sourceFiles: [] });
                }
            });
        });
    });
}

function ensureExtractInteractions() {
    if (document.body.dataset.extractInteractionsBound === "true") return;
    document.body.dataset.extractInteractionsBound = "true";

    document.addEventListener("pointerdown", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (!target.closest("#extract-model-picker")) {
            closeExtractModelMenu();
        }
        if (!target.closest("#extract-bookmark-tags-picker")) {
            closeExtractBookmarkTagMenu();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeExtractModelMenu();
            closeExtractBookmarkTagMenu();
        }
    });
}

function populateExtractOptions(options) {
    extractFilterOptions = options || { services: [], models: [], modelsByService: {}, sourceFiles: [] };

    const serviceButtons = document.getElementById("extract-service-buttons");
    if (serviceButtons) {
        serviceButtons.innerHTML = (extractFilterOptions.services || [])
            .map((service) => {
                const normalizedService = String(service || "").trim().toLowerCase();
                const serviceClass = normalizedService ? ` source-label-${escapeHTML(normalizedService)}` : "";
                return `<button class="extract-service-btn${serviceClass}" type="button" data-value="${escapeHTML(service)}" onclick="setExtractService('${escapeJsString(service)}', event)">${escapeHTML(formatExtractServiceLabel(service))}</button>`;
            })
            .join("");
        syncExtractServiceButtons();
    }
    renderExtractModelMenu();
    syncExtractModelTrigger();
    renderExtractBookmarkTagMenu();
    syncExtractBookmarkTagTrigger();
    syncExtractSortButton();

    const sourceFileDatalist = document.getElementById("extract-source-file-options");
    if (sourceFileDatalist) {
        sourceFileDatalist.innerHTML = (extractFilterOptions.sourceFiles || [])
            .map((file) => `<option value="${escapeHTML(file)}"></option>`)
            .join("");
    }
}

function requestVirtualThread(filters) {
    // Current extract result path. Kept as a separate bridge request so Phase 2 can
    // add named/saved views without changing how the viewer asks for derived results.
    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.buildVirtualThread) {
            throw new Error("Virtual thread bridge is not available");
        }
        return new Promise((resolve, reject) => {
            bridge.buildVirtualThread(JSON.stringify(filters), function (result) {
                try {
                    resolve(result ? JSON.parse(result) : null);
                } catch (error) {
                    reject(error);
                }
            });
        });
    });
}

function requestVirtualThreadPreview(filters) {
    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.buildVirtualThreadPreview) {
            return requestVirtualThread(filters).then((virtualThread) => ({
                itemCount: virtualThread?.itemCount || 0,
                conversationIds: Array.from(
                    new Set((virtualThread?.items || []).map((item) => item.convId).filter(Boolean))
                ),
            }));
        }
        return new Promise((resolve, reject) => {
            bridge.buildVirtualThreadPreview(JSON.stringify(filters), function (result) {
                try {
                    resolve(result ? JSON.parse(result) : null);
                } catch (error) {
                    reject(error);
                }
            });
        });
    });
}

function hasActiveExtractFilters(filters) {
    if (!filters) return false;
    return Boolean(
        (filters.service && filters.service.length) ||
        (filters.model && filters.model.length) ||
        (filters.bookmarkTags && filters.bookmarkTags.length) ||
        (filters.bookmarkTagGroups && filters.bookmarkTagGroups.length) ||
        EXTRACT_TEXT_FILTER_SPECS.some(({ key }) => String(filters[key] || "").trim()) ||
        normalizeBookmarkedFilterValue(filters.bookmarked) !== "all"
    );
}

function hasActiveVirtualFilters(filters) {
    return hasActiveExtractFilters(filters);
}

function syncExtractFiltersToDirectory(previewResult, filters) {
    if (!isSidebarFilterActive || !hasActiveExtractFilters(filters)) {
        appliedExtractConversationIds = null;
    } else {
        const convIds = Array.from(
            new Set((previewResult?.conversationIds || []).filter(Boolean))
        );
        appliedExtractConversationIds = new Set(convIds);
    }
    markTreeStructureDirty();
    renderTree();
}

function updateExtractPreviewCount(previewResult) {
    const countNode = document.getElementById("extract-hit-count");
    if (countNode) {
        countNode.textContent = String(previewResult?.itemCount || 0);
    }
}

async function requestExtractPreviewResult(filters, options = {}) {
    const previewStartedAt = window.performance?.now?.() ?? Date.now();
    const previewResult = await requestVirtualThreadPreview(filters);
    if (options.requestId !== extractPreviewRequestId) {
        return null;
    }
    if (options.updateCount) {
        updateExtractPreviewCount(previewResult);
    }
    if (options.syncDirectory) {
        syncExtractFiltersToDirectory(previewResult, filters);
    }
    const previewElapsed = (window.performance?.now?.() ?? Date.now()) - previewStartedAt;
    if (previewElapsed >= 120) {
        console.log(`[perf] extractPreview ${Math.round(previewElapsed)}ms`);
    }
    return previewResult;
}

async function refreshDirectoryFromExtractFilters(forceImmediate = false) {
    void forceImmediate;
    const filters = getExtractFilterState();
    const requestId = ++extractPreviewRequestId;

    if (!isSidebarFilterActive || !hasActiveExtractFilters(filters)) {
        syncExtractFiltersToDirectory(null, filters);
        return;
    }

    const previewResult = await requestExtractPreviewResult(filters, {
        requestId,
        syncDirectory: true,
        updateCount: false,
    });
    if (!previewResult) {
        return;
    }
}

function scheduleVirtualThreadPreview() {
    const filters = getExtractFilterState();
    renderActiveFilterSummary(filters);
    if (extractPreviewTimer) {
        window.clearTimeout(extractPreviewTimer);
    }
    extractPreviewTimer = window.setTimeout(async () => {
        const requestId = ++extractPreviewRequestId;
        await requestExtractPreviewResult(filters, {
            requestId,
            syncDirectory: true,
            updateCount: true,
        });
    }, 180);
}

function clearVirtualThreadFilters() {
    EXTRACT_TEXT_FILTER_SPECS.forEach(({ elementId }) => {
        const element = document.getElementById(elementId);
        if (element) element.value = "";
    });
    [
        "extract-bookmarked",
        "extract-sort",
    ].forEach((id) => {
        const element = document.getElementById(id);
        if (element) {
            element.value = id === "extract-bookmarked" ? "all" : "date-asc";
        }
    });
    writeExtractMultiValue("extract-service", []);
    writeExtractMultiValue("extract-model", []);
    writeExtractMultiValue("extract-bookmark-tags", []);
    writeExtractGroupValue("extract-bookmark-tag-groups", []);
    appliedExtractConversationIds = null;
    markTreeStructureDirty();
    syncExtractServiceButtons();
    renderExtractModelMenu();
    syncExtractModelTrigger();
    renderExtractBookmarkTagMenu();
    syncExtractBookmarkTagTrigger();
    syncBookmarkWorkspaceFiltersFromExtract();
    rerenderBookmarkManagerIfActive();
    syncExtractSortButton();
    closeExtractModelMenu();
    closeExtractBookmarkTagMenu();
    scheduleVirtualThreadPreview();
    renderTree();
}

async function openVirtualThreadFromFilters() {
    const filters = getExtractFilterState();
    await saveRecentFilterEntry(filters);
    await refreshRecentFilters();
}

async function applyCurrentFiltersToDirectory() {
    const filters = getExtractFilterState();
    if (!hasActiveExtractFilters(filters)) {
        showToast("条件を入れてから使ってね");
        return;
    }
    await saveRecentFilterEntry(filters);
    await refreshRecentFilters();
    isSidebarFilterActive = true;
    persistSearchPreferences();
    syncSidebarFilterButton();
    switchSidebarMode("threads");
    await refreshDirectoryFromExtractFilters(true);
}

async function openVirtualThreadFromStoredFilter(payload) {
    const filters = parseSavedFilterPayload(payload);
    setVirtualThreadFilters(filters);
    await openVirtualThreadFromFilters();
}

async function applyStoredFilterToDirectory(payload) {
    const filters = parseSavedFilterPayload(payload);
    setVirtualThreadFilters(filters);
    await applyCurrentFiltersToDirectory();
}

async function openVirtualThreadFromSavedFilter(payload) {
    await openVirtualThreadFromStoredFilter(payload);
}

async function applySavedFilterToDirectory(payload) {
    await applyStoredFilterToDirectory(payload);
}

function openStarredFiltersTab() {
    openManagerTab("starred_filters");
}

function openStarredPromptsTab() {
    openManagerTab("starred_prompts");
}

function isBookmarkGroupOpen(groupKey) {
    return bookmarkGroupOpenByKey[groupKey] !== false;
}

function toggleBookmarkGroup(groupKey, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!groupKey) return;
    bookmarkGroupOpenByKey[groupKey] = !isBookmarkGroupOpen(groupKey);
    if (getActiveTab()?.type === "manager" && getActiveTab()?.kind === "starred_prompts") {
        renderActiveTab();
    }
}

function toggleConversationTreeFromBadge(convIdx, event) {
    if (Date.now() < bookmarkSelectionSuppressClickUntil) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        return;
    }
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!Number.isInteger(convIdx) || convIdx < 0 || isAllTreesExpanded) return;
    const isOpen = currentTreeConvIdx === convIdx;
    currentTreeConvIdx = isOpen ? null : convIdx;
    suppressedTreeAutoExpandConvIdx = isOpen ? convIdx : null;
    renderTree();
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
    const renderStartedAt = window.performance?.now?.() ?? Date.now();
    const treeRoot = document.getElementById("index-tree");
    if (!treeRoot) return;
    const shouldRestoreFocusedTreeItem =
        treeRoot.contains(document.activeElement) &&
        document.activeElement !== treeRoot;
    const nextStructureSignature = getTreeStructureSignature();
    if (treeRoot.dataset.structureSignature === nextStructureSignature) {
        syncDirectoryPromptSelectionClasses({ pruneToVisible: true });
        syncSidebarActiveStateToCurrentView({ scroll: false });
        return;
    }
    const sortSelect = document.getElementById("sort-select");
    const directoryFilterState = getDirectoryFilterState();
    const isSearch = directoryFilterState.hasKeywordSearch;

    let targetData = chatData
        .map((conv) => {
            const result = getCurrentConversationResult(conv);
            conv._hits = result.hits || 0;
            return { conv, result };
        })
        .filter((item) => shouldIncludeConversationInDirectory(item.conv, item.result, directoryFilterState))
        .map((item) => item.conv);

    sortConversations(targetData, sortSelect ? sortSelect.value : "date-desc");

    let htmlStr = "";
    targetData.forEach((conv) => {
        const convIdx = conv._idx;
        const result = getCurrentConversationResult(conv);
        const hitBadge = isSearch && result.hits > 0 ? `<span class="hit-badge">${result.hits} Hits</span> ` : "";
        const shouldRenderPromptList = isAllTreesExpanded || currentTreeConvIdx === convIdx;
        const starredPromptCount = Number.isInteger(conv.starredPromptCount) ? conv.starredPromptCount : 0;
        const starBadge = getCountFolderBadgeHtml(
            starredPromptCount,
            getConversationSourceClass(conv),
            "thread-star-badge",
            shouldRenderPromptList ? "スレッドを閉じる" : "スレッドを開く",
            {
                expanded: shouldRenderPromptList,
                interactive: true,
                clickHandler: `toggleConversationTreeFromBadge(${convIdx}, event)`,
            }
        );
        const previewItems = buildPromptPreviews(conv);
        const visiblePreviewItems = getVisibleDirectoryPreviewItems(previewItems, result, directoryFilterState);

        let promptsHtml = "";
        if (shouldRenderPromptList) {
            visiblePreviewItems.forEach((item) => {
                const safeText = escapeHTML(item.preview || "");
                const hasMatch = !isSearch || result.matchedMessageIndexes.includes(item.messageIndex);
                const selectionKey = buildDirectoryPromptSelectionKey(conv.id, item.messageIndex);
                const promptBookmarkTarget = buildPromptBookmarkTargetSpec(
                    conv,
                    item.messageIndex,
                    item.preview || ""
                );
                const promptBookmarkState = getCachedBookmarkState(promptBookmarkTarget);
                promptsHtml += `
                    <div
                        class="prompt-item-row ${hasMatch ? "has-match" : "no-match"}"
                        data-selection-key="${escapeHTML(selectionKey)}"
                        data-directory-drop-kind="directory-prompt"
                        data-directory-conv-idx="${convIdx}"
                        data-directory-msg-idx="${item.messageIndex}"
                    >
                        ${buildPromptSidebarTagIndicatorHtml(
                            Array.isArray(promptBookmarkState?.tags) && promptBookmarkState.tags.length > 0
                        )}
                        <button type="button"
                           class="prompt-item ${hasMatch ? "has-match" : "no-match"}"
                           id="nav-msg-${convIdx}-${item.messageIndex}"
                           tabindex="0"
                           data-item-type="prompt"
                           data-conv-idx="${convIdx}"
                           data-msg-idx="${item.messageIndex}"
                           data-selection-key="${escapeHTML(selectionKey)}"
                           data-focus-key="prompt-${convIdx}-${item.messageIndex}"
                           onpointerdown="armDirectoryPromptDrag(${convIdx}, ${item.messageIndex}, event)"
                           onclick="openPromptFromTree(event, ${convIdx}, ${item.messageIndex})">${safeText}...</button>
                    </div>`;
            });

            if (directoryFilterState.shouldFilterToKeywordMatches && result.titleMatched && result.hits === 0) {
                promptsHtml += `
                    <div class="prompt-item prompt-item-muted">
                        タイトル一致
                    </div>`;
            }

            const hiddenPreviewCount = Math.max((conv.promptCount || 0) - visiblePreviewItems.length, 0);
            const shouldShowMore =
                hiddenPreviewCount > 0 &&
                (!Array.isArray(conv.messages) || conv.messages.length === 0) &&
                !directoryFilterState.shouldFilterToKeywordMatches;
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
                    data-directory-drop-kind="directory-folder"
                    data-directory-conv-idx="${convIdx}"
                    data-focus-key="conv-${convIdx}"
                    onpointerdown="armDirectoryFolderDrag(${convIdx}, event)"
                    onclick="openConversationFromTree(event, ${convIdx})"><span class="thread-title">${hitBadge}${starBadge}${escapeHTML(conv.title)}</span></summary>
                <div class="prompt-list">${promptsHtml}</div>
            </details>`;
    });

    if (!htmlStr) {
        treeRoot.innerHTML = `<div class="prompt-item prompt-item-muted" style="margin: 10px 0 0 4px;">表示できるスレッドがないよ。</div>`;
    } else {
        treeRoot.innerHTML = htmlStr;
    }
    treeRoot.dataset.structureSignature = nextStructureSignature;
    syncDirectoryPromptSelectionClasses({ pruneToVisible: true });
    if (shouldRestoreFocusedTreeItem) {
        restoreSidebarFocus();
    }
    syncSidebarActiveStateToCurrentView({ scroll: false });
    const renderElapsed = (window.performance?.now?.() ?? Date.now()) - renderStartedAt;
    if (renderElapsed >= 120) {
        console.log(
            `[perf] renderTree ${Math.round(renderElapsed)}ms convs=${targetData.length} search=${isSearch} sidebarFilter=${isSidebarFilterActive}`
        );
    }
}

function jumpToMessage(convIdx, msgIdx, scrollBehavior = "smooth") {
    const activeTabBeforeJump = getActiveTab();
    const shouldRenderConversation =
        activeTabBeforeJump?.type !== "conversation" || activeTabBeforeJump.convIdx !== convIdx;
    ensureConversationTab(convIdx);
    currentPromptMessageIndex = msgIdx;
    pendingPromptMessageIndex = msgIdx;
    pendingPromptLockUntil = Date.now() + PROMPT_NAV_LOCK_MS;
    if (!isSidebarHidden) {
        syncSidebarActiveState({ convIdx, msgIdx }, { scroll: true, behavior: "auto" });
    }
    const conv = chatData[convIdx];
    if (conv?.id) {
        setMessageCollapsed(conv, getTurnStartMessageIndex(conv, msgIdx), false);
        if (conv.messages?.[msgIdx]?.role !== "user") {
            setAnswerCollapseOverride(conv, msgIdx, null);
        }
    }
    const renderPromise = shouldRenderConversation ? renderChat(convIdx) : Promise.resolve();

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

function openPromptFromTree(event, convIdx, msgIdx) {
    if (Date.now() < bookmarkSelectionSuppressClickUntil) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        return;
    }
    const selectionKey = buildDirectoryPromptSelectionKey(chatData[convIdx]?.id || "", msgIdx);
    if (event?.shiftKey && selectionKey) {
        selectDirectoryPromptRange(selectionKey);
        return;
    }
    if (event && event.currentTarget) {
        rememberSidebarFocus(event.currentTarget);
    }
    if (selectionKey) {
        clearDirectoryPromptSelection(selectionKey);
    }
    suppressedTreeAutoExpandConvIdx = null;
    ensureConversationTab(convIdx);
    renderActiveTab();
    currentTreeConvIdx = convIdx;
    renderTree();
    if (event && typeof event.stopPropagation === "function") {
        event.stopPropagation();
    }
    jumpToMessage(convIdx, msgIdx);
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

function openConversationFromTree(event, convIdx, options = {}) {
    if (Date.now() < bookmarkSelectionSuppressClickUntil) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        return;
    }
    if (event && event.currentTarget) {
        rememberSidebarFocus(event.currentTarget);
    }
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const activeTab = getActiveTab();
    const isSameConversationActive =
        activeTab?.type === "conversation" && activeTab.convIdx === convIdx;
    const shouldActivateViewer =
        options.activateViewer !== false &&
        (!isSameConversationActive || options.toggleTree === false);

    if (shouldActivateViewer) {
        suppressedTreeAutoExpandConvIdx = null;
        ensureConversationTab(convIdx);
        renderActiveTab();
    }

    if (!isAllTreesExpanded && options.toggleTree !== false) {
        const shouldCollapse = isSameConversationActive && currentTreeConvIdx === convIdx;
        currentTreeConvIdx = shouldCollapse ? null : convIdx;
        suppressedTreeAutoExpandConvIdx = shouldCollapse ? convIdx : null;
    } else {
        suppressedTreeAutoExpandConvIdx = null;
        currentTreeConvIdx = convIdx;
    }
    renderTree();
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

async function renderChat(convIdx, options = {}) {
    const conv = await loadConversationDetail(convIdx);
    await ensureConversationPromptBookmarkStates(conv);
    const viewer = document.getElementById("chat-viewer");
    const tab = ensureConversationTab(convIdx);
    if (options.preserveTabStripScroll === true) {
        pendingTabStripScrollLeft = captureTabStripScrollLeft();
    }
    viewer.dataset.currentConv = convIdx;
    viewer.dataset.currentTab = tab.id;
    viewer.dataset.currentTabType = "conversation";
    if (scrollObserver) scrollObserver.disconnect();

    const result = getCurrentConversationResult(conv);
    const promptItems = getPromptNavigatorItems(convIdx);
    const totalPromptCount =
        typeof conv.promptCount === "number" && conv.promptCount > 0
            ? conv.promptCount
            : promptItems.length;
    if (promptItems.length > 0) {
        const hasCurrentPrompt = promptItems.some((item) => item.messageIndex === currentPromptMessageIndex);
        if (!hasCurrentPrompt) {
            currentPromptMessageIndex = promptItems[0].messageIndex;
        }
    } else {
        currentPromptMessageIndex = null;
    }

    syncSidebarStateToCurrentView({
        renderTreeIfNeeded: true,
        updateFocusKey: false,
        scroll: false,
    });

    const filterToggleHtml =
        currentParsedQuery.words.length > 0
            ? `
        <label class="filter-toggle">
            <input type="checkbox" id="match-filter-toggle" onchange="toggleMatchFilter(this.checked)" ${isMatchFilterActive ? "checked" : ""}>
            <span class="toggle-slider"></span>
            フィルタを反映
        </label>
    `
            : "";

    let html = `
        ${buildTabStripHtml()}
        ${buildPageTopControlsHtml(tab)}
        ${filterToggleHtml ? `<div class="header-filter-row">${filterToggleHtml}</div>` : ""}
        ${buildRawSourceDebugPanelHtml(conv, tab)}`;

    let promptCount = 0;
    let i = 0;
    while (i < conv.messages.length) {
        const startIndex = i;
        const turnMatched = turnMatchesQuery(conv, startIndex);
        const turnClasses = [
            "chat-turn",
            conv.messages[startIndex]?.role === "user" && isMessageCollapsed(conv, startIndex) ? "collapsed-answer" : "",
            turnMatched ? "has-match" : "no-match",
            !turnMatched && isMatchFilterActive ? "filtered-out" : "",
        ]
            .filter(Boolean)
            .join(" ");
        const isTurnCollapsed = conv.messages[startIndex]?.role === "user" && isMessageCollapsed(conv, startIndex);
        html += `<div class="${turnClasses}" id="turn-${convIdx}-${startIndex}">`;
        if (conv.messages[i] && conv.messages[i].role === "user") {
            promptCount += 1;
            const prompt = conv.messages[i];
            const promptBookmarkTarget = buildPromptBookmarkTargetSpec(
                conv,
                i,
                prompt.text || ""
            );
            const isPromptCollapsed = isMessageCollapsed(conv, i);
            const promptTagBadgesHtml = buildPromptTagBadgesHtml(promptBookmarkTarget);
            html += `
                <div class="chat-row user ${isPromptCollapsed ? "is-collapsed" : ""}" id="msg-${convIdx}-${i}">
                    ${buildMessageAvatarButtonHtml(convIdx, i, "user")}
                    <div class="bubble-wrapper">
                        <div class="prompt-meta-row">
                            ${promptTagBadgesHtml ? `<div class="prompt-inline-tags">${promptTagBadgesHtml}</div>` : ""}
                            <div class="prompt-counter">Prompt ${promptCount}/${Math.max(1, totalPromptCount)}</div>
                        </div>
                        <div class="bubble${isPromptCollapsed ? " bubble-collapsed-preview" : ""}">
                            <div class="prompt-bubble-layout">
                                <div class="prompt-bubble-content">
                                    ${
                                        isPromptCollapsed
                                            ? escapeHTML(buildCollapsedMessagePreview(prompt.text || ""))
                                            : renderPromptContent(prompt.text || "")
                                    }
                                </div>
                                ${buildPromptCopyButtonHtml(convIdx, i)}
                            </div>
                        </div>
                    </div>
                </div>`;
            i += 1;
        }

        html += `<div class="answers-container-wrapper"><div class="answers-container">`;
        while (i < conv.messages.length && conv.messages[i].role !== "user") {
            const answer = conv.messages[i];
            const isAnswerCollapsed = isAnswerMessageCollapsed(conv, i);
            html += `
                <div class="chat-row assist ${isAnswerCollapsed ? "is-collapsed" : ""}" id="msg-${convIdx}-${i}">
                    ${buildMessageAvatarButtonHtml(convIdx, i, "assist")}
                    <div class="bubble-wrapper">
                        <div class="bubble${isAnswerCollapsed ? " bubble-collapsed-preview" : ""}">${
                            isAnswerCollapsed
                                ? escapeHTML(buildCollapsedMessagePreview(answer.text))
                                : renderContent(answer.text)
                        }</div>
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
    syncTabStripRovingFocus();
    restorePendingTabStripFocus();
    const restoredTabStripScroll = restorePendingTabStripScrollLeft();
    if (options.skipTabStripReveal !== true) {
        if (!restoredTabStripScroll) {
            revealActiveTabStripButton();
        }
    }
    isolateRenderedMath(viewer);
    scheduleVisibleMathTypeset(viewer);
    enhanceCodeBlocks(viewer, { skipUserBubbles: true });
    refreshScrollFadeStates(viewer);
    playPendingTabReorderAnimation();
    document.querySelectorAll(".chat-row.user").forEach((el) => scrollObserver.observe(el));
    syncPromptNavigatorPopover(false);
    refreshConversationRootDock();
    scheduleConversationRootDockUpdate();
    applyTheme();
    refreshUtilityToggleButtons();
    updateToolbarCollapse();
    applyHighlightsAndFilters(viewer);
    syncSidebarActiveStateToCurrentView({ scroll: false });
    scheduleConversationRootDockUpdate();
}

function renderVirtualThreadTab(tab) {
    const viewer = document.getElementById("chat-viewer");
    const virtualThread = tab.virtualThread || { title: "仮想スレッド", items: [], groups: [] };
    void ensureVirtualThreadBookmarkStates(tab);
    viewer.dataset.currentConv = "";
    viewer.dataset.currentTab = tab.id;
    viewer.dataset.currentTabType = "virtual";
    if (scrollObserver) scrollObserver.disconnect();

    const chips = [];
    const filters = virtualThread.filters || {};
    (filters.service || []).forEach((value) => {
        chips.push(`<span class="extract-chip">service: ${escapeHTML(formatExtractServiceLabel(value))}</span>`);
    });
    (filters.model || []).forEach((value) => {
        chips.push(`<span class="extract-chip">model: ${escapeHTML(value)}</span>`);
    });
    (filters.bookmarkTags || []).forEach((value) => {
        chips.push(`<span class="extract-chip">tag: ${escapeHTML(value)}</span>`);
    });
    (filters.bookmarkTagGroups || []).forEach((group) => {
        const label = normalizeBookmarkTagNameGroup(group).join(" & ");
        if (!label) return;
        chips.push(`<span class="extract-chip extract-chip-compound">tag: ${escapeHTML(label)}</span>`);
    });
    [
        ["dateFrom", "from"],
        ["dateTo", "to"],
        ["titleContains", "title"],
        ["promptContains", "prompt"],
        ["responseContains", "response"],
        ["sourceFile", "file"],
    ].forEach(([key, label]) => {
        const value = filters[key];
        if (String(value || "").trim()) {
            chips.push(`<span class="extract-chip">${escapeHTML(label)}: ${escapeHTML(value)}</span>`);
        }
    });
    if (normalizeBookmarkedFilterValue(filters.bookmarked) === "bookmarked") {
        chips.push('<span class="extract-chip">Tag: あり</span>');
    } else if (normalizeBookmarkedFilterValue(filters.bookmarked) === "not-bookmarked") {
        chips.push('<span class="extract-chip">Tag: なし</span>');
    }

    const items = Array.isArray(virtualThread.items) ? virtualThread.items : [];
    const selectedFragmentIndex = setVirtualTabSelectionIndex(
        getVirtualTabSelectionIndex(tab),
        tab
    );

    syncSidebarStateToCurrentView({
        renderTreeIfNeeded: true,
        updateFocusKey: false,
        scroll: false,
    });

    const bodyHtml =
        items.length === 0
            ? `<div class="prompt-item prompt-item-muted" style="margin: 18px 0;">条件に一致する断片はなかったよ。</div>`
            : items
                  .map((item, index) => {
                      // Prompt and virtual-fragment bookmarks share the same bookmark
                      // target-spec/cache path. Only the surface-specific payload differs.
                      const isActive = index === selectedFragmentIndex;
                      const fragmentBookmarkTarget = buildVirtualFragmentBookmarkTargetSpec(tab, item);
                      const fragmentBookmarkState = getCachedBookmarkState(fragmentBookmarkTarget);
                      const primaryTime = getConversationPrimaryTimeInfo(item);
                      const primaryTimeTooltip = `${primaryTime.label} via ${primaryTime.field}`;
                      return `
                        <article
                            class="virtual-fragment ${isActive ? "active" : ""}"
                            id="virtual-fragment-${escapeHTML(item.id)}"
                            tabindex="0"
                            data-item-type="virtual-fragment"
                            data-fragment-index="${index}"
                            data-conv-id="${escapeHTML(item.convId)}"
                            data-msg-idx="${item.messageIndex}"
                            onclick="selectVirtualFragment(${index})">
                            <div class="virtual-fragment-meta">
                                <div class="virtual-fragment-meta-top">
                                    <div title="${escapeHTML(primaryTimeTooltip)}">${escapeHTML(String(primaryTime.value || ""))}</div>
                                    ${buildBookmarkToggleButtonHtml(
                                        fragmentBookmarkTarget,
                                        Boolean(fragmentBookmarkState?.bookmarked),
                                        `toggleVirtualFragmentBookmark('${escapeJsString(tab.id)}', ${index}, event)`,
                                        "virtual-fragment-bookmark",
                                        {
                                            activeTitle: "断片をマーク中",
                                            inactiveTitle: "この断片をマーク",
                                        }
                                    )}
                                </div>
                                <div>${escapeHTML(item.service || "")}${item.model ? ` / ${escapeHTML(item.model)}` : ""}</div>
                                <div>${escapeHTML(item.threadTitle || "")}</div>
                                <div>role: ${escapeHTML(item.role || "")}</div>
                            </div>
                            <div class="virtual-fragment-body">
                                <div class="virtual-group-label">${escapeHTML(item.threadTitle || "Untitled")}</div>
                                <div class="bubble">${renderContent(item.body || "")}</div>
                                <button class="action-btn virtual-open-origin" type="button" onclick="event.stopPropagation(); openOriginConversation('${escapeJsString(item.convId)}', ${item.messageIndex})">元スレッドを開く</button>
                            </div>
                        </article>
                    `;
                  })
                  .join("");

    viewer.innerHTML = `
        ${buildTabStripHtml()}
        ${buildPageTopControlsHtml(tab)}
        <div class="virtual-thread-view">
            <div class="virtual-thread-meta top-inline">
                <span class="extract-chip">${items.length} fragments</span>
                ${chips.join("")}
            </div>
            ${bodyHtml}
        </div>
    `;

    syncTabStripRovingFocus();
    restorePendingTabStripFocus();
    revealActiveTabStripButton();
    isolateRenderedMath(viewer);
    scheduleVisibleMathTypeset(viewer);
    enhanceCodeBlocks(viewer);
    playPendingTabReorderAnimation();
    applyTheme();
    refreshUtilityToggleButtons();
    updateToolbarCollapse();
    syncSidebarActiveStateToCurrentView({ scroll: false });
    window.requestAnimationFrame(() => {
        if (!restoreVirtualTabScrollPosition(tab, viewer)) {
            focusVirtualFragment(selectedFragmentIndex, "auto", { tab });
        }
    });
}

function renderManagerTab(tab) {
    const viewer = document.getElementById("chat-viewer");
    if (!viewer) return;
    viewer.dataset.currentConv = "";
    viewer.dataset.currentTab = tab.id;
    viewer.dataset.currentTabType = "manager";
    if (scrollObserver) scrollObserver.disconnect();

    let bodyHtml = '<div class="extract-history-empty">表示できる内容がないよ</div>';
    let controlsHtml = "";
    if (tab.kind === "starred_filters") {
        bodyHtml = buildStarredFiltersMarkup();
    } else if (tab.kind === "starred_prompts") {
        controlsHtml = buildStarredPromptManagerControlsHtml();
        bodyHtml = buildBookmarkTagWorkspaceMarkup();
    }

    viewer.innerHTML = `
        ${buildTabStripHtml()}
        <div class="virtual-thread-view manager-tab-view">
            <div class="virtual-thread-meta top-inline">
                <h2 class="manager-tab-heading">${escapeHTML(tab.title || "Manager")}</h2>
            </div>
            ${controlsHtml}
            <div class="extract-history-list manager-tab-list">
                ${bodyHtml}
            </div>
        </div>
    `;

    syncTabStripRovingFocus();
    restorePendingTabStripFocus();
    revealActiveTabStripButton();
    playPendingTabReorderAnimation();
    applyTheme();
    refreshUtilityToggleButtons();
    updateToolbarCollapse();
    if (tab.kind === "starred_prompts") {
        renderRecentFilters();
        syncStarredPromptSelectionClasses({ pruneToVisible: true });
    }
}

function setVirtualFragmentActiveIndex(index, options = {}) {
    const targetTab =
        options.tab && options.tab.type === "virtual" ? options.tab : getActiveTab();
    if (!targetTab || targetTab.type !== "virtual") return;
    const items = Array.from(document.querySelectorAll(".virtual-fragment"));
    if (items.length === 0) return;
    const selectedFragmentIndex = setVirtualTabSelectionIndex(index, targetTab);
    items.forEach((item, itemIndex) => {
        item.classList.toggle("active", itemIndex === selectedFragmentIndex);
    });
    const target = items[selectedFragmentIndex];
    if (!target) return;
    if (options.focus) {
        target.focus({ preventScroll: options.scrollIntoView !== true });
    }
    if (options.scrollIntoView) {
        target.scrollIntoView({ behavior: options.behavior || "smooth", block: "nearest" });
    }
    if (options.syncSidebar !== false) {
        syncSidebarStateToCurrentView({
            renderTreeIfNeeded: true,
            updateFocusKey: true,
            scroll: options.scrollSidebar === true,
            behavior: options.behavior || "auto",
        });
    }
}

function focusVirtualFragment(index, behavior = "smooth", options = {}) {
    setVirtualFragmentActiveIndex(index, {
        ...options,
        focus: true,
        scrollIntoView: true,
        behavior,
        syncSidebar: true,
        scrollSidebar: false,
    });
}

function selectVirtualFragment(index) {
    focusVirtualFragment(index, "smooth");
}

function moveVirtualFragment(step) {
    const activeTab = getActiveTab();
    if (!activeTab || activeTab.type !== "virtual") return false;
    const items = activeTab.virtualThread?.items || [];
    if (items.length === 0) return false;
    focusVirtualFragment(getVirtualTabSelectionIndex(activeTab) + step, "smooth");
    return true;
}

function openOriginConversation(convId, messageIndex = null) {
    const convIdx = getConversationIndexById(convId);
    if (convIdx < 0) return;
    ensureConversationTab(convIdx);
    if (messageIndex !== null && messageIndex !== undefined) {
        currentPromptMessageIndex = messageIndex;
    }
    renderActiveTab();
    if (messageIndex !== null && messageIndex !== undefined) {
        window.setTimeout(() => {
            jumpToMessage(convIdx, messageIndex, "auto");
        }, 60);
    }
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

function setRawCopyButtonState(button, copied) {
    if (!button) return;
    button.innerHTML = `<span class="raw-debug-panel-btn-icon" aria-hidden="true">${copied ? "✓" : "⧉"}</span>`;
    button.setAttribute("aria-label", copied ? "raw_text をコピー済み" : "raw_text をコピー");
    button.dataset.copied = copied ? "true" : "false";
}

function sanitizeDownloadFilename(name, fallback = "raw_text.txt") {
    const normalized = String(name || "")
        .replace(/[<>:\"/\\|?*\u0000-\u001f]/g, "-")
        .replace(/\s+/g, " ")
        .trim();
    return normalized || fallback;
}

function buildRawTextDownloadFilename(conv, raw) {
    const sourcePath = String(raw?.sourcePath || raw?.rawBytesPath || "").trim();
    const sourceFormat = String(raw?.sourceFormat || "").trim().toLowerCase();
    const fallbackExtension = sourceFormat === "json" ? ".json" : ".txt";
    let fileName = sourcePath ? sourcePath.split(/[\\/]/).pop() || "" : "";
    if (!fileName) {
        const convIdPart = String(conv?.id || "conversation").slice(0, 32);
        fileName = `raw-${convIdPart}${fallbackExtension}`;
    } else if (!/\.[A-Za-z0-9]{1,12}$/.test(fileName)) {
        fileName = `${fileName}${fallbackExtension}`;
    }
    return sanitizeDownloadFilename(fileName, `raw_text${fallbackExtension}`);
}

function triggerTextDownload(text, filename) {
    const blob = new Blob([String(text || "")], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
    }, 1200);
}

function copyConversationRawText(convIdx, buttonOrEvent = null, event = null) {
    const triggerButton =
        buttonOrEvent instanceof Element
            ? buttonOrEvent
            : (event?.currentTarget || buttonOrEvent?.currentTarget || null);
    const rawEvent =
        event && typeof event.preventDefault === "function"
            ? event
            : (buttonOrEvent instanceof Element ? event : buttonOrEvent);
    rawEvent?.preventDefault?.();
    rawEvent?.stopPropagation?.();
    const conv = chatData[convIdx];
    const entry = conv?.id ? getRawSourceDebugEntry(conv.id) : null;
    if (!entry || entry.data?.available === false) {
        showToast("コピーできる raw_text がないよ");
        return;
    }
    if (triggerButton) {
        triggerButton.disabled = true;
    }
    loadConversationRawText(conv.id)
        .then((rawText) => {
            const normalizedText = String(rawText || "");
            if (!normalizedText) {
                throw new Error("コピーできる raw_text がないよ");
            }
            return copyTextToClipboard(normalizedText)
                .catch(() => {
                    fallbackCopyText(normalizedText);
                });
        })
        .then(() => {
            setRawCopyButtonState(triggerButton, true);
            if (triggerButton?._copyResetTimer) {
                window.clearTimeout(triggerButton._copyResetTimer);
            }
            if (triggerButton) {
                triggerButton._copyResetTimer = window.setTimeout(() => {
                    setRawCopyButtonState(triggerButton, false);
                }, 1400);
            }
        })
        .catch((error) => {
            showToast(error && error.message ? error.message : "raw_text をコピーできなかったよ");
        })
        .finally(() => {
            if (triggerButton) {
                triggerButton.disabled = false;
            }
            rerenderRawDebugConversation(conv.id);
        });
}

function downloadConversationRawText(convIdx, buttonOrEvent = null, event = null) {
    const triggerButton =
        buttonOrEvent instanceof Element
            ? buttonOrEvent
            : (event?.currentTarget || buttonOrEvent?.currentTarget || null);
    const rawEvent =
        event && typeof event.preventDefault === "function"
            ? event
            : (buttonOrEvent instanceof Element ? event : buttonOrEvent);
    rawEvent?.preventDefault?.();
    rawEvent?.stopPropagation?.();
    const conv = chatData[convIdx];
    const entry = conv?.id ? getRawSourceDebugEntry(conv.id) : null;
    if (!entry || entry.data?.available === false) {
        showToast("ダウンロードできる raw_text がないよ");
        return;
    }
    if (triggerButton) {
        triggerButton.disabled = true;
    }
    loadConversationRawText(conv.id)
        .then((rawText) => {
            const normalizedText = String(rawText || "");
            if (!normalizedText) {
                throw new Error("ダウンロードできる raw_text がないよ");
            }
            const filename = buildRawTextDownloadFilename(conv, entry.data);
            triggerTextDownload(normalizedText, filename);
            showToast("raw_text をダウンロードしたよ");
        })
        .catch((error) => {
            showToast(error && error.message ? error.message : "raw_text をダウンロードできなかったよ");
        })
        .finally(() => {
            if (triggerButton) {
                triggerButton.disabled = false;
            }
        });
}

function setCodeCopyButtonState(button, copied) {
    if (!button) return;
    button.innerHTML = `<span class="raw-debug-panel-btn-icon" aria-hidden="true">${copied ? "✓" : "⧉"}</span>`;
    button.setAttribute("aria-label", copied ? "コードをコピー済み" : "コードをコピー");
    button.dataset.copied = copied ? "true" : "false";
}

function copyCodeBlock(button, codeElement) {
    if (!button || !codeElement) return;
    const rawText = codeElement.textContent || "";

    copyTextToClipboard(rawText)
        .catch(() => {
            fallbackCopyText(rawText);
        })
        .finally(() => {
            setCodeCopyButtonState(button, true);
            if (button._copyResetTimer) {
                window.clearTimeout(button._copyResetTimer);
            }
            button._copyResetTimer = window.setTimeout(() => {
                setCodeCopyButtonState(button, false);
            }, 1400);
        });
}

function toggleCodeBlockCollapsed(button, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const wrapper = button?.closest(".code-block-wrapper");
    if (!wrapper) return;
    const nextCollapsed = !wrapper.classList.contains("is-collapsed");
    wrapper.classList.toggle("is-collapsed", nextCollapsed);
    button.setAttribute("aria-pressed", nextCollapsed ? "true" : "false");
    button.setAttribute("title", nextCollapsed ? "コードを展開" : "コードを折りたたむ");
}

function updateCodeBlockStickyOffset(viewer = document.getElementById("chat-viewer")) {
    if (!viewer) return;

    const tabStrip = viewer.querySelector(":scope > .tab-strip");
    const filterRow = viewer.querySelector(":scope > .header-filter-row");
    const stickyTop =
        (tabStrip ? tabStrip.offsetHeight || 0 : 0) +
        (filterRow ? filterRow.offsetHeight || 0 : 0) +
        6;

    viewer.style.setProperty("--code-block-sticky-top", `${stickyTop}px`);
    viewer.style.setProperty("--bubble-action-sticky-top", `${stickyTop}px`);
}

function inferCodeHighlightLanguage(codeText = "", className = "") {
    const explicit = String(className || "").match(/language-([a-z0-9_+-]+)/i);
    if (explicit?.[1]) {
        return explicit[1].toLowerCase();
    }
    const sample = String(codeText || "");
    if (/^\s*[\[{]/.test(sample) && /"\w+"\s*:/.test(sample)) return "json";
    if (/\b(?:const|let|var|function|=>|import |export |await |async )\b/.test(sample)) return "javascript";
    if (/^\s*(def |class |import |from |print\()/m.test(sample)) return "python";
    if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|FROM|WHERE|JOIN)\b/im.test(sample)) return "sql";
    if (
        /^\s*(curl|git|npm|pnpm|yarn|python|node|bash|sh)\b/im.test(sample) ||
        /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/.test(sample)
    ) {
        return "bash";
    }
    return "generic";
}

function classifyHighlightedCodeToken(token, language, match) {
    if (language === "json" && match?.[1]) {
        return match[2] ? "key" : "string";
    }
    if (/^(?:\/\*[\s\S]*\*\/|\/\/[^\n]*|#[^\n]*|--[^\n]*)$/.test(token)) return "comment";
    if (/^"(?:\\.|[^"\\])*"$|^'(?:\\.|[^'\\])*'$|^`[\s\S]*`$/.test(token)) return "string";
    if (/^\$\{?[A-Za-z_][A-Za-z0-9_]*\}?$/.test(token)) return "variable";
    if (/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(token)) return "number";
    if (/^(?:true|false|null|undefined|None|True|False|NULL)$/i.test(token)) return "literal";
    if (
        /^(?:const|let|var|function|return|if|else|for|while|switch|case|break|continue|try|catch|finally|class|extends|new|import|export|from|default|async|await|throw|typeof|instanceof|in|of|def|lambda|yield|raise|pass|with|SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP|ORDER|BY|HAVING|LIMIT|AND|OR|NOT|AS|ON|VALUES|SET)$/i.test(token)
    ) {
        return "keyword";
    }
    return "";
}

function buildCodeHighlightPattern(language) {
    if (language === "json") {
        return /("(?:\\.|[^"\\])*")(\s*:)?|\/\*[\s\S]*?\*\/|\/\/[^\n]*|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gm;
    }
    if (language === "python") {
        return /#[^\n]*|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:def|class|return|if|elif|else|for|while|try|except|finally|import|from|as|with|pass|break|continue|yield|lambda|async|await|raise|in|is|and|or|not|True|False|None)\b|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gm;
    }
    if (language === "sql") {
        return /\/\*[\s\S]*?\*\/|--[^\n]*|"(?:\\.|[^"\\])*"|'(?:''|[^'])*'|\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP|ORDER|BY|HAVING|LIMIT|AND|OR|NOT|AS|ON|VALUES|SET|INTO)\b|-?\d+(?:\.\d+)?/gim;
    }
    if (language === "bash") {
        return /#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\$\{?[A-Za-z_][A-Za-z0-9_]*\}?|\b(?:if|then|else|fi|for|do|done|case|esac|function|export|local|return|in)\b|-?\d+(?:\.\d+)?/gm;
    }
    return /\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[\s\S]*?`|\$\{?[A-Za-z_][A-Za-z0-9_]*\}?|\b(?:const|let|var|function|return|if|else|for|while|switch|case|break|continue|try|catch|finally|class|extends|new|import|export|from|default|async|await|throw|typeof|instanceof|in|of|def|lambda|yield|raise|pass|with|SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|FROM|WHERE|JOIN|AND|OR|NOT|true|false|null|undefined|None|True|False)\b|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gm;
}

function highlightCodeSyntax(codeText = "", language = "generic") {
    const source = String(codeText || "");
    const pattern = buildCodeHighlightPattern(language);
    let html = "";
    let cursor = 0;

    for (const match of source.matchAll(pattern)) {
        const token = match[0];
        const index = Number(match.index || 0);
        html += escapeHTML(source.slice(cursor, index));
        const tokenClass = classifyHighlightedCodeToken(token, language, match);
        if (tokenClass) {
            html += `<span class="code-token code-token-${tokenClass}">${escapeHTML(token)}</span>`;
        } else {
            html += escapeHTML(token);
        }
        cursor = index + token.length;
    }

    html += escapeHTML(source.slice(cursor));
    return html;
}

function enhanceCodeBlocks(root, options = {}) {
    if (!root) return;
    const skipUserBubbles = options.skipUserBubbles === true;
    root.querySelectorAll("pre > code").forEach((codeElement) => {
        const pre = codeElement.parentElement;
        if (!pre || pre.dataset.codeCopyEnhanced === "true") return;
        if (skipUserBubbles && codeElement.closest(".chat-row.user .bubble")) return;

        pre.dataset.codeCopyEnhanced = "true";
        const rawCodeText = codeElement.textContent || "";
        const language = inferCodeHighlightLanguage(rawCodeText, codeElement.className || "");
        codeElement.dataset.codeLanguage = language;
        codeElement.innerHTML = highlightCodeSyntax(rawCodeText, language);
        const wrapper = document.createElement("div");
        wrapper.className = "code-block-wrapper";

        const toolbar = document.createElement("div");
        toolbar.className = "code-block-toolbar";

        const label = document.createElement("span");
        label.className = "code-block-label";
        label.textContent = "<code>";

        const actions = document.createElement("div");
        actions.className = "code-block-actions";

        const toggleButton = document.createElement("button");
        toggleButton.type = "button";
        toggleButton.className = "code-collapse-button raw-debug-panel-btn circle-pill circle-pill-sm";
        toggleButton.innerHTML = '<span class="code-collapse-button-icon" aria-hidden="true">▾</span>';
        toggleButton.title = "コードを折りたたむ";
        toggleButton.setAttribute("aria-pressed", "false");
        toggleButton.addEventListener("click", (event) => {
            toggleCodeBlockCollapsed(toggleButton, event);
        });

        const button = document.createElement("button");
        button.type = "button";
        button.className = "code-copy-button raw-debug-panel-btn circle-pill circle-pill-sm";
        button.title = "コードをコピー";
        setCodeCopyButtonState(button, false);
        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            copyCodeBlock(button, codeElement);
        });
        actions.appendChild(toggleButton);
        toolbar.appendChild(label);
        toolbar.appendChild(actions);

        const body = document.createElement("div");
        body.className = "code-block-body";

        const copyTrack = document.createElement("div");
        copyTrack.className = "code-copy-track";
        copyTrack.appendChild(button);

        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(toolbar);
        wrapper.appendChild(body);
        body.appendChild(pre);
        body.appendChild(copyTrack);

        const bubble = wrapper.closest(".bubble");
        if (bubble) {
            bubble.classList.add("has-sticky-code-blocks");
        }

        const answersContainer = wrapper.closest(".answers-container");
        if (answersContainer) {
            answersContainer.classList.add("has-sticky-code-blocks");
        }
    });

    updateCodeBlockStickyOffset(root);
}

function updateScrollFadeState(element) {
    if (!element) return;
    const hasOverflow = element.scrollHeight > element.clientHeight + 1;
    const atEnd = element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
    element.classList.toggle("has-scroll-fade", hasOverflow && !atEnd);
}

function bindScrollFade(element) {
    if (!element || element.dataset.scrollFadeBound === "true") return;
    element.dataset.scrollFadeBound = "true";
    element.addEventListener(
        "scroll",
        () => {
            updateScrollFadeState(element);
        },
        { passive: true }
    );
}

function refreshScrollFadeStates(root = document) {
    if (!root) return;
    root.querySelectorAll(".prompt-bubble-content, .code-block-wrapper pre").forEach((element) => {
        bindScrollFade(element);
        updateScrollFadeState(element);
    });
}

async function executeSearch() {
    const searchBar = document.getElementById("searchBar");
    if (!searchBar) {
        currentParsedQuery = { fuseQuery: "", words: [] };
        currentSearchResults = {};
        markTreeStructureDirty();
        renderTree();
        return;
    }
    const searchSpec = buildKeywordSearchSpec(searchBar.value.trim());
    currentParsedQuery = {
        fuseQuery: searchSpec.fuseQuery,
        words: searchSpec.words,
    };
    persistSearchPreferences();
    currentSearchResults = await requestSearchResults(searchSpec);
    markTreeStructureDirty();
    renderTree();

    const currentConv = document.getElementById("chat-viewer").dataset.currentConv;
    if (currentConv !== "") {
        await renderChat(Number.parseInt(currentConv, 10));
    }
}

async function bootViewer(options = {}) {
    try {
        debugPerfLog("boot:start");
        await initMathJaxRuntime({ timeoutMs: 2200 });
        debugPerfLog("boot:renderer-ready");
        initBridge();
        debugPerfLog("boot:bridge-init");
        chatData = Array.isArray(window.__CHAT_INDEX__) ? window.__CHAT_INDEX__.map(hydrateConversation) : [];
        debugPerfLog(`boot:index-loaded convs=${chatData.length}`);
        currentThemes = JSON.parse(document.getElementById("theme-data").textContent);

        activeTheme = localStorage.getItem(STORAGE_KEYS.theme) || "default";
        activeMode = localStorage.getItem(STORAGE_KEYS.mode) || options.systemTheme || "light";

        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)");
        systemPrefersDark.addEventListener("change", (event) => {
            setSystemTheme(event.matches ? "dark" : "light");
        });

        const searchBar = document.getElementById("searchBar");
        const sortSelect = document.getElementById("sort-select");
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
        syncSidebarFilterButton();

        isAllTreesExpanded = readBooleanPreference(STORAGE_KEYS.treeExpand, false);

        isMatchFilterActive = readBooleanPreference(STORAGE_KEYS.matchFilter, false);
        isSidebarHidden = readBooleanPreference(STORAGE_KEYS.sidebarHidden, false);
        sidebarMode = localStorage.getItem(STORAGE_KEYS.sidebarMode) || "threads";
        applySidebarWidth(localStorage.getItem(STORAGE_KEYS.sidebarWidth) || 292);

        setupObserver();
        if (viewer) {
            viewer.addEventListener("scroll", () => {
                captureActiveVirtualTabScrollState(viewer);
                scheduleConversationRootDockUpdate();
                scheduleVisibleMathTypeset(viewer);
            }, { passive: true });
        }
        window.addEventListener("resize", () => {
            scheduleVisibleMathTypeset(document.getElementById("chat-viewer"));
        }, { passive: true });
        ensureTabMouseDragInteractions();
        ensureViewerToolsInteractions();
        ensureExtractInteractions();
        ensureBookmarkSelectionDragInteractions();
        ensureTabStripKeyboardNavigation();
        ensureSidebarKeyboardNavigation();
        ensureHiddenSidebarKeyboardNavigation();
        ensureGlobalViewerKeyboardNavigation();
        ensureNativeShortcutFallbacks();
        ensureTabSessionLifecyclePersistence();
        ensureReadingContextWidgetFocusBridges();
        ensureSidebarResizer();
        debugPerfLog("boot:before-filter-options");
        populateExtractOptions(await requestFilterOptions());
        debugPerfLog("boot:after-filter-options");
        await refreshStarredFilters();
        debugPerfLog("boot:after-starred-filters");
        await refreshBookmarkTags();
        debugPerfLog("boot:after-bookmark-tags");
        await refreshStarredPrompts();
        debugPerfLog("boot:after-starred-prompts");
        await refreshRecentFilters();
        debugPerfLog("boot:after-recent-filters");
        switchSidebarMode(sidebarMode);
        debugPerfLog(`boot:after-sidebar-mode mode=${sidebarMode}`);
        scheduleVirtualThreadPreview();
        debugPerfLog("boot:after-schedule-preview");
        applySidebarVisibility();
        applyTheme();
        refreshUtilityToggleButtons();
        debugPerfLog("boot:before-execute-search");
        await executeSearch();
        debugPerfLog("boot:after-execute-search");
        await restoreOpenTabsFromSession();
        ensurePinnedManagerTabs();
        if (!getActiveTab() && openTabs.length > 0) {
            activeTabId = openTabs[0].id;
        }
        if (getActiveTab()) {
            renderActiveTab();
        }
        debugPerfLog("boot:after-restore-tabs");
        window.requestAnimationFrame(() => {
            ensureInitialAppFocus();
        });
        debugPerfLog("boot:ready");

        if (options.showToast) {
            showToast("✨ 登録完了！");
        }
    } catch (error) {
        console.error("Init Error:", error);
    }
}
