export type StockItem = { id: string; name: string; stock: number; unitCost: number; supplier: string; leadDays: number; incoming: number; incomingDate: string }
export type Sale = { id: string; productId: string; quantity: number; date: string; status: string }
export type RestockSettings = { start: string; end: string; asOf: string; reviewDays: number; safetyDays: number; budget: number }
export const restockDefaults: RestockSettings = { start: '2026-10-05', end: '2026-10-18', asOf: '2026-10-19', reviewDays: 7, safetyDays: 2, budget: 250 }
export const supplierDefaults: Record<string, Omit<StockItem, 'id' | 'name' | 'stock'>> = {
 hoodie: { unitCost: 35, supplier: 'North Textile', leadDays: 4, incoming: 3, incomingDate: '2026-10-21' },
 tee: { unitCost: 10, supplier: 'North Textile', leadDays: 3, incoming: 0, incomingDate: '' },
 cargo: { unitCost: 22, supplier: 'Atlas Apparel', leadDays: 7, incoming: 2, incomingDate: '2026-11-10' },
 cap: { unitCost: 12, supplier: 'Studio Supply', leadDays: 2, incoming: 0, incomingDate: '' },
 shoes: { unitCost: 28, supplier: 'Stride Works', leadDays: 10, incoming: 0, incomingDate: '' },
}
const day = (s: string) => {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Error('Use valid calendar dates.')
 const t = Date.parse(s + 'T00:00:00Z')
 if (!Number.isFinite(t) || new Date(t).toISOString().slice(0,10) !== s) throw Error('Use valid calendar dates.')
 return t / 86400000
}
const nonnegative = (v: number, label: string, integer = false) => { if (!Number.isFinite(v) || v < 0 || (integer && !Number.isInteger(v))) throw Error(label + ' must be a non-negative ' + (integer ? 'whole number.' : 'number.')) }
export function recommendRestock(items: StockItem[], sales: Sale[], settings: RestockSettings) {
 const start = day(settings.start), end = day(settings.end), asOf = day(settings.asOf)
 if (start > end || end >= asOf) throw Error('Sales must end before the planning date and start before the end.')
 nonnegative(settings.reviewDays, 'Review days', true); nonnegative(settings.safetyDays, 'Safety days', true); nonnegative(settings.budget, 'Budget')
 if (!settings.reviewDays) throw Error('Review days must be at least one.')
 if (new Set(items.map(p=>p.id)).size !== items.length) throw Error('Duplicate product IDs.')
 const counts = new Map<string, number>(), ids = new Set<string>()
 for (const sale of sales) {
  if(ids.has(sale.id)) throw Error('Duplicate sales row IDs.')
  ids.add(sale.id); nonnegative(sale.quantity,'Sales quantity',true)
  const date=day(sale.date)
  if(date>=start && date<=end && ['Paid','Shipped'].includes(sale.status)) counts.set(sale.productId,(counts.get(sale.productId)??0)+sale.quantity)
 }
 const days = end-start+1
 const rows = items.map(p=>{
  for(const [label,value] of [['Stock',p.stock],['Incoming',p.incoming],['Lead days',p.leadDays]] as const) nonnegative(value,label,true)
  nonnegative(p.unitCost,'Unit cost')
  const unitsSold=counts.get(p.id)??0, dailyRate=unitsSold/days
  const horizon=p.leadDays+settings.reviewDays+settings.safetyDays
  const arrival=p.incoming>0&&p.incomingDate?day(p.incomingDate):null
  const eligibleIncoming=arrival!==null&&arrival>=asOf&&arrival<=asOf+horizon?p.incoming:0
  const targetStock=Math.ceil(dailyRate*horizon)
  const buy=Math.max(0,targetStock-p.stock-eligibleIncoming)
  // Detect any shortage before the new order arrives, including before an inbound delivery.
  const stockout=p.leadDays>0 && (arrival!==null&&eligibleIncoming&&arrival<=asOf+p.leadDays
   ? p.stock<dailyRate*(arrival-asOf)||p.stock+eligibleIncoming<dailyRate*p.leadDays
   : p.stock<dailyRate*p.leadDays)
  const urgent=dailyRate>0&&(p.stock===0||Boolean(stockout))
  const cost=Math.round(buy*p.unitCost*100)/100
  const warning=[urgent?'Stock may run out before a new order arrives.':'',unitsSold===0?'No sales in this period.':dailyRate>0&&p.stock/dailyRate>60?'Over 60 days of stock: slow-moving / overstock risk.':'',p.incoming>0&&!eligibleIncoming?'Incoming delivery is missing a valid ETA, overdue, or beyond the planning horizon; excluded.':''].filter(Boolean).join(' ')
  return {...p,unitsSold,days,dailyRate,eligibleIncoming,targetStock,buy,cost,urgent,warning,explanation:`ceil(${unitsSold}/${days} × (${p.leadDays} lead + ${settings.reviewDays} review + ${settings.safetyDays} safety)) − ${p.stock} stock − ${eligibleIncoming} eligible incoming; minimum 0.`}
 })
 const total=Math.round(rows.reduce((sum,r)=>sum+r.cost,0)*100)/100
 return {rows,total,overBudget:total>settings.budget,days}
}
export type RestockResult = ReturnType<typeof recommendRestock>
export function shoppingRows(result: RestockResult): (string|number)[][] {
 return [['Product ID','Product','Supplier','Units sold','Observation days','Daily rate','Stock','Incoming counted','Target stock','Buy quantity','Unit cost EUR','Cost EUR','Urgent','Warnings','Explanation'],...result.rows.map(r=>[r.id,r.name,r.supplier,r.unitsSold,r.days,Number(r.dailyRate.toFixed(4)),r.stock,r.eligibleIncoming,r.targetStock,r.buy,r.unitCost,r.cost,r.urgent?'Yes':'No',r.warning,r.explanation])]
}
