#!/usr/bin/env python3
"""PreToolUse hook: block `gh pr create` unless the PR body has a UI verification section.

The issue-verification loop (.claude/skills/issue-verification/) requires every
PR to carry the agent's UI acceptance evidence. A PR with no UI change still
needs the heading, with "N/A — no UI change" and the reason under it.

Exit 0 = allow, exit 2 = block (stderr goes back to Claude).
"""
import json
import re
import shlex
import sys

HEADING = re.compile(r"^##\s+UI verification\b", re.IGNORECASE | re.MULTILINE)


def body_of(args: list[str]) -> str | None:
    for i, arg in enumerate(args):
        for flag in ("--body-file", "-F", "--body", "-b"):
            value = None
            if arg == flag and i + 1 < len(args):
                value = args[i + 1]
            elif arg.startswith(flag + "="):
                value = arg[len(flag) + 1 :]
            if value is None:
                continue
            if flag in ("--body-file", "-F"):
                try:
                    with open(value, encoding="utf-8") as f:
                        return f.read()
                except OSError:
                    return None
            return value
    return None


def main() -> int:
    try:
        command = json.load(sys.stdin).get("tool_input", {}).get("command", "")
    except (json.JSONDecodeError, AttributeError):
        return 0
    # Command position only (start, or after ; & | ( or a newline), so a doc
    # or heredoc that merely mentions the command is not blocked.
    if not re.search(r"(?:^|[;&|(\n])\s*gh\s+pr\s+create\b", command):
        return 0
    try:
        args = shlex.split(command)
    except ValueError:
        args = command.split()
    body = body_of(args)
    if body is not None and HEADING.search(body):
        return 0
    print(
        "Blocked: the PR body has no '## UI verification' section. Run the "
        "issue-verification skill (.claude/skills/issue-verification/SKILL.md) and put its "
        "evidence table in the body (--body-file). A PR with no UI change still needs the "
        "heading, with 'N/A — no UI change' and the reason.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
