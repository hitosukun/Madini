import html
import hashlib
import json
import mimetypes
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from archive_store import (
    init_db,
    load_history,
    register_conversation,
    register_raw_source,
    save_history,
    update_conversation_metadata,
)


USER_NAME = "ジェンナ"
AI_NAME = "マディニ"
AI_KEYWORDS = ["ai", "assistant", "gpt", "claude", "gemini", "madini", AI_NAME.lower()]
MODEL_VALUE_RE = re.compile(
    r"^(?:gpt-[A-Za-z0-9._-]+|claude(?:[- ][A-Za-z0-9._-]+)+|gemini(?:[- ][A-Za-z0-9._-]+)+|(?:haiku|sonnet|opus|flash|pro|ultra)(?:[- ][A-Za-z0-9._-]+)*)$",
    re.IGNORECASE,
)
TEXT_SOURCE_SUFFIXES = {
    ".json": ("json", "application/json"),
    ".md": ("markdown", "text/markdown"),
    ".markdown": ("markdown", "text/markdown"),
}


def _format_timestamp(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value)).strftime("%Y-%m-%d %H:%M:%S")
        except (OverflowError, OSError, ValueError):
            return None

    text = str(value).strip()
    if not text:
        return None
    if re.fullmatch(r"\d+(?:\.\d+)?", text):
        try:
            return datetime.fromtimestamp(float(text)).strftime("%Y-%m-%d %H:%M:%S")
        except (OverflowError, OSError, ValueError):
            return None
    try:
        normalized = text.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized).strftime("%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None


def _get_file_source_created_at(path):
    try:
        stat = path.stat()
    except OSError:
        return None
    filesystem_timestamp = getattr(stat, "st_birthtime", None) or stat.st_mtime
    return _format_timestamp(filesystem_timestamp)


def _build_raw_source_record(path):
    suffix = path.suffix.lower()
    source_format, default_mime_type = TEXT_SOURCE_SUFFIXES.get(
        suffix,
        ("text", "text/plain"),
    )
    raw_text = path.read_text(encoding="utf-8")
    mime_type = mimetypes.guess_type(str(path))[0] or default_mime_type
    raw_bytes = raw_text.encode("utf-8")
    return {
        "source_hash": hashlib.sha256(raw_bytes).hexdigest(),
        "source_format": source_format,
        "source_path": str(path.resolve()),
        "source_created_at": _get_file_source_created_at(path),
        "mime_type": mime_type,
        "size_bytes": len(raw_bytes),
        "text_encoding": "utf-8",
        "raw_text": raw_text,
        "raw_bytes_path": None,
    }


def _current_imported_at():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _normalize_model_name(value):
    text = str(value or "").strip()
    if not text:
        return None
    text = text.replace("models/", "").strip()
    text = re.sub(r"\s+", " ", text)
    return text or None


def _extract_model_from_text(text):
    if not text:
        return None
    normalized = _normalize_model_name(text)
    if not normalized:
        return None
    if len(normalized) > 80:
        return None
    if not MODEL_VALUE_RE.match(normalized):
        return None
    return normalized


def _extract_model_from_obj(obj):
    if obj is None:
        return None
    if isinstance(obj, str):
        return _extract_model_from_text(obj)
    if isinstance(obj, list):
        for item in obj:
            model = _extract_model_from_obj(item)
            if model:
                return model
        return None
    if isinstance(obj, dict):
        preferred_keys = [
            "model_slug",
            "resolved_model_slug",
            "requested_model_slug",
            "default_model_slug",
            "model",
            "modelCode",
            "model_code",
            "modelName",
            "model_name",
        ]
        for key in preferred_keys:
            if key in obj:
                model = _extract_model_from_obj(obj.get(key))
                if model:
                    return model
        for key, value in obj.items():
            if any(token in key.lower() for token in ["model", "slug"]):
                model = _extract_model_from_obj(value)
                if model:
                    return model
        for value in obj.values():
            if isinstance(value, (dict, list)):
                model = _extract_model_from_obj(value)
                if model:
                    return model
    return None


def gemini_html_to_md(html_str):
    if not html_str:
        return ""

    text = html_str

    def process_table(match):
        content = (
            match.group(1)
            .replace("<thead>", "")
            .replace("</thead>", "")
            .replace("<tbody>", "")
            .replace("</tbody>", "")
        )
        content = re.sub(r"<tr[^>]*>", "|", content).replace("</tr>", "|\n")
        content = re.sub(r"<th[^>]*>", "", content).replace("</th>", "|")
        content = re.sub(r"<td[^>]*>", "", content).replace("</td>", "|")
        lines = [line.strip() for line in content.strip().split("\n") if line.strip()]
        if not lines:
            return ""
        col_count = lines[0].count("|") - 1
        if col_count > 0:
            lines.insert(1, "|" + "|".join(["---"] * col_count) + "|")
        return "\n\n" + "\n".join(lines) + "\n\n"

    text = re.sub(r"<table[^>]*>(.*?)</table>", process_table, text, flags=re.DOTALL)
    for level in range(1, 7):
        text = re.sub(
            fr"<h{level}[^>]*>(.*?)</h{level}>",
            lambda match: "\n\n" + ("#" * level) + " " + match.group(1) + "\n\n",
            text,
            flags=re.DOTALL,
        )
    text = text.replace("<ul>", "\n").replace("</ul>", "\n")
    text = text.replace("<ol>", "\n").replace("</ol>", "\n")
    text = re.sub(r"<li[^>]*>(.*?)</li>", r"- \1\n", text, flags=re.DOTALL)
    text = re.sub(r'<a href="(.*?)">(.*?)</a>', r"[\2](\1)", text)
    text = re.sub(r"<strong[^>]*>(.*?)</strong>", r"**\1**", text, flags=re.DOTALL)
    text = re.sub(r"<b[^>]*>(.*?)</b>", r"**\1**", text, flags=re.DOTALL)
    text = re.sub(r"<em[^>]*>(.*?)</em>", r"*\1*", text, flags=re.DOTALL)
    text = re.sub(r"<i[^>]*>(.*?)</i>", r"*\1*", text, flags=re.DOTALL)
    text = (
        text.replace("<p>", "")
        .replace("</p>", "\n\n")
        .replace("<br>", "\n")
        .replace("<br/>", "\n")
        .replace("<br />", "\n")
        .replace("<hr>", "\n---\n")
    )
    text = re.sub(
        r"<pre[^>]*><code[^>]*>(.*?)</code></pre>",
        lambda match: "\n```\n" + match.group(1).strip() + "\n```\n",
        text,
        flags=re.DOTALL,
    )
    text = re.sub(
        r"<pre[^>]*>(.*?)</pre>",
        lambda match: "\n```\n" + match.group(1).strip() + "\n```\n",
        text,
        flags=re.DOTALL,
    )
    text = re.sub(r"<code[^>]*>(.*?)</code>", r"`\1`", text, flags=re.DOTALL)

    def process_blockquote(match):
        return "\n\n" + "\n".join("> " + line for line in match.group(1).strip().split("\n")) + "\n\n"

    text = re.sub(r"<blockquote[^>]*>(.*?)</blockquote>", process_blockquote, text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _finalize_messages(messages):
    return [message for message in messages if message.get("text")]


def parse_markdown_file(path, raw_text=None):
    text = raw_text if raw_text is not None else path.read_text(encoding="utf-8")
    messages = []
    current_role = "user"
    current_text = []

    for line in text.split("\n"):
        is_header = line.startswith("#")
        has_role_hint = any(
            keyword in line.lower()
            for keyword in AI_KEYWORDS + ["user", "ジェンナ", "自分", "jenna", USER_NAME.lower()]
        )
        if is_header and has_role_hint:
            if current_text:
                messages.append({"role": current_role, "text": "\n".join(current_text).strip()})
            current_text = []
            current_role = "assistant" if any(keyword in line.lower() for keyword in AI_KEYWORDS) else "user"
        else:
            current_text.append(line)

    if current_text:
        messages.append({"role": current_role, "text": "\n".join(current_text).strip()})

    messages = _finalize_messages(messages)
    if not messages:
        return []

    return [
        {
            "conv_id": path.name,
            "source": "markdown",
            "title": path.stem,
            "source_created_at": _get_file_source_created_at(path),
            "messages": messages,
        }
    ]


def parse_chatgpt_export(data):
    conversations = []
    for conv in data:
        messages = []
        message_timestamps = []
        conversation_model = _extract_model_from_obj(
            {
                "model_slug": conv.get("default_model_slug"),
                "resolved_model_slug": conv.get("resolved_model_slug"),
                "requested_model_slug": conv.get("requested_model_slug"),
                "mapping": conv.get("mapping"),
            }
        )
        nodes = sorted(
            [node for node in conv.get("mapping", {}).values() if node.get("message")],
            key=lambda item: item["message"].get("create_time") or 0,
        )
        for node in nodes:
            message = node["message"]
            role = message.get("author", {}).get("role")
            if role not in {"user", "assistant"}:
                continue
            if conversation_model is None:
                conversation_model = _extract_model_from_obj(
                    message.get("metadata") or {}
                )
            timestamp = _format_timestamp(message.get("create_time"))
            if timestamp:
                message_timestamps.append(timestamp)
            text = "\n\n".join(
                str(part)
                for part in message.get("content", {}).get("parts", [])
                if isinstance(part, str)
            ).strip()
            if text:
                messages.append({"role": role, "text": text})

        messages = _finalize_messages(messages)
        if messages:
            conversation_source_created_at = (
                _format_timestamp(conv.get("create_time"))
                or (min(message_timestamps) if message_timestamps else None)
            )
            conversations.append(
                {
                    "conv_id": conv.get("conversation_id") or conv.get("id", ""),
                    "source": "chatgpt",
                    "title": conv.get("title", "Untitled"),
                    "model": conversation_model,
                    "source_created_at": conversation_source_created_at,
                    "messages": messages,
                }
            )
    return conversations


CLAUDE_TOOL_PLACEHOLDER = "```\nThis block is not supported on your current device yet.\n```"


def _summarize_claude_tool_input(name, inputs):
    """Pick the most informative single-key value from a Claude `tool_use`
    input dict. Falls back to listing input keys when nothing scalar-ish
    fits. Output is intentionally short — tool blocks are rendered inline
    and shouldn't dominate the message body."""
    if not isinstance(inputs, dict) or not inputs:
        return ""
    PRIORITIZED_KEYS = ("query", "url", "path", "title", "name", "command", "code", "text")
    for key in PRIORITIZED_KEYS:
        value = inputs.get(key)
        if isinstance(value, (str, int, float)) and str(value).strip():
            text = str(value).strip()
            if len(text) > 140:
                text = text[:140].rstrip() + "…"
            return f"{key}: {text}"
    keys = [k for k in list(inputs.keys())[:4] if k]
    return f"inputs: {', '.join(keys)}" if keys else ""


def _format_claude_tool_block(item):
    """Render a single `tool_use` or `tool_result` content item as a short
    Markdown blockquote. Used to replace Claude's export-side placeholder
    string ('This block is not supported on your current device yet.')
    with the actual tool name + a brief input summary, so the user can
    see which tool ran instead of an opaque stub."""
    if not isinstance(item, dict):
        return CLAUDE_TOOL_PLACEHOLDER
    kind = item.get("type")
    name = (item.get("name") or "unknown").strip() or "unknown"
    if kind == "tool_use":
        summary = _summarize_claude_tool_input(name, item.get("input"))
        return f"> 🔧 **{name}** — {summary}" if summary else f"> 🔧 **{name}**"
    if kind == "tool_result":
        if item.get("is_error"):
            msg = item.get("message") or "tool returned an error"
            return f"> ⚠️ **{name}** failed — {str(msg)[:120]}"
        # Successful tool_result is mostly redundant once the tool_use
        # above has already surfaced what ran. Drop it to keep the
        # message readable instead of doubling every tool with a
        # confirmation line.
        return ""
    return CLAUDE_TOOL_PLACEHOLDER


def _build_claude_message_text(message):
    """Replace each `This block is not supported on your current device yet.`
    placeholder fence-block in `message.text` with a contextual summary
    pulled from the matching item in `message.content[]`. Claude's
    export embeds the placeholder once per `tool_use` and once per
    `tool_result` — we walk both arrays in lockstep so the i-th
    placeholder gets the i-th tool block's summary. When the counts don't
    match (defensive — never seen in practice), surplus placeholders are
    left as-is rather than risk grafting a wrong tool's name onto an
    unrelated block."""
    text = (message.get("text") or "").strip()
    if not text or CLAUDE_TOOL_PLACEHOLDER not in text:
        return text
    content = message.get("content") or []
    tool_blocks = [
        item for item in content
        if isinstance(item, dict) and item.get("type") in ("tool_use", "tool_result")
    ]
    parts = text.split(CLAUDE_TOOL_PLACEHOLDER)
    rebuilt = parts[0]
    for i, tail in enumerate(parts[1:]):
        if i < len(tool_blocks):
            replacement = _format_claude_tool_block(tool_blocks[i])
        else:
            replacement = CLAUDE_TOOL_PLACEHOLDER
        rebuilt += replacement + tail
    # Empty replacements (successful tool_result) leave bare blank lines
    # behind. Collapse 3+ newlines back to a paragraph break so the
    # resulting Markdown doesn't render with huge gaps.
    return re.sub(r"\n{3,}", "\n\n", rebuilt).strip()


def parse_claude_export(data):
    conversations = []
    for conv in data:
        messages = []
        message_timestamps = []
        conversation_model = _extract_model_from_obj(conv)
        for message in sorted(conv.get("chat_messages", []), key=lambda item: item.get("created_at", "")):
            sender = message.get("sender")
            role = "user" if sender == "human" else "assistant" if sender == "assistant" else None
            if conversation_model is None:
                conversation_model = _extract_model_from_obj(message)
            timestamp = _format_timestamp(message.get("created_at"))
            if timestamp:
                message_timestamps.append(timestamp)
            text = _build_claude_message_text(message)
            if role and text:
                messages.append({"role": role, "text": text})

        messages = _finalize_messages(messages)
        if messages:
            conversation_source_created_at = (
                _format_timestamp(conv.get("created_at"))
                or (min(message_timestamps) if message_timestamps else None)
            )
            conversations.append(
                {
                    "conv_id": conv.get("uuid", ""),
                    "source": "claude",
                    "title": conv.get("name", "Untitled"),
                    "model": conversation_model,
                    "source_created_at": conversation_source_created_at,
                    "messages": messages,
                }
            )
    return conversations


def parse_gemini_export(data):
    grouped = defaultdict(list)
    for item in data:
        date_key = item.get("time", "").split("T")[0] if "T" in item.get("time", "") else "Unknown Date"
        grouped[date_key].append(item)

    conversations = []
    for date_key, items in grouped.items():
        messages = []
        conversation_model = None
        message_timestamps = []
        for item in sorted(items, key=lambda value: value.get("time", "")):
            if conversation_model is None:
                conversation_model = _extract_model_from_obj(item)
            timestamp = _format_timestamp(item.get("time"))
            if timestamp:
                message_timestamps.append(timestamp)
            prompt = (
                item.get("title", "")
                .replace("送信したメッセージ: ", "")
                .replace(" と言いました", "")
                .replace("Said ", "")
                .strip()
            )
            safe_items = item.get("safeHtmlItem", [])
            response_html = ""
            if safe_items and isinstance(safe_items, list):
                response_html = safe_items[0].get("html", "")
            response = gemini_html_to_md(response_html)
            if prompt:
                messages.append({"role": "user", "text": prompt})
            if response:
                messages.append({"role": "assistant", "text": response})

        messages = _finalize_messages(messages)
        if messages:
            conversations.append(
                {
                    "conv_id": f"gemini_{date_key}",
                    "source": "gemini",
                    "title": f"Geminiの記録 ({date_key})",
                    "model": conversation_model,
                    "source_created_at": min(message_timestamps) if message_timestamps else None,
                    "messages": messages,
                }
            )
    return conversations


def parse_json_file(path, raw_text=None):
    text = raw_text if raw_text is not None else path.read_text(encoding="utf-8")
    data = json.loads(text)
    if not isinstance(data, list) or not data:
        return []

    if "mapping" in data[0]:
        return parse_chatgpt_export(data)
    if "chat_messages" in data[0]:
        return parse_claude_export(data)
    if "time" in data[0] and "title" in data[0]:
        return parse_gemini_export(data)
    return []


def parse_input_file(path, raw_text=None):
    suffix = path.suffix.lower()
    if suffix in {".md", ".markdown"}:
        return parse_markdown_file(path, raw_text=raw_text)
    if suffix == ".json":
        return parse_json_file(path, raw_text=raw_text)
    return []


def import_files(paths):
    conn = init_db()
    cursor = conn.cursor()
    imported_count = 0
    provenance_updated_count = 0
    imported_paths = []

    for path in paths:
        cursor.execute("SAVEPOINT import_file")
        try:
            raw_source = _build_raw_source_record(path)
            imported_at = _current_imported_at()
            conversations = parse_input_file(path, raw_text=raw_source["raw_text"])
        except Exception as exc:
            cursor.execute("ROLLBACK TO SAVEPOINT import_file")
            cursor.execute("RELEASE SAVEPOINT import_file")
            print(f"⚠️ 解析失敗: {path.name} ({exc})")
            continue

        if not conversations:
            cursor.execute("ROLLBACK TO SAVEPOINT import_file")
            cursor.execute("RELEASE SAVEPOINT import_file")
            print(f"💡 取り込み対象が見つからなかったわ: {path.name}")
            continue

        try:
            raw_source_id = register_raw_source(
                cursor,
                raw_source["source_hash"],
                raw_source["source_format"],
                source_path=raw_source["source_path"],
                source_created_at=raw_source["source_created_at"],
                imported_at=imported_at,
                mime_type=raw_source["mime_type"],
                size_bytes=raw_source["size_bytes"],
                text_encoding=raw_source["text_encoding"],
                raw_text=raw_source["raw_text"],
                raw_bytes_path=raw_source["raw_bytes_path"],
            )
            imported_paths.append(str(path))
            for conv in conversations:
                conv.setdefault("model", None)
                conv.setdefault("source_file", path.name)
                conv.setdefault("source_created_at", raw_source["source_created_at"])
                if register_conversation(
                    cursor,
                    conv["conv_id"],
                    conv["source"],
                    conv["title"],
                    conv["messages"],
                    model=conv.get("model"),
                    source_file=conv.get("source_file"),
                    raw_source_id=raw_source_id,
                    source_created_at=conv.get("source_created_at"),
                    imported_at=imported_at,
                ):
                    imported_count += 1
                else:
                    provenance_updated_count += update_conversation_metadata(
                        cursor,
                        conv["conv_id"],
                        model=conv.get("model"),
                        source_file=conv.get("source_file"),
                        raw_source_id=raw_source_id,
                        source_created_at=conv.get("source_created_at"),
                        imported_at=imported_at,
                    )
        except Exception as exc:
            cursor.execute("ROLLBACK TO SAVEPOINT import_file")
            cursor.execute("RELEASE SAVEPOINT import_file")
            print(f"⚠️ 保存失敗: {path.name} ({exc})")
            continue

        cursor.execute("RELEASE SAVEPOINT import_file")

    conn.commit()
    conn.close()

    if imported_count > 0:
        save_history(imported_paths)
        print(f"✨ 新しく {imported_count} 個の物語を登録したわ！")
    elif provenance_updated_count > 0:
        save_history(imported_paths)
        print(f"✨ 新規登録はなかったけれど、{provenance_updated_count} 件の provenance を更新したわ。")
    else:
        print("💡 登録できる新しい物語がなかったわ。（すでに登録済みのデータよ）")


def main(jpaths):
    import_files(jpaths)


def backfill_models_from_paths(paths=None):
    history_paths = [Path(path) for path in load_history()]
    extra_paths = [Path(path) for path in (paths or [])]
    merged_paths = []
    for path in history_paths + extra_paths:
        if path not in merged_paths:
            merged_paths.append(path)
    existing_paths = [path for path in merged_paths if path.exists()]
    if not existing_paths:
        print("💡 model を埋め直せる元ログが見つからなかったわ。")
        return 0

    conn = init_db()
    cursor = conn.cursor()
    updated_count = 0

    for path in existing_paths:
        try:
            conversations = parse_input_file(path)
        except Exception as exc:
            print(f"⚠️ 再解析失敗: {path.name} ({exc})")
            continue

        for conv in conversations:
            model = conv.get("model")
            source_file = conv.get("source_file") or path.name
            source_created_at = conv.get("source_created_at")
            if not model and not source_file and not source_created_at:
                continue
            updated_count += update_conversation_metadata(
                cursor,
                conv["conv_id"],
                model=model,
                source_file=source_file,
                source_created_at=source_created_at,
            )

    conn.commit()
    conn.close()
    print(f"✨ model / source file を {updated_count} 件更新したわ。")
    return updated_count


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "--backfill-models":
        backfill_models_from_paths(sys.argv[2:])
    elif len(sys.argv) >= 2:
        main([Path(path) for path in sys.argv[1:]])
