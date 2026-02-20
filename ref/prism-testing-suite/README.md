# Prism CLI — Test Suite

Complete testing package for the Prism CLI installer script and Charm-based TUI application.

## Directory Structure

```
prism-tests/
├── README.md                          ← You are here
├── scripts/
│   └── tests/
│       ├── prism-cli-install.bats     ← BATS test suite (requires bats-core)
│       └── test_install.sh            ← Standalone bash tests (zero dependencies)
└── cmd/
    └── prism-cli/
        ├── config/
        │   └── config_test.go         ← Path constants, directory structure, init detection
        ├── models/
        │   └── stories_test.go        ← JSON parsing, filtering, status transitions, deps
        └── ui/
            └── model_test.go          ← Bubble Tea model: keys, views, navigation, rendering
```

## Quick Start

### Shell installer tests (no dependencies needed)

```bash
# From your repo root:
bash scripts/tests/test_install.sh

# Or point at the script directly:
bash scripts/tests/test_install.sh ./scripts/prism-cli-install.sh
```

### Shell installer tests (with BATS — richer output)

```bash
# Install bats-core
brew install bats-core
# or: npm install -g bats

# Run
bats scripts/tests/prism-cli-install.bats
```

### Go tests

```bash
# All tests
cd cmd/prism-cli && go test ./... -v

# By package
go test ./config/ -v
go test ./models/ -v
go test ./ui/ -v

# With coverage
go test ./... -v -coverprofile=coverage.out
go tool cover -html=coverage.out

# Benchmarks
go test ./ui/ -bench=. -benchmem
```

## What's Tested

### `prism-cli-install.sh` (32 assertions)

| Area | Tests |
|------|-------|
| `detect_platform` | OS detection, arch detection, format validation |
| `is_windows` | Platform-correct return value |
| `has_go` | Go availability detection |
| `init_workspaces` | Directory creation, JSON initialization, idempotency |
| `setup_path` | PATH modification, RC file selection priority, idempotency, fallback chain |
| `download_release` | URL construction (latest, versioned, .exe suffix) |
| `main` | Method validation, error handling, fallback logic, end-to-end simulation |
| `PRISM_BIN_DIR` | Custom install directory override |

### `cmd/prism-cli` Go packages (60+ assertions)

| Package | Tests |
|---------|-------|
| `config/` | Path constants, directory structure, `IsPrismInitialized`, workspace registry, no legacy paths |
| `models/` | JSON parsing, field validation, status filtering, progress calculation, dependency validation, status transitions, file I/O, malformed input handling |
| `ui/` | Model initialization, dashboard rendering, key handling (q, ctrl+c, ?, esc, 1-4, j/k, arrows, enter), cursor bounds, view switching, window resize, message handling, no "ralph" references, benchmarks |

## Integration Notes

### Wiring Go tests to your actual code

The test files use **stub types** so they compile standalone. To connect them to your real code:

1. **config_test.go** — Replace the `Expected*` constants with imports from your `config` package
2. **stories_test.go** — Replace the `Story`/`StoriesFile` structs with imports from your `models` package
3. **model_test.go** — Replace the stub `Model` with an import from your `ui` package, remove the entire "Stub model" section

Example for `model_test.go`:
```go
// Remove the stub section and add:
import "github.com/TheDigitalGriot/prism-plugin/cmd/prism-cli/ui"

// Then change NewModel() → ui.NewModel(), etc.
```

### Enabling teatest golden files

The `model_test.go` file includes commented-out `teatest` snapshot tests. To enable:

```bash
cd cmd/prism-cli
go get github.com/charmbracelet/x/exp/teatest
```

Then uncomment the `TestGolden*` functions. First run creates golden files, subsequent runs compare against them. Update with `-update` flag.

### CI integration

```yaml
# GitHub Actions example
- name: Test installer script
  run: bash scripts/tests/test_install.sh

- name: Test Go packages
  run: |
    cd cmd/prism-cli
    go test ./... -v -race -coverprofile=coverage.out

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    file: cmd/prism-cli/coverage.out
```

## Adding New Tests

The patterns in each file are designed to be extended:

- **Shell tests**: Add new functions following the `assert_*` pattern in `test_install.sh`
- **Go config tests**: Add new `TestRequired*` functions for new directories or files
- **Go model tests**: Add new status transitions to the `TestValidTransitions` table
- **Go UI tests**: Add new `sendKey` sequences for new keybindings
