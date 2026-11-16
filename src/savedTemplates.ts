import defaults from "./default.json";
import { readTemplate } from "./template";

export const defaultAlias = "default";

export class TemplateLookupError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
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
