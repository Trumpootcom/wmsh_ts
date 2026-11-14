# Headless WMS

Upload a JPEG, PNG, or static WebP and a JSON template to produce a PDF with a square grid. The [example template](examples/letter-square.json) centers the map on one US Letter sheet at an 8-inch print width and overlays a 1-inch grid across the printable area. Use a landscape or square image for the first test.

From PowerShell, start the local Worker:

```powershell
npm.cmd ci
npm.cmd run dev
```

In another terminal, upload a JPEG, PNG, or static WebP and open the result:

```powershell
curl.exe --fail-with-body -F "image=@C:\path\to\map.jpg" -F "template_file=@examples/letter-square.json" -o smoke.pdf http://127.0.0.1:8787/render
Invoke-Item smoke.pdf
```

Include every field in the example. Try changing `grid.inchesPerFiveFeet` to `0.5` to print the map 4 inches wide with half-inch squares. For a two-sheet print, start with the example and set `page.columns` to `2` and `worldWidthFeet` to `65`. The PDF contains exactly `page.rows × page.columns` sheets, up to 100, in row order from the top left. The map is centered across the assembled printable area, and adjacent sheets share the specified overlap. If the map exceeds that area, the Worker shrinks the image proportionally to fit while preserving the grid spacing. The fitted image represents fewer world feet.

The Worker supports Letter or Ledger in either orientation, plus square and isometric grids centered on the image. Run `curl.exe -fsS http://127.0.0.1:8787/help` for the supported styles, aliases, and template fields. See [vision.md](vision.md) for planned R2 alias support.

Run `npm.cmd run typecheck` to generate the Worker types and check the TypeScript.

Omit `template_file` to use the bundled [160-foot-wide, 2×2 landscape Ledger template](src/default.json). URL overrides apply to both bundled and uploaded templates.

Add `?overview=1` to prepend a landscape assembly guide, or turn on **Overview page** in `test.html`. The guide uses the selected paper size and shows the full gridded layout, cut lines, render settings, and a calibrated scale bar.

Open [test.html](test.html) directly in your browser. Select a JPEG, PNG, or static WebP, adjust the settings, and click **Render PDF**. Choose **Local** with `npm.cmd run dev` running on port 8787, or choose **Live** once Cloudflare has deployed support for requests from the standalone page.
