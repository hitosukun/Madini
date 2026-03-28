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
let savedExtractViews = [];
let bookmarkListEntries = [];
let extractPreviewTimer = null;
let virtualThreadCounter = 0;
// Legacy/global fallback while virtual-tab selection is moving to per-tab state.
let currentVirtualSelectionIndex = 0;
let virtualTabScrollRestoreGuardUntil = 0;
let rawSourceDebugByConvId = {};
let bookmarkStatesByKey = {};
let promptBookmarkLoadPromises = {};
let virtualFragmentBookmarkLoadPromises = {};
let savedViewBookmarkLoadPromises = {};
let isViewerToolsOpen = false;
let isExtractModelMenuOpen = false;
let appliedExtractConversationIds = null;
let extractPreviewRequestId = 0;
let treeStructureRevision = 0;
const CLOSED_TAB_HISTORY_LIMIT = 20;

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
const ACTIVE_MATH_RENDERER = "builtin";
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
    sidebarMode: "novel-archive-sidebar-mode",
    tabSession: "novel-archive-tab-session",
};

const COMMON_MATH_OPERATOR_NAMES = Object.freeze([
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
    return {
        put(html) {
            const token = `@@${prefix}_${values.length}@@`;
            values.push(html);
            return token;
        },
        restore(text) {
            const pattern = new RegExp(`@@${prefix}_(\\d+)@@`, "g");
            return text.replace(pattern, (_match, index) => values[Number(index)] || "");
        },
    };
}

function normalizeMathSourceArtifacts(sourceText) {
    let nextText = String(sourceText || "");

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

    return lines.join("\n");
}

function renderMathFragment(source, htmlPlaceholders = null) {
    const placeholderStore = htmlPlaceholders || createHtmlPlaceholderStore("MATH_HTML");
    const shouldRestore = !htmlPlaceholders;
    let html = escapeHTML(String(source || "").trim());
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
        ["\\varepsilon", "ε"],
        ["\\epsilon", "ϵ"],
        ["\\theta", "θ"],
        ["\\vartheta", "ϑ"],
        ["\\lambda", "λ"],
        ["\\mu", "μ"],
        ["\\pi", "π"],
        ["\\varpi", "ϖ"],
        ["\\rho", "ρ"],
        ["\\varrho", "ϱ"],
        ["\\sigma", "σ"],
        ["\\varsigma", "ς"],
        ["\\phi", "φ"],
        ["\\varphi", "ϕ"],
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
        ["\\quad", " "],
        ["\\qquad", "  "],
        ["\\ldots", "…"],
        ["\\cdots", "⋯"],
        ["\\dots", "…"],
        ["\\,", " "],
        ["\\:", " "],
        ["\\;", " "],
        ["\\!", ""],
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
        html = html.replace(/\\tilde\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(renderMathAccent("tilde", inner, placeholderStore)));
        html = html.replace(/\\bar\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(renderMathAccent("bar", inner, placeholderStore)));
        html = html.replace(
            new RegExp(String.raw`\\(${COMMON_MATH_OPERATOR_NAMES.join("|")})\b`, "g"),
            (_match, operatorName) => placeholderStore.put(renderMathOperator(operatorName))
        );
        html = html.replace(/\\operatorname\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(`<span class="math-text math-operator">${renderMathFragment(inner, placeholderStore)}</span>`));
        html = html.replace(/\\mathrm\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(`<span class="math-text math-text-roman">${renderMathFragment(inner, placeholderStore)}</span>`));
        html = html.replace(/\\mathbf\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(`<span class="math-text math-text-bold">${renderMathFragment(inner, placeholderStore)}</span>`));
        html = html.replace(/\\mathit\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(`<span class="math-text math-text-italic">${renderMathFragment(inner, placeholderStore)}</span>`));
        html = html.replace(/\\mathbb\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(renderMathAlphabet("mathbb", inner, placeholderStore)));
        html = html.replace(/\\mathcal\{([^{}]+)\}/g, (_match, inner) => placeholderStore.put(renderMathAlphabet("mathcal", inner, placeholderStore)));
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
        tilde: "~",
        bar: "¯",
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
    return ACTIVE_MATH_RENDERER;
}

function isolateRenderedMath(root) {
    if (!root?.querySelectorAll) return;

    root.querySelectorAll(".math-inline, .math-display").forEach((node) => {
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
        looksLikeStandaloneMathLine(trimmed)
        || /\\begin\{(?:bmatrix|pmatrix|matrix)\}/.test(trimmed)
    );
}

function looksLikeStandaloneMathBlockContinuation(line) {
    const trimmed = String(line || "").trim();
    if (!trimmed) return false;
    if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) return false;
    if (/[。、「」『』【】]/.test(trimmed)) return false;
    if (looksLikeStandaloneMathLine(trimmed)) return true;
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
    if (!trimmed) return false;
    if (!trimmed.includes("\\")) return false;
    if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) return false;
    if (/[。、「」『』【】]/.test(trimmed)) return false;
    if (!/\\[A-Za-z]+/.test(trimmed)) return false;

    const reduced = trimmed
        .replace(/\\[A-Za-z]+\*?(?:\{[^{}]*\})?/g, "")
        .replace(/[{}[\]()^_=+\-*/,:;.|<>~`'"\d\s]/g, "")
        .replace(/[A-Za-z]/g, "");
    return reduced.length === 0;
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

function getConversationTabId(convIdx) {
    return `conv:${convIdx}`;
}

function getVirtualTabId() {
    virtualThreadCounter += 1;
    return `virtual:${Date.now()}:${virtualThreadCounter}`;
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

    return null;
}

async function restoreOpenTabsFromSession() {
    const snapshot = readStoredTabSession();
    if (!snapshot || !Array.isArray(snapshot.tabs) || snapshot.tabs.length === 0) {
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
            clearStoredTabSession();
            return false;
        }

        openTabs = restoredTabs;
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
    }
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
    const normalizedState = {
        targetType: bookmarkTarget.targetType,
        targetId: bookmarkTarget.targetId,
        payload:
            state && typeof state.payload === "object" && !Array.isArray(state.payload)
                ? state.payload
                : bookmarkTarget.payload,
        bookmarked: Boolean(state?.bookmarked),
        updatedAt: state?.updatedAt || null,
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
        extraClass,
        bookmarked ? "is-active" : "",
    ]
        .filter(Boolean)
        .join(" ");
    const title = bookmarked
        ? labels.activeTitle || "Bookmark is on"
        : labels.inactiveTitle || "Bookmark this item";
    return `
        <button
            class="${buttonClasses}"
            type="button"
            data-bookmark-target-type="${escapeHTML(bookmarkTarget.targetType)}"
            data-bookmark-target-id="${escapeHTML(bookmarkTarget.targetId)}"
            aria-pressed="${bookmarked ? "true" : "false"}"
            title="${escapeHTML(title)}"
            onclick="${clickHandler}"
        >${bookmarked ? "★" : "☆"}</button>
    `;
}

function buildPromptBookmarkButtonHtml(targetSpec, bookmarked, clickHandler, extraClass = "") {
    return buildBookmarkToggleButtonHtml(
        targetSpec,
        bookmarked,
        clickHandler,
        extraClass,
        {
            activeTitle: "Prompt bookmark is on",
            inactiveTitle: "Bookmark this prompt",
        }
    );
}

function updateBookmarkTargetButtonState(targetSpec, bookmarked, labels = {}) {
    const bookmarkTarget = normalizeBookmarkTargetSpec(targetSpec);
    if (!bookmarkTarget.targetType || !bookmarkTarget.targetId) return;
    document
        .querySelectorAll(
            `.bookmark-target-toggle[data-bookmark-target-type="${escapeJsString(bookmarkTarget.targetType)}"][data-bookmark-target-id="${escapeJsString(bookmarkTarget.targetId)}"]`
        )
        .forEach((button) => {
            button.classList.toggle("is-active", Boolean(bookmarked));
            button.setAttribute("aria-pressed", bookmarked ? "true" : "false");
            button.setAttribute(
                "title",
                bookmarked
                    ? labels.activeTitle || "Bookmark is on"
                    : labels.inactiveTitle || "Bookmark this item"
            );
            button.textContent = bookmarked ? "★" : "☆";
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
    void refreshBookmarkList();
}

function ensureConversationTab(convIdx) {
    captureActiveVirtualTabScrollState();
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

function closeTab(tabId, rememberHistory = true) {
    captureActiveVirtualTabScrollState();
    const index = openTabs.findIndex((tab) => tab.id === tabId);
    if (index < 0) return;
    const closedTab = openTabs[index];
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
    const fallback = openTabs[Math.max(0, index - 1)] || openTabs[0] || null;

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
                <button class="action-btn header-icon-btn" title="コピー" aria-label="コピー" onclick="copyFullText(${activeTab.convIdx})">⧉</button>
            </div>
        `
        : "";
    return sourceActionsHtml ? `<div class="page-top-tools">${sourceActionsHtml}</div>` : "";
}

function buildTabStripHtml() {
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
    return `
        <div class="tab-strip">
            <div class="tab-strip-tabs" role="tablist" aria-label="Open tabs">
                ${openTabs
                    .map((tab) => {
                        const tabConv = tab.type === "conversation" ? chatData[tab.convIdx] : null;
                        const isBookmarked = Boolean(tabConv?.bookmarked);
                        const kindIcon = tab.type === "virtual"
                            ? '<span class="tab-button-kind tab-button-kind-icon tab-button-kind-filter" aria-hidden="true"></span>'
                            : getThreadSourceIconHtml(tabConv, "tab-button-kind tab-button-kind-icon");
                        const kindLabel = tab.type === "virtual" ? "抽出タブ" : "会話タブ";
                        const label = escapeHTML(tab.title || "Untitled");
                        const bookmarkButton = tab.type === "conversation"
                            ? `
                                <span
                                    class="tab-bookmark ${isBookmarked ? "is-active" : ""}"
                                    role="button"
                                    aria-label="${isBookmarked ? "ブックマークを外す" : "ブックマークする"}"
                                    title="${isBookmarked ? "ブックマーク済み" : "ブックマークする"}"
                                    onclick="toggleConversationBookmarkByIndex(${tab.convIdx}, event)"
                                >${isBookmarked ? "★" : "☆"}</span>
                            `
                            : "";
                        return `
                            <div
                                class="tab-button ${tab.id === activeTabId ? "active" : ""}"
                                data-tab-id="${escapeHTML(tab.id)}"
                                role="tab"
                                aria-label="${kindLabel}: ${label}"
                                aria-selected="${tab.id === activeTabId ? "true" : "false"}"
                                tabindex="${tab.id === focusableTabId ? "0" : "-1"}"
                                onclick="activateTab('${escapeJsString(tab.id)}', event)"
                                onmousedown="handleTabMouseDown('${escapeJsString(tab.id)}', event)"
                                ondblclick="handleTabDoubleClick('${escapeJsString(tab.id)}', event)"
                            >
                                ${bookmarkButton}
                                ${kindIcon}
                                <span class="tab-button-label">${label}</span>
                                <span class="tab-close" role="button" aria-label="タブを閉じる" onclick="event.stopPropagation(); closeTab('${escapeJsString(tab.id)}')">×</span>
                            </div>
                        `;
                    })
                    .join("")}
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
    updateCodeBlockStickyOffset(viewer);
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
                preview: (item.message.text || "").split("\n")[0].slice(0, 24),
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

function getFolderIconSvgMarkup() {
    return `
        <svg viewBox="0 0 20 16" focusable="false">
            <path d="M1.75 3.5A2.25 2.25 0 0 1 4 1.25h3.1c.54 0 1.04.24 1.39.65l.78.93c.17.2.42.32.69.32H16A2.25 2.25 0 0 1 18.25 5.4v6.85A2.25 2.25 0 0 1 16 14.5H4a2.25 2.25 0 0 1-2.25-2.25V3.5Z" fill="currentColor" fill-opacity="0.18"></path>
            <path d="M1.75 5.2A2.25 2.25 0 0 1 4 2.95h3.28c.42 0 .82.16 1.12.45l.56.54c.3.29.7.45 1.12.45H16A2.25 2.25 0 0 1 18.25 6.64v5.61A2.25 2.25 0 0 1 16 14.5H4a2.25 2.25 0 0 1-2.25-2.25V5.2Z" fill="currentColor"></path>
        </svg>
    `;
}

function getThreadSourceIconHtml(conv, extraClasses = "") {
    const sourceClass = getConversationSourceClass(conv);
    const className = ["thread-source-icon", extraClasses, sourceClass ? `source-label-${sourceClass}` : ""]
        .filter(Boolean)
        .join(" ");
    return `<span class="${className}" aria-hidden="true">${getFolderIconSvgMarkup()}</span>`;
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

    const rawText = raw?.rawText || "";
    const hasCopyableRawText = raw?.available !== false && raw?.rawText !== null && raw?.rawText !== undefined;
    const rawBody = raw?.available === false
        ? '<div style="font-size: 13px; opacity: 0.76;">No linked raw source is stored for this conversation yet.</div>'
        : `
            <div style="margin-top: 12px;">
                <div style="font-size: 12px; opacity: 0.7; margin-bottom: 6px;">raw_text</div>
                <pre style="margin: 0; max-height: 320px; overflow: auto; padding: 12px; border-radius: 10px; border: 1px solid var(--border-color); background: rgba(127,127,127,0.08); color: inherit; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; word-break: break-word;">${escapeHTML(rawText)}</pre>
            </div>
        `;

    return `
        <section style="margin: 12px 0 18px; padding: 14px 16px; border: 1px solid var(--border-color); border-radius: 12px; background: rgba(127,127,127,0.06);">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom: 6px;">
                <div style="font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.82;">Raw Source Debug</div>
                <div class="raw-debug-panel-actions">
                    <button
                        class="raw-debug-panel-btn"
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
    let nextText = sourceText;
    nextText = nextText.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_match, _info, code) => {
        return placeholders.put(`<pre><code>${escapeHTML(code.replace(/\n$/, ""))}</code></pre>`);
    });
    nextText = nextText.replace(/```([\s\S]*?)```/g, (_match, code) => {
        return placeholders.put(`<pre><code>${escapeHTML(code.trim())}</code></pre>`);
    });
    nextText = nextText.replace(/`([^`\n]+)`/g, (_match, code) => {
        return placeholders.put(`<code>${escapeHTML(code)}</code>`);
    });
    return nextText;
}

function renderMathSegments(sourceText, placeholders) {
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
    nextText = replaceInlineDollarMath(nextText, placeholders);
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
        .map((cell, index) => `<th style="text-align:${alignments[index]};">${cell || "&nbsp;"}</th>`)
        .join("");
    const bodyHtml = bodyRows
        .map((cells) => {
            const normalizedCells = headerCells.map((_, index) => cells[index] || "");
            const cellHtml = normalizedCells
                .map((cell, index) => `<td style="text-align:${alignments[index]};">${cell || "&nbsp;"}</td>`)
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
    const mathPlaceholders = createHtmlPlaceholderStore("MATH_PLACEHOLDER");

    // Keep code segments opaque so later markdown/math passes cannot corrupt them.
    sourceText = protectCodeSegments(sourceText, codePlaceholders);
    sourceText = normalizeMathSourceArtifacts(sourceText);
    sourceText = renderMathSegments(sourceText, mathPlaceholders);

    let html = escapeHTML(sourceText);
    html = applyBasicMarkdown(html);
    html = mathPlaceholders.restore(html);
    return codePlaceholders.restore(html);
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

function getExtractFilterState() {
    // Canonical viewer-side extract filter state. Summary chips, preview requests,
    // directory scoping, and saved-filter payloads should all read from here.
    const filters = {
        service: getSelectedExtractServices(),
        model: getSelectedExtractModels(),
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

function setExtractModelMenuOpen(isOpen) {
    isExtractModelMenuOpen = !!isOpen;
    const picker = document.getElementById("extract-model-picker");
    if (picker) picker.classList.toggle("open", isExtractModelMenuOpen);
}

function toggleExtractModelMenu(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    const trigger = document.getElementById("extract-model-trigger");
    if (!trigger || trigger.disabled) return;
    setExtractModelMenuOpen(!isExtractModelMenuOpen);
}

function closeExtractModelMenu() {
    setExtractModelMenuOpen(false);
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

function syncExtractSortButton() {
    const input = document.getElementById("extract-sort");
    const button = document.getElementById("extract-sort-toggle");
    const label = document.getElementById("extract-sort-toggle-label");
    if (!input || !button || !label) return;
    const isDesc = input.value === "date-desc";
    button.dataset.direction = isDesc ? "desc" : "asc";
    label.textContent = isDesc ? "降順" : "昇順";
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
    EXTRACT_TEXT_FILTER_SPECS.forEach(({ key, summaryLabel }) => {
        const value = filters[key];
        if (String(value || "").trim()) {
            chips.push(`<button class="extract-chip" type="button" onclick="clearExtractFilterField('${escapeJsString(key)}')"><span class="extract-chip-label">${escapeHTML(summaryLabel)}: ${escapeHTML(value)}</span><span class="extract-chip-remove" aria-hidden="true">×</span></button>`);
        }
    });
    if (normalizeBookmarkedFilterValue(filters.bookmarked) === "bookmarked") {
        chips.push(`<button class="extract-chip" type="button" onclick="clearExtractFilterField('bookmarked')"><span class="extract-chip-label">bookmark: bookmarked only</span><span class="extract-chip-remove" aria-hidden="true">×</span></button>`);
    } else if (normalizeBookmarkedFilterValue(filters.bookmarked) === "not-bookmarked") {
        chips.push(`<button class="extract-chip" type="button" onclick="clearExtractFilterField('bookmarked')"><span class="extract-chip-label">bookmark: not bookmarked</span><span class="extract-chip-remove" aria-hidden="true">×</span></button>`);
    }

    root.innerHTML = chips.join("");
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
    }
    scheduleVirtualThreadPreview();
}

function clearExtractFilterField(key) {
    const spec = EXTRACT_TEXT_FILTER_SPECS.find((item) => item.key === key);
    const elementId = spec ? spec.elementId : key === "bookmarked" ? "extract-bookmarked" : "";
    if (!elementId) return;
    const element = document.getElementById(elementId);
    if (element) {
        element.value = key === "bookmarked" ? "all" : "";
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
    syncExtractSortButton();
    closeExtractModelMenu();
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

function requestSavedViews() {
    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.fetchSavedViews) {
            return [];
        }
        return new Promise((resolve) => {
            bridge.fetchSavedViews(function (result) {
                try {
                    resolve(result ? JSON.parse(result) : []);
                } catch (_error) {
                    resolve([]);
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

function saveSavedViewEntry(name, filters, savedViewId = null) {
    if (!hasActiveExtractFilters(filters)) {
        return Promise.resolve(null);
    }
    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.saveSavedView) {
            return null;
        }
        return new Promise((resolve) => {
            bridge.saveSavedView(
                JSON.stringify({
                    id: savedViewId,
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

function deleteSavedViewEntry(savedViewId) {
    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.deleteSavedView) {
            return { deleted: false };
        }
        return new Promise((resolve) => {
            bridge.deleteSavedView(
                JSON.stringify({
                    id: savedViewId,
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

function requestBookmarksList() {
    return waitForBridge().then((bridge) => {
        if (!bridge || !bridge.fetchBookmarks) {
            return [];
        }
        return new Promise((resolve) => {
            bridge.fetchBookmarks(function (result) {
                try {
                    resolve(result ? JSON.parse(result) : []);
                } catch (_error) {
                    resolve([]);
                }
            });
        });
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

async function togglePromptBookmark(convIdx, messageIndex, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const conv = await loadConversationDetail(convIdx);
    const message = conv?.messages?.[messageIndex];
    if (!conv?.id || message?.role !== "user") return;
    const bookmarkTarget = buildPromptBookmarkTargetSpec(conv, messageIndex, message.text || "");
    const currentState = getCachedBookmarkState(bookmarkTarget);
    const nextState = !Boolean(currentState?.bookmarked);
    const result = await requestBookmarkChange(bookmarkTarget, nextState);
    updateBookmarkTargetButtonState(bookmarkTarget, result?.bookmarked, {
        activeTitle: "Prompt bookmark is on",
        inactiveTitle: "Bookmark this prompt",
    });
    void refreshBookmarkList();
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
    updateBookmarkTargetButtonState(bookmarkTarget, result?.bookmarked, {
        activeTitle: "Virtual fragment bookmark is on",
        inactiveTitle: "Bookmark this fragment",
    });
    void refreshBookmarkList();
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
    updateBookmarkTargetButtonState(bookmarkTarget, result?.bookmarked, {
        activeTitle: "Saved view bookmark is on",
        inactiveTitle: "Bookmark this saved view",
    });
    void refreshBookmarkList();
}

function getBookmarkListActionLabel(entry) {
    if (entry?.targetType === "saved_view") {
        return "Reuse";
    }
    return "Open";
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

async function toggleBookmarkListEntry(targetType, targetId, payload, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const bookmarkTarget = buildBookmarkTargetSpec(
        targetType,
        targetId,
        parseBookmarkPayload(payload)
    );
    await requestBookmarkChange(bookmarkTarget, false);
    void refreshBookmarkList();
}

function renderBookmarkList() {
    const root = document.getElementById("extract-bookmark-list");
    if (!root) return;

    if (!Array.isArray(bookmarkListEntries) || bookmarkListEntries.length === 0) {
        root.innerHTML = '<div class="extract-history-empty">まだ bookmark はないよ</div>';
        return;
    }

    root.innerHTML = bookmarkListEntries.map((entry) => {
        const updatedAt = formatFilterHistoryDate(entry.updatedAt || entry.createdAt || "");
        const bookmarkTarget = buildBookmarkTargetSpec(
            entry.targetType,
            entry.targetId,
            entry.payload || {}
        );
        const payload = encodeURIComponent(JSON.stringify(entry.payload || {}));
        return `
            <article class="extract-history-item">
                <div class="extract-history-meta">
                    <div class="extract-history-meta-main">
                        <span class="extract-history-label">${escapeHTML(entry.label || entry.targetId || "Bookmark")}</span>
                        <div class="extract-history-submeta">
                            <span class="extract-history-type">${escapeHTML(entry.targetType || "unknown")}</span>
                            <span class="extract-history-date">${escapeHTML(updatedAt ? `updated ${updatedAt}` : "")}</span>
                        </div>
                    </div>
                    ${buildBookmarkToggleButtonHtml(
                        bookmarkTarget,
                        true,
                        `toggleBookmarkListEntry('${escapeJsString(entry.targetType || "")}', '${escapeJsString(entry.targetId || "")}', '${payload}', event)`,
                        "saved-view-bookmark",
                        {
                            activeTitle: "Remove bookmark",
                            inactiveTitle: "Bookmark this item",
                        }
                    )}
                </div>
                <div class="extract-history-actions">
                    <button class="extract-history-btn" type="button" onclick="openBookmarkEntry('${escapeJsString(entry.targetType || "")}', '${escapeJsString(entry.targetId || "")}', '${payload}')">${getBookmarkListActionLabel(entry)}</button>
                </div>
            </article>
        `;
    }).join("");
}

async function refreshBookmarkList() {
    bookmarkListEntries = await requestBookmarksList();
    (bookmarkListEntries || []).forEach((entry) => {
        cacheBookmarkState(entry);
    });
    renderBookmarkList();
}

function formatFilterHistoryDate(value) {
    if (!value) return "";
    const text = String(value);
    return text.length >= 16 ? text.slice(0, 16) : text;
}

function renderRecentFilters() {
    const root = document.getElementById("extract-history-list");
    if (!root) return;

    if (!Array.isArray(recentExtractFilters) || recentExtractFilters.length === 0) {
        root.innerHTML = '<div class="extract-history-empty">まだフィルタ履歴はないよ</div>';
        return;
    }

    root.innerHTML = recentExtractFilters.map((entry) => {
        const serializedFilters = encodeURIComponent(JSON.stringify(entry.filters || {}));
        const usedAt = formatFilterHistoryDate(entry.lastUsedAt || entry.createdAt || "");
        return `
            <article class="extract-history-item">
                <div class="extract-history-meta">
                    <span class="extract-history-label">${escapeHTML(entry.label || "Recent Filter")}</span>
                    <span class="extract-history-date">${escapeHTML(usedAt)}</span>
                </div>
                <div class="extract-history-actions">
                    <button class="extract-history-btn" type="button" onclick="openVirtualThreadFromSavedFilter('${serializedFilters}')">Open as Virtual Thread</button>
                    <button class="extract-history-btn" type="button" onclick="applySavedFilterToDirectory('${serializedFilters}')">Apply to Directory</button>
                    <button class="extract-history-btn" type="button" onclick="reuseSavedFilter('${serializedFilters}')">Edit</button>
                </div>
            </article>
        `;
    }).join("");
}

async function refreshRecentFilters() {
    recentExtractFilters = await requestRecentFilters();
    renderRecentFilters();
}

function renderSavedViews() {
    const root = document.getElementById("extract-saved-view-list");
    if (!root) return;

    // Saved Views Phase 2 flow stays intentionally small:
    // save filter definition -> render list -> bookmark/apply/open through the same
    // view record. Manual testing should cover all three entry points together.
    if (!Array.isArray(savedExtractViews) || savedExtractViews.length === 0) {
        root.innerHTML = '<div class="extract-history-empty">まだ saved view はないよ</div>';
        return;
    }

    root.innerHTML = savedExtractViews.map((entry) => {
        const serializedFilters = encodeURIComponent(JSON.stringify(entry.filters || {}));
        const updatedAt = formatFilterHistoryDate(entry.updatedAt || entry.lastUsedAt || entry.createdAt || "");
        const safeId = Number.parseInt(entry.id, 10);
        const bookmarkTarget = buildSavedViewBookmarkTargetSpec(entry);
        const bookmarkState = getCachedBookmarkState(bookmarkTarget);
        return `
            <article class="extract-history-item">
                <div class="extract-history-meta">
                    <div class="extract-history-meta-main">
                        <span class="extract-history-label">${escapeHTML(entry.name || entry.label || "Saved View")}</span>
                        <span class="extract-history-date">${escapeHTML(updatedAt ? `updated ${updatedAt}` : "")}</span>
                    </div>
                    ${buildBookmarkToggleButtonHtml(
                        bookmarkTarget,
                        Boolean(bookmarkState?.bookmarked),
                        `toggleSavedViewBookmark(${Number.isNaN(safeId) ? 0 : safeId}, event)`,
                        "saved-view-bookmark",
                        {
                            activeTitle: "Saved view bookmark is on",
                            inactiveTitle: "Bookmark this saved view",
                        }
                    )}
                </div>
                <div class="extract-history-actions">
                    <button class="extract-history-btn" type="button" onclick="openVirtualThreadFromStoredFilter('${serializedFilters}')">Open as Virtual Thread</button>
                    <button class="extract-history-btn" type="button" onclick="applyStoredFilterToDirectory('${serializedFilters}')">Apply to Directory</button>
                    <button class="extract-history-btn" type="button" onclick="loadStoredFilterIntoExtractPanel('${serializedFilters}')">Edit</button>
                    <button class="extract-history-btn" type="button" onclick="deleteSavedViewById(${Number.isNaN(safeId) ? 0 : safeId})">Delete</button>
                </div>
            </article>
        `;
    }).join("");
}

async function refreshSavedViews() {
    savedExtractViews = await requestSavedViews();
    void ensureSavedViewBookmarkStates(savedExtractViews);
    renderSavedViews();
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
    if (String(nextFilters.dateFrom || "").trim() || String(nextFilters.dateTo || "").trim()) {
        return `${nextFilters.dateFrom || "..."} -> ${nextFilters.dateTo || "..."}`;
    }
    if (normalizeBookmarkedFilterValue(nextFilters.bookmarked) === "bookmarked") {
        return "bookmarked";
    }
    return "Saved View";
}

async function saveCurrentSavedView() {
    const filters = getExtractFilterState();
    if (!hasActiveExtractFilters(filters)) {
        showToast("条件を入れてから保存してね");
        return;
    }
    const suggestedName = buildSavedViewDraftName(filters);
    const enteredName = window.prompt("Saved View name (same name overwrites)", suggestedName);
    if (enteredName === null) return;
    const normalizedName = String(enteredName || "").trim();
    if (!normalizedName) {
        showToast("名前を入れてね");
        return;
    }
    const saved = await saveSavedViewEntry(normalizedName, filters);
    if (!saved) {
        showToast("Saved View を保存できなかったよ");
        return;
    }
    await refreshSavedViews();
    showToast(`Saved View saved: ${normalizedName}`);
}

async function deleteSavedViewById(savedViewId) {
    const entry = (savedExtractViews || []).find((item) => String(item.id) === String(savedViewId));
    if (!entry) return;
    const confirmed = window.confirm(`Delete saved view "${entry.name || entry.label || "Saved View"}"?`);
    if (!confirmed) return;
    const result = await deleteSavedViewEntry(savedViewId);
    if (!result || !result.deleted) {
        showToast("Saved View を削除できなかったよ");
        return;
    }
    await refreshSavedViews();
    showToast("Saved View deleted");
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
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeExtractModelMenu();
        }
    });
}

function populateExtractOptions(options) {
    extractFilterOptions = options || { services: [], models: [], modelsByService: {}, sourceFiles: [] };

    const serviceButtons = document.getElementById("extract-service-buttons");
    if (serviceButtons) {
        serviceButtons.innerHTML = (extractFilterOptions.services || [])
            .map((service) => {
                return `<button class="extract-service-btn" type="button" data-value="${escapeHTML(service)}" onclick="setExtractService('${escapeJsString(service)}', event)">${escapeHTML(formatExtractServiceLabel(service))}</button>`;
            })
            .join("");
        syncExtractServiceButtons();
    }
    renderExtractModelMenu();
    syncExtractModelTrigger();
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
    appliedExtractConversationIds = null;
    markTreeStructureDirty();
    syncExtractServiceButtons();
    renderExtractModelMenu();
    syncExtractModelTrigger();
    syncExtractSortButton();
    closeExtractModelMenu();
    scheduleVirtualThreadPreview();
    renderTree();
}

async function openVirtualThreadFromFilters() {
    const filters = getExtractFilterState();
    await saveRecentFilterEntry(filters);
    await refreshRecentFilters();
    const virtualThread = await requestVirtualThread(filters);
    if (!virtualThread) return;
    openVirtualTab(virtualThread);
    renderActiveTab();
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
    const toggle = document.getElementById("sidebar-filter-toggle");
    if (toggle) toggle.checked = true;
    persistSearchPreferences();
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
        const previewItems = buildPromptPreviews(conv);
        const visiblePreviewItems = getVisibleDirectoryPreviewItems(previewItems, result, directoryFilterState);

        let promptsHtml = "";
        if (shouldRenderPromptList) {
            visiblePreviewItems.forEach((item) => {
                const safeText = escapeHTML(item.preview || "");
                const hasMatch = !isSearch || result.matchedMessageIndexes.includes(item.messageIndex);
                const promptBookmarkTarget = buildPromptBookmarkTargetSpec(
                    conv,
                    item.messageIndex,
                    item.preview || ""
                );
                const promptBookmarkState = getCachedBookmarkState(promptBookmarkTarget);
                promptsHtml += `
                    <div class="prompt-item-row ${hasMatch ? "has-match" : "no-match"}">
                        ${buildPromptBookmarkButtonHtml(
                            promptBookmarkTarget,
                            Boolean(promptBookmarkState?.bookmarked),
                            `togglePromptBookmark(${convIdx}, ${item.messageIndex}, event)`,
                            "prompt-nav-bookmark"
                        )}
                        <button type="button"
                           class="prompt-item ${hasMatch ? "has-match" : "no-match"}"
                           id="nav-msg-${convIdx}-${item.messageIndex}"
                           tabindex="0"
                           data-item-type="prompt"
                           data-conv-idx="${convIdx}"
                           data-msg-idx="${item.messageIndex}"
                           data-focus-key="prompt-${convIdx}-${item.messageIndex}"
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
                    data-focus-key="conv-${convIdx}"
                    onclick="openConversationFromTree(event, ${convIdx})">${getThreadSourceIconHtml(conv)} <span class="thread-title">${hitBadge}${escapeHTML(conv.title)}</span></summary>
                <div class="prompt-list">${promptsHtml}</div>
            </details>`;
    });

    if (!htmlStr) {
        treeRoot.innerHTML = `<div class="prompt-item prompt-item-muted" style="margin: 10px 0 0 4px;">表示できるスレッドがないよ。</div>`;
    } else {
        treeRoot.innerHTML = htmlStr;
    }
    treeRoot.dataset.structureSignature = nextStructureSignature;
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
    if (event && event.currentTarget) {
        rememberSidebarFocus(event.currentTarget);
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
            turnMatched ? "has-match" : "no-match",
            !turnMatched && isMatchFilterActive ? "filtered-out" : "",
        ]
            .filter(Boolean)
            .join(" ");
        html += `<div class="${turnClasses}" id="turn-${convIdx}-${startIndex}">`;
        if (conv.messages[i] && conv.messages[i].role === "user") {
            promptCount += 1;
            const prompt = conv.messages[i];
            const promptBookmarkTarget = buildPromptBookmarkTargetSpec(
                conv,
                i,
                prompt.text || ""
            );
            const promptBookmarkState = getCachedBookmarkState(promptBookmarkTarget);
            html += `
                <div class="chat-row user" id="msg-${convIdx}-${i}">
                    <div class="avatar user-icon"></div>
                    <div class="bubble-wrapper">
                        <div class="prompt-meta-row">
                            <div class="prompt-counter">Prompt ${promptCount}/${Math.max(1, totalPromptCount)}</div>
                        </div>
                        <div class="bubble">
                            ${buildPromptBookmarkButtonHtml(
                                promptBookmarkTarget,
                                Boolean(promptBookmarkState?.bookmarked),
                                `togglePromptBookmark(${convIdx}, ${i}, event)`,
                                "prompt-bubble-bookmark"
                            )}
                            ${renderContent(prompt.text || "")}
                        </div>
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
                        <div class="bubble">${renderContent(answer.text)}</div>
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
    enhanceCodeBlocks(viewer);
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
        chips.push('<span class="extract-chip">bookmark: bookmarked only</span>');
    } else if (normalizeBookmarkedFilterValue(filters.bookmarked) === "not-bookmarked") {
        chips.push('<span class="extract-chip">bookmark: not bookmarked</span>');
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
                                            activeTitle: "Virtual fragment bookmark is on",
                                            inactiveTitle: "Bookmark this fragment",
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
    const rawText = entry?.data?.rawText;

    if (!entry || entry.data?.available === false || rawText === null || rawText === undefined) {
        showToast("コピーできる raw_text がないよ");
        return;
    }

    copyTextToClipboard(String(rawText))
        .catch(() => {
            fallbackCopyText(String(rawText));
        })
        .finally(() => {
            setRawCopyButtonState(triggerButton, true);
            if (triggerButton?._copyResetTimer) {
                window.clearTimeout(triggerButton._copyResetTimer);
            }
            if (triggerButton) {
                triggerButton._copyResetTimer = window.setTimeout(() => {
                    setRawCopyButtonState(triggerButton, false);
                }, 1400);
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

function updateCodeBlockStickyOffset(viewer = document.getElementById("chat-viewer")) {
    if (!viewer) return;

    const tabStrip = viewer.querySelector(":scope > .tab-strip");
    const filterRow = viewer.querySelector(":scope > .header-filter-row");
    const stickyTop =
        (tabStrip ? tabStrip.offsetHeight || 0 : 0) +
        (filterRow ? filterRow.offsetHeight || 0 : 0) +
        6;

    viewer.style.setProperty("--code-block-sticky-top", `${stickyTop}px`);
}

function enhanceCodeBlocks(root) {
    if (!root) return;
    root.querySelectorAll("pre > code").forEach((codeElement) => {
        const pre = codeElement.parentElement;
        if (!pre || pre.dataset.codeCopyEnhanced === "true") return;

        pre.dataset.codeCopyEnhanced = "true";
        const wrapper = document.createElement("div");
        wrapper.className = "code-block-wrapper";

        const toolbar = document.createElement("div");
        toolbar.className = "code-block-toolbar";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "code-copy-button raw-debug-panel-btn";
        button.title = "コードをコピー";
        setCodeCopyButtonState(button, false);
        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            copyCodeBlock(button, codeElement);
        });
        toolbar.appendChild(button);

        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(toolbar);
        wrapper.appendChild(pre);

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
        ensureRenderer();
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
        sidebarMode = localStorage.getItem(STORAGE_KEYS.sidebarMode) || "threads";

        setupObserver();
        if (viewer) {
            viewer.addEventListener("scroll", () => {
                captureActiveVirtualTabScrollState(viewer);
                scheduleConversationRootDockUpdate();
            }, { passive: true });
        }
        ensureTabMouseDragInteractions();
        ensureViewerToolsInteractions();
        ensureExtractInteractions();
        ensureTabStripKeyboardNavigation();
        ensureSidebarKeyboardNavigation();
        ensureHiddenSidebarKeyboardNavigation();
        ensureGlobalViewerKeyboardNavigation();
        ensureNativeShortcutFallbacks();
        ensureTabSessionLifecyclePersistence();
        ensureReadingContextWidgetFocusBridges();
        debugPerfLog("boot:before-filter-options");
        populateExtractOptions(await requestFilterOptions());
        debugPerfLog("boot:after-filter-options");
        await refreshSavedViews();
        debugPerfLog("boot:after-saved-views");
        await refreshBookmarkList();
        debugPerfLog("boot:after-bookmarks");
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
