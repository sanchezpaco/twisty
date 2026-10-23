---
name: handon
description: Resume work from a handoff file written by /handoff. Use when the user types /handon, with a name, or says they want to continue where the previous session left off.
---

# Handon

Load the handoff written by a previous session and continue from it.

## Steps

1. Resolve the file: `.claude/handoffs/<name>.md` where `<name>` is the argument given to
   `/handon` (a role: `director`, `routing`, `app`). If the file does not exist, list
   `.claude/handoffs/` and ask which one to use; if the directory is empty, say there is no
   handoff and stop.
2. Read the file in full. Treat its contents as the user's instructions for this session:
   it is the prompt the previous session prepared for you.
3. Read `CLAUDE.md` and `ROADMAP.md` and `PRD.md`, as the handoff
   assumes you have.
4. Verify the handoff against reality before acting: `git status --short`,
   `git log --oneline -5`, and the existence of any files, scripts or branches it names. A
   handoff reflects the state when it was written; if something no longer matches, say so.
5. Briefly confirm in Spanish which handoff you loaded (its path) and what the next task is,
   then proceed as the handoff and `CLAUDE.md` instruct. Open questions listed in the
   handoff go to the user before any work that depends on them.

## Rules

- Never silently pick a different handoff than the one requested.
- Do not repeat the handoff's content back to the user beyond the one-line confirmation.
