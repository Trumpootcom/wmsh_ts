import defaults from "./default.json";
import { aliases } from "./templateOverrides";

const descriptions: Record<keyof typeof aliases, string> = {
  wid: "World width in feet",
  template: "Template name (legacy alias: name)",
  title: "Overview title",
  overview: "Global toggle: 1 to include, 0 to omit",
  place: "center",
  gstyle: "rect or hex; legacy aliases: square and iso",
  giso: "true for projection, false for regular cells",
  gangle: "15 to 90 if giso=true, null if giso=false",
  grot: "Counterclockwise rotation in degrees",
  gx: "X offset in cell units, from -1.0 to 1.0",
  gy: "Y offset in cell units, from -1.0 to 1.0",
  gscale: "Inches per 5 ft; minimum hex flat-to-flat",
  gline: "solid, dash-1, dash-2, dash-3, dash-4, dash-5, dash-6, " +
    "dash-8, dash-10, dash-16, corners, or none",
  gcolor: "black, gray, white, diff, or contrast",
  gpt: "Stroke width in PDF points",
  gopacity: "0 (transparent) to 1 (opaque)",
  gextent: "printableCanvas",
  psize: "letter or ledger",
  porient: "portrait or landscape",
  pr: "Number of page rows",
  pc: "Number of page columns",
  pmargin: "Margin per edge in inches",
  poverlap: "Overlap per join in inches",
};

const columnWidths = [11, 23, 18, 49];

function border(left: string, join: string, right: string): string {
  return left + columnWidths.map((width) => "─".repeat(width + 2)).join(join) + right;
}

function row(alias: string, field: string, value: string, description: string): string {
  const lines = description.split("\n").flatMap((paragraph) => {
    const wrapped: string[] = [];
    let line = "";
    for (const word of paragraph.split(" ")) {
      if (line && line.length + 1 + word.length > columnWidths[3]) {
        wrapped.push(line);
        line = word;
      } else {
        line = line ? line + " " + word : word;
      }
    }
    return [...wrapped, line];
  });
  return lines.map((line, index) => {
    const cells = index === 0 ? [alias, field, value, line] : ["", "", "", line];
    return "│ " + cells.map((cell, column) => cell.padEnd(columnWidths[column])).join(" │ ") + " │";
  }).join("\n");
}

const rows = { Global: [] as string[], Grid: [] as string[], Page: [] as string[] };
rows.Global.push(row("template_id", "-", "0001", "Select a saved D1 template by numeric ID"));
for (const [alias, [field]] of Object.entries(aliases)) {
  const value = field.split(".").reduce<unknown>(
    (parent, key) => (parent as Record<string, unknown>)[key], defaults,
  );
  const group = field.startsWith("grid.") ? "Grid" : field.startsWith("page.") ? "Page" : "Global";
  rows[group].push(row(alias, field, alias === "template" ? "template" : String(value), descriptions[alias as keyof typeof aliases]));
}
const divider = border("├", "┼", "┤");
const table = [
  border("┌", "┬", "┐"),
  row("Parameter", "JSON field", "Default", "Description or allowed values"),
  divider,
  Object.values(rows).map((lines) => lines.join("\n")).join("\n" + divider + "\n"),
  border("└", "┴", "┘"),
].join("\n");

export const urlHelp = `HEADLESS WMS URL PARAMETERS

Upload a JPEG, PNG, or static WebP. This PowerShell command uses the
built-in template, overrides the world width to 120 feet, and adds a
titled overview page.

  curl.exe --fail-with-body -F "image=@map.png" -o map-120ft.pdf "https://wmsh-ts.trumpoot.workers.dev/render?wid=120&overview=1&title=Goblin%20Ambush"

Use curl on macOS or Linux. Replace map.png with your image path.
Add -F "template_file=@template.json" to use a complete custom template.
Use ?template_id=0001 to select a saved template by ID. Old commands
can still use -F "template_alias=default". With no template selector,
the Worker loads Default from D1 or the bundled fallback.
Overrides apply to the selected template for this request.

For a public Google Drive image, send POST with an empty body and pass
the URL-encoded direct download link as imageUrl. For example:

  POST /render?template_id=0001&wid=160&imageUrl=https%3A%2F%2Fdrive.google.com%2Fuc%3Fexport%3Ddownload%26id%3DFILE_ID

Use imageUrl or a multipart image field. Drive downloads are limited
to 20 MiB and 15 seconds.

${table}

Quote the full URL and join multiple parameters with &. Use each alias
once. Unknown, repeated, or invalid overrides return HTTP 422.
Use gstyle=rect&giso=true&gangle=60 to switch to ISO and
giso=false&gangle=null to switch back.

Full guide
https://wmsh-ts.trumpoot.workers.dev/help
`;
