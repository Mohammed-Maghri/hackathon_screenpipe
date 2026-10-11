/** Validate destinations from websites without treating them as search queries. */
export function browserURL(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 8192) throw new Error('Enter a website address.')
  const input = value.trim()
  const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(input) && !/^[\w.-]+:\d+(\/|$)/.test(input) ? input : `https://${input}`)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP or HTTPS website address without embedded credentials.')
  return url.href
}

/** The address bar accepts either a website address or a Google search. */
export function resolveBrowserAddress(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 8192) throw new Error('Enter a website address or search term.')
  const input = value.trim()
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(input)
  const localAddress = /^(localhost|[\w.-]+:\d+|\[[a-f\d:]+\])([/?#:]|$)/i.test(input)
  const domain = /^[^\s/?#:@]+\.[^\s/?#:@]+(?::\d+)?(?:[/?#]|$)/u.test(input)
  if (hasScheme || localAddress || domain) return browserURL(input)
  return `https://www.google.com/search?q=${encodeURIComponent(input)}`
}
