import defaults from "./default.json";
import { readTemplate } from "./template";
import { sheetLayout } from "./sheetLayout";
import { applyOverrides } from "./templateOverrides";

export const defaultAlias = "default";

export class TemplateLookupError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function describeTemplate(alias: string, id: string, value: unknown) {
  const settings = readTemplate(value);
  const { canvasWidth, canvasHeight } = sheetLayout(settings);
  const dimensions = (pointsPerUnit: number) =>
    `${(canvasWidth / pointsPerUnit).toFixed(1)} x ${(canvasHeight / pointsPerUnit).toFixed(1)}`;
  const name = settings.template;
  return { alias, id, name, dimensions: `${dimensions(settings.spacing / 5)} feet - ${dimensions(72)} in` };
}

export async function listSavedTemplates(database?: D1Database) {
  const fallback = describeTemplate(defaultAlias, "0001", defaults);
  if (!database) return [fallback];
  try {
    const { results } = await database.prepare(
      "SELECT id, alias, template_json FROM templates ORDER BY id",
    ).all<{ id: number; alias: string; template_json: string }>();
    const templates = results.map(({ id: numericId, alias, template_json }) => {
      const id = String(numericId).padStart(4, "0");
      try {
        return describeTemplate(alias, id, JSON.parse(template_json));
      } catch {
        return { alias, id, name: alias };
      }
    });
    return templates.some(({ alias }) => alias === defaultAlias) ? templates : [fallback, ...templates];
  } catch {
    throw new TemplateLookupError("The saved template library is temporarily unavailable.", 503);
  }
}

export async function loadSavedTemplate(database: D1Database | undefined, name: string, byId = false): Promise<unknown> {
  const alias = name.trim().toLowerCase();
  const id = Number(name);
  if (byId && (!/^\d+$/.test(name) || !Number.isSafeInteger(id) || id < 1)) {
    throw new TemplateLookupError("Use a positive template ID, such as 0001.", 400);
  }
  if (!byId && !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(alias)) {
    throw new TemplateLookupError("Use a template alias of 1–64 letters, digits, hyphens, or underscores, starting with a letter or digit.", 400);
  }

  let stored: string | null | undefined;
  try {
    stored = await database?.prepare(byId ? "SELECT template_json FROM templates WHERE id = ?"
      : "SELECT template_json FROM templates WHERE alias = ?")
      .bind(byId ? id : alias).first<string>("template_json");
  } catch {
    throw new TemplateLookupError("The saved template library is temporarily unavailable.", 503);
  }
  if (stored == null) {
    if (byId ? id === 1 : alias === defaultAlias) return defaults;
    throw new TemplateLookupError(`Template "${name}" was not found.`, 404);
  }

  let json: unknown;
  try {
    json = JSON.parse(stored);
    readTemplate(json);
  } catch {
    throw new TemplateLookupError(`Saved template "${name}" is invalid.`, 500);
  }
  return json;
}

export async function editSavedTemplates(
  request: Request, database: D1Database | undefined, secret: string | undefined,
) {
  if (!database || !secret) throw new TemplateLookupError("Template editing is not configured.", 503);
  const body = await request.json<Record<string, unknown>>().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.password !== "string") {
    throw new TemplateLookupError("A password and template action are required.", 400);
  }
  const encoder = new TextEncoder();
  const [supplied, expected] = await Promise.all([body.password, secret]
    .map((value) => crypto.subtle.digest("SHA-256", encoder.encode(value))));
  const suppliedBytes = new Uint8Array(supplied);
  const expectedBytes = new Uint8Array(expected);
  let difference = 0;
  for (let i = 0; i < suppliedBytes.length; i++) difference |= suppliedBytes[i] ^ expectedBytes[i];
  if (difference !== 0) throw new TemplateLookupError("Incorrect template password.", 403);

  const { action } = body;
  if (action !== "create" && action !== "overwrite" && action !== "delete" && action !== "rename") {
    throw new TemplateLookupError("Unknown template action.", 400);
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if ((action === "create" || action === "rename") && (!name || name.length > 128)) {
    throw new TemplateLookupError("Use a template name of 1–128 characters.", 400);
  }
  const alias = action === "create"
    ? name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : body.alias;
  if (typeof alias !== "string" || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(alias)) {
    throw new TemplateLookupError("Use a template name that produces a valid alias of 1–64 characters.", 400);
  }
  if (alias === defaultAlias && action !== "overwrite") {
    throw new TemplateLookupError("Default is reserved and can only be overwritten.", 409);
  }

  if (action === "delete") {
    const { meta } = await database.prepare("DELETE FROM templates WHERE alias = ?").bind(alias).run();
    if (!meta.changes) throw new TemplateLookupError("The selected template no longer exists.", 404);
    return { alias };
  }

  if (action === "rename") {
    const { meta } = await database.prepare(
      "UPDATE templates SET template_json = json_set(template_json, '$.template', ?), updated_at = CURRENT_TIMESTAMP WHERE alias = ?",
    ).bind(name, alias).run();
    if (!meta.changes) throw new TemplateLookupError("The template no longer exists.", 404);
    return { alias, name };
  }

  const settings = body.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings) ||
      !Object.values(settings).every((value) => typeof value === "string")) {
    throw new TemplateLookupError("Provide the current form settings.", 400);
  }
  const params = new URLSearchParams(settings as Record<string, string>);
  const templateName = action === "create" ? name
    : readTemplate(await loadSavedTemplate(database, alias)).template;
  params.delete("template");
  params.delete("name");
  let json: string;
  try {
    const { template, grid, page } = applyOverrides(defaults, defaults.grid, defaults.page, params);
    const value = { ...template, template: templateName, grid, page };
    readTemplate(value);
    json = JSON.stringify(value);
  } catch (failure) {
    throw new TemplateLookupError(failure instanceof Error ? failure.message : "Invalid template settings.", 422);
  }

  if (action === "create") {
    const { meta } = await database.prepare(
      "INSERT INTO templates (alias, template_json) VALUES (?, ?) ON CONFLICT(alias) DO NOTHING",
    ).bind(alias, json).run();
    if (!meta.changes) throw new TemplateLookupError("That template name already exists. Select it to overwrite.", 409);
  } else if (alias === defaultAlias) {
    await database.prepare(
      "INSERT INTO templates (id, alias, template_json) VALUES (1, ?, ?) ON CONFLICT(alias) DO UPDATE SET template_json = excluded.template_json, updated_at = CURRENT_TIMESTAMP",
    ).bind(alias, json).run();
  } else {
    const { meta } = await database.prepare(
      "UPDATE templates SET template_json = ?, updated_at = CURRENT_TIMESTAMP WHERE alias = ?",
    ).bind(json, alias).run();
    if (!meta.changes) throw new TemplateLookupError("The selected template no longer exists.", 404);
  }
  return { alias, name: templateName };
}
