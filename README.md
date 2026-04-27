# Madini Archive — Legacy Python Prototype

このリポジトリは、Madini Archive の初期 Python / PyQt プロトタイプです。  
ChatGPT / Claude / Gemini などの会話ログを取り込み、共通スキーマで SQLite に保存して、あとから検索・閲覧するための最初の実装として育ててきました。

現在の canonical implementation は SwiftUI 版の **Madini-Archive-Swift** です。  
この Python 版は、開発履歴とプロトタイプの設計判断を残すために保持しています。

GUI は `madini_gui.py`、取り込みと正規化は `split_chatlog.py` が担当します。

## 主な機能

- JSON / Markdown の会話ログを取り込み
- ChatGPT / Claude / Gemini 系データの正規化
- SQLite への保存
- FTS5 を使った全文検索
- PyQt6 + WebView ベースのデスクトップ閲覧 UI
- ドラッグ&ドロップでのログ追加
- テーマ切り替えと検索 UI

## ファイル構成

- `madini_gui.py`
  アプリ本体。PyQt6 GUI、WebView 表示、ドラッグ&ドロップ、表示更新を担当します。
- `split_chatlog.py`
  会話ログの取り込み、正規化、SQLite 登録を担当します。
- `MadiniArchive_Assets/`
  画面用の静的アセットです。`style.css`、`viewer.js`、アバター画像を含みます。
- `MadiniArchive.spec`
  PyInstaller 用のビルド設定です。
- `Scripts/build_macos_app.sh`
  macOS 向けに `.app` と `.zip` をまとめて作るビルドスクリプトです。
- `MadiniArchive.icns`
  macOS アプリアイコンです。

## セットアップ方法

Python 3.11 前後を推奨します。

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install PyQt6 PyQt6-WebEngine
```

補足:

- `sqlite3` は Python 標準ライブラリを使用しています。
- ビルドを行う場合は別途 `pyinstaller` を追加インストールしてください。

```bash
pip install pyinstaller
```

## macOS アプリとしてパッケージ化

`.app` を自分用に作るだけなら、次の 1 コマンドで大丈夫です。

```bash
chmod +x Scripts/build_macos_app.sh
./Scripts/build_macos_app.sh
```

生成物:

- `dist/Madini Archive/Madini Archive.app`
- `dist/Madini Archive/Madini Archive-macOS.zip`

補足:

- `.zip` は Finder で別の Mac に持っていきたいとき用です。
- 未署名アプリなので、初回起動時に Gatekeeper に止められた場合は Finder でアプリを右クリックして「開く」を選ぶと起動できます。
- もし配布用に署名や notarization までやりたくなったら、別途 Apple Developer 設定を追加する形で拡張できます。

## 実行方法

GUI を起動:

```bash
python3 madini_gui.py
```

CLI でログを取り込み:

```bash
python3 split_chatlog.py /path/to/chat_export.json
python3 split_chatlog.py /path/to/chat_export.md
```

## データ保存先

実行時データは、コード上では次のユーザーデータ領域に保存されます。

```text
~/Library/Application Support/Madini Archive/
```

旧 `~/Library/Application Support/Madini_NovelStudio/` が残っている場合は、起動時に新しいフォルダ名へ移行する想定です。

主に以下のようなファイルがここに作られます。

- `archive.db`
- `history.json`
- `Current_View.html`
- `custom.css`
- `themes.json`

これらは個人データや生成物を含むため、Git 管理しません。

## Git 管理から除外しているもの

- `archive.db` などの SQLite DB
  取り込み済みの会話本文を含むため
- `history.json`
  最近開いたログや個人環境の履歴を含むため
- 実際の会話ログファイル
  個人データそのものだからです
  安全性を優先して、`.json` / `.md` / `.markdown` は既定で除外し、現状は `README.md` だけを明示的に Git 管理対象に戻しています
- `build/`, `dist/`
  PyInstaller の生成物で再生成可能だからです
- `__pycache__/`, `*.pyc`
  Python のキャッシュだからです
- `.venv/`, `venv/`
  ローカル環境依存だからです
- `.env`, `.env.*`, 鍵ファイル
  秘密情報を誤って含めないためです

このリポジトリでは、GitHub に載せるのは「コード・静的アセット・ビルド設定・ドキュメント」に絞る方針です。

## GitHub に載せる前の確認ポイント

- `archive.db` を `git add` していないか
- `history.json` を `git add` していないか
- 実際の会話ログ `*.json` / `*.md` を入れていないか
- `build/` と `dist/` が含まれていないか
- 仮想環境や `.env` が含まれていないか

## 今後の軽い整理案

今すぐの GitHub private repository 化には必須ではありませんが、次の整理をするとさらに安全です。

- 取り込み用の生ログは常にリポジトリ外のフォルダに置く
- 依存関係を `requirements.txt` に固定する
- 将来的に `src/` へ分離して、アプリ本体とアセットの責務を少し整理する
- `MadiniArchive_Assets/` から生成物を完全に排除し、静的アセット専用ディレクトリとして固定する