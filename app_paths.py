import sys
from pathlib import Path


APP_SUPPORT_DIR_NAME = "Madini_NovelStudio"
ASSET_DIR_NAME = "NovelStudio_Assets"


def get_asset_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / ASSET_DIR_NAME
    return Path(__file__).resolve().parent / ASSET_DIR_NAME


ASSET_DIR = get_asset_dir()
USER_DATA_DIR = Path.home() / "Library" / "Application Support" / APP_SUPPORT_DIR_NAME
DB_FILE = USER_DATA_DIR / "archive.db"
TEMP_HTML = USER_DATA_DIR / "Current_View.html"
VIEWER_INDEX_JS = USER_DATA_DIR / "viewer_index.js"
CUSTOM_CSS = USER_DATA_DIR / "custom.css"
THEMES_JSON = USER_DATA_DIR / "themes.json"
HISTORY_FILE = USER_DATA_DIR / "history.json"
CUSTOM_USER_AVATAR = USER_DATA_DIR / "custom_user.png"
CUSTOM_AI_AVATAR = USER_DATA_DIR / "custom_ai.png"
