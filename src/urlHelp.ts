import defaults from "./default.json";
import { aliases } from "./templateOverrides";

const descriptions: Record<keyof typeof aliases, string> = {
  wid: "World width in feet",
  name: "Template name",
  place: "center",
  gstyle: "square or iso",
  gangle: "15 to 90 for ISO, null for square",
  grot: "Counterclockwise rotation in degrees",
  gx: "X offset in cell units, from -1.0 to 1.0 (wraps every cell)",
  gy: "Y offset in cell units, from -1.0 to 1.0 (wraps every cell)",
  gscale: "Printed inches per five world feet",
  gline: "solid, dash-1, dash-2, dash-3, dash-4, dash-5, dash-6,\n" +
    "dash-8, dash-10, dash-16, corners, or none",
  gcolor: "black, gray, white, diff (inversion), or contrast (adaptive inversion)",
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

function row(alias: string, field: string, value: string, description: string): string {
  const prefix = alias.padEnd(11) + field.padEnd(24) + value.padEnd(19);
  return prefix + description.replaceAll("\n", "\n" + " ".repeat(prefix.length));
}

const table = Object.entries(aliases).map(([alias, [field]]) => {
  const value = field.split(".").reduce<unknown>(
    (parent, key) => (parent as Record<string, unknown>)[key], defaults,
  );
  return row(alias, field, alias === "name" ? "name" : String(value), descriptions[alias as keyof typeof aliases]);
}).join("\n");

export const urlHelp = `HEADLESS WMS URL PARAMETERS

Upload a JPEG, PNG, or static WebP. This PowerShell command uses the
built-in template and overrides the world width to 120 feet.

  curl.exe --fail-with-body -F "image=@map.png" -o map-120ft.pdf "https://wmsh-ts.trumpoot.workers.dev/render?wid=120"

Use curl on macOS or Linux. Replace map.png with your image path.
Add -F "template_file=@template.json" to use a complete custom template.
Overrides apply to either template for the current request.

${row("Parameter", "JSON field", "Default", "Description or allowed values")}
${table}

Quote the full URL and join multiple parameters with &. Use each alias
once. Unknown, repeated, or invalid overrides return HTTP 422.
Use gstyle=iso&gangle=60 to switch to ISO and
gstyle=square&gangle=null to switch back.

Full guide
https://wmsh-ts.trumpoot.workers.dev/help
`;
