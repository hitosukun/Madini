import hashlib
import json
import sqlite3
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from app_paths import DB_FILE, HISTORY_FILE, THEMES_JSON, USER_DATA_DIR


def ensure_user_data_dir() -> None:
    USER_DATA_DIR.mkdir(parents=True, exist_ok=True)


def init_db(db_file=DB_FILE):
    Path(db_file).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            source TEXT,
            title TEXT,
            date_str TEXT,
            prompt_count INTEGER,
            hash TEXT UNIQUE
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conv_id TEXT,
            role TEXT,
            content TEXT,
            msg_index INTEGER,
            FOREIGN KEY(conv_id) REFERENCES conversations(id)
        )
        """
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_messages_conv_order ON messages(conv_id, msg_index)"
    )
    try:
        cursor.execute(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS search_idx
            USING fts5(conv_id, title, content, tokenize="unicode61")
            """
        )
    except sqlite3.OperationalError:
        pass
    conn.commit()
    return conn


def _joined_message_text(messages, role):
    return "\n\n".join(m["text"] for m in messages if m["role"] == role)


def register_conversation(cursor, conv_id, source, title, messages):
    full_text = "\n".join(m["text"] for m in messages)
    prompts_text = _joined_message_text(messages, "user")
    conv_hash = hashlib.md5(f"{title}{full_text}".encode("utf-8")).hexdigest()

    try:
        cursor.execute(
            "INSERT INTO conversations VALUES (?, ?, ?, ?, ?, ?)",
            (
                conv_id,
                source,
                title,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                sum(1 for m in messages if m["role"] == "user"),
                conv_hash,
            ),
        )
        for index, message in enumerate(messages):
            cursor.execute(
                """
                INSERT INTO messages (conv_id, role, content, msg_index)
                VALUES (?, ?, ?, ?)
                """,
                (conv_id, message["role"], message["text"], index),
            )
        try:
            cursor.execute(
                "INSERT INTO search_idx (conv_id, title, content) VALUES (?, ?, ?)",
                (conv_id, title, full_text or prompts_text),
            )
        except sqlite3.OperationalError:
            pass
        return True
    except sqlite3.IntegrityError:
        return False
    except sqlite3.DatabaseError as exc:
        print(f"⚠️ DBエラー: {exc}")
        return False


def fetch_all_conversations(db_file=DB_FILE):
    if not db_file.exists():
        return []

    conn = sqlite3.connect(f"file:{db_file}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    conv_rows = cursor.execute(
        """
        SELECT id, source, title, date_str, prompt_count
        FROM conversations
        ORDER BY date_str DESC
        """
    ).fetchall()

    grouped_messages = defaultdict(list)
    for row in cursor.execute(
        """
        SELECT conv_id, role, content, msg_index
        FROM messages
        ORDER BY conv_id, msg_index
        """
    ).fetchall():
        grouped_messages[row["conv_id"]].append(
            {"role": row["role"], "text": row["content"]}
        )

    conversations = []
    for row in conv_rows:
        messages = grouped_messages.get(row["id"], [])
        conversations.append(
            {
                "id": row["id"],
                "source": row["source"],
                "title": row["title"],
                "date": row["date_str"],
                "messages": messages,
                "promptCount": row["prompt_count"],
                "prompts_text": _joined_message_text(messages, "user"),
                "answers_text": "\n\n".join(
                    m["text"] for m in messages if m["role"] != "user"
                ),
            }
        )

    conn.close()
    return conversations


def fetch_conversation_index(
    db_file=DB_FILE,
    prompt_search_limit=1200,
    answer_search_limit=1200,
    preview_limit=5,
    preview_chars=24,
):
    if not db_file.exists():
        return []

    conn = sqlite3.connect(f"file:{db_file}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    conv_rows = cursor.execute(
        """
        SELECT id, source, title, date_str, prompt_count
        FROM conversations
        ORDER BY date_str DESC
        """
    ).fetchall()

    by_conv = {
        row["id"]: {
            "id": row["id"],
            "source": row["source"],
            "title": row["title"],
            "date": row["date_str"],
            "promptCount": row["prompt_count"],
            "promptPreviews": [],
            "prompts_text": "",
            "answers_text": "",
        }
        for row in conv_rows
    }

    for row in cursor.execute(
        """
        SELECT conv_id, role, content, msg_index
        FROM messages
        ORDER BY conv_id, msg_index
        """
    ).fetchall():
        conv = by_conv.get(row["conv_id"])
        if not conv:
            continue

        content = row["content"] or ""
        if row["role"] == "user":
            if len(conv["promptPreviews"]) < preview_limit:
                conv["promptPreviews"].append(
                    {
                        "messageIndex": row["msg_index"],
                        "preview": content.splitlines()[0][:preview_chars],
                    }
                )
            remaining = prompt_search_limit - len(conv["prompts_text"])
            if remaining > 0:
                if conv["prompts_text"]:
                    conv["prompts_text"] += "\n\n"
                    remaining -= 2
                conv["prompts_text"] += content[: max(0, remaining)]
        else:
            remaining = answer_search_limit - len(conv["answers_text"])
            if remaining > 0:
                if conv["answers_text"]:
                    conv["answers_text"] += "\n\n"
                    remaining -= 2
                conv["answers_text"] += content[: max(0, remaining)]

    conn.close()
    return [by_conv[row["id"]] for row in conv_rows]


def fetch_conversation_detail(conv_id, db_file=DB_FILE):
    if not db_file.exists():
        return None

    conn = sqlite3.connect(f"file:{db_file}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    row = cursor.execute(
        """
        SELECT id, source, title, date_str, prompt_count
        FROM conversations
        WHERE id = ?
        """,
        (conv_id,),
    ).fetchone()
    if not row:
        conn.close()
        return None

    messages = [
        {"role": msg["role"], "text": msg["content"]}
        for msg in cursor.execute(
            """
            SELECT role, content, msg_index
            FROM messages
            WHERE conv_id = ?
            ORDER BY msg_index
            """,
            (conv_id,),
        ).fetchall()
    ]

    conn.close()
    return {
        "id": row["id"],
        "source": row["source"],
        "title": row["title"],
        "date": row["date_str"],
        "promptCount": row["prompt_count"],
        "messages": messages,
        "prompts_text": _joined_message_text(messages, "user"),
        "answers_text": "\n\n".join(m["text"] for m in messages if m["role"] != "user"),
    }


def _group_turns(message_rows):
    turns = []
    current_turn = None

    for row in message_rows:
        role = row["role"]
        content = row["content"] or ""
        msg_index = row["msg_index"]

        if role == "user":
            if current_turn and (current_turn["prompt"] or current_turn["answers"]):
                turns.append(current_turn)
            current_turn = {"messageIndex": msg_index, "prompt": content, "answers": []}
            continue

        if current_turn is None:
            current_turn = {"messageIndex": msg_index, "prompt": "", "answers": []}
        current_turn["answers"].append(content)

    if current_turn and (current_turn["prompt"] or current_turn["answers"]):
        turns.append(current_turn)

    return turns


def _normalize_search_words(words):
    return [word.strip().lower() for word in words if word and word.strip()]


def _build_all_words_like_clause(columns, normalized_words):
    if not columns or not normalized_words:
        return "", []

    clauses = []
    params = []
    for word in normalized_words:
        token = f"%{word}%"
        subclauses = [f"LOWER(COALESCE({column}, '')) LIKE ?" for column in columns]
        clauses.append("(" + " OR ".join(subclauses) + ")")
        params.extend([token] * len(columns))

    return " AND ".join(clauses), params


def search_conversations(words, include_title=True, include_prompt=True, include_answer=True, db_file=DB_FILE):
    normalized_words = _normalize_search_words(words)
    if not normalized_words or not db_file.exists():
        return {}

    conn = sqlite3.connect(f"file:{db_file}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    results = {}
    if include_title:
        title_clause, title_params = _build_all_words_like_clause(
            ["title"], normalized_words
        )
        if title_clause:
            for row in cursor.execute(
                f"""
                SELECT id
                FROM conversations
                WHERE {title_clause}
                """,
                title_params,
            ).fetchall():
                results[row["id"]] = {
                    "matched": True,
                    "hits": 0,
                    "matchedMessageIndexes": [],
                    "titleMatched": True,
                }

    turn_columns = []
    if include_prompt:
        turn_columns.append("prompt")
    if include_answer:
        turn_columns.append("answer")

    if turn_columns:
        turn_clause, turn_params = _build_all_words_like_clause(
            turn_columns, normalized_words
        )
        if turn_clause:
            turn_rows = cursor.execute(
                f"""
                WITH ordered_messages AS (
                    SELECT
                        conv_id,
                        role,
                        content,
                        msg_index,
                        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) OVER (
                            PARTITION BY conv_id
                            ORDER BY msg_index
                            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                        ) AS turn_no
                    FROM messages
                ),
                turns AS (
                    SELECT
                        conv_id,
                        MIN(CASE WHEN role = 'user' THEN msg_index END) AS message_index,
                        MAX(CASE WHEN role = 'user' THEN content END) AS prompt,
                        GROUP_CONCAT(
                            CASE WHEN role != 'user' THEN content END,
                            char(10) || char(10)
                        ) AS answer
                    FROM ordered_messages
                    GROUP BY conv_id, turn_no
                )
                SELECT conv_id, message_index
                FROM turns
                WHERE message_index IS NOT NULL
                  AND {turn_clause}
                ORDER BY conv_id, message_index
                """,
                turn_params,
            ).fetchall()

            for row in turn_rows:
                entry = results.setdefault(
                    row["conv_id"],
                    {
                        "matched": True,
                        "hits": 0,
                        "matchedMessageIndexes": [],
                        "titleMatched": False,
                    },
                )
                entry["hits"] += 1
                entry["matchedMessageIndexes"].append(row["message_index"])

    conn.close()
    return results


def load_history():
    if HISTORY_FILE.exists():
        try:
            return json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            pass
    return []


def save_history(files):
    ensure_user_data_dir()
    history = load_history()
    for file_path in reversed(files):
        if file_path in history:
            history.remove(file_path)
        history.insert(0, file_path)
    HISTORY_FILE.write_text(
        json.dumps(history[:50], ensure_ascii=False, indent=2), encoding="utf-8"
    )


def load_themes():
    if THEMES_JSON.exists():
        try:
            return json.loads(THEMES_JSON.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            pass
    return {}
