# TODO for November 14, 2026

- [x] Remove the single-option Image Placement and Grid Extent controls from the test page and display Overview as a global setting alongside the image and title.

- [x] Record uploaded image bytes and generated PDF bytes in Cloudflare Workers Analytics Engine and document the daily totals query.

- [x] Add a configurable overview title to the template and `test.html`. Default to `TTRPG Battle Map` and support the `title` URL parameter.

- [x] Add regular and projected hex grids with shared geometry across sheet overlaps and a 1-inch round-base fit at 1 inch per 5 feet.
- [ ] Decorate the overview legend and SCALE panels with small parchment squares behind each corner, protruding about 3 pt on each adjoining edge. Add a muted brown rule under the legend heading and a faint divider between its columns.

- [ ] Add a **Copy settings** button to `test.html` that puts the current render settings on the clipboard in a format you can paste into ChatGPT.
- [ ] Add a status strip directly below the `test.html` header that shows the full `curl.exe` command for the selected image, renderer, and current settings. Update it as the inputs change and add a **Copy** button so the command can be pasted into ChatGPT to reproduce the render. The strip only previews and copies the command.
- [x] Implement read-only D1 template loading by alias and a bundled fallback for Default.
- [ ] Bind the wmsh-ts D1 database, apply the migration to seed Default, and deploy the Worker.
- [x] Add the read-only template gallery with overview-style thumbnails and load-on-click controls.
- [ ] Add a **Save as template** action to `test.html` that saves the current settings to D1 under a name you enter.

- [x] Publish the test interface at [the Worker’s /test.html](https://wmsh-ts.trumpoot.workers.dev/test.html) and verify image upload, rendering, PDF preview, and download.

- [x] Set and verify numeric control increments in `test.html`, including whole-number steps for page rows and columns and support for the precise `0.125`-inch overlap default.

- [x] Accept PNG uploads and convert them to a working JPEG before rendering.
- [x] Accept static WebP uploads through the working JPEG normalization used for PNG and include WebP in the `test.html` file picker.
- [x] Label every map sheet with a bold Excel-style corner badge (A1, B1, A2, B2).
- [x] Include a page number on the overview.
- [x] Add an optional landscape overview as the first PDF page, enabled with overview=1 or the test.html control. Fit the entire assembled map and its gameplay grid onto one sheet, then draw the sheet boundaries with a 5 pt white stroke underneath a centered 1 pt black dotted cut line. Use these stroke widths at the final overview page size. Use the renderer’s printable dimensions and sheet steps. The printable span is the paper size minus both margins, and the step is that span minus the overlap. Show both edges of each shared strip where sheets overlap. Add a text box with the template name, effective render parameters after URL overrides, world and printed map dimensions, grid print scale, paper size and orientation, page layout, margins, and overlap. Include a scale bar calibrated to the overview and a legend that identifies the gameplay grid, dotted sheet cut lines, and overlap strips. When enabled, the overview adds one page before the regular sheets.
