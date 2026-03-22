import io
import json
import sys
from pathlib import Path

from PyQt6.QtCore import QEvent, QObject, QThread, Qt, QUrl, pyqtSignal, pyqtSlot
from PyQt6.QtGui import QAction, QDesktopServices, QKeySequence, QPalette, QShortcut
from PyQt6.QtWidgets import QApplication, QLabel, QMainWindow, QTextEdit, QVBoxLayout, QWidget
from PyQt6.QtWebChannel import QWebChannel

try:
    from PyQt6.QtWebEngineCore import QWebEnginePage, QWebEngineSettings
    from PyQt6.QtWebEngineWidgets import QWebEngineView
except ImportError:
    print("❌ PyQt6-WebEngine が未インストールよ！")
    sys.exit(1)

import split_chatlog
from app_paths import TEMP_HTML, USER_DATA_DIR, VIEWER_INDEX_JS
from archive_store import (
    ensure_user_data_dir,
    fetch_conversation_detail,
    fetch_conversation_index,
    load_themes,
    search_conversations,
)
from viewer_builder import build_viewer_html, build_viewer_index_script


def get_system_theme(widget):
    color = widget.palette().color(QPalette.ColorRole.Window)
    return "dark" if color.lightness() < 128 else "light"


class CustomWebEnginePage(QWebEnginePage):
    def __init__(self, parent_view, log_callback):
        super().__init__(parent_view)
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
    def searchConversations(self, payload):
        try:
            params = json.loads(payload)
        except json.JSONDecodeError:
            params = {}

        results = search_conversations(
            params.get("words", []),
            include_title=params.get("includeTitle", True),
            include_prompt=params.get("includePrompt", True),
            include_answer=params.get("includeAnswer", True),
        )
        return json.dumps(results, ensure_ascii=False)

    @pyqtSlot(str)
    def log(self, message):
        self.log_callback(f"🌐 [Viewer]: {message}")


class MadiniApp(QMainWindow):
    def __init__(self):
        super().__init__()
        ensure_user_data_dir()
        self.worker = None
        self._command_active = False

        self.setWindowTitle("Madini - Novel Studio")
        self.resize(1200, 800)
        self.setAcceptDrops(True)

        main_widget = QWidget()
        layout = QVBoxLayout(main_widget)
        layout.setContentsMargins(0, 0, 0, 0)
        self.setCentralWidget(main_widget)

        self.viewer = QWebEngineView()
        self.viewer.setAcceptDrops(False)
        self.viewer.settings().setAttribute(
            QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True
        )
        self.viewer.settings().setAttribute(
            QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True
        )
        self.page = CustomWebEnginePage(self.viewer, self.log_console_append)
        self.viewer.setPage(self.page)
        self.viewer.installEventFilter(self)
        self.bridge = ViewerBridge(self.log_console_append)
        self.channel = QWebChannel(self.page)
        self.channel.registerObject("bridge", self.bridge)
        self.page.setWebChannel(self.channel)
        self.page.installEventFilter(self)
        layout.addWidget(self.viewer, stretch=1)

        self.log_console = QTextEdit()
        self.log_console.setReadOnly(True)
        self.log_console.setMaximumHeight(120)
        self.log_console.hide()
        layout.addWidget(self.log_console)

        self.drop_overlay = QLabel("ファイルをドロップして書庫に追加", self)
        self.drop_overlay.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.drop_overlay.setStyleSheet(
            "background: rgba(30,30,35,0.7); color: white; font-size: 24px; border-radius: 12px;"
        )
        self.drop_overlay.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents)
        self.drop_overlay.hide()

        self.create_menus()
        self.setup_native_shortcuts()
        app_instance = QApplication.instance()
        if app_instance is not None:
            app_instance.installEventFilter(self)
        self.load_all_chats_to_viewer()

    def log_console_append(self, text):
        self.log_console.append(text)

    def create_menus(self):
        menu_bar = self.menuBar()
        view_menu = menu_bar.addMenu("表示")
        console_action = QAction("コンソールを表示", self, checkable=True)
        console_action.triggered.connect(self.log_console.setVisible)
        view_menu.addAction(console_action)
        menu_bar.addAction(
            "📁 データフォルダを開く",
            lambda: QDesktopServices.openUrl(QUrl.fromLocalFile(str(USER_DATA_DIR))),
        )

    def setup_native_shortcuts(self):
        self.native_shortcuts = []
        bindings = {
            "Meta+Up": "ArrowUp",
            "Meta+Down": "ArrowDown",
            "Meta+Left": "ArrowLeft",
            "Meta+Right": "ArrowRight",
        }
        for sequence, key_name in bindings.items():
            shortcut = QShortcut(QKeySequence(sequence), self)
            shortcut.setContext(Qt.ShortcutContext.WindowShortcut)
            shortcut.activated.connect(
                lambda key=key_name: self.forward_native_command_arrow(key)
            )
            self.native_shortcuts.append(shortcut)

    def forward_native_command_arrow(self, key_name):
        js = (
            "if (typeof handleCommandArrowKey === 'function') { "
            f"handleCommandArrowKey('{key_name}'); "
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
        elif event.type() == QEvent.Type.KeyRelease and event.key() == Qt.Key.Key_Meta:
            self.set_command_state(False)
        elif event.type() == QEvent.Type.ApplicationDeactivate:
            self.set_command_state(False)
        elif event.type() == QEvent.Type.ShortcutOverride:
            if self._is_command_arrow_event(event):
                event.accept()
                return True
        elif event.type() == QEvent.Type.KeyPress:
            if self._is_command_arrow_event(event):
                key_name = self._arrow_key_name(event.key())
                if key_name:
                    self.set_command_state(True)
                    self.forward_native_command_arrow(key_name)
                    event.accept()
                    return True
        return super().eventFilter(obj, event)

    def _arrow_key_name(self, key):
        mapping = {
            Qt.Key.Key_Up: "ArrowUp",
            Qt.Key.Key_Down: "ArrowDown",
            Qt.Key.Key_Left: "ArrowLeft",
            Qt.Key.Key_Right: "ArrowRight",
        }
        return mapping.get(key)

    def _is_command_arrow_event(self, event):
        key_name = self._arrow_key_name(event.key())
        if not key_name:
            return False
        modifiers = event.modifiers()
        return bool(modifiers & Qt.KeyboardModifier.MetaModifier) and not (
            modifiers & Qt.KeyboardModifier.ControlModifier
            or modifiers & Qt.KeyboardModifier.AltModifier
        )

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
        self.worker.log_signal.connect(self.log_console.append)
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
    sys.exit(app.exec())
