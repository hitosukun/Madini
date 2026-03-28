# -*- mode: python ; coding: utf-8 -*-

from app_metadata import (
    APP_ASSET_DIR_NAME,
    APP_BUNDLE_IDENTIFIER,
    APP_ICON_PATH,
    APP_NAME,
    APP_VERSION,
)

a = Analysis(
    ['madini_gui.py'],
    pathex=[],
    binaries=[],
    datas=[(APP_ASSET_DIR_NAME, APP_ASSET_DIR_NAME)],
    hiddenimports=['PyQt6.QtWebChannel'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name=APP_NAME,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=[APP_ICON_PATH],
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name=APP_NAME,
)
app = BUNDLE(
    coll,
    name=f'{APP_NAME}.app',
    icon=APP_ICON_PATH,
    bundle_identifier=APP_BUNDLE_IDENTIFIER,
    info_plist={
        'CFBundleDisplayName': APP_NAME,
        'CFBundleName': APP_NAME,
        'CFBundleShortVersionString': APP_VERSION,
        'CFBundleVersion': APP_VERSION,
        'LSApplicationCategoryType': 'public.app-category.productivity',
    },
)
