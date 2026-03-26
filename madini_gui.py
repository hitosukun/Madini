import io
import json
import sys
from pathlib import Path

from PyQt6.QtCore import (
    QEasingCurve,
    QEvent,
    QObject,
    QPropertyAnimation,
    QThread,
    QTimer,
    Qt,
    QUrl,
    pyqtSignal,
    pyqtSlot,
)
from PyQt6.QtGui import QAction, QDesktopServices, QKeySequence, QPalette
from PyQt6.QtWidgets import (
    QApplication,
    QFrame,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QStatusBar,
    QToolButton,
    QVBoxLayout,
    QWidget,
)
from PyQt6.QtWebChannel import QWebChannel

try:
    from PyQt6.QtWebEngineCore import (
        QWebEnginePage,
        QWebEngineProfile,
        QWebEngineSettings,
    )
    from PyQt6.QtWebEngineWidgets import QWebEngineView
except ImportError:
    print("❌ PyQt6-WebEngine が未インストールよ！")
    sys.exit(1)

import split_chatlog
from app_paths import TEMP_HTML, USER_DATA_DIR, VIEWER_INDEX_JS
from archive_store import (
    build_virtual_thread,
    delete_saved_view,
    ensure_user_data_dir,
    fetch_bookmark_states,
    fetch_filter_options,
    list_bookmarks,
    fetch_conversation_raw_source,
    list_saved_filters,
    list_saved_views,
    fetch_conversation_detail,
    fetch_conversation_index,
    init_db,
    load_themes,
    save_recent_filter,
    save_saved_view,
    search_conversations_for_spec,
    set_bookmark,
)
from viewer_builder import build_viewer_html, build_viewer_index_script

IS_MACOS = sys.platform == "darwin"
PRIMARY_SHORTCUT_MODIFIER = (
    Qt.KeyboardModifier.ControlModifier if IS_MACOS else Qt.KeyboardModifier.MetaModifier
)
SECONDARY_SHORTCUT_MODIFIER = (
    Qt.KeyboardModifier.MetaModifier if IS_MACOS else Qt.KeyboardModifier.ControlModifier
)
PRIMARY_SHORTCUT_NAME = "Ctrl" if IS_MACOS else "Meta"


def get_system_theme(widget):
    color = widget.palette().color(QPalette.ColorRole.Window)
    return "dark" if color.lightness() < 128 else "light"


class CustomWebEnginePage(QWebEnginePage):
    def __init__(self, profile, parent_view, log_callback):
        super().__init__(profile, parent_view)
        self.log_callback = log_callback

    def javaScriptConsoleMessage(self, level, message, line_number, source_id):
        if "MathJax" not in message and "IMKC" not in message:
            self.log_callback(f"🐛 [ブラウザ]: {message}")

    def acceptNavigationRequest(self, url, nav_type, is_main_frame):
        if (
            nav_type == QWebEnginePage.NavigationType.NavigationTypeLinkClicked
            and url.scheme() in ["http", "https"]
        ):
            QDesktopServices.openUrl(url)
            return False
        return super().acceptNavigationRequest(url, nav_type, is_main_frame)


class ViewerBridge(QObject):
    def __init__(self, log_callback):
        super().__init__()
        self.log_callback = log_callback

    # ViewerBridge is the stable JSON boundary between the WebView and backend store.
    # Phase 2 view-state features should prefer extending this boundary over reaching
    # directly into storage concerns from the viewer.

    @pyqtSlot(str)
    def openExternal(self, url):
        QDesktopServices.openUrl(QUrl(url))

    @pyqtSlot(str)
    def copyText(self, text):
        QApplication.clipboard().setText(text)

    @pyqtSlot(str, result=str)
    def fetchConversation(self, conv_id):
        detail = fetch_conversation_detail(conv_id)
        return json.dumps(detail, ensure_ascii=False) if detail else ""

    @pyqtSlot(str, result=str)
    def fetchConversationRawSource(self, conv_id):
        detail = fetch_conversation_raw_source(conv_id)
        return json.dumps(detail, ensure_ascii=False) if detail else ""

    @pyqtSlot(result=str)
    def fetchFilterOptions(self):
        return json.dumps(fetch_filter_options(), ensure_ascii=False)

    @pyqtSlot(result=str)
    def fetchRecentFilters(self):
        return json.dumps(list_saved_filters(), ensure_ascii=False)

    @pyqtSlot(result=str)
    def fetchSavedViews(self):
        return json.dumps(list_saved_views(), ensure_ascii=False)

    @pyqtSlot(str, result=str)
    def saveRecentFilter(self, payload):
        try:
            params = json.loads(payload)
        except json.JSONDecodeError:
            params = {}
        saved = save_recent_filter(params)
        return json.dumps(saved or {}, ensure_ascii=False)

    @pyqtSlot(str, result=str)
    def saveSavedView(self, payload):
        try:
            params = json.loads(payload)
        except json.JSONDecodeError:
            params = {}
        saved = save_saved_view(
            params.get("name"),
            params.get("filters"),
            target_type=params.get("targetType") or "virtual_thread",
            saved_view_id=params.get("id"),
        )
        return json.dumps(saved or {}, ensure_ascii=False)

    @pyqtSlot(str, result=str)
    def deleteSavedView(self, payload):
        try:
            params = json.loads(payload)
        except json.JSONDecodeError:
            params = {}
        deleted = delete_saved_view(
            params.get("id"),
            target_type=params.get("targetType") or "virtual_thread",
        )
        return json.dumps(deleted, ensure_ascii=False)

    @pyqtSlot(str, result=str)
    def setBookmark(self, payload):
        # Generic bookmark target boundary. Thread bookmarks are current UI, but the
        # payload shape should remain reusable for prompt/answer/saved-view targets.
        try:
            params = json.loads(payload)
        except json.JSONDecodeError:
            params = {}
        result = set_bookmark(
            params.get("targetType"),
            params.get("targetId"),
            params.get("bookmarked"),
            payload=params.get("payload"),
        )
        return json.dumps(result, ensure_ascii=False)

    @pyqtSlot(str, result=str)
    def fetchBookmarkStates(self, payload):
        try:
            params = json.loads(payload)
        except json.JSONDecodeError:
            params = []
        if not isinstance(params, list):
            params = []
        result = fetch_bookmark_states(params)
        return json.dumps(result, ensure_ascii=False)

    @pyqtSlot(result=str)
    def fetchBookmarks(self):
        return json.dumps(list_bookmarks(), ensure_ascii=False)

    @pyqtSlot(str, result=str)
    def searchConversations(self, payload):
        try:
            search_spec = json.loads(payload)
        except json.JSONDecodeError:
            search_spec = {}

        results = search_conversations_for_spec(search_spec)
        return json.dumps(results, ensure_ascii=False)

    @pyqtSlot(str, result=str)
    def buildVirtualThread(self, payload):
        try:
            params = json.loads(payload)
        except json.JSONDecodeError:
            params = {}
        return json.dumps(build_virtual_thread(params), ensure_ascii=False)

    @pyqtSlot(str)
    def log(self, message):
        self.log_callback(f"🌐 [Viewer]: {message}")


class MadiniApp(QMainWindow):
    CONSOLE_COMPACT_WIDTH = 220
    CONSOLE_EXPANDED_WIDTH = 520

    @staticmethod
    def _primary_shortcut(stroke):
        return QKeySequence(f"{PRIMARY_SHORTCUT_NAME}+{stroke}")

    def __init__(self):
        super().__init__()
        ensure_user_data_dir()
        try:
            init_db().close()
        except Exception as exc:
            print(f"⚠️ DB初期化を読み取り専用モードとして続行するよ: {exc}")
        self.worker = None
        self._command_active = False
        self.console_lines = []
        self.console_expanded = False
        self.status_bar_visible = True

        self.setWindowTitle("Madini - Local Archive Browser")
        self.resize(1200, 800)
        self.setAcceptDrops(True)

        main_widget = QWidget()
        layout = QVBoxLayout(main_widget)
        layout.setContentsMargins(0, 0, 0, 0)
        self.setCentralWidget(main_widget)

        self.viewer = QWebEngineView()
        self.viewer.setAcceptDrops(False)
        self.web_profile = QWebEngineProfile("MadiniProfile", self.viewer)
        profile_root = USER_DATA_DIR / "web_profile"
        profile_root.mkdir(parents=True, exist_ok=True)
        self.web_profile.setPersistentStoragePath(str(profile_root / "storage"))
        self.web_profile.setCachePath(str(profile_root / "cache"))
        self.web_profile.setPersistentCookiesPolicy(
            QWebEngineProfile.PersistentCookiesPolicy.ForcePersistentCookies
        )
        self.viewer.settings().setAttribute(
            QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True
        )
        self.viewer.settings().setAttribute(
            QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True
        )
        self.viewer.settings().setAttribute(
            QWebEngineSettings.WebAttribute.LocalStorageEnabled, True
        )
        self.page = CustomWebEnginePage(
            self.web_profile, self.viewer, self.log_console_append
        )
        self.viewer.setPage(self.page)
        self.viewer.installEventFilter(self)
        self.bridge = ViewerBridge(self.log_console_append)
        self.channel = QWebChannel(self.page)
        self.channel.registerObject("bridge", self.bridge)
        self.page.setWebChannel(self.channel)
        self.page.installEventFilter(self)
        layout.addWidget(self.viewer, stretch=1)

        self.drop_overlay = QLabel("ファイルをドロップして書庫に追加", self)
        self.drop_overlay.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.drop_overlay.setStyleSheet(
            "background: rgba(30,30,35,0.7); color: white; font-size: 24px; border-radius: 12px;"
        )
        self.drop_overlay.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents)
        self.drop_overlay.hide()

        self.setup_status_console()
        self.create_menus()
        self.setup_native_shortcuts()
        app_instance = QApplication.instance()
        if app_instance is not None:
            app_instance.installEventFilter(self)
        self.load_all_chats_to_viewer()

    def log_console_append(self, text):
        lines = [line.strip() for line in str(text).splitlines() if line.strip()]
        if not lines:
            return
        self.console_lines.extend(lines)
        self.console_lines = self.console_lines[-200:]
        latest = self.console_lines[-1]
        print(latest)
        self.console_preview.setText(latest)
        tooltip = "\n".join(self.console_lines[-20:])
        self.console_bar.setToolTip(tooltip)
        self.console_preview.setToolTip(tooltip)

    def setup_status_console(self):
        status_bar = QStatusBar(self)
        status_bar.setSizeGripEnabled(False)
        self.setStatusBar(status_bar)

        self.console_bar = QFrame()
        self.console_bar.setObjectName("consoleBar")
        self.console_bar.setMinimumWidth(self.CONSOLE_COMPACT_WIDTH)
        self.console_bar.setMaximumWidth(self.CONSOLE_COMPACT_WIDTH)

        console_layout = QHBoxLayout(self.console_bar)
        console_layout.setContentsMargins(10, 4, 8, 4)
        console_layout.setSpacing(8)

        self.console_dot = QLabel("●")
        self.console_dot.setObjectName("consoleDot")

        self.console_preview = QLabel("準備完了")
        self.console_preview.setObjectName("consolePreview")
        self.console_preview.setTextInteractionFlags(
            Qt.TextInteractionFlag.TextSelectableByMouse
        )

        self.console_toggle_button = QToolButton()
        self.console_toggle_button.setObjectName("consoleToggle")
        self.console_toggle_button.setAutoRaise(True)
        self.console_toggle_button.setText("▸")
        self.console_toggle_button.setToolTip("コンソール幅を切り替え")
        self.console_toggle_button.clicked.connect(self.toggle_console_expanded)

        console_layout.addWidget(self.console_dot)
        console_layout.addWidget(self.console_preview, stretch=1)
        console_layout.addWidget(self.console_toggle_button)

        status_bar.addPermanentWidget(self.console_bar, 1)

        self.console_animation = QPropertyAnimation(self.console_bar, b"maximumWidth", self)
        self.console_animation.setDuration(180)
        self.console_animation.setEasingCurve(QEasingCurve.Type.OutCubic)

        status_bar.setStyleSheet(
            """
            QStatusBar {
                background: palette(base);
                border-top: 1px solid palette(midlight);
            }
            QStatusBar::item {
                border: none;
            }
            QFrame#consoleBar {
                background: rgba(127, 127, 127, 0.08);
                border: 1px solid rgba(127, 127, 127, 0.16);
                border-radius: 10px;
            }
            QLabel#consoleDot {
                color: rgba(90, 150, 255, 0.9);
                font-size: 10px;
            }
            QLabel#consolePreview {
                color: palette(text);
                font-size: 12px;
                padding: 0;
            }
            QToolButton#consoleToggle {
                border: none;
                background: transparent;
                color: rgba(120, 120, 120, 0.9);
                font-size: 12px;
                padding: 0 2px;
            }
            QToolButton#consoleToggle:hover {
                color: palette(text);
            }
            """
        )

    def set_console_expanded(self, expanded):
        if not self.status_bar_visible:
            return
        self.console_expanded = bool(expanded)
        target_width = (
            self.CONSOLE_EXPANDED_WIDTH
            if self.console_expanded
            else self.CONSOLE_COMPACT_WIDTH
        )
        self.console_animation.stop()
        self.console_animation.setStartValue(self.console_bar.width())
        self.console_animation.setEndValue(target_width)
        self.console_animation.start()
        self.console_bar.setMinimumWidth(target_width)
        self.console_toggle_button.setText("◂" if self.console_expanded else "▸")

    def toggle_console_expanded(self):
        self.set_console_expanded(not self.console_expanded)

    def set_status_bar_visible(self, visible):
        self.status_bar_visible = bool(visible)
        self.statusBar().setVisible(self.status_bar_visible)
        if not self.status_bar_visible:
            self.console_expanded = False
            self.console_bar.setMinimumWidth(self.CONSOLE_COMPACT_WIDTH)
            self.console_bar.setMaximumWidth(self.CONSOLE_COMPACT_WIDTH)
            self.console_toggle_button.setText("▸")
        elif self.console_expanded:
            self.set_console_expanded(True)
        else:
            self.console_bar.setMinimumWidth(self.CONSOLE_COMPACT_WIDTH)
            self.console_bar.setMaximumWidth(self.CONSOLE_COMPACT_WIDTH)
            self.console_toggle_button.setText("▸")

    def create_menus(self):
        menu_bar = self.menuBar()
        view_menu = menu_bar.addMenu("表示")
        self.status_bar_action = QAction("ステータスバーを表示", self, checkable=True)
        self.status_bar_action.setChecked(True)
        self.status_bar_action.triggered.connect(self.set_status_bar_visible)
        view_menu.addAction(self.status_bar_action)
        menu_bar.addAction(
            "📁 データフォルダを開く",
            lambda: QDesktopServices.openUrl(QUrl.fromLocalFile(str(USER_DATA_DIR))),
        )
        self.navigation_menu = menu_bar.addMenu("移動")
        self.tab_menu = menu_bar.addMenu("タブ")

    def setup_native_shortcuts(self):
        self.native_shortcut_actions = []
        # App-level/browser-like shortcuts live in PyQt first so Qt/macOS can own
        # the actual key chord. The web viewer receives only named actions, while
        # viewer-local/widget-local keys stay in viewer.js near the focused panel.
        # On macOS, Qt expresses Command shortcuts as Ctrl-based QKeySequence text,
        # so keep the platform mapping here rather than scattering Meta/Ctrl guesses.
        self._register_native_shortcut_action(
            "back",
            "戻る",
            [self._primary_shortcut("[")],
            menu=self.navigation_menu,
        )
        self._register_native_shortcut_action(
            "forward",
            "進む",
            [self._primary_shortcut("]")],
            menu=self.navigation_menu,
        )
        self._register_native_shortcut_action(
            "showSidebar",
            "サイドバーを開く",
            [self._primary_shortcut("Right")],
            menu=self.navigation_menu,
        )
        self._register_native_shortcut_action(
            "hideSidebar",
            "サイドバーを閉じる",
            [self._primary_shortcut("Left")],
            menu=self.navigation_menu,
        )
        self._register_native_shortcut_action(
            "openSettings",
            "設定",
            [self._primary_shortcut(",")],
            menu=self.navigation_menu,
        )
        self._register_native_shortcut_action(
            "scrollTop",
            "先頭へ移動",
            [self._primary_shortcut("Up")],
            menu=self.navigation_menu,
        )
        self._register_native_shortcut_action(
            "scrollBottom",
            "末尾へ移動",
            [self._primary_shortcut("Down")],
            menu=self.navigation_menu,
        )
        previous_tab_shortcuts = [
            self._primary_shortcut("Shift+["),
            self._primary_shortcut("Shift+{"),
        ]
        next_tab_shortcuts = [
            self._primary_shortcut("Shift+]"),
            self._primary_shortcut("Shift+}"),
        ]
        if not IS_MACOS:
            previous_tab_shortcuts = [
                QKeySequence("Ctrl+Shift+Tab"),
                *QKeySequence.keyBindings(QKeySequence.StandardKey.PreviousChild),
                *previous_tab_shortcuts,
            ]
            next_tab_shortcuts = [
                QKeySequence("Ctrl+Tab"),
                *QKeySequence.keyBindings(QKeySequence.StandardKey.NextChild),
                *next_tab_shortcuts,
            ]
        self._register_native_shortcut_action(
            "previousTab",
            "前のタブ",
            previous_tab_shortcuts,
            menu=self.tab_menu,
        )
        self._register_native_shortcut_action(
            "nextTab",
            "次のタブ",
            next_tab_shortcuts,
            menu=self.tab_menu,
        )
        self._register_native_shortcut_action(
            "closeTab",
            "タブを閉じる",
            QKeySequence.keyBindings(QKeySequence.StandardKey.Close),
            menu=self.tab_menu,
        )
        self._register_native_shortcut_action(
            "restoreTab",
            "閉じたタブを開く",
            [self._primary_shortcut("Shift+T")],
            menu=self.tab_menu,
        )

    def _register_native_shortcut_action(
        self, action_name, label, shortcuts, menu=None, context=None
    ):
        action = QAction(label, self)
        action.setShortcuts(self._dedupe_shortcuts(shortcuts))
        action.setShortcutContext(Qt.ShortcutContext.ApplicationShortcut)
        action.triggered.connect(
            lambda checked=False, action_name=action_name, context=context: self.forward_native_shortcut(
                action_name, context
            )
        )
        self.addAction(action)
        if menu is not None:
            menu.addAction(action)
        self.native_shortcut_actions.append(action)

    def _dedupe_shortcuts(self, shortcuts):
        unique_shortcuts = []
        seen = set()
        for shortcut in shortcuts:
            portable_text = shortcut.toString(QKeySequence.SequenceFormat.PortableText)
            if portable_text in seen:
                continue
            seen.add(portable_text)
            unique_shortcuts.append(shortcut)
        return unique_shortcuts

    def forward_native_shortcut(self, action_name, context=None):
        # JS stays authoritative for tab/viewer state transitions. Native code only
        # decides that an app-level shortcut fired and forwards the named action
        # plus the smallest payload needed to interpret it.
        action_json = json.dumps(action_name, ensure_ascii=False)
        context_json = json.dumps(context or {}, ensure_ascii=False)
        js = (
            "if (typeof handleNativeAppShortcut === 'function') { "
            f"handleNativeAppShortcut({action_json}, {context_json}); "
            "}"
        )
        self.viewer.page().runJavaScript(js)

    def set_command_state(self, active):
        if self._command_active == active:
            return
        self._command_active = active
        js = (
            "if (typeof setNativeCommandKeyHeld === 'function') { "
            f"setNativeCommandKeyHeld({str(active).lower()}); "
            "}"
        )
        self.viewer.page().runJavaScript(js)

    def eventFilter(self, obj, event):
        if event.type() == QEvent.Type.KeyPress and event.key() == Qt.Key.Key_Meta:
            self.set_command_state(True)
        elif event.type() == QEvent.Type.KeyPress:
            shortcut_payload = self._native_shortcut_payload(event)
            if shortcut_payload and not event.isAutoRepeat():
                action_name, context = shortcut_payload
                # Keep app-level shortcuts on one native->JS path. QWebEngine can
                # swallow browser-like chords before QAction dispatch, so we
                # forward them from KeyPress instead of relying on per-shortcut
                # exceptions such as sidebar open/close only.
                self.forward_native_shortcut(action_name, context)
                event.accept()
                return True
        elif event.type() == QEvent.Type.KeyRelease and event.key() == Qt.Key.Key_Meta:
            self.set_command_state(False)
        elif event.type() == QEvent.Type.ApplicationDeactivate:
            self.set_command_state(False)
        elif event.type() == QEvent.Type.ShortcutOverride:
            if self._native_shortcut_payload(event):
                event.accept()
                return True
        return super().eventFilter(obj, event)

    def _native_shortcut_payload(self, event):
        action_name = self._native_shortcut_action(event)
        if not action_name:
            return None

        context = None
        if action_name == "selectTabByIndex":
            tab_index_by_key = {
                Qt.Key.Key_1: 1,
                Qt.Key.Key_2: 2,
                Qt.Key.Key_3: 3,
                Qt.Key.Key_4: 4,
                Qt.Key.Key_5: 5,
                Qt.Key.Key_6: 6,
                Qt.Key.Key_7: 7,
                Qt.Key.Key_8: 8,
                Qt.Key.Key_9: 9,
            }
            tab_index = tab_index_by_key.get(event.key())
            if tab_index is None:
                return None
            context = {"tabIndex": tab_index}

        return action_name, context

    def _native_shortcut_action(self, event):
        # Keep this list scoped to app-level shortcuts such as tab/window-style
        # commands and top-level viewer focus moves. Widget-local arrows/enter/esc
        # should stay inside viewer.js with the owning panel.
        modifiers = event.modifiers()
        key = event.key()
        text = event.text()
        primary = bool(modifiers & PRIMARY_SHORTCUT_MODIFIER)
        secondary = bool(modifiers & SECONDARY_SHORTCUT_MODIFIER)
        shift = bool(modifiers & Qt.KeyboardModifier.ShiftModifier)
        alt = bool(modifiers & Qt.KeyboardModifier.AltModifier)

        if primary and not secondary and not alt:
            if key == Qt.Key.Key_BracketLeft and not shift:
                return "back"
            if key == Qt.Key.Key_BracketRight and not shift:
                return "forward"
            if key == Qt.Key.Key_W and not shift:
                return "closeTab"
            if key == Qt.Key.Key_T and shift:
                return "restoreTab"
            if key == Qt.Key.Key_Left and not shift:
                return "hideSidebar"
            if key == Qt.Key.Key_Right and not shift:
                return "showSidebar"
            if key == Qt.Key.Key_Comma and not shift:
                return "openSettings"
            if key == Qt.Key.Key_Up and not shift:
                return "scrollTop"
            if key == Qt.Key.Key_Down and not shift:
                return "scrollBottom"
            if (
                key in {Qt.Key.Key_BracketRight, Qt.Key.Key_BraceRight, Qt.Key.Key_Greater}
                or (shift and text in {"]", "}"})
            ):
                return "nextTab"
            if (
                key in {Qt.Key.Key_BracketLeft, Qt.Key.Key_BraceLeft, Qt.Key.Key_Less}
                or (shift and text in {"[", "{"})
            ):
                return "previousTab"

        if not IS_MACOS and secondary and not primary and not alt:
            if key == Qt.Key.Key_Tab and not shift:
                return "nextTab"
            if (key == Qt.Key.Key_Tab and shift) or key == Qt.Key.Key_Backtab:
                return "previousTab"

        return None

    def changeEvent(self, event):
        if event.type() == event.Type.PaletteChange:
            js = (
                "if (typeof setSystemTheme === 'function') { "
                f"setSystemTheme('{get_system_theme(self)}'); "
                "}"
            )
            self.viewer.page().runJavaScript(js)
        super().changeEvent(event)

    def resizeEvent(self, event):
        self.drop_overlay.resize(self.size())
        super().resizeEvent(event)

    def dragEnterEvent(self, event):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
            self.drop_overlay.show()
            self.drop_overlay.raise_()

    def dragLeaveEvent(self, event):
        self.drop_overlay.hide()

    def dropEvent(self, event):
        self.drop_overlay.hide()
        files = [
            url.toLocalFile()
            for url in event.mimeData().urls()
            if url.toLocalFile().lower().endswith((".json", ".md", ".markdown"))
        ]
        if not files:
            return

        self.worker = Worker(files)
        self.worker.log_signal.connect(self.log_console_append)
        self.worker.finished.connect(lambda: self.load_all_chats_to_viewer(True))
        self.worker.start()

    def load_all_chats_to_viewer(self, show_toast=False):
        index = fetch_conversation_index()
        if not index:
            self.viewer.setHtml("<div style='text-align:center;margin-top:150px;'>ログをドロップしてね！</div>")
            return

        VIEWER_INDEX_JS.write_text(build_viewer_index_script(index), encoding="utf-8")

        html = build_viewer_html(
            conversations=index,
            user_themes=load_themes(),
            system_theme=get_system_theme(self),
            show_toast=show_toast,
        )
        TEMP_HTML.write_text(html, encoding="utf-8")
        self.viewer.load(QUrl.fromLocalFile(str(TEMP_HTML.resolve())))


class Worker(QThread):
    log_signal = pyqtSignal(str)

    def __init__(self, files):
        super().__init__()
        self.files = files

    def run(self):
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()
        try:
            split_chatlog.main([Path(file_path) for file_path in self.files])
            self.log_signal.emit(sys.stdout.getvalue())
        finally:
            sys.stdout = old_stdout


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MadiniApp()
    window.show()
    QTimer.singleShot(0, window.raise_)
    QTimer.singleShot(0, window.activateWindow)
    QTimer.singleShot(120, window.raise_)
    QTimer.singleShot(120, window.activateWindow)
    sys.exit(app.exec())
