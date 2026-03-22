import html
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

from archive_store import init_db, register_conversation, save_history


USER_NAME = "ジェンナ"
AI_NAME = "マディニ"
AI_KEYWORDS = ["ai", "assistant", "gpt", "claude", "gemini", "madini", AI_NAME.lower()]


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


def parse_markdown_file(path):
    text = path.read_text(encoding="utf-8")
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
            "messages": messages,
        }
    ]


def parse_chatgpt_export(data):
    conversations = []
    for conv in data:
        messages = []
        nodes = sorted(
            [node for node in conv.get("mapping", {}).values() if node.get("message")],
            key=lambda item: item["message"].get("create_time") or 0,
        )
        for node in nodes:
            message = node["message"]
            role = message.get("author", {}).get("role")
            if role not in {"user", "assistant"}:
                continue
            text = "\n\n".join(
                str(part)
                for part in message.get("content", {}).get("parts", [])
                if isinstance(part, str)
            ).strip()
            if text:
                messages.append({"role": role, "text": text})

        messages = _finalize_messages(messages)
        if messages:
            conversations.append(
                {
                    "conv_id": conv.get("conversation_id") or conv.get("id", ""),
                    "source": "chatgpt",
                    "title": conv.get("title", "Untitled"),
                    "messages": messages,
                }
            )
    return conversations


def parse_claude_export(data):
    conversations = []
    for conv in data:
        messages = []
        for message in sorted(conv.get("chat_messages", []), key=lambda item: item.get("created_at", "")):
            sender = message.get("sender")
            role = "user" if sender == "human" else "assistant" if sender == "assistant" else None
            text = message.get("text", "").strip()
            if role and text:
                messages.append({"role": role, "text": text})

        messages = _finalize_messages(messages)
        if messages:
            conversations.append(
                {
                    "conv_id": conv.get("uuid", ""),
                    "source": "claude",
                    "title": conv.get("name", "Untitled"),
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
        for item in sorted(items, key=lambda value: value.get("time", "")):
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
                    "messages": messages,
                }
            )
    return conversations


def parse_json_file(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list) or not data:
        return []

    if "mapping" in data[0]:
        return parse_chatgpt_export(data)
    if "chat_messages" in data[0]:
        return parse_claude_export(data)
    if "time" in data[0] and "title" in data[0]:
        return parse_gemini_export(data)
    return []


def parse_input_file(path):
    suffix = path.suffix.lower()
    if suffix in {".md", ".markdown"}:
        return parse_markdown_file(path)
    if suffix == ".json":
        return parse_json_file(path)
    return []


def import_files(paths):
    conn = init_db()
    cursor = conn.cursor()
    imported_count = 0
    imported_paths = []

    for path in paths:
        try:
            conversations = parse_input_file(path)
        except Exception as exc:
            print(f"⚠️ 解析失敗: {path.name} ({exc})")
            continue

        if not conversations:
            print(f"💡 取り込み対象が見つからなかったわ: {path.name}")
            continue

        imported_paths.append(str(path))
        for conv in conversations:
            if register_conversation(
                cursor,
                conv["conv_id"],
                conv["source"],
                conv["title"],
                conv["messages"],
            ):
                imported_count += 1

    conn.commit()
    conn.close()

    if imported_count > 0:
        save_history(imported_paths)
        print(f"✨ 新しく {imported_count} 個の物語を登録したわ！")
    else:
        print("💡 登録できる新しい物語がなかったわ。（すでに登録済みのデータよ）")


def main(jpaths):
    import_files(jpaths)


if __name__ == "__main__":
    if len(sys.argv) >= 2:
        main([Path(path) for path in sys.argv[1:]])
