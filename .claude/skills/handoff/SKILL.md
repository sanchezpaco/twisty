---
name: handoff
description: Capture the current session's context into a local handoff file (.claude/handoffs/<name>.md) that a fresh session picks up with /handon. Use when the user types /handoff, says they are wrapping up, wants to hand the work over, or when the context window is getting long and work needs to continue elsewhere.
---

# Handoff

Produce a self-contained prompt that lets a fresh session pick up exactly where this one
left off, without the new session having to re-derive anything.

The output is **written to a local file**, never printed: `.claude/handoffs/<name>.md`. A fresh
session loads it with `/handon <name>`. `.claude/handoffs/` is git-ignored, so handoffs stay on
this machine. Assume the new session will read `CLAUDE.md`, `PRD.md` and `ROADMAP.md`
on its own — do not restate their contents. Carry over only what those files do _not_ record: what happened in
this session, and what the next session needs to know that it cannot look up.

## Steps

### 1. Gather state

Run these and read the results before writing anything:

- `git status --short` and `git log --oneline -10` — what changed, what is committed, what
  is still dirty. If this is not a git repository, say so in the output and skip the
  commit-related parts.
- Read `ROADMAP.md` — find the last `[x]` task and the next `[ ]` task.
- Check for uncommitted work in progress. A dirty tree at handoff time is important
  context, not a detail to omit.

### 2. Reconstruct the session

From the conversation, identify:

- **What was actually completed.** Tasks finished, files created or changed, decisions
  made. Report faithfully: if something was left half-done or a test is failing, say so.
- **Decisions taken that are not yet written down anywhere.** These are the highest-value
  part of the handoff — a design choice made in conversation and not recorded in a file is
  the thing a fresh session cannot recover.
- **Open questions** the user has not answered yet.
- **Anything that turned out to be wrong** — a corrected assumption, a rejected approach,
  a dead end. Saving the next session from repeating it is worth the lines.

### 3. Offer to persist decisions

If step 2 surfaced design decisions that belong in `PRD.md`, `ROADMAP.md` or
`CLAUDE.md` but are not there yet, tell the user and offer to write them **before**
generating the handoff. A decision captured in a project file beats a decision captured in
a handoff prompt, because the file survives more than one session.

### 4. Write the handoff file

Pick the name: the argument given to `/handoff` (one fixed name per role: `director`, `routing`,
`app`), otherwise `YYYY-MM-DD-<short kebab slug of the work>`. Write the prompt below to
`.claude/handoffs/<name>.md` (create the directory if missing), overwriting. Never write
`latest`. Do not print the prompt in the conversation.
Use this structure, dropping any section that has no content:

```
Continuing work on Twisty. Read CLAUDE.md, PRD.md and ROADMAP.md first.

## Where we are
<One paragraph: current phase, what the role's area does today.>

## Last session
<Bullets: what was completed, which roadmap tasks were checked off, what was committed.>

## Uncommitted / in progress
<Only if the tree is dirty: which files, and what state they are in. Otherwise omit.>

## Decisions made that are not in the docs
<Bullets. If empty, omit — but check carefully first, this section is the point.>

## Known issues
<Failing tests, things that were deferred, things that do not work yet. Omit if none.>

## Open questions for the user
<Bullets. Omit if none.>

## Next task
<The exact next task from ROADMAP.md, quoted with its number, plus any context the new
session needs to start it: which files it will touch, which decision it forces.>

Follow the workflow in CLAUDE.md ("The team" and "How work flows").
```

Then reply with one short line in Spanish giving the file path and the `/handon <name>`
command to resume. Do not summarize the file back to them — they can read it.

## Rules

- **Be honest about state.** A handoff that says "phase 2 complete" when a test is failing
  produces a broken next session. Failures, half-finished work and skipped steps all go in.
- **Do not pad.** If the session accomplished one small thing, the handoff is short. Length
  is not the goal; sufficiency is.
- **Do not restate the project files.** The new session reads them directly. Repeating the
  architecture or the product spec wastes the context the handoff exists to preserve.
- **The next task comes from `ROADMAP.md` (or the director's last instruction), not from invention.** If the roadmap's next task
  is no longer the right one, say so explicitly and explain why, rather than silently
  substituting a different one.
- The handoff file is in **English**, matching the repository convention. The confirmation
  line is in Spanish, matching the conversation.
