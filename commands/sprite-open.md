---
name: sprite-open
description: Reopen a stored sprite project
---

Reopen an earlier sprite project. Usage: /sprite-open [name or id]

Projects persist automatically in SQLite — no save file to hunt for. Run:

```
node "$CLAUDE_PLUGIN_ROOT/scripts/sprite.js" sessions
```

to list recent projects (id, name, last updated). If the user gave a name or id, open it directly; otherwise show the list and ask which one:

```
node "$CLAUDE_PLUGIN_ROOT/scripts/sprite.js" open --session <name|id>
```

Cell groups, shape groups, and pivot come back with the project. Load the `sprite-editing` skill before making edits.
