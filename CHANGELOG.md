# Changelog

## 1.1.0

- Added regular and projected hex grids. Grid shape and isometric projection are separate settings, with support for legacy square and ISO requests.
- Published the browser test page on the same Worker as the renderer and help. Simplified the form and moved Overview and Template into the global controls.
- Renamed the template display name to `template` in JSON and URL overrides. Existing requests can still use `name`.
- Added Analytics Engine counters for uploaded image bytes and generated PDF bytes.

## 1.0.0

- Render JPEG, PNG, and static WebP maps to printable PDFs with configurable paper, margins, overlap, and sheet layouts.
- Support square and isometric grids with adjustable scale, offsets, rotation, dash patterns, and contrast colors.
- Use a bundled Ledger template, an uploaded JSON template, or per-request URL overrides.
- Include a configurable landscape overview with sheet cut lines, a print-scale legend, a title, and Excel-style sheet badges.
- Provide a standalone test page and plain-text help at `/help` and `/url`.
