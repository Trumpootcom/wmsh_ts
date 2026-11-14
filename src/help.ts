export const help = `HEADLESS WMS
JPG battle map to print-ready PDF

Headless WMS takes a JPG and a JSON print template. It centers the map
at the requested print scale, draws a square or isometric grid, and returns a PDF
with the exact sheet layout you specify.

QUICK START

1. Start with a JPG that is already cropped and oriented for printing.
   The service preserves its aspect ratio. For the example below, use
   a landscape JPG and place it in the current folder as map.jpg.
2. Save the full JSON under EXAMPLE TEMPLATE as template.json in the
   same folder. Include every field. Save as UTF-8 without a BOM.
3. Upload both files from that folder using PowerShell:

   curl.exe --fail-with-body -F "image=@map.jpg;type=image/jpeg" -F "template_file=@template.json;type=application/json" -o map.pdf "https://wmsh-ts.trumpoot.workers.dev/render"

   On macOS or Linux, replace curl.exe with curl. Replace the paths after
   @ as needed. The -F flags send a multipart POST.
4. Open map.pdf. This example produces four landscape Letter sheets.
   Lay out pages 1 and 2 on top, with pages 3 and 4 beneath them.
   Print at Actual Size or 100% to preserve the grid dimensions.

EXAMPLE TEMPLATE

{
  "schemaVersion": 1,
  "name": "2 x 2 landscape Letter map",
  "worldWidthFeet": 65,
  "imagePlacement": "center",
  "grid": {
    "style": "square",
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
  name                    Any non-empty descriptive string.
  worldWidthFeet          Positive number of world feet across the JPG.
  imagePlacement          Use "center" to center the image across all sheets.

  grid.style              "square" or "iso".
  grid.isoAngleDegrees    Use null for squares. For "iso", use the angle
                          between the grid axes in degrees, from 15 to 90.
  grid.rotationDegrees   Counterclockwise rotation in degrees. Use 0 for
                          a horizontal first axis.
  grid.offsetX            Shift along the grid's X axis in cell units.
  grid.offsetY            Shift along the grid's Y axis in cell units.
                          Both start at 0 (no shift). Use values from -1 to +1
                          to describe a shift of up to one cell either way.
                          Zero offsets put a grid intersection at the JPG
                          center. With a square grid at zero rotation,
                          positive X shifts right and positive Y shifts down.
                          With an ISO grid, Y follows the slanted grid axis.
                          Offsets repeat every cell. For example, 1.1 has
                          the same effect as 0.1, and -1 and +1 match 0.
  grid.inchesPerFiveFeet  Printed inches per five-foot cell. Use a positive
                          number that gives at least 0.25 PDF points of spacing.
  grid.lineStyle          "solid" (alias "line"), "dash32", "dash16",
                          "dash12", "dash8" (alias "dash"), "dash4",
                          "corners" (alias "corner"), or "none".
                          These patterns scale with the cell edge. "dash32"
                          draws one quarter, skips half, and draws one quarter.
                          "corners" draws one eighth at each end.
                          "dash1", "dash2", and "dash3" use legacy PDF-point lengths.
  grid.color              "black", "gray", or "white".
  grid.lineWidthPoints    Positive stroke width in PDF points (72 per inch).
  grid.opacity            Number from 0 (transparent) to 1 (opaque).
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

Each square represents five world feet. For ISO grids, the print spacing
is measured perpendicular to each family of parallel lines, as in
vtt_slicer. The slanted cell edges lengthen as the angle gets smaller.
To print each square at three
quarters of an inch, set grid.inchesPerFiveFeet to 0.75. Changing this
value scales the JPG and grid together.

  Requested width  = worldWidthFeet / 5 * grid.inchesPerFiveFeet
  Requested height = requested width * JPG pixel height / JPG pixel width

Subtract twice the margin from each sheet dimension to get its printable
width and height. Multiply the printable width by columns and the printable
height by rows, then subtract one overlap for each join along that axis.
The example has a 20.875 x 15.875 inch assembled printable area and
prints a 65-foot-wide map at 9.75 inches wide.

The PDF always contains rows times columns sheets, up to 100, even when
some sheets contain only grid. Adjacent sheets repeat the same artwork
and grid in the overlap. If either dimension exceeds the assembled
printable area, the Worker shrinks the image and grid proportionally
until both dimensions fit, then centers the map across the sheets.
Choose a larger sheet layout to preserve the requested physical scale
when the map would otherwise shrink.

HTTP REQUEST AND RESPONSE

  GET /help     This plain-text guide.
  POST /render  Send multipart/form-data with one JPG file in "image"
                and one JSON file in "template_file".

  200  A PDF attachment (application/pdf). The server suggests a UTC
       timestamp filename. The example curl command saves it as map.pdf.
  400  Upload missing or duplicated, multipart data unreadable, or invalid JSON.
  415  Request must use multipart/form-data.
  422  Invalid template field, unreadable JPG, or invalid fitted scale.

Errors from the Worker are JSON with an "error" message. With
--fail-with-body and -o map.pdf, curl exits with an error and may save
that JSON in map.pdf. In PowerShell, read it with Get-Content .\\map.pdf.

To help someone prepare a request, ask for their JPG or its path, its
world width in feet, the desired printed inches per five feet, and the
paper layout. Use the template above to prepare a complete JSON file.
If you cannot access the user's local JPG, give them the JSON and upload
command to run on their own machine.
`;
