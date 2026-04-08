---
name: sprite-export
description: Export sprite sheet to PNG
---

Export the current project. Usage: /sprite-export [target] [path]

Target can be "sheet", a cell ref ("0,0"), or a group name.
Path defaults to ./{project-name}.png

Calls sprite_export_png and sprite_export_json.
