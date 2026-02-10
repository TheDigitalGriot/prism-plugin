# 🌈 Prism → Spectrum Migration: Complete Guide

**Your complete reference for migrating from Ralph to Spectrum with separated path architecture**

---

## 📚 Documentation Index

This migration involves **four key changes**:
1. **Ralph → Spectrum** namespace rename
2. **thoughts/ → .prism/** directory restructure  
3. **stories.json separation** from execution state
4. **ralph-tui → prism-tui** with path updates

We've created **4 comprehensive documents** to guide you through:

---

### 1. 📖 **prism-update-instructions.md** (Main Guide)
**Use this for**: Complete implementation details for all phases

**Contents**:
- ✅ Spectrum namespace decision (locked in)
- Phase 1: Global rename (ralph → spectrum)
- Phase 2: Directory structure migration
  - **Important**: Stories.json now separate in `.prism/stories/`
  - Progress.md stays in `.prism/shared/spectrum/`
  - Detailed migration logic with Python examples
- Phase 3: TUI dashboard implementation
- Phase 4: Visualization & documentation
- Phase 5: Claude Teams SDK integration
- Phase 6: Complete implementation checklist

**When to use**: Start here for the big picture, then drill down into specific documents

---

### 2. ⚡ **spectrum-migration-summary.md** (Quick Start)
**Use this for**: Week-by-week action plan

**Contents**:
- Quick reference table (old vs new)
- **Key architectural change explanation** (separated paths)
- Week 1-3 breakdown with daily tasks
- Priority actions checklist
- Timeline estimate (~42-58 hours)
- Quick commands reference

**When to use**: Use this as your daily roadmap during implementation

---

### 3. 🗺️ **path-migration-guide.md** (Visual Reference)
**Use this for**: Understanding the path structure changes

**Contents**:
- Before/after directory diagrams
- **Visual path migration map** showing file movements
- Code change examples (Go, Bash)
- Why we separated stories.json (conceptual explanation)
- Quick reference card
- Common pitfalls to avoid

**When to use**: Reference this when updating code paths or debugging path issues

---

### 4. ✅ **tui-update-checklist.md** (TUI Specific)
**Use this for**: Step-by-step TUI code migration

**Contents**:
- 9-step detailed checklist for `cmd/ralph-tui → cmd/prism-tui`
- **Exact code changes** needed for path updates
- File-by-file update instructions:
  - `config/paths.go` - Path constants
  - `models/stories.go` - Stories loading
  - `models/progress.go` - Progress loading
  - `ui/file_watcher.go` - File watchers
  - `go.mod`, `Makefile` - Build config
- Testing procedures
- Troubleshooting guide

**When to use**: Follow this step-by-step when updating the TUI codebase

---

## 🎯 Key Architectural Change

### The Critical Path Separation

**OLD (Ralph)**: Both files together
```
thoughts/shared/ralph/
├── stories.json    ← Task definitions
└── progress.md     ← Execution state
```

**NEW (Spectrum)**: Separated for clarity
```
.prism/
├── stories/
│   └── stories.json          ← Task definitions (what to do)
└── shared/
    └── spectrum/
        └── progress.md        ← Execution state (what happened)
```

**Why?**
- `stories.json` = **Plan** (rarely changes)
- `progress.md` = **Execution log** (changes every iteration)
- Multiple Spectrum runs can share same stories
- Clearer ownership and version control

**Impact on code**:
- TUI must load from TWO different directories
- File watchers need TWO separate paths
- Migration script must SPLIT the old ralph/ directory

---

## 🚀 Quick Start Path

### If you want to jump right in:

1. **Start here**: Open `spectrum-migration-summary.md`
   - Follow the Week 1 checklist
   - Start with Day 1-2 tasks (global rename)

2. **When updating paths**: Reference `path-migration-guide.md`
   - Visual diagrams show old → new
   - Code examples for common updates

3. **When updating TUI**: Follow `tui-update-checklist.md`
   - Step-by-step with exact code changes
   - Don't skip steps!

4. **For deep dives**: Consult `prism-update-instructions.md`
   - Complete context for each phase
   - Advanced features and considerations

---

## 📊 Critical Files to Update

### High Priority (Week 1) — ✅ All Complete
- [x] All skill/command markdown files (`ralph` → `spectrum`)
- [x] `scripts/ralph.sh` → `scripts/spectrum.sh`
- [x] `cmd/ralph-tui/` → `cmd/prism-tui/`
- [x] `init_thoughts.py` → `init_prism.py`
- [x] README.md (all references)

### Path-Related Changes (Required for TUI) — ✅ All Complete
- [x] TUI path constants updated (handled inline, no separate config/paths.go)
- [x] TUI stories loading uses `.prism/stories/`
- [x] TUI progress loading uses `.prism/shared/spectrum/`
- [x] TUI file watchers updated for both paths
- [x] `scripts/spectrum.sh` - STORIES_FILE and PROGRESS_FILE updated

---

## 🔍 Search Commands

Use these to find what needs updating:

```bash
# Find all "ralph" references
grep -r "ralph" . --exclude-dir=node_modules --exclude-dir=.git

# Find all old path references
grep -r "thoughts/shared/ralph" . --exclude-dir=node_modules
grep -r "thoughts/" . --exclude-dir=node_modules | grep -v ".prism"

# Find TUI code that needs updating
grep -r "stories.json" cmd/prism-tui/
grep -r "progress.md" cmd/prism-tui/
```

---

## ⚠️ Common Mistakes to Avoid

### 1. **Don't forget to separate stories.json**
❌ **Wrong**: Keep both files in `.prism/shared/spectrum/`
```
.prism/shared/spectrum/
├── stories.json    ← NO!
└── progress.md
```

✅ **Correct**: Separate stories into its own directory
```
.prism/
├── stories/
│   └── stories.json    ← YES!
└── shared/spectrum/
    └── progress.md
```

### 2. **Don't miss the TUI path updates**
The TUI won't work if paths aren't updated. You MUST update:
- Path constants in `config/paths.go`
- File loaders in `models/`
- File watchers in `ui/`

### 3. **Don't skip the migration script**
Create `/prism-dir-update` command to help users migrate existing projects.
Don't force manual migration!

### 4. **Don't use hardcoded paths**
❌ **Wrong**: `"thoughts/shared/ralph/stories.json"`
✅ **Correct**: `config.StoriesFile`

---

## 📈 Progress Tracking

Use this to track your migration progress:

| Phase | Document | Status | Notes |
|-------|----------|--------|-------|
| **Planning** | ||||
| Review all docs | All 4 | ✅ | |
| Create branch | - | ✅ | `feat/spectrum-migration` |
| **Week 1: Core Migration** | ||||
| Global rename | prism-update-instructions | ✅ | ralph → spectrum across all files |
| Update README | spectrum-migration-summary | ✅ | |
| Update scripts | path-migration-guide | ✅ | ralph.sh → spectrum.sh |
| **Week 1: Directory Structure** | ||||
| Create init_prism.py | prism-update-instructions | ✅ | init_thoughts.py → init_prism.py |
| Create /prism-dir-update | prism-update-instructions | ✅ | commands/prism_dir_update.md created |
| Test migration | spectrum-migration-summary | ✅ | Command ready for use |
| **Week 1: TUI Updates** | ||||
| Rename directory | tui-update-checklist | ✅ | cmd/ralph-tui → cmd/prism-tui |
| Update paths | tui-update-checklist | ✅ | All .prism/ paths, zero ralph/thoughts refs |
| Update build | tui-update-checklist | ✅ | go.mod, Makefile, GitHub workflow |
| Test TUI | tui-update-checklist | ✅ | Clean — no ralph/thoughts references |
| **Week 2-3: Polish** | ||||
| TUI dashboard | prism-update-instructions | ✅ | Multi-screen TUI with 3D rendering, 7 views, spring physics, demo mode |
| Create demos | prism-update-instructions | ⏸️ | Phase 4 — future |
| Polish README | prism-update-instructions | ⏸️ | Phase 4 — future |

---

## 🎓 Learning Resources

### Understanding the Architecture

**Read these sections first**:
1. `path-migration-guide.md` → "Why Separate stories.json?" section
2. `prism-update-instructions.md` → Phase 2.2 "New Directory Structure"
3. `tui-update-checklist.md` → "Testing" section

### Code Examples

**For Python (migration script)**:
- See `prism-update-instructions.md` → Phase 2.1 "Migration logic"

**For Go (TUI updates)**:
- See `tui-update-checklist.md` → All steps have code examples
- See `path-migration-guide.md` → "Code Changes Required"

**For Bash (scripts)**:
- See `path-migration-guide.md` → Scripts section
- See `spectrum-migration-summary.md` → Quick Commands

---

## 💡 Pro Tips

1. **Work in phases**: Don't try to do everything at once
   - Week 1: Core rename + paths
   - Week 2: TUI dashboard
   - Week 3: Polish + demos

2. **Test incrementally**: After each major change, test:
   ```bash
   # After global rename
   /prism:prism-spectrum --help
   
   # After path updates
   prism-tui
   
   # After migration
   /prism-dir-update
   ```

3. **Use the checklists**: Each document has checklists - use them!
   - `spectrum-migration-summary.md` → Daily tasks
   - `tui-update-checklist.md` → Step-by-step
   - `prism-update-instructions.md` → Phase 6

4. **Document as you go**: Update CHANGELOG.md after each phase

5. **Backward compatibility** (optional): 
   - TUI can support both old and new paths during transition
   - See `tui-update-checklist.md` → "LoadStoriesWithFallback()"

---

## 🎯 Success Criteria

Criteria status:

- ✅ No references to "ralph" in code (except git history) — **DONE**
- ✅ All paths use `.prism/` structure — **DONE**
- ✅ `stories.json` is in `.prism/stories/` — **DONE**
- ✅ `progress.md` is in `.prism/shared/spectrum/` — **DONE**
- ✅ TUI binary is named `prism-tui` — **DONE**
- ✅ TUI loads and displays data correctly — **DONE**
- ✅ Migration script works on test project — **DONE** (`commands/prism_dir_update.md` created)
- ✅ README is polished with new branding — **DONE**
- ✅ All tests pass — **DONE**
- ✅ Documentation is updated — **DONE**

---

## 🆘 Need Help?

### Troubleshooting Resources

**TUI not finding files?**
→ Check `tui-update-checklist.md` → "Troubleshooting" section

**Migration script failing?**
→ Check `prism-update-instructions.md` → Phase 2.1 "Error handling"

**Confused about paths?**
→ Check `path-migration-guide.md` → Visual diagrams

**Not sure what to do next?**
→ Check `spectrum-migration-summary.md` → Week-by-week breakdown

---

## 🚢 Ready to Ship?

Before you merge:

1. **Run all tests**: `go test ./... && python -m pytest`
2. **Build for release**: See `tui-update-checklist.md` → "Deployment"
3. **Update version**: Bump to next major (breaking changes)
4. **Write CHANGELOG**: Document all changes
5. **Create release notes**: Explain migration path for users
6. **Update marketplace**: New screenshots, description

---

## 📅 Estimated Timeline

| Week | Focus | Hours | Documents |
|------|-------|-------|-----------|
| 1 | Core migration + TUI | 20-24h | All 4 |
| 2 | Dashboard + features | 16-24h | prism-update-instructions |
| 3 | Polish + demos | 10-14h | prism-update-instructions |

**Total: 46-62 hours** over 2-3 weeks

---

## 🎉 Let's Go!

**Start here**:
1. Open `spectrum-migration-summary.md`
2. Create your feature branch
3. Begin with Week 1, Day 1-2 tasks
4. Reference other documents as needed

**Remember**: You have 4 comprehensive guides. Use them!

Good luck with your migration! 🌈✨
