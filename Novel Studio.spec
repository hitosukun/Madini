# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['madini_gui.py'],
    pathex=[],
    binaries=[],
    datas=[('NovelStudio_Assets', 'NovelStudio_Assets')],
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
    name='Madini - Local Archive Browser',
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
    icon=['Madini.icns'],
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='Madini - Local Archive Browser',
)
app = BUNDLE(
    coll,
    name='Madini - Local Archive Browser.app',
    icon='Madini.icns',
    bundle_identifier=None,
)
