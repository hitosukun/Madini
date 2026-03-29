import base64
import json

from app_paths import (
    ASSET_DIR,
    CUSTOM_AI_AVATAR,
    CUSTOM_CSS,
    CUSTOM_USER_AVATAR,
)


DEFAULT_THEMES = {
    "default": {
        "name": "Default",
        "color": "#6b8fd6",
        "light": {
            "bg-color": "#f6f6f8",
            "text-color": "#1f1f24",
            "border-color": "#d8d9de",
            "sidebar-bg": "#eeeff3",
            "sidebar-text": "#4d5563",
            "accent-color": "#6b8fd6",
            "bubble-assist-bg": "#ffffff",
            "bubble-user-bg": "#dbe7fb",
            "bubble-user-text": "#1f3455",
        },
        "dark": {
            "bg-color": "#1e1f22",
            "text-color": "#f3f4f7",
            "border-color": "#3b3d44",
            "sidebar-bg": "#282a2f",
            "sidebar-text": "#cfd4dc",
            "accent-color": "#84a6ec",
            "bubble-assist-bg": "#24262b",
            "bubble-user-bg": "#314b74",
            "bubble-user-text": "#f6f8ff",
        },
    },
    "miku": {
        "name": "Miku",
        "color": "#4aa79f",
        "light": {
            "bg-color": "#f5f7f7",
            "text-color": "#1e2928",
            "border-color": "#d7dfde",
            "sidebar-bg": "#edf2f1",
            "sidebar-text": "#4b5c5a",
            "accent-color": "#4aa79f",
            "bubble-assist-bg": "#ffffff",
            "bubble-user-bg": "#d9efec",
            "bubble-user-text": "#18413d",
        },
        "dark": {
            "bg-color": "#1c2121",
            "text-color": "#eef3f2",
            "border-color": "#364140",
            "sidebar-bg": "#252b2b",
            "sidebar-text": "#c7d2d0",
            "accent-color": "#67bbb3",
            "bubble-assist-bg": "#242c2b",
            "bubble-user-bg": "#2b5a54",
            "bubble-user-text": "#f2fbfa",
        },
    },
    "sepia": {
        "name": "Sepia",
        "color": "#c89367",
        "light": {
            "bg-color": "#f7f4f0",
            "text-color": "#302922",
            "border-color": "#ddd5cc",
            "sidebar-bg": "#f0ebe5",
            "sidebar-text": "#615548",
            "accent-color": "#c89367",
            "bubble-assist-bg": "#ffffff",
            "bubble-user-bg": "#ecdcc9",
            "bubble-user-text": "#503725",
        },
        "dark": {
            "bg-color": "#201d1a",
            "text-color": "#eee5db",
            "border-color": "#3d3833",
            "sidebar-bg": "#2b2723",
            "sidebar-text": "#d1c3b5",
            "accent-color": "#d8a27a",
            "bubble-assist-bg": "#2b2824",
            "bubble-user-bg": "#5d4534",
            "bubble-user-text": "#fff7ef",
        },
    },
}


def merge_themes(user_themes=None):
    themes = DEFAULT_THEMES.copy()
    if user_themes:
        themes.update(user_themes)
    return themes


def _read_text(path):
    return path.read_text(encoding="utf-8") if path.exists() else ""


def _to_data_uri(path):
    if not path.exists():
        return ""
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _escape_json(value):
    return (
        json.dumps(value, ensure_ascii=False)
        .replace("&", "\\u0026")
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
    )


def build_viewer_data_script(conversations):
    return f"window.__CHAT_DATA__ = {_escape_json(conversations)};\n"


def build_viewer_index_script(index):
    return f"window.__CHAT_INDEX__ = {_escape_json(index)};\nwindow.__CHAT_DETAILS__ = window.__CHAT_DETAILS__ || {{}};\n"


def _build_theme_buttons(themes, scope="inline"):
    return "".join(
        [
            (
                f"<button class=\"theme-btn\" data-theme-btn=\"{scope}\" data-theme-key=\"{key}\" "
                f"onclick=\"switchTheme('{key}')\" "
                f"style=\"background-color: {value['color']};\"></button>"
            )
            for key, value in themes.items()
        ]
    )


def build_viewer_html(
    conversations,
    user_themes=None,
    system_theme="light",
    show_toast=False,
    frameless_host=False,
):
    themes = merge_themes(user_themes)
    css_text = _read_text(ASSET_DIR / "style.css")
    css_text += "\n" + _read_text(ASSET_DIR / "math.css")
    js_text = _read_text(ASSET_DIR / "viewer.js")

    if CUSTOM_CSS.exists():
        css_text += "\n" + _read_text(CUSTOM_CSS)

    user_avatar = _to_data_uri(CUSTOM_USER_AVATAR if CUSTOM_USER_AVATAR.exists() else ASSET_DIR / "avatar_jenna.png")
    ai_avatar = _to_data_uri(CUSTOM_AI_AVATAR if CUSTOM_AI_AVATAR.exists() else ASSET_DIR / "avatar_madini.png")
    css_text = (
        css_text.replace("__IMG_USER__", f"url('{user_avatar}')")
        .replace("__IMG_AI__", f"url('{ai_avatar}')")
        .replace("__LABEL_USER__", '""')
        .replace("__LABEL_AI__", '""')
    )

    boot_options = _escape_json(
        {
            "systemTheme": system_theme,
            "showToast": show_toast,
            "framelessHost": frameless_host,
        }
    )

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>{css_text}</style>
<script src="qrc:///qtwebchannel/qwebchannel.js"></script>
</head>
<body class="{'frameless-host' if frameless_host else ''}">
<div id="sidebar">
    <div class="sidebar-header" onmousedown="maybeStartWindowDrag(event)">
        <div class="sidebar-mode-switch" role="tablist" aria-label="左ペインモード">
            <button id="sidebar-mode-threads" class="sidebar-mode-btn active" type="button" role="tab" aria-selected="true" onclick="switchSidebarMode('threads')"><span class="sidebar-mode-btn-icon" aria-hidden="true">📁</span><span>ディレクトリ</span></button>
            <button id="sidebar-mode-extract" class="sidebar-mode-btn" type="button" role="tab" aria-selected="false" onclick="switchSidebarMode('extract')"><span class="sidebar-mode-btn-icon sidebar-mode-btn-icon-filter" aria-hidden="true"></span><span>フィルタ</span></button>
        </div>
        <div id="thread-list-panel" class="sidebar-panel active">
        <div class="tree-actions">
            <button id="tree-expand-toggle" class="icon-toggle branch-toggle-button" type="button" onclick="toggleAllTreesButton()" title="通常表示: 会話ごとに開閉" aria-pressed="false">
                <span class="branch-toggle-icon" aria-hidden="true">
                    <span class="branch-caret"></span>
                </span>
                <span class="branch-toggle-label" aria-hidden="true">個別</span>
            </button>
            <div class="tree-actions-trailing">
                <button
                    id="sidebar-filter-toggle"
                    class="extract-manager-pill sidebar-filter-pill circle-pill circle-pill-md"
                    type="button"
                    title="フィルタを反映"
                    aria-label="フィルタを反映"
                    aria-pressed="false"
                    onclick="toggleSidebarFilterButton()"
                >
                    <span class="tab-button-kind tab-button-kind-icon tab-button-kind-filter" aria-hidden="true"></span>
                </button>
                <input type="hidden" id="extract-sort" value="date-asc">
                <button id="extract-sort-toggle" class="extract-cycle-btn extract-sort-toggle tree-sort-toggle circle-pill circle-pill-md" type="button" onclick="toggleExtractSort(event)" title="昇順" aria-label="昇順">
                    <span class="extract-sort-icon" aria-hidden="true"></span>
                </button>
            </div>
        </div>
        <div id="index-tree"></div>
        </div>
        <div id="extract-panel" class="sidebar-panel">
            <div class="extract-form">
                <div class="extract-summary extract-summary-top" title="Preview count and date-based sort use the same primary time rule.">
                    <div class="extract-summary-head">
                        <div class="extract-summary-copy">
                            <div class="extract-hit-count" title="Primary time: source_created_at, then imported_at, then date_str."><span id="extract-hit-count">0</span> 件</div>
                            <div class="extract-summary-note" title="Preview count and date sort use primary time.">preview / sort also use primary time</div>
                        </div>
                        <div class="extract-summary-actions">
                            <button class="action-btn secondary-btn header-text-btn extract-summary-text-btn" type="button" title="ディレクトリに適用" aria-label="ディレクトリに適用" onclick="applyCurrentFiltersToDirectory()">開く</button>
                            <button class="action-btn secondary-btn header-text-btn extract-summary-text-btn" type="button" title="条件をクリア" aria-label="条件をクリア" onclick="clearVirtualThreadFilters()">クリア</button>
                        </div>
                    </div>
                    <div id="extract-active-filters" class="extract-active-filters"></div>
                </div>
                <div class="extract-grid">
                    <div class="extract-field extract-field-wide">
                        <span>service</span>
                        <input type="hidden" id="extract-service" value="[]">
                        <div id="extract-service-buttons" class="extract-service-buttons"></div>
                    </div>
                    <div class="extract-field extract-field-wide">
                        <span>model</span>
                        <input type="hidden" id="extract-model" value="[]">
                        <div id="extract-model-picker" class="extract-model-picker">
                            <button id="extract-model-trigger" class="extract-picker-trigger" type="button" onclick="toggleExtractModelMenu(event)">
                                <span id="extract-model-trigger-label">serviceを選ぶ</span>
                                <span class="extract-picker-caret" aria-hidden="true"></span>
                            </button>
                            <div id="extract-model-menu" class="extract-model-menu"></div>
                        </div>
                    </div>
                    <div class="extract-field extract-field-wide extract-date-row">
                        <label class="extract-field">
                            <span>date from</span>
                            <input type="date" id="extract-date-from" onchange="scheduleVirtualThreadPreview()">
                        </label>
                        <label class="extract-field">
                            <span>date to</span>
                            <input type="date" id="extract-date-to" onchange="scheduleVirtualThreadPreview()">
                        </label>
                    </div>
                    <div
                        class="extract-date-note extract-field-wide"
                        title="Date filter uses primary time: source_created_at, then imported_at, then date_str."
                    >date filter uses primary time: source_created_at -> imported_at -> date_str</div>
                    <label class="extract-field extract-field-wide">
                        <span>title</span>
                        <input type="text" id="extract-title" oninput="scheduleVirtualThreadPreview()">
                    </label>
                    <label class="extract-field extract-field-wide">
                        <span>prompt</span>
                        <textarea id="extract-prompt" rows="2" oninput="scheduleVirtualThreadPreview()"></textarea>
                    </label>
                    <label class="extract-field extract-field-wide">
                        <span>response</span>
                        <textarea id="extract-response" rows="2" oninput="scheduleVirtualThreadPreview()"></textarea>
                    </label>
                    <label class="extract-field">
                        <span>source file</span>
                        <input type="text" id="extract-source-file" list="extract-source-file-options" oninput="scheduleVirtualThreadPreview()">
                        <datalist id="extract-source-file-options"></datalist>
                    </label>
                    <label class="extract-field">
                        <span>starred prompts</span>
                        <select id="extract-bookmarked" onchange="scheduleVirtualThreadPreview()">
                            <option value="all">all</option>
                            <option value="bookmarked">has starred prompt</option>
                            <option value="not-bookmarked">without starred prompt</option>
                        </select>
                    </label>
                </div>
            </div>
        </div>
    </div>
</div>
<div id="resizer" aria-hidden="true"></div>
<div id="chat-viewer" data-current-conv="">
    <div style="text-align:center; margin-top:150px; color:#999;">左のツリーから物語を読み返そう</div>
</div>
<div id="toast" class="toast" aria-live="polite"></div>

<template id="viewer-controls-inline-template">
    <div class="viewer-header-controls">
        <div class="theme-selector viewer-theme-selector">{_build_theme_buttons(themes, "inline")}</div>
        <div class="utility-toggles viewer-utility-toggles">
            <button class="icon-toggle header-view-toggle" data-view-setting="mode" type="button" onclick="toggleColorMode()" title="明暗を切り替え">☀︎</button>
            <button class="icon-toggle text-size-toggle-button header-view-toggle" data-view-setting="text-size" type="button" onclick="toggleTextSizeButton()" title="文字サイズを切り替え">
                <span class="size-toggle-icon" aria-hidden="true">
                    <span class="size-a size-a-large">A</span>
                    <span class="size-a size-a-small">A</span>
                </span>
            </button>
        </div>
    </div>
</template>

<template id="viewer-controls-menu-template">
    <div class="viewer-settings-section">
        <div class="viewer-settings-section-label">Appearance</div>
        <div class="theme-selector viewer-theme-selector viewer-theme-selector-menu">{_build_theme_buttons(themes, "menu")}</div>
        <div class="utility-toggles viewer-utility-toggles viewer-utility-toggles-menu">
            <button class="icon-toggle header-view-toggle viewer-menu-toggle" data-view-setting="mode" type="button" onclick="toggleColorMode()" title="明暗を切り替え"><span class="viewer-menu-toggle-icon">☀︎</span><span>表示モード</span></button>
            <button class="icon-toggle text-size-toggle-button header-view-toggle viewer-menu-toggle" data-view-setting="text-size" type="button" onclick="toggleTextSizeButton()" title="文字サイズを切り替え">
                <span class="size-toggle-icon" aria-hidden="true">
                    <span class="size-a size-a-large">A</span>
                    <span class="size-a size-a-small">A</span>
                </span>
                <span>文字サイズ</span>
            </button>
        </div>
    </div>
</template>

<script id="theme-data" type="application/json">{_escape_json(themes)}</script>
<script src="./viewer_index.js"></script>
<script>{js_text}</script>
<script>
document.addEventListener('DOMContentLoaded', function () {{
    if (typeof bootViewer === 'function') {{
        bootViewer({boot_options});
    }}
}});
</script>
</body>
</html>"""
