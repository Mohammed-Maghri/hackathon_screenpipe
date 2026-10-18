import type { WebContents } from 'electron'
import { setTimeout as delay } from 'node:timers/promises'
import { hostedBrowserTask } from '../shared/hostedBrowserTask'

/** Perform native clicks once, and let the normal recorder capture their evidence. */
export async function teachHostedTask(contents: WebContents, signal: AbortSignal, ready: () => boolean, completedDownloads: () => Promise<number>) {
  const address = contents.getURL()
  const task = hostedBrowserTask(address)
  if (!task) throw new Error('Automatic teaching supports only the hosted NOVA restocking and Forma finance pages.')
  async function wait<T>(check: () => Promise<T>, message: string): Promise<NonNullable<T>> {
    const end = Date.now() + 20000
    while (Date.now() < end) {
      signal.throwIfAborted()
      if (contents.isDestroyed() || contents.getURL() !== address) throw new Error('Task page changed. Automatic teaching stopped.')
      const result = await check()
      if (result) return result as NonNullable<T>
      await delay(100, undefined, { signal })
    }
    throw new Error(message)
  }
  await wait(async () => ready(), 'Recorder is not ready. No actions were sent.')
  for (const selector of task.selectors) {
    const before = await completedDownloads()
    const point = await wait(async () => contents.executeJavaScript(`(() => {
      const matches = document.querySelectorAll(${JSON.stringify(selector)});
      if (matches.length > 1) throw Error('Ambiguous export button');
      const e = matches[0]; if (!e || e.disabled) return null;
      e.scrollIntoView({block:'center', behavior:'instant'});
      const r = e.getBoundingClientRect(), style = getComputedStyle(e);
      if (!r.width || !r.height || style.visibility === 'hidden' || style.display === 'none') return null;
      const x = Math.round(r.x+r.width/2), y = Math.round(r.y+r.height/2);
      if (!e.contains(document.elementFromPoint(x,y))) return null;
      return {x,y};
    })()`), 'Export button unavailable. Sign in and dismiss any dialogs, then start a new recording.')
    signal.throwIfAborted()
    if (!ready() || contents.getURL() !== address) throw new Error('Browser is no longer ready.')
    contents.focus()
    contents.sendInputEvent({ type: 'mouseDown', ...point, button: 'left', clickCount: 1 })
    contents.sendInputEvent({ type: 'mouseUp', ...point, button: 'left', clickCount: 1 })
    // Never retry a dispatched click: an uncertain download needs inspection.
    await wait(async () => (await completedDownloads()) > before, 'Download completion was not captured. The click will not be repeated automatically.')
  }
}
