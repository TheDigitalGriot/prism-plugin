/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  // Only run unit tests (not vscode-test integration tests)
  testMatch: ["**/src/**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    // Resolve @shared/* path alias
    "^@shared/(.*)$": "<rootDir>/src/shared/$1",
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          // Use the project tsconfig but override module for jest compatibility
          module: "CommonJS",
        },
      },
    ],
  },
  // Do not transform node_modules
  transformIgnorePatterns: ["/node_modules/"],
  // Coverage reporting
  collectCoverageFrom: [
    "src/prism/stories.ts",
    "src/prism/signals.ts",
    "src/prism/progress.ts",
    "src/core/controller/prism/workflow.ts",
  ],
}
