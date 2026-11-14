# TODO for November 14, 2026

- [x] Add a configurable overview title to the template and `test.html`. Default to `TTRPG Battle Map` and support the `title` URL parameter.

- [ ] Add a hex grid option to the renderer and `test.html`. Define how print scale applies to hexes and verify that the grid aligns across sheet overlaps.

- [ ] Add a **Copy settings** button to `test.html` that puts the current render settings on the clipboard in a format you can paste into ChatGPT.
- [ ] Implement named templates backed by Cloudflare R2 so a render can reuse saved settings by template name.
- [ ] Add a **Save as template** action to `test.html` that saves the current settings to R2 under a name you enter.

- [ ] Publish the test interface publicly. Consider hosting `test.html` on `trumpoot.com`, serving it from the Worker’s root URL, or doing both. Verify that visitors can select an image, render it through the live Worker, and preview and download the PDF. Check cross-origin access if the interface and renderer use different origins.

- [x] Set and verify numeric control increments in `test.html`, including whole-number steps for page rows and columns and support for the precise `0.125`-inch overlap default.

- [x] Accept PNG uploads and convert them to a working JPEG before rendering.
- [x] Accept static WebP uploads through the working JPEG normalization used for PNG and include WebP in the `test.html` file picker.
- [x] Label every map sheet with a bold Excel-style corner badge (A1, B1, A2, B2).
- [x] Include a page number on the overview.
- [x] Add an optional landscape overview as the first PDF page, enabled with overview=1 or the test.html control. Fit the entire assembled map and its gameplay grid onto one sheet, then draw the sheet boundaries with a 5 pt white stroke underneath a centered 1 pt black dotted cut line. Use these stroke widths at the final overview page size. Use the renderer’s printable dimensions and sheet steps. The printable span is the paper size minus both margins, and the step is that span minus the overlap. Show both edges of each shared strip where sheets overlap. Add a text box with the template name, effective render parameters after URL overrides, world and printed map dimensions, grid print scale, paper size and orientation, page layout, margins, and overlap. Include a scale bar calibrated to the overview and a legend that identifies the gameplay grid, dotted sheet cut lines, and overlap strips. When enabled, the overview adds one page before the regular sheets.
