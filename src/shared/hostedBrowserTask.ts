/** Explicit tasks for our hosted practice websites; never inferred for other sites. */
export function hostedBrowserTask(address: string) {
  try {
    const url = new URL(address)
    if (url.origin !== 'https://hackathon-screenpipe.vercel.app' || url.username || url.password || url.search || url.hash) return null
    if (url.pathname === '/nova/restocking') return { name: 'NOVA exports', selectors: ['[data-testid="restock-sales-export"]', '[data-testid="restock-inventory-export"]', '[data-testid="restock-excel"]'] }
    if (url.pathname === '/finance') return { name: 'Forma finance export', selectors: ['[data-testid="export-report"]'] }
  } catch { /* Invalid or unsupported URL. */ }
  return null
}
