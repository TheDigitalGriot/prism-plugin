# Development Guide

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run make
```

## Development Workflow

1. `npm start` launches Electron with Vite hot-reload
2. Main process changes require app restart
3. Renderer changes hot-reload automatically
4. DevTools open by default in development

## Project Conventions

- TypeScript strict mode enabled
- ESLint for code quality
- Electron Forge for packaging
- Vite for bundling (separate configs for main, preload, renderer)

## Building

```bash
npm run package    # Package without installer
npm run make       # Create platform installers
npm run publish    # Publish to configured target
```
