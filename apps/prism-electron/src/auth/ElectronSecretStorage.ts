/**
 * ElectronSecretStorage — implements the shared SecretStore interface using
 * Electron's safeStorage API (OS-level encryption: Keychain / DPAPI / libsecret).
 *
 * Secrets are stored as an encrypted JSON map at:
 *   <userData>/prism-secrets.enc
 *
 * The file contains a Buffer of safeStorage.encryptString(JSON.stringify(map)).
 * On each get/set/delete, the file is decrypted, mutated, and re-encrypted.
 */

import * as fs from 'fs'
import * as path from 'path'
import { app, safeStorage } from 'electron'
import type { SecretStore } from '@prism-core/core/api/auth'

export class ElectronSecretStorage implements SecretStore {
  private readonly _filePath: string

  constructor() {
    this._filePath = path.join(app.getPath('userData'), 'prism-secrets.enc')
  }

  // ---------------------------------------------------------------------------
  // SecretStore implementation
  // ---------------------------------------------------------------------------

  async get(key: string): Promise<string | undefined> {
    const map = this._readMap()
    return map[key]
  }

  async set(key: string, value: string): Promise<void> {
    const map = this._readMap()
    map[key] = value
    this._writeMap(map)
  }

  async delete(key: string): Promise<void> {
    const map = this._readMap()
    delete map[key]
    this._writeMap(map)
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Read and decrypt the secrets map. Returns {} on any error. */
  private _readMap(): Record<string, string> {
    if (!safeStorage.isEncryptionAvailable()) {
      return this._readPlaintext()
    }
    try {
      const encrypted = fs.readFileSync(this._filePath)
      const json = safeStorage.decryptString(encrypted)
      return JSON.parse(json) as Record<string, string>
    } catch {
      return {}
    }
  }

  /** Encrypt and write the secrets map. */
  private _writeMap(map: Record<string, string>): void {
    if (!safeStorage.isEncryptionAvailable()) {
      this._writePlaintext(map)
      return
    }
    try {
      const json = JSON.stringify(map)
      const encrypted = safeStorage.encryptString(json)
      fs.writeFileSync(this._filePath, encrypted)
    } catch (err) {
      console.error('[Prism] Failed to write secrets:', err)
    }
  }

  // ---------------------------------------------------------------------------
  // Plaintext fallback (safeStorage unavailable in some CI / headless envs)
  // ---------------------------------------------------------------------------

  private get _plaintextPath(): string {
    return this._filePath + '.plain.json'
  }

  private _readPlaintext(): Record<string, string> {
    try {
      const raw = fs.readFileSync(this._plaintextPath, 'utf-8')
      return JSON.parse(raw) as Record<string, string>
    } catch {
      return {}
    }
  }

  private _writePlaintext(map: Record<string, string>): void {
    try {
      fs.writeFileSync(this._plaintextPath, JSON.stringify(map, null, 2), 'utf-8')
    } catch (err) {
      console.error('[Prism] Failed to write plaintext secrets:', err)
    }
  }
}
