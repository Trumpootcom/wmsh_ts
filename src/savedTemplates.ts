import defaults from "./default.json";
import { readTemplate } from "./template";
import { sheetLayout } from "./sheetLayout";

export const defaultAlias = "default";

export class TemplateLookupError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function describeTemplate(alias: string, value: unknown) {
  const settings = readTemplate(value);
  const { canvasWidth, canvasHeight } = sheetLayout(settings);
  const dimensions = (pointsPerUnit: number) =>
    `${(canvasWidth / pointsPerUnit).toFixed(1)} x ${(canvasHeight / pointsPerUnit).toFixed(1)}`;
  const name = settings.template;
  return { alias, name, dimensions: `${dimensions(settings.spacing / 5)} feet - ${dimensions(72)} in` };
}

export async function listSavedTemplates(database?: D1Database) {
  const fallback = describeTemplate(defaultAlias, defaults);
  if (!database) return [fallback];
  try {
    const { results } = await database.prepare(
      "SELECT alias, template_json FROM templates ORDER BY alias <> 'default', alias",
    ).all<{ alias: string; template_json: string }>();
    const templates = results.map(({ alias, template_json }) => {
      try {
        return describeTemplate(alias, JSON.parse(template_json));
      } catch {
        return { alias, name: alias };
      }
    });
    return templates.some(({ alias }) => alias === defaultAlias) ? templates : [fallback, ...templates];
  } catch {
    throw new TemplateLookupError("The saved template library is temporarily unavailable.", 503);
  }
}

export async function loadSavedTemplate(database: D1Database | undefined, name: string): Promise<unknown> {
  const alias = name.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(alias)) {
    throw new TemplateLookupError("Use a template alias of 1–64 letters, digits, hyphens, or underscores, starting with a letter or digit.", 400);
  }

  let stored: string | null | undefined;
  try {
    stored = await database?.prepare("SELECT template_json FROM templates WHERE alias = ?")
      .bind(alias).first<string>("template_json");
  } catch {
    throw new TemplateLookupError("The saved template library is temporarily unavailable.", 503);
  }
  if (stored == null) {
    if (alias === defaultAlias) return defaults;
    throw new TemplateLookupError(`Template "${alias}" was not found.`, 404);
  }

  let json: unknown;
  try {
    json = JSON.parse(stored);
    readTemplate(json);
  } catch {
    throw new TemplateLookupError(`Saved template "${alias}" is invalid.`, 500);
  }
  return json;
}
