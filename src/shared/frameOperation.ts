import type { FrameIdentity } from './recording'
export type FrameRequest = { frame: FrameIdentity; point?: { x: number; y: number } }
export function frameOperation(request: FrameRequest) {
  let candidates = [...document.querySelectorAll<HTMLIFrameElement>('iframe,frame')].filter(frame => request.frame.name ? frame.name === request.frame.name : frame.src === request.frame.url)
  if (candidates.length > 1 && request.frame.name) candidates = candidates.filter(frame => frame.src === request.frame.url)
  if (candidates.length !== 1) throw new Error(candidates.length ? 'Ambiguous embedded frame owner.' : 'Embedded frame owner not found. A named frame is required after a redirect.')
  const frame = candidates[0]!
  // Reject geometry we cannot map exactly; never fall back to recorded coordinates.
  for (let ancestor: Element | null = frame; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor)
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0' || ancestor.matches('[inert],[aria-hidden="true"]')) throw new Error('Embedded frame is hidden or disabled.')
    if (style.transform !== 'none' || (style.zoom && !['1', 'normal'].includes(style.zoom))) throw new Error('Transformed embedded frames are not supported yet.')
  }
  const style = getComputedStyle(frame)
  if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0' || frame.closest('[inert]')) throw new Error('Embedded frame is hidden or disabled.')
  frame.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })
  const rect = frame.getBoundingClientRect()
  if (!rect.width || !rect.height) throw new Error('Embedded frame has no visible viewport.')
  if (!request.point) return { x: rect.x + frame.clientLeft, y: rect.y + frame.clientTop }
  const { x, y } = request.point
  if (x < 0 || y < 0 || x >= frame.clientWidth || y >= frame.clientHeight) throw new Error('Target is outside the embedded frame viewport.')
  const translated = { x: rect.x + frame.clientLeft + x, y: rect.y + frame.clientTop + y }
  if (document.elementFromPoint(translated.x, translated.y) !== frame) throw new Error('Embedded frame is covered by another element.')
  return translated
}
