# Pencil Layout

Load this reference when executing **Step 6A** — materializing the `.pen` file via the Pencil MCP.

## Inputs to read before calling the MCP

From the brainstorm ledger `§3 · Reference Artifacts`:

1. **`Final hi-fi screen:`** — the exact HTML file path from the visual companion session
   - If the path exists: read that HTML file. It is the visual intent. Html guides the eye; the markdown sidecar carries the meaning.
   - If `"none — text-only session"`: proceed from the markdown sidecar's Architecture section alone.

2. **`Design tokens:`** block — the palette, surface, typography, and motion values. Apply these to the layout's color choices and surface treatments in the `.pen` file.

## MCP call sequence

1. `mcp__pencil__get_guidelines()` — refresh on the canonical pen format before generating anything
2. Lay out using `mcp__pencil__batch_design()` with operations that cover:
   - Architecture diagrams (source from the markdown sidecar's mermaid sections)
   - Screen mockups (source from the hi-fi HTML reference, if available)
   - Component boundaries (source from the Interface Contracts section of the sidecar)
   - Apply the `design_tokens.palette` and `design_tokens.surface` values to color and glass-effect choices

## Save path

`.prism/shared/designs/YYYY-MM-DD-<topic>.pen`

## After saving

Update the markdown sidecar's `**Visual:**` field with the `.pen` file path.
