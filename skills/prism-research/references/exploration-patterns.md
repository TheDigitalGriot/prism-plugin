# Exploration Patterns

Bash-based patterns for codebase exploration. Use when agents need lower-level access.

---

## File Discovery

### Find by extension
```bash
# All TypeScript files
find . -name "*.ts" -not -path "*/node_modules/*"

# All test files
find . -name "*.test.ts" -o -name "*.spec.ts"

# Config files
find . -name "*.config.*" -o -name ".*rc"
```

### Find by content
```bash
# Functions/classes
grep -rn "function createToken" --include="*.ts"
grep -rn "class AuthService" --include="*.ts"

# Imports
grep -rn "from './auth'" --include="*.ts"

# Exports
grep -rn "export.*Token" --include="*.ts"
```

### Find by modification
```bash
# Recently changed
git diff --name-only HEAD~10

# Changed in feature branch
git diff main...HEAD --name-only
```

---

## Structure Mapping

### Directory overview
```bash
# Tree structure (depth 2)
tree -L 2 -I node_modules

# Just directories
tree -d -L 3 -I node_modules

# With file counts
find . -type d -not -path "*/node_modules/*" | head -20
```

### Component mapping
```bash
# List components
ls -la src/components/

# Count by type
find src -name "*.tsx" | wc -l
find src -name "*.ts" | wc -l
```

---

## Dependency Tracing

### Import chains
```bash
# What imports this file?
grep -rn "from.*auth/jwt" --include="*.ts"

# What does this file import?
head -50 src/auth/jwt.ts | grep "^import"
```

### Package usage
```bash
# Where is lodash used?
grep -rn "from 'lodash" --include="*.ts"

# External dependencies
grep -rn "from '[^.]" --include="*.ts" | head -30
```

---

## Git Archaeology

### File history
```bash
# Commits touching file
git log --oneline src/auth/jwt.ts

# Blame for specific lines
git blame -L 45,60 src/auth/jwt.ts
```

### Author discovery
```bash
# Who wrote this?
git log --format="%an" src/auth/jwt.ts | sort | uniq -c

# Recent contributors
git shortlog -sn --since="6 months ago"
```

### Change discovery
```bash
# What changed recently in auth?
git log --oneline --since="1 month ago" -- src/auth/
```

---

## Pattern Recognition

### Find similar code
```bash
# Find all route definitions
grep -rn "app\.\(get\|post\|put\|delete\)" --include="*.ts"

# Find all hooks
grep -rn "use[A-Z][a-zA-Z]*" --include="*.tsx"

# Find all exports
grep -rn "^export " --include="*.ts"
```

### Find conventions
```bash
# Error handling patterns
grep -rn "catch\|throw\|Error" --include="*.ts" | head -20

# Logging patterns
grep -rn "console\.\|logger\." --include="*.ts" | head -20
```

---

## Quick Checks

### Health indicators
```bash
# TODO/FIXME count
grep -rn "TODO\|FIXME\|HACK" --include="*.ts" | wc -l

# Test coverage hints
ls -la coverage/ 2>/dev/null || echo "No coverage dir"

# Build status
ls -la dist/ 2>/dev/null || echo "No dist dir"
```

### Config check
```bash
# Package info
cat package.json | head -20

# TypeScript config
cat tsconfig.json | head -20
```

---

## Usage Notes

1. **Prefer Grep/Glob tools** over raw bash when available
2. **Use agents** for complex multi-step exploration
3. **These patterns** are for when you need bash-level access
4. **Always filter** node_modules, dist, .git
5. **Pipe to head** for large outputs
