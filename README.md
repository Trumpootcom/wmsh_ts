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

The Worker supports Letter or Ledger in either orientation, plus rectangular and hex grids with optional projection. Run `curl.exe -fsS http://127.0.0.1:8787/help` for the supported styles, aliases, and template fields.

Run `npm.cmd run typecheck` to generate the Worker types and check the TypeScript.

Omit both template fields to use **Default** from D1, with the bundled [160-foot-wide, 2×2 landscape Ledger template](src/default.json) as fallback when the row is missing or no database is bound. Upload `template_file` or send `-F "template_alias=default"` to choose a template explicitly. URL overrides apply after selection.

## Saved templates

The Worker reads JSON from the `templates` table in the `wmsh-ts` D1 database. Each card shows its stable numeric ID. Use `/render?template_id=0001` to render with Default by ID. Existing `template_alias` commands still work. Read the JSON directly with `GET /templates/<alias>`.

Bind the database as `TEMPLATES` using its Database ID in `wrangler.jsonc`. Before deploying the binding, apply the migration to create the table and seed Default:

```powershell
npx.cmd wrangler d1 migrations apply wmsh-ts --remote
```

For local Wrangler storage, run the same command with `--local`.

On the test page, click **Templates** to open the gallery. Each card has **Load** to copy its settings into the form and **Save to** to overwrite that template with the current form settings. Templates other than Default also have **Rename** and **Delete**. Rename updates the display name and preserves the alias used in render requests. **New from current settings** asks for a name.

Set the production password with `npx.cmd wrangler secret put TEMPLATE_PASSWORD`. For local Wrangler, put `TEMPLATE_PASSWORD="your-local-password"` in the git-ignored `.dev.vars` file and restart the server. After a successful edit, the page remembers the password for that renderer until reload. The Worker receives it in the POST body.

The gallery uses `GET /templates` for names and aliases, `GET /templates/<alias>/preview.svg` for thumbnails, and `POST /templates` for password-protected changes.

The bundled template prepends a landscape assembly guide titled **TTRPG Battle Map**. Use `?overview=0` or turn off **Overview page** in `test.html` to omit it. Custom templates can set `"overview": true` or use `?overview=1` to include it.

Open the [hosted test page](https://wmsh-ts.trumpoot.workers.dev/test.html), or run `npm.cmd run dev` and visit `http://127.0.0.1:8787/test.html`. The served page uses its own Worker for rendering and help. Select a JPEG, PNG, or static WebP, adjust the settings, and click **Render PDF**.

You can also open [public/test.html](public/test.html) directly from disk and choose **Local** or **Live**.

## Render traffic

Cloudflare Workers Analytics Engine records uploaded image bytes and generated PDF bytes in `wmsh_render_traffic`. An accepted image field counts even if rendering later fails. Generated PDF bytes measure the response body prepared by the Worker. The totals exclude multipart and HTTP overhead, help pages, and static assets.

Run this through the [Analytics Engine SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/) to see daily totals in decimal MB. Multiply by the sampling interval to account for sampled data.

```sql
SELECT
  toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day,
  sum(double1 * _sample_interval) / 1000000 AS uploaded_image_mb,
  sum(double2 * _sample_interval) / 1000000 AS generated_pdf_mb
FROM wmsh_render_traffic
WHERE timestamp >= NOW() - INTERVAL '7' DAY
GROUP BY day
ORDER BY day DESC
```
