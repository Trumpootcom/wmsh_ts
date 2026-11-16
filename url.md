# Headless WMS URL parameters

Upload a JPG to the live Worker. This PowerShell command uses the bundled template and overrides the map width and grid thickness.

```powershell
curl.exe --fail-with-body -F "image=@examples/enc1.jpg" -o map.pdf "https://wmsh-ts.trumpoot.workers.dev/render?wid=140&gpt=2"
```

Replace the JPG path as needed. Add `-F "template_file=@template.json"` to use your own complete JSON template. Overrides apply to either template for that request.

<table>
<thead>
<tr><th>Parameter</th><th>JSON field</th><th>Default</th><th>Description or allowed values</th></tr>
</thead>
<tbody>
<tr><td><code>wid</code></td><td><code>worldWidthFeet</code></td><td><code>160</code></td><td>World width in feet</td></tr>
<tr><td><code>template</code></td><td><code>template</code></td><td><code>template</code></td><td>Template name (legacy alias: <code>name</code>)</td></tr>
<tr><td><code>overview</code></td><td><code>overview</code></td><td><code>true</code></td><td>Global overview toggle. Use <code>1</code> to include or <code>0</code> to omit.</td></tr>
<tr><td><code>place</code></td><td><code>imagePlacement</code></td><td><code>center</code></td><td><code>center</code></td></tr>
<tr><td><code>gstyle</code></td><td><code>grid.style</code></td><td><code>rect</code></td><td><code>rect</code> or <code>hex</code></td></tr>
<tr><td><code>giso</code></td><td><code>grid.iso</code></td><td><code>false</code></td><td><code>true</code> for projection or <code>false</code> for regular cells</td></tr>
<tr><td><code>gangle</code></td><td><code>grid.isoAngleDegrees</code></td><td><code>null</code></td><td><code>15</code> to <code>90</code> with projection on, <code>null</code> with projection off</td></tr>
<tr><td><code>grot</code></td><td><code>grid.rotationDegrees</code></td><td><code>0</code></td><td>Counterclockwise rotation in degrees</td></tr>
<tr><td><code>gx</code></td><td><code>grid.offsetX</code></td><td><code>0</code></td><td>X offset in cell units. Range <code>-1.0</code> to <code>1.0</code></td></tr>
<tr><td><code>gy</code></td><td><code>grid.offsetY</code></td><td><code>0</code></td><td>Y offset in cell units. Range <code>-1.0</code> to <code>1.0</code></td></tr>
<tr><td><code>gscale</code></td><td><code>grid.inchesPerFiveFeet</code></td><td><code>1</code></td><td>Printed inches per five feet</td></tr>
<tr><td valign="top" style="vertical-align: top"><code>gline</code></td><td valign="top" style="vertical-align: top"><code>grid.lineStyle</code></td><td valign="top" style="vertical-align: top"><code>solid</code></td><td valign="top" style="vertical-align: top"><code>solid   ▕────────────────────────────────▏</code><br><code>dash-1  ▕────────                ────────▏</code><br><code>dash-2  ▕────        ────────        ────▏</code><br><code>dash-3  ▕───     ─────      ─────      ──▏</code><br><code>dash-4  ▕──    ────    ────    ────    ──▏</code><br><code>dash-5  ▕──   ───   ───    ───    ───   ─▏</code><br><code>dash-6  ▕──  ───   ──   ───   ──   ───  ─▏</code><br><code>dash-8  ▕─  ──  ──  ──  ──  ──  ──  ──  ─▏</code><br><code>dash-10 ▕─  ─  ─  ─  ──  ─  ──  ─  ─  ─  ▏</code><br><code>dash-16 ▕─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ▏</code><br><code>corners ▕────                        ────▏</code><br><code>none    ▕                                ▏</code></td></tr>
<tr><td><code>gcolor</code></td><td><code>grid.color</code></td><td><code>black</code></td><td><code>black</code>, <code>gray</code>, <code>white</code>, or <code>diff</code> (Difference blend), or <code>contrast</code> (inversion with a midtone adjustment)</td></tr>
<tr><td><code>gpt</code></td><td><code>grid.lineWidthPoints</code></td><td><code>2.5</code></td><td>Stroke width in PDF points</td></tr>
<tr><td><code>gopacity</code></td><td><code>grid.opacity</code></td><td><code>0.6</code></td><td><code>0</code> to <code>1</code></td></tr>
<tr><td><code>gextent</code></td><td><code>grid.extent</code></td><td><code>printableCanvas</code></td><td><code>printableCanvas</code></td></tr>
<tr><td><code>psize</code></td><td><code>page.size</code></td><td><code>ledger</code></td><td><code>letter</code> or <code>ledger</code></td></tr>
<tr><td><code>porient</code></td><td><code>page.orientation</code></td><td><code>landscape</code></td><td><code>portrait</code> or <code>landscape</code></td></tr>
<tr><td><code>pr</code></td><td><code>page.rows</code></td><td><code>2</code></td><td>Number of page rows</td></tr>
<tr><td><code>pc</code></td><td><code>page.columns</code></td><td><code>2</code></td><td>Number of page columns</td></tr>
<tr><td><code>pmargin</code></td><td><code>page.marginInches</code></td><td><code>0.25</code></td><td>Margin per edge in inches</td></tr>
<tr><td><code>poverlap</code></td><td><code>page.overlapInches</code></td><td><code>0.125</code></td><td>Overlap per join in inches</td></tr>
</tbody>
</table>

Quote the URL, join parameters with `&`, and use each alias once. Unknown, repeated, or invalid overrides return HTTP 422. Use `gstyle=rect&giso=true&gangle=60` to switch to ISO, or `giso=false&gangle=null` to switch back.
