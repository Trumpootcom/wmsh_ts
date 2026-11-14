export const aliases = {
  wid: ["worldWidthFeet", "decimal"],
  name: ["name", "text"],
  title: ["title", "text"],
  overview: ["overview", "boolean"],
  place: ["imagePlacement", "text"],
  gstyle: ["grid.style", "text"],
  giso: ["grid.iso", "trueFalse"],
  gangle: ["grid.isoAngleDegrees", "nullableDecimal"],
  grot: ["grid.rotationDegrees", "decimal"],
  gx: ["grid.offsetX", "decimal"],
  gy: ["grid.offsetY", "decimal"],
  gscale: ["grid.inchesPerFiveFeet", "decimal"],
  gline: ["grid.lineStyle", "text"],
  gcolor: ["grid.color", "text"],
  gpt: ["grid.lineWidthPoints", "decimal"],
  gopacity: ["grid.opacity", "decimal"],
  gextent: ["grid.extent", "text"],
  psize: ["page.size", "text"],
  porient: ["page.orientation", "text"],
  pr: ["page.rows", "decimal"],
  pc: ["page.columns", "decimal"],
  pmargin: ["page.marginInches", "decimal"],
  poverlap: ["page.overlapInches", "decimal"],
} as const;

export const overrideReference = Object.entries(aliases)
  .map(([alias, [field]]) => `  ${alias.padEnd(10)} ${field}`)
  .join("\n");

export function applyOverrides(
  template: Record<string, unknown>,
  grid: Record<string, unknown>,
  page: Record<string, unknown>,
  params: URLSearchParams,
) {
  const merged = { template: { ...template }, grid: { ...grid }, page: { ...page } };
  const seen = new Set<string>();
  params.forEach((raw, alias) => {
    if (!Object.hasOwn(aliases, alias)) throw new Error(`Unknown template override: ${alias}.`);
    if (seen.has(alias)) throw new Error(`Specify ${alias} only once.`);
    seen.add(alias);

    const [path, kind] = aliases[alias as keyof typeof aliases];
    const parts = path.split(".");
    const target = parts.length === 1 ? merged.template : merged[parts[0] as "grid" | "page"];
    const field = parts[parts.length - 1];
    if (!Object.hasOwn(target, field)) throw new Error(`The template must include ${path}.`);

    if (kind === "text") {
      target[field] = raw;
    } else if (kind === "trueFalse") {
      if (raw !== "true" && raw !== "false") throw new Error(`${alias} must be true or false.`);
      target[field] = raw === "true";
    } else if (kind === "boolean") {
      if (raw !== "0" && raw !== "1") throw new Error(`${alias} must be 0 or 1.`);
      target[field] = raw === "1";
    } else if (kind === "nullableDecimal" && raw === "null") {
      target[field] = null;
    } else {
      const value = Number(raw);
      if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw) || !Number.isFinite(value)) {
        throw new Error(`${alias} must be a finite decimal number${kind === "nullableDecimal" ? " or null" : ""}.`);
      }
      target[field] = value;
    }
  });
  return merged;
}
