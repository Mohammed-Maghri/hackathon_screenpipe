// Avoid persisting authentication material embedded in navigation destinations.
export function recordedURL(value: string) {
  const url = new URL(value)
  let redacted = false
  for (const key of [...url.searchParams.keys()]) if (/token|secret|password|authorization|^(code|otp|session|sessionid|api_key)$/i.test(key)) { url.searchParams.set(key, '[REDACTED]'); redacted = true }
  if (/token|secret|password|authorization|\bcode=/i.test(url.hash)) { url.hash = 'REDACTED'; redacted = true }
  if (url.username || url.password) { url.username = ''; url.password = ''; redacted = true }
  return { url: url.href, redacted }
}
