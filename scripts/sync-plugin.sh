#!/usr/bin/env bash
# Sync built plugin to Cursor's local plugin directory
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/.cursor/plugins/local/raidu-firewall"

echo "Building..."
cd "$SRC" && node esbuild.mjs
cd "$SRC/webview" && npm run build --silent

echo "Syncing to $DEST..."
rm -rf "$DEST"
mkdir -p "$DEST"/{.cursor-plugin,hooks/dist,dist,webview/dist,media,rules,skills/governance-scan,commands}

cp "$SRC/.cursor-plugin/plugin.json" "$DEST/.cursor-plugin/"
# Plugin-level hooks: tool-use events only (preToolUse, beforeReadFile, etc.)
# User-level hooks (beforeSubmitPrompt, etc.) managed by hooks-installer.ts
cp "$SRC/hooks/hooks-plugin.json" "$DEST/hooks/hooks.json"
cp "$SRC/hooks/dist/index.js" "$DEST/hooks/dist/"
cp "$SRC/dist/extension.js" "$DEST/dist/"
cp "$SRC/webview/dist/index.html" "$DEST/webview/dist/"
cp "$SRC/media/"* "$DEST/media/"
cp "$SRC/rules/"*.mdc "$DEST/rules/"
cp "$SRC/skills/governance-scan/SKILL.md" "$DEST/skills/governance-scan/"
cp "$SRC/commands/raidu-status.md" "$DEST/commands/"
cp "$SRC/package.json" "$DEST/"

echo "Done. Restart Cursor to activate."
