/**
 * API key management via VS Code SecretStorage.
 *
 * The Anthropic API key is stored securely in VS Code's SecretStorage,
 * which is OS-level credential storage (Keychain / Windows Credential Store).
 *
 * Delegates to the platform-agnostic helpers in @prism-core/core/api/auth
 * via a SecretStore adapter over vscode.ExtensionContext.secrets.
 */
import * as vscode from "vscode"
import {
  type SecretStore,
  isValidApiKey as _isValidApiKey,
  getApiKey as _getApiKey,
  setApiKey as _setApiKey,
  deleteApiKey as _deleteApiKey,
} from "@prism-core/core/api/auth"

function makeVscodeStore(context: vscode.ExtensionContext): SecretStore {
  return {
    get: (key) => Promise.resolve(context.secrets.get(key)),
    set: (key, value) => Promise.resolve(context.secrets.store(key, value)),
    delete: (key) => Promise.resolve(context.secrets.delete(key)),
  }
}

/** Retrieve the stored Anthropic API key, or undefined if not set. */
export async function getApiKey(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  return _getApiKey(makeVscodeStore(context))
}

/** Store an Anthropic API key in SecretStorage. */
export async function setApiKey(
  context: vscode.ExtensionContext,
  key: string,
): Promise<void> {
  return _setApiKey(makeVscodeStore(context), key)
}

/** Delete the stored Anthropic API key. */
export async function deleteApiKey(context: vscode.ExtensionContext): Promise<void> {
  return _deleteApiKey(makeVscodeStore(context))
}

/** Validate that a string looks like an Anthropic API key (starts with sk-ant-). */
export { _isValidApiKey as isValidApiKey }

/**
 * Prompt the user to enter their Anthropic API key via VS Code input box.
 * Returns the key, or undefined if cancelled.
 */
export async function promptForApiKey(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  const key = await vscode.window.showInputBox({
    title: "Prism: Anthropic API Key",
    prompt: "Enter your Anthropic API key (starts with sk-ant-)",
    placeHolder: "sk-ant-...",
    ignoreFocusOut: true,
    password: true,
    validateInput: (value) => {
      if (!value) return "API key is required"
      if (!_isValidApiKey(value)) return "Invalid API key format — must start with sk-ant-"
      return undefined
    },
  })

  if (key) {
    await setApiKey(context, key)
    vscode.window.showInformationMessage("Prism: API key saved securely.")
  }

  return key
}
