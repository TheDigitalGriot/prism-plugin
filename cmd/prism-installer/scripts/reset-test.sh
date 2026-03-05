#!/usr/bin/env bash
# Reset local Prism installation for testing the installer.
# Removes global install artifacts while leaving project-level .prism/ dirs untouched.
set -euo pipefail

echo "=== Prism Installer Test Reset ==="

# 1. Remove global ~/.prism/
if [ -d "$HOME/.prism" ]; then
  rm -rf "$HOME/.prism"
  echo "  Removed ~/.prism/"
else
  echo "  ~/.prism/ not found (skip)"
fi

# 2. Remove %LOCALAPPDATA%\Prism (Windows install dir)
if [ -n "${LOCALAPPDATA:-}" ] && [ -d "$LOCALAPPDATA/Prism" ]; then
  rm -rf "$LOCALAPPDATA/Prism"
  echo "  Removed $LOCALAPPDATA/Prism/"
else
  echo "  %LOCALAPPDATA%\\Prism not found (skip)"
fi

# 3. Remove Prism commands from ~/.claude/commands/
PRISM_COMMANDS=(
  cli-install cli-uninstall commit create_handoff create_plan
  decompose_plan describe_pr generate_prd generate_pricing
  generate_tech_spec generate_user_flows implement_plan iterate_plan
  prism-browse prism-debug prism-screenshot prism-verify
  prism_cli prism_dir_update research_codebase resume_handoff
  retroactive review-setup validate_plan worktree
)
removed=0
for cmd in "${PRISM_COMMANDS[@]}"; do
  f="$HOME/.claude/commands/${cmd}.md"
  if [ -f "$f" ]; then rm -f "$f"; removed=$((removed + 1)); fi
done
echo "  Removed $removed Prism command(s) from ~/.claude/commands/"

# 4. Remove Prism agents from ~/.claude/agents/
PRISM_AGENTS=(
  browser-verifier codebase-analyzer codebase-locator
  codebase-pattern-finder git-investigator log-investigator
  prism-analyzer prism-locator state-investigator web-search-researcher
)
removed=0
for agent in "${PRISM_AGENTS[@]}"; do
  f="$HOME/.claude/agents/${agent}.md"
  if [ -f "$f" ]; then rm -f "$f"; removed=$((removed + 1)); fi
done
echo "  Removed $removed Prism agent(s) from ~/.claude/agents/"

# 5. Remove Prism skills from ~/.claude/skills/ (non-Prism skills left intact)
PRISM_SKILLS=(
  prism prism-debug prism-docs-update prism-implement prism-iterate
  prism-plan prism-prd prism-release prism-research prism-spectrum
  prism-validate prism-verify prism-visual-docs
)
removed=0
for skill in "${PRISM_SKILLS[@]}"; do
  d="$HOME/.claude/skills/${skill}"
  if [ -d "$d" ]; then rm -rf "$d"; removed=$((removed + 1)); fi
done
echo "  Removed $removed Prism skill(s) from ~/.claude/skills/"

# 6. Remove Windows registry keys (best-effort)
if command -v reg.exe &>/dev/null; then
  reg.exe delete "HKCU\\Software\\Prism" /f 2>/dev/null && echo "  Removed HKCU\\Software\\Prism" || true
  reg.exe delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Prism" /f 2>/dev/null && echo "  Removed Add/Remove Programs entry" || true
fi

# 7. Remove PATH entry (informational — needs manual or reg edit)
if [ -n "${LOCALAPPDATA:-}" ]; then
  echo ""
  echo "  Note: PATH entry for $LOCALAPPDATA\\Prism\\bin may still exist."
  echo "  The installer will re-add it on next run, so this is harmless."
fi

echo ""
echo "Done. Ready for a fresh installer test."
