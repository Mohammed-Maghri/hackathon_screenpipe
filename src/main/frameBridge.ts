import { ipcMain, type IpcMainEvent, type WebContents, type WebFrameMain } from 'electron'
import { randomUUID } from 'node:crypto'
import type { FrameIdentity } from '../shared/recording'
import type { PageRequest, PageResult } from '../shared/pageOperation'
import type { FrameRequest } from '../shared/frameOperation'
import { recordedURL } from '../shared/recordedURL'
const key = (frame: WebFrameMain) => `${frame.processId}:${frame.frameToken}`
const equalURL = (a: string, b: string) => { try { const x = new URL(a), y = new URL(b); x.searchParams.sort(); y.searchParams.sort(); return x.href === y.href } catch { return a === b } }
export class FrameBridge {
  private ready = new Set<string>()
  private pending = new Map<string, { frame: string; resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>()
  constructor(private contents: WebContents) { ipcMain.on('recorder:response', this.response) }
  private response = (event: IpcMainEvent, value: { id: string; result?: unknown; error?: string }) => {
    if (event.sender !== this.contents || !event.senderFrame || !value || typeof value.id !== 'string') return
    const pending = this.pending.get(value.id)
    if (!pending || pending.frame !== key(event.senderFrame)) return
    clearTimeout(pending.timer); this.pending.delete(value.id)
    value.error ? pending.reject(new Error(value.error)) : pending.resolve(value.result)
  }
  accepts(frame: WebFrameMain) { return !frame.isDestroyed() && !frame.detached && this.contents.mainFrame.framesInSubtree.some(item => key(item) === key(frame)) }
  markReady(frame: WebFrameMain) { this.ready.add(key(frame)) }
  isReady(frame: WebFrameMain) { return this.accepts(frame) && this.ready.has(key(frame)) }
  setEnabled(value: boolean) { for (const frame of this.contents.mainFrame.framesInSubtree) if (this.isReady(frame)) frame.send('recorder:enabled', value) }
  path(frame: WebFrameMain): FrameIdentity[] {
    const result: FrameIdentity[] = []
    for (let item = frame; item.parent; item = item.parent) {
      if (item.name.length > 256 || item.url.length > 4096) throw new Error('Embedded frame identity exceeds recording limits.')
      const safe = recordedURL(item.url || 'about:blank')
      if (safe.redacted) throw new Error('Manual authentication required. Embedded frame URL contains sensitive authentication parameters.')
      const matches = item.parent.frames.filter(other => other.name === item.name && equalURL(other.url, item.url))
      if (matches.length !== 1) throw new Error('Ambiguous embedded frames: matching names and URLs. Recording cannot identify this frame reliably.')
      result.unshift({ name: item.name, url: safe.url })
    }
    if (result.length > 8) throw new Error('Embedded frame nesting exceeds the supported depth.')
    return result
  }
  resolve(path: FrameIdentity[]): WebFrameMain {
    let frame = this.contents.mainFrame
    for (const identity of path) {
      const matches = frame.frames.filter(item => item.name === identity.name && equalURL(item.url, identity.url))
      if (matches.length !== 1) throw new Error(matches.length ? 'Ambiguous embedded frame; replay stopped.' : 'Expected embedded frame is missing or navigated to another URL.')
      frame = matches[0]!
    }
    if (!this.isReady(frame)) throw new Error('Embedded frame recorder is not ready or unavailable.')
    return frame
  }
  request<T>(frame: WebFrameMain, operation: 'page' | 'owner' | 'flush' | 'settle', request?: PageRequest | FrameRequest): Promise<T> {
    if (!this.isReady(frame)) return Promise.reject(new Error('Frame recorder is unavailable.'))
    const id = randomUUID()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Frame operation timed out.')) }, 2500)
      this.pending.set(id, { frame: key(frame), resolve, reject, timer })
      try { frame.send('recorder:request', { id, operation, request }) } catch { clearTimeout(timer); this.pending.delete(id); reject(new Error('Frame was detached.')) }
    })
  }
  page(path: FrameIdentity[], request: PageRequest) { return this.request<PageResult>(this.resolve(path), 'page', request) }
  async point(path: FrameIdentity[], point?: { x: number; y: number }) {
    const chain: WebFrameMain[] = [this.contents.mainFrame]
    for (let i = 1; i <= path.length; i++) chain.push(this.resolve(path.slice(0, i)))
    if (!point) {
      for (let i = 0; i < path.length; i++) await this.request(chain[i]!, 'owner', { frame: path[i]! })
      return undefined
    }
    for (let i = path.length - 1; i >= 0; i--) point = await this.request<{ x: number; y: number }>(chain[i]!, 'owner', { frame: path[i]!, point })
    return point
  }
  async settle(path: FrameIdentity[]) { await Promise.all([this.contents.mainFrame, ...(path.length ? [this.resolve(path)] : [])].map(frame => this.request(frame, 'settle'))) }
  async flush() { await Promise.all(this.contents.mainFrame.framesInSubtree.filter(frame => this.isReady(frame)).map(frame => this.request(frame, 'flush'))) }
  dispose() {
    ipcMain.removeListener('recorder:response', this.response)
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Browser session closed.')) }
    this.pending.clear(); this.ready.clear()
  }
}
