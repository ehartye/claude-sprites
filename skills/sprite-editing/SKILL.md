---
name: sprite-editing
description: Guide for effectively using sprite sheet editing tools. Activate when the user asks to draw, create, or edit pixel art sprites.
---

# Sprite Sheet Editing

You have access to sprite_* MCP tools for pixel art creation. Key workflow:

## Starting
1. Create a project: sprite_new_project (pick cell size, grid dimensions)
2. Load a palette: sprite_load_palette (pico8, gameboy, nes) or sprite_set_palette

## Drawing
- Name your shapes as you draw — `shape_name` param. Use descriptive names like "body", "left_arm", "hat".
- Draw background/large shapes first (lower z-index), details on top.
- Use sprite_view_cell frequently to see your work.

## Organization
- Name cells: sprite_name_cell ("idle_1", "walk_3")
- Group related cells: sprite_create_group ("walk_cycle", ["1,0", "1,1", "1,2", "1,3"])
- Use sprite_view_cells to see a group's frames side by side

## Iteration
- sprite_move_shape to adjust positioning
- sprite_recolor_shape to try different colors
- sprite_undo if something goes wrong

## Export
- sprite_export_png for images
- sprite_export_json for texture atlas metadata

## Web UI
The web UI is available at http://localhost:3377 while the MCP server is running. Tell the user they can open it to see real-time updates and draw alongside you.
