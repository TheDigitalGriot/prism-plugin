# Prism CLI Makefile

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS := -X main.version=$(VERSION)
BINARY := prism-cli

# Platforms for cross-compilation
PLATFORMS := windows/amd64 darwin/amd64 darwin/arm64 linux/amd64 linux/arm64

REPO_ROOT := $(shell git rev-parse --show-toplevel)

.PHONY: build build-all test test-install test-install-bats test-all lint clean install help

# Default target
all: build

# Build for current platform
build:
	go build -ldflags "$(LDFLAGS)" -o bin/$(BINARY)$(if $(findstring windows,$(shell go env GOOS)),.exe,) .

# Build for all platforms
build-all:
	@mkdir -p bin
	@for platform in $(PLATFORMS); do \
		os=$${platform%/*}; \
		arch=$${platform#*/}; \
		ext=""; \
		if [ "$$os" = "windows" ]; then ext=".exe"; fi; \
		GOOS=$$os GOARCH=$$arch \
		go build -ldflags "$(LDFLAGS)" \
		-o bin/$(BINARY)-$$os-$$arch$$ext \
		. ; \
		echo "Built bin/$(BINARY)-$$os-$$arch$$ext"; \
	done

# Run tests
test:
	go test -v ./...

# Run shell installer tests (zero dependencies)
test-install:
	bash $(REPO_ROOT)/scripts/tests/test_install.sh

# Run BATS installer tests (requires bats-core)
test-install-bats:
	bats $(REPO_ROOT)/scripts/tests/prism-cli-install.bats

# Run all tests (Go + shell)
test-all: test test-install

# Run linter
lint:
	@which golangci-lint > /dev/null || (echo "golangci-lint not installed" && exit 1)
	golangci-lint run

# Clean build artifacts
clean:
	rm -rf bin/
	go clean

# Install to GOPATH/bin
install:
	go install -ldflags "$(LDFLAGS)" .

# Development run (requires stories.json)
run:
	go run . $(ARGS)

# Show help
help:
	@echo "Prism CLI - Build Commands"
	@echo ""
	@echo "Usage:"
	@echo "  make build       Build for current platform"
	@echo "  make build-all   Build for all platforms"
	@echo "  make test             Run Go tests"
	@echo "  make test-install     Run shell installer tests"
	@echo "  make test-install-bats Run BATS installer tests (requires bats-core)"
	@echo "  make test-all         Run all tests (Go + shell)"
	@echo "  make lint        Run linter"
	@echo "  make clean       Remove build artifacts"
	@echo "  make install     Install to GOPATH/bin"
	@echo "  make run ARGS=.. Run with arguments"
	@echo ""
	@echo "Cross-compilation targets:"
	@echo "  $(PLATFORMS)"
