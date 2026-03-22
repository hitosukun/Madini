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


def _build_theme_buttons(themes):
    return "".join(
        [
            (
                f"<button id=\"btn-theme-{key}\" class=\"theme-btn\" "
                f"onclick=\"switchTheme('{key}')\" "
                f"style=\"background-color: {value['color']};\"></button>"
            )
            for key, value in themes.items()
        ]
    )


def build_viewer_html(conversations, user_themes=None, system_theme="light", show_toast=False):
    themes = merge_themes(user_themes)
    css_text = _read_text(ASSET_DIR / "style.css")
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
        {"systemTheme": system_theme, "showToast": show_toast}
    )

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>{css_text}</style>
<script src="qrc:///qtwebchannel/qwebchannel.js"></script>
</head>
<body>
<div id="sidebar">
    <div class="sidebar-header">
        <div class="search-container">
            <input type="text" id="searchBar" onkeypress="if(event.key === 'Enter') executeSearch()">
            <button class="action-btn" onclick="executeSearch()">検索</button>
        </div>
        <div class="search-options">
            <div class="search-targets">
                <label class="search-target-label"><input type="checkbox" id="chk-title" checked onchange="handleSearchTargetChange()"> <span class="search-target-pill">タイトル</span></label>
                <label class="search-target-label"><input type="checkbox" id="chk-prompt" checked onchange="handleSearchTargetChange()"> <span class="search-target-pill">プロンプト</span></label>
                <label class="search-target-label"><input type="checkbox" id="chk-answer" checked onchange="handleSearchTargetChange()"> <span class="search-target-pill">回答</span></label>
            </div>
            <div class="sort-options">
                <select id="sort-select" onchange="executeSearch()">
                    <option value="date-desc">日付(新)</option>
                    <option value="date-asc">日付(古)</option>
                    <option value="original">標準</option>
                    <option value="hits-desc">ヒット数(降)</option>
                    <option value="title-asc">五十音(昇)</option>
                </select>
            </div>
        </div>
        <div class="tree-actions">
            <button id="tree-expand-toggle" class="icon-toggle branch-toggle-button" type="button" onclick="toggleAllTreesButton()" title="ツリー全体の開閉を切り替え">
                <span class="branch-toggle-icon" aria-hidden="true">
                    <span class="branch-caret"></span>
                </span>
            </button>
            <label class="filter-toggle">
                <input type="checkbox" id="sidebar-filter-toggle" onchange="toggleSidebarFilter(this.checked)">
                <span class="toggle-slider"></span>ヒットのみ
            </label>
        </div>
    </div>
    <div id="index-tree"></div>
</div>
<div id="resizer">
    <button id="sidebar-toggle" class="icon-toggle sidebar-toggle-button boundary-sidebar-toggle" type="button" onclick="toggleSidebarVisibilityButton()" title="サイドバーを隠す" data-direction="left" aria-label="サイドバーを隠す"></button>
</div>
<div id="chat-viewer" data-current-conv="">
    <div style="text-align:center; margin-top:150px; color:#999;">左のツリーから物語を読み返そう</div>
</div>
<div id="toast" class="toast" aria-live="polite"></div>

<template id="viewer-controls-template">
    <div class="viewer-header-controls">
        <div class="theme-selector viewer-theme-selector">{_build_theme_buttons(themes)}</div>
        <div class="utility-toggles viewer-utility-toggles">
            <button id="mode-toggle" class="icon-toggle header-view-toggle" type="button" onclick="toggleColorMode()" title="明暗を切り替え">☀︎</button>
            <button id="text-size-toggle" class="icon-toggle text-size-toggle-button header-view-toggle" type="button" onclick="toggleTextSizeButton()" title="文字サイズを切り替え">
                <span class="size-toggle-icon" aria-hidden="true">
                    <span class="size-a size-a-large">A</span>
                    <span class="size-a size-a-small">A</span>
                </span>
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
