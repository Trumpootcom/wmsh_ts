import { overrideReference } from "./templateOverrides";
import defaults from "./default.json";

export const help = `HEADLESS WMS
JPEG, PNG, or static WebP battle map to print-ready PDF

Headless WMS takes a JPEG, PNG, or static WebP and an optional JSON print
template. It centers the map, draws a square, diamond, or hex grid, and
returns a PDF with the exact sheet layout you specify.

QUICK START

To use the built-in 160-foot-wide template, upload just the image:

   curl.exe --fail-with-body -F "image=@map.jpg;type=image/jpeg" -o map.pdf "https://wmsh-ts.trumpoot.workers.dev/render"

The default produces a landscape overview followed by four landscape Ledger sheets with quarter-inch
margins and eighth-inch overlaps. At the requested scale of one inch
per five feet, an 8:5 image prints at 32 by 20 inches. Artwork that would
exceed the printable area shrinks to fit.
The default grid is solid and ${defaults.grid.color}, with a
${defaults.grid.lineWidthPoints}-point stroke and opacity ${defaults.grid.opacity}.

To use your own template:

1. Start with a JPEG, PNG, or static WebP that is already cropped and oriented for printing.
   The service preserves its aspect ratio. For the example below, use
   a landscape image. For PNG or WebP, use your image filename and remove ;type=image/jpeg
   from the curl example.
2. Save the full JSON under EXAMPLE TEMPLATE as template.json in the
   same folder. Include every field. Save as UTF-8 without a BOM.
3. Upload both files from that folder using PowerShell:

   curl.exe --fail-with-body -F "image=@map.jpg;type=image/jpeg" -F "template_file=@template.json;type=application/json" -o map.pdf "https://wmsh-ts.trumpoot.workers.dev/render"

   On macOS or Linux, replace curl.exe with curl. Replace the paths after
   @ as needed. The -F flags send a multipart POST.
4. Open map.pdf. This example produces four landscape Letter sheets.
   Lay out sheets A1 and B1 on top, with A2 and B2 beneath them.
   Print at Actual Size or 100% to preserve the grid dimensions.

EXAMPLE TEMPLATE

{
  "schemaVersion": 1,
  "template": "2 x 2 landscape Letter map",
  "title": "TTRPG Battle Map",
  "overview": false,
  "worldWidthFeet": 65,
  "imagePlacement": "center",
  "grid": {
    "style": "rect",
    "iso": false,
    "isoAngleDegrees": null,
    "rotationDegrees": 0,
    "offsetX": 0,
    "offsetY": 0,
    "inchesPerFiveFeet": 0.75,
    "lineStyle": "solid",
    "color": "black",
    "lineWidthPoints": 0.5,
    "opacity": 0.6,
    "extent": "printableCanvas"
  },
  "page": {
    "size": "letter",
    "orientation": "landscape",
    "rows": 2,
    "columns": 2,
    "marginInches": 0.25,
    "overlapInches": 0.125
  }
}

TEMPLATE FIELDS

  schemaVersion           Use 1.
  template                Any non-empty descriptive template name. Older JSON
                          files and URLs can still use name.
  title                   Optional overview heading. Defaults to TTRPG Battle Map.
  overview                Optional top-level boolean for the guide. The bundled
                          template sets it to true. Custom templates that omit
                          it keep the map sheets only.
  worldWidthFeet          Requested world width in feet before fitting.
  imagePlacement          Use "center" to center the image across all sheets.

  grid.style              "rect" or "hex". Hexes start flat-top.
  grid.iso                true for projection or false for regular cells.
                          Older styles "square" and "iso" still work.
                          An explicit giso override takes precedence.
  grid.isoAngleDegrees    Use null when projection is off. When it is on,
                          use 15 to 90 degrees. For rect this is the angle
                          between grid axes. For hex this is the tilt angle.
  grid.rotationDegrees   Counterclockwise rotation in degrees. Use 0 for
                          a horizontal first axis.
  grid.offsetX            Shift along the grid's X axis in cell units.
  grid.offsetY            Shift along the grid's Y axis in cell units.
                          Both start at 0 (no shift). Use values from -1 to +1
                          to describe a shift of up to one cell either way.
                          Zero offsets put a grid intersection or hex cell
                          center at the image center. With a square grid at zero rotation,
                          positive X shifts right and positive Y shifts down.
                          With an ISO grid, Y follows the slanted grid axis.
                          Offsets repeat every cell. For example, 1.1 has
                          the same effect as 0.1, and -1 and +1 match 0.
  grid.inchesPerFiveFeet  Printed inches per five-foot cell. Use a positive
                          number that gives at least 0.25 PDF points of spacing.
  grid.lineStyle          "solid", "dash-1", "dash-2", "dash-3", "dash-4",
                          "dash-5", "dash-6", "dash-8", "dash-10", "dash-16",
                          "corners", or "none".
                          The number is the dash count per cell edge,
                          counting the two end pieces as one dash. Patterns
                          scale with the cell edge. "dash-1" draws one
                          quarter, skips half, and draws one quarter.
                          "corners" draws one eighth at each end.
  grid.color              "black", "gray", and "white" draw fixed colors.
                          "diff" inverts the artwork along each stroke at
                          full opacity. Mid-gray can remain hard to see.
                          "contrast" pushes the inverted stroke lighter on
                          dark midtones and darker on light midtones. At
                          full opacity it targets a brightness difference
                          of at least 64 on a 0–255 scale. Both modes draw
                          black over blank paper at full opacity.
                          Contrast uses a 144 dpi overlay and requires a
                          working JPEG within decoder memory and 12 MP limits.
  grid.lineWidthPoints    Positive stroke width in PDF points (72 per inch).
  grid.opacity            Number from 0 (transparent) to 1 (opaque).
                          Try ?gcolor=contrast&gopacity=1 for gray artwork.
  grid.extent             Use "printableCanvas" to cover the complete canvas,
                          including areas outside the image.

  page.size               "letter" (8.5 x 11 in) or "ledger" (11 x 17 in).
  page.orientation        "portrait" or "landscape".
  page.rows               Positive integer. Number of sheets from top to bottom.
  page.columns            Positive integer. Number of sheets from left to right.
  page.marginInches       Nonnegative margin on every edge of every sheet.
  page.overlapInches      Nonnegative shared print area between adjacent sheets.
                          Use 0 for sheets that meet edge to edge within their
                          printable areas. The overlap must be smaller than
                          both printable sheet dimensions.

SCALE AND FIT

For hexes, the scale is the smallest perpendicular distance between
opposite sides. At 1 inch per 5 feet, a centered 1-inch round base fits
even with projection enabled. Rotation is applied after projection.
For example, use gstyle=hex&giso=true&gangle=60 for tilted hexes.

Each square represents five world feet. For ISO grids, the print spacing
is measured perpendicular to each family of parallel lines, as in
vtt_slicer. The slanted cell edges lengthen as the angle gets smaller.
To print each square at three
quarters of an inch, set grid.inchesPerFiveFeet to 0.75. Changing this
value scales the image and grid together.

  Requested width  = worldWidthFeet / 5 * grid.inchesPerFiveFeet
  Requested height = requested width * image pixel height / image pixel width

Subtract twice the margin from each sheet dimension to get its printable
width and height. Multiply the printable width by columns and the printable
height by rows, then subtract one overlap for each join along that axis.
The example has a 20.875 x 15.875 inch assembled printable area and
prints a 65-foot-wide map at 9.75 inches wide.

The PDF contains rows times columns map sheets, up to 100, even when
some sheets contain only grid. The column letter and row number in each
corner badge identify the sheet. PDF order runs across each row, then
down to the next row. Adjacent sheets repeat the same artwork
and grid in the overlap. If either dimension exceeds the assembled
printable area, the Worker shrinks the image proportionally and centers
it across the sheets. Grid spacing stays at the requested print scale,
so the fitted image represents fewer world feet. Choose a larger sheet
layout to preserve the requested world dimensions.

HTTP REQUEST AND RESPONSE

  GET /help     This plain-text guide.
  GET /url      Plain-text URL parameter reference with defaults.
  POST /render  Supply one JPEG, PNG, or static WebP using either the
                multipart "image" field or the imageUrl query parameter.
                imageUrl accepts public HTTPS Google Drive direct download
                links and works with an empty POST body. Encode the full
                Drive URL as a single query parameter value. Downloads
                are limited to 20 MiB and 15 seconds.
                In a multipart body, optionally send one JSON file in
                "template_file" or one saved alias in "template_alias".
                To select by ID, use
                ?template_id=0001 in place of either field. With no
                selector, use Default from D1 or the bundled fallback.
  GET /templates  List saved templates by ID, alias, and display name.
  GET /templates/{alias}
                Read a saved template as JSON. Use /templates/default for
                the current Default.
  GET /templates/{alias}/preview.svg
                View a blank-map preview with grid, sheet cuts, and badges.

  Use ?overview=1 to include or ?overview=0 to omit the landscape
  assembly guide on the selected paper size. It shows cut lines,
  overlap, print scale, and render settings.
  The numbered map sheets follow at their regular print scale.

IMAGE NORMALIZATION

  Static PNG and WebP images up to 12 megapixels are converted to a working JPEG.
  The longest edge is capped at 2400 pixels and transparency prints
  as white. JPEG uploads use their original pixels.

TEMPLATE OVERRIDES

  Add query parameters to POST /render to override template values for
  that request. Overrides apply to the default, saved, or uploaded template.
  A custom upload must include every required field, including schemaVersion.
  Use each alias once. Unknown or repeated aliases return 422. Numeric
  values use decimal notation. Use giso=true&gangle=60 to project the grid
  and giso=false&gangle=null to switch back.

${overrideReference}

  Quote the full URL in your shell when combining overrides with &.
  Encode spaces in names as %20. The fit-to-page rule still applies.

  curl.exe --fail-with-body -F "image=@map.jpg" -F "template_file=@template.json" -o map.pdf "https://wmsh-ts.trumpoot.workers.dev/render?overview=1&title=Goblin%20Ambush&wid=160&gstyle=rect&giso=true&gangle=60&gline=dash-8&pr=2&pc=2&psize=ledger&porient=landscape"

STATUS CODES

  200  A PDF attachment (application/pdf). The server suggests a UTC
       timestamp filename. The example curl command saves it as map.pdf.
  400  Missing, duplicate, or conflicting image sources, invalid imageUrl,
       unreadable multipart data, or invalid JSON.
  413  Google Drive image exceeds 20 MiB.
  415  A request body must use multipart/form-data.
  422  Invalid template field, unreadable image, or invalid fitted scale.
       Google Drive did not return a public image download.
  502  Google Drive download failed.
  504  Google Drive download timed out.

Errors from the Worker are JSON with an "error" message. With
--fail-with-body and -o map.pdf, curl exits with an error and may save
that JSON in map.pdf. In PowerShell, read it with Get-Content .\\map.pdf.

To help someone prepare a request, ask for their image or its path, its
world width in feet, the desired printed inches per five feet, and the
paper layout. Use the template above to prepare a complete JSON file.
If you cannot access the user's local image, give them the JSON and upload
command to run on their own machine.

GOOGLE DRIVE WORKFLOW

  Upload the approved map to a Google Drive folder shared as Anyone
  with the link → Viewer. Replace FILE_ID with the image file ID.
  Use an HTTP tool to send this POST with an empty body:

  POST https://wmsh-ts.trumpoot.workers.dev/render?template_id=0001&wid=160&imageUrl=https%3A%2F%2Fdrive.google.com%2Fuc%3Fexport%3Ddownload%26id%3DFILE_ID

  On success, save the PDF response to the same Drive folder using the
  requested filename and share links to the image and PDF.
`;
