#!/usr/bin/env python3
import argparse
import re
import sqlite3
import sys
from collections import Counter, defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app_paths import DB_FILE


SUPPORTED_SIMPLE_COMMANDS = {
    "displaystyle", "textstyle", "scriptstyle", "scriptscriptstyle",
    "cdot", "times", "div", "pm", "mp", "approx", "neq", "ne", "leq", "geq", "le", "ge",
    "to", "rightarrow", "leftarrow", "Rightarrow", "Leftarrow", "infty", "partial", "nabla",
    "sum", "prod", "int", "forall", "exists", "in", "notin", "subseteq", "supseteq",
    "subset", "supset", "cup", "cap", "land", "lor",
    "alpha", "beta", "gamma", "delta", "varepsilon", "epsilon", "theta", "vartheta",
    "lambda", "mu", "pi", "varpi", "rho", "varrho", "sigma", "varsigma", "phi", "varphi",
    "omega", "Delta", "Theta", "Lambda", "Pi", "Sigma", "Phi", "Omega",
    "left", "right", "quad", "qquad", "ldots", "cdots", "dots", "vec", "hat", "tilde",
    "bar", "operatorname", "mathrm", "mathbf", "mathit", "mathbb", "mathcal", "text",
    "sqrt", "frac",
    "arg", "cos", "cosh", "cot", "coth", "csc", "deg", "det", "dim", "exp", "gcd", "hom",
    "inf", "ker", "lim", "ln", "log", "max", "min", "mod", "Pr", "sec", "sin", "sinh",
    "sup", "tan", "tanh",
}
SUPPORTED_ENVIRONMENTS = {"bmatrix", "pmatrix", "matrix", "cases", "vmatrix", "Vmatrix"}
COMMON_OPERATOR_NAMES = {
    "arg", "cos", "cosh", "cot", "coth", "csc", "deg", "det", "dim", "exp", "gcd", "hom",
    "inf", "ker", "lim", "ln", "log", "max", "min", "mod", "Pr", "sec", "sin", "sinh",
    "sup", "tan", "tanh",
}
IGNORED_ESCAPE_COMMANDS = {"b", "f", "n", "r", "t", "u"}

PATTERN_COMMAND = re.compile(r"\\([A-Za-z]+)")
PATTERN_ENV = re.compile(r"\\begin\{([^}]+)\}|\\end\{([^}]+)\}")
PATTERN_TABLE_SEPARATOR = re.compile(r"^\|?(?:\s*:?-{3,}:?\s*\|)+(?:\s*:?-{3,}:?\s*)\|?$", re.M)
PATTERN_HTML_TAG = re.compile(r"<\s*(sup|sub|span)\b", re.I)
PATTERN_HTML_ENTITY = re.compile(r"&[a-zA-Z]+;")
PATTERN_MATHISH = re.compile(r"(\\[A-Za-z]+|\$[^\n$]+\$|\\\(|\\\[|\b(?:sin|cos|tan|sinh|cosh|tanh|log|ln|max|min|lim)\b)")


def parse_args():
    parser = argparse.ArgumentParser(description="Audit archived messages for likely math rendering problems.")
    parser.add_argument("--db", default=str(DB_FILE), help="Path to archive.db")
    parser.add_argument("--limit", type=int, default=5, help="Examples to show per issue")
    return parser.parse_args()


def fetch_rows(db_path):
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        return conn.execute(
            """
            SELECT m.conv_id, m.msg_index, m.content, c.title
            FROM messages m
            JOIN conversations c ON c.id = m.conv_id
            WHERE m.content LIKE '%\\%'
               OR m.content LIKE '%$%'
               OR m.content LIKE '%|%'
               OR m.content LIKE '%<sup>%'
               OR m.content LIKE '%&middot;%'
            """
        ).fetchall()
    finally:
        conn.close()


def classify_rows(rows, limit):
    issues = Counter()
    examples = defaultdict(list)
    math_rows = 0

    for row in rows:
        text = row["content"] or ""
        if not PATTERN_MATHISH.search(text) and not PATTERN_TABLE_SEPARATOR.search(text):
            continue
        math_rows += 1

        commands = set(PATTERN_COMMAND.findall(text))
        environments = set(a or b for a, b in PATTERN_ENV.findall(text))
        unsupported_commands = sorted(
            cmd for cmd in commands
            if cmd not in SUPPORTED_SIMPLE_COMMANDS and cmd not in IGNORED_ESCAPE_COMMANDS
        )
        unsupported_envs = sorted(env for env in environments if env not in SUPPORTED_ENVIRONMENTS)
        category_hits = []

        if unsupported_envs:
            category_hits.append(("unsupported_env", ", ".join(unsupported_envs[:6])))
        if unsupported_commands:
            category_hits.append(("unsupported_cmd", ", ".join(unsupported_commands[:8])))
            named_ops = [cmd for cmd in unsupported_commands if cmd in COMMON_OPERATOR_NAMES]
            if named_ops:
                category_hits.append(("common_math_name_unhandled", ", ".join(named_ops[:8])))
        if PATTERN_HTML_TAG.search(text):
            category_hits.append(("html_inside_mathish_text", "html tags like <sup>/<span>"))
        if PATTERN_HTML_ENTITY.search(text):
            category_hits.append(("html_entity_inside_mathish_text", "html entities like &middot;"))
        if PATTERN_TABLE_SEPARATOR.search(text):
            category_hits.append(("markdown_table_with_math", "markdown table"))
        if "\\begin{" in text and "\\end{" in text and "\n" in text:
            category_hits.append(("multiline_tex_block", "multiline environment block"))

        if not category_hits and commands:
            continue

        for category, detail in category_hits:
            issues[category] += 1
            if len(examples[category]) >= limit:
                continue
            snippet = re.sub(r"\s+", " ", text.strip())[:220]
            examples[category].append(
                {
                    "title": row["title"],
                    "msg_index": row["msg_index"],
                    "detail": detail,
                    "snippet": snippet,
                }
            )

    return math_rows, issues, examples


def main():
    args = parse_args()
    rows = fetch_rows(args.db)
    math_rows, issues, examples = classify_rows(rows, args.limit)

    print(f"db\t{args.db}")
    print(f"candidate_rows\t{math_rows}")
    print("issues")
    for name, count in issues.most_common():
        print(f"{name}\t{count}")

    print("examples")
    for name in issues:
        print(f"## {name}")
        for example in examples[name]:
            print(
                f"- {example['title']} [msg {example['msg_index']}] :: "
                f"{example['detail']} :: {example['snippet']}"
            )


if __name__ == "__main__":
    main()
