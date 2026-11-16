CREATE TABLE templates_with_ids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alias TEXT NOT NULL UNIQUE,
    template_json TEXT NOT NULL CHECK (json_valid(template_json)),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO templates_with_ids (id, alias, template_json, updated_at)
SELECT 1, alias, template_json, updated_at
FROM templates WHERE alias = 'default';

INSERT INTO templates_with_ids (id, alias, template_json, updated_at)
SELECT 1 + ROW_NUMBER() OVER (ORDER BY updated_at, alias), alias, template_json, updated_at
FROM templates WHERE alias <> 'default';

DROP TABLE templates;
ALTER TABLE templates_with_ids RENAME TO templates;

