# Ralph TUI Makefile

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS := -X main.version=$(VERSION)
BINARY := ralph-tui

# Platforms for cross-compilation
PLATFORMS := windows/amd64 darwin/amd64 darwin/arm64 linux/amd64 linux/arm64

.PHONY: build build-all test lint clean install help

# Default target
all: build

# Build for current platform
build:
	go build -ldflags "$(LDFLAGS)" -o bin/$(BINARY)$(if $(findstring windows,$(shell go env GOOS)),.exe,) .

# Build for all platforms
build-all:
	@mkdir -p bin
	@for platform in $(PLATFORMS); do \
		GOOS=$${platform%/*} GOARCH=$${platform#*/} \
		go build -ldflags "$(LDFLAGS)" \
		-o bin/$(BINARY)-$${platform%/*}-$${platform#*/}$(if $(findstring windows,$${platform%/*}),.exe,) \
		. ; \
		echo "Built bin/$(BINARY)-$${platform%/*}-$${platform#*/}"; \
	done

# Run tests
test:
	go test -v ./...

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
	@echo "Ralph TUI - Build Commands"
	@echo ""
	@echo "Usage:"
	@echo "  make build       Build for current platform"
	@echo "  make build-all   Build for all platforms"
	@echo "  make test        Run tests"
	@echo "  make lint        Run linter"
	@echo "  make clean       Remove build artifacts"
	@echo "  make install     Install to GOPATH/bin"
	@echo "  make run ARGS=.. Run with arguments"
	@echo ""
	@echo "Cross-compilation targets:"
	@echo "  $(PLATFORMS)"
