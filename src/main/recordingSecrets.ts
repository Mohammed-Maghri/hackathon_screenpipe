import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// MVP device-local key. File permissions protect the key; this is not an OS vault.
export class RecordingSecrets {
 private key: Buffer
 constructor(root: string) {
  mkdirSync(root, { recursive: true, mode: 0o700 })
  const path = join(root, 'recording-key')
  try { this.key = readFileSync(path) } catch (error) {
   if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
   this.key = randomBytes(32)
   try { writeFileSync(path, this.key, { mode: 0o600, flag: 'wx' }) }
   catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; this.key = readFileSync(path) }
  }
  if (this.key.length !== 32) throw new Error('Invalid local recording encryption key.')
 }
 encrypt(value: string, context: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, iv)
  cipher.setAAD(Buffer.from(context))
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return { version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') }
 }
 decrypt(value: unknown, context: string) {
  const data = value as { version: number; iv: string; tag: string; data: string }
  if (data?.version !== 1) throw new Error('Unsupported encrypted input.')
  try {
   const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(data.iv, 'base64'))
   decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(Buffer.from(data.tag, 'base64'))
   return Buffer.concat([decipher.update(Buffer.from(data.data, 'base64')), decipher.final()]).toString('utf8')
  } catch { throw new Error('Cannot decrypt this input on this computer. Record it again.') }
 }
}
