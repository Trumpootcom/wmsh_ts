# Execution & Token-Saving Rules

## Terminal & Testing Limits
- NEVER run `flutter test`, `npm test`, integration tests, smoke tests, or `wrangler deploy` unless I explicitly ask for them in the current prompt.
- Do NOT start local dev servers (`flutter run` or `wrangler dev`) unless requested.
- To verify changes without running full builds:
  - For TypeScript (`.ts`): rely on VS Code diagnostics, or run `npx tsc --noEmit` only when checking cross-file type changes.
  - For Dart/Flutter (`.dart`): run `dart analyze` (or `flutter analyze --no-pub`).
- If a command fails twice, stop and explain the error instead of retrying in a loop.

## Code & Context Discipline
- Start with the currently open or mentioned files; only search other files in the workspace when needed to check imported types, schemas, or bindings.
- Never scan `node_modules`, `.dart_tool`, or build output folders.
- Keep responses concise: skip line-by-line recaps of edits, and only mention edge cases, assumptions, or manual steps I need to run.

## Deployment & Git Workflow
- This repo auto-deploys to Cloudflare Workers/Pages via GitHub pushes; NEVER run `wrangler deploy` or manual build scripts unless explicitly asked.
- Do not run `git push` without asking first.
