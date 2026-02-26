declare function acquireVsCodeApi(): { postMessage(msg: unknown): void }

export const vscode = acquireVsCodeApi()
