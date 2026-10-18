'use client'
import { useState, type FormEvent } from 'react'
import { downloadCSV } from '../../lib/data'
import { recommendRestock, restockDefaults, shoppingRows, supplierDefaults, type StockItem } from '../../lib/restocking'
import { euro, ProductImage, type NovaData } from './data'

export function Restocking({data,onSave}:{data:NovaData;onSave:(next:NovaData,message:string)=>boolean}) {
 const settings=data.restocking?.settings??restockDefaults
 const suppliers=data.restocking?.suppliers??supplierDefaults
 const items:StockItem[]=data.products.filter(p=>p.id in supplierDefaults).map(p=>({...supplierDefaults[p.id],...suppliers[p.id],id:p.id,name:p.name,stock:p.stock}))
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[exporting,setExporting]=useState(false)
 let result:ReturnType<typeof recommendRestock>|null=null
 try { result=recommendRestock(items,data.orders,settings) } catch { /* Invalid saved settings are reported and editable below. */ }
 function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  const form=new FormData(event.currentTarget)
  const number=(key:string)=>Number(form.get(key))
  const nextSettings={start:String(form.get('start')),end:String(form.get('end')),asOf:String(form.get('asOf')),reviewDays:number('reviewDays'),safetyDays:number('safetyDays'),budget:number('budget')}
  const nextItems=items.map(p=>({...p,stock:number(p.id+'-stock'),unitCost:number(p.id+'-cost'),supplier:String(form.get(p.id+'-supplier')),leadDays:number(p.id+'-lead'),incoming:number(p.id+'-incoming'),incomingDate:String(form.get(p.id+'-eta'))}))
  try{
   recommendRestock(nextItems,data.orders,nextSettings)
   const nextSuppliers=Object.fromEntries(nextItems.map(({id,name,stock,...supply})=>[id,supply]))
   if(onSave({...data,products:data.products.map(p=>({...p,stock:nextItems.find(i=>i.id===p.id)?.stock??p.stock})),restocking:{settings:nextSettings,suppliers:nextSuppliers}},'Inventory saved. Restocking recommendations recalculated.')){setError('');setNotice('Recommendations updated from saved inventory.')}
  }catch(e){setError(e instanceof Error?e.message:'Unable to calculate.')}
 }
 function salesExport(){
  downloadCSV('nova-restock-sales.csv',[['Order ID','Product ID','Date','Quantity','Status','Window start','Window end'],...data.orders.filter(o=>items.some(p=>p.id===o.productId)&&o.date>=settings.start&&o.date<=settings.end).map(o=>[o.id,o.productId,o.date,String(o.quantity),o.status,settings.start,settings.end])])
  setNotice('Sales CSV downloaded, including product IDs, quantities and status.')
 }
 function inventoryExport(){
  downloadCSV('nova-restock-inventory.csv',[['Product ID','Product','Stock','Supplier','Unit cost EUR','Lead days','Incoming quantity','Incoming ETA','Planning date','Review days','Safety days','Budget EUR','Window start','Window end'],...items.map(p=>[p.id,p.name,String(p.stock),p.supplier,String(p.unitCost),String(p.leadDays),String(p.incoming),p.incomingDate,settings.asOf,String(settings.reviewDays),String(settings.safetyDays),String(settings.budget),settings.start,settings.end])])
  setNotice('Inventory CSV downloaded from saved stock and supplier settings.')
 }
 async function excel(){
  if(!result)return
  setExporting(true);setError('')
  try{
   const {default:ExcelJS}=await import('exceljs')
   const workbook=new ExcelJS.Workbook()
   const sheet=workbook.addWorksheet('Shopping list')
   shoppingRows(result).forEach(row=>sheet.addRow(row))
   sheet.getRow(1).font={bold:true};sheet.views=[{state:'frozen',ySplit:1}]
   sheet.autoFilter='A1:O1'
   sheet.columns.forEach((column,index)=>{column.width=index>=13?60:index===1?32:18})
   const notes=workbook.addWorksheet('Review and assumptions')
   ;[['Status','Awaiting human approval — no purchases placed'],['Planning date',settings.asOf],['Sales window',settings.start+' through '+settings.end],['Eligible sales','Paid and Shipped only; zero-sale days included'],['Demand model','Constant daily rate; no seasonality or lost-sales adjustment'],['Incoming','Count only dated deliveries from planning date through lead + review + safety horizon'],['Budget EUR',settings.budget],['Recommended cost EUR',result.total],['Budget status',result.overBudget?'Over budget: review quantities before buying':'Within budget'],['Source','NOVA demo store in this browser; not live business data'],['Calculation','Calculated by NOVA from saved sales, inventory and supplier settings']].forEach(row=>notes.addRow(row))
   notes.columns=[{width:28},{width:100}]
   const bytes=await workbook.xlsx.writeBuffer()
   const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}))
   const a=document.createElement('a');a.href=url;a.download='nova-shopping-list.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
   setNotice('Excel shopping list downloaded. Awaiting your approval; nothing has been ordered.')
  }catch{setError('Excel export failed. Try again.')}finally{setExporting(false)}
 }
 return <div className="nova-restock">
  <section className="nova-card nova-restock-intro"><div><span className="nova-kicker">MONDAY BUYING REVIEW</span><h2>Buy what you need. Know why.</h2><p>Review product demand, available stock and incoming deliveries. Plan next week’s purchases using your sales history and supplier lead times.</p><small>Sandbox data · Paid + Shipped sales · No orders placed</small></div><details className="nova-sample-data"><summary>Sandbox setup</summary><button className="nova-button" data-testid="restock-demo-stock" onClick={()=>{const stock:Record<string,number>={hoodie:1,tee:2,cargo:1,cap:0,shoes:60};onSave({...data,products:data.products.map(p=>({...p,stock:stock[p.id]??p.stock})),restocking:{settings:{...restockDefaults},suppliers:structuredClone(supplierDefaults)}},'Five-product demo stock loaded. Orders were preserved.')}}>Load sample inventory</button></details></section>
  {error&&<p role="alert">{error}</p>}{!result&&<p role="alert">Saved planning settings are invalid. Correct and save them below.</p>}{notice&&<p className="nova-notice" role="status">{notice}</p>}
  <form onSubmit={save} key={JSON.stringify({items,settings})}>
   <section className="nova-card nova-restock-settings"><header><h2>Planning assumptions</h2><span>Save changes before exporting</span></header><div className="nova-restock-fields">
    {([['start','Sales from'],['end','Sales through'],['asOf','Planning date']] as const).map(([key,label])=><label key={key} htmlFor={'restock-'+key}>{label}<input id={'restock-'+key} name={key} type="date" required defaultValue={settings[key]}/></label>)}
    {([['reviewDays','Review cycle (days)',1],['safetyDays','Safety buffer (days)',0],['budget','Budget (EUR)',0]] as const).map(([key,label,min])=><label key={key} htmlFor={'restock-'+key}>{label}<input id={'restock-'+key} name={key} type="number" min={min} step={key==='budget'?'0.01':'1'} required defaultValue={settings[key]}/></label>)}
   </div></section>
   <section className="nova-card"><header><h2>Inventory & suppliers</h2><span>Edits also update Products</span></header><div className="nova-table-scroll"><table className="nova-restock-table"><thead><tr><th>Product</th><th>Stock</th><th>Supplier</th><th>Cost EUR</th><th>Lead days</th><th>Incoming</th><th>Arrival date</th></tr></thead><tbody>{items.map((p,index)=><tr key={p.id}><td><div className="nova-restock-product"><ProductImage index={index} name={p.name}/><span><strong>{p.name}</strong><small>{p.id}</small></span></div></td>{(['stock','supplier','cost','lead','incoming','eta'] as const).map(field=><td key={field}><input aria-label={p.name+' '+({stock:'stock',supplier:'supplier',cost:'unit cost',lead:'lead days',incoming:'incoming quantity',eta:'incoming date'}[field])} id={`restock-${p.id}-${field}`} name={p.id+'-'+field} type={field==='supplier'?'text':field==='eta'?'date':'number'} min="0" step={field==='cost'?'0.01':'1'} required={field!=='eta'} defaultValue={field==='cost'?p.unitCost:field==='lead'?p.leadDays:field==='eta'?p.incomingDate:p[field]}/></td>)}</tr>)}</tbody></table></div><footer className="nova-restock-actions"><button className="nova-button nova-primary" data-testid="restock-save">Save inventory & recalculate</button></footer></section>
  </form>
  {result&&<><div className="nova-restock-summary"><article><small>Recommended spend</small><strong data-testid="restock-total">{euro(result.total)}</strong><span>{result.overBudget?'Above budget — review required':'Within budget'} · {euro(settings.budget)} limit</span></article><article><small>Units to buy</small><strong>{result.rows.reduce((n,r)=>n+r.buy,0)}</strong><span>Across {result.rows.filter(r=>r.buy>0).length} products</span></article><article><small>Needs attention</small><strong>{result.rows.filter(r=>r.urgent).length}</strong><span>At risk before new stock arrives</span></article></div>
   {result.overBudget&&<p className="nova-restock-warning" role="status">Recommended purchases exceed your budget by {euro(result.total-settings.budget)}. Quantities have not been silently reduced. Review priorities before approval.</p>}
   <section className="nova-card"><header><div><h2>Next week's shopping list</h2><p>Awaiting your approval. No supplier is contacted.</p></div><button className="nova-button nova-primary" data-testid="restock-excel" onClick={()=>void excel()} disabled={exporting}>{exporting?'Preparing Excel…':'Download Excel for approval'}</button></header><div className="nova-table-scroll"><table><thead><tr><th>Product</th><th>Sold / day</th><th>Stock</th><th>Incoming counted</th><th>Buy</th><th>Cost</th><th>Review</th></tr></thead><tbody>{result.rows.map(r=><tr key={r.id} data-testid={'restock-result-'+r.id}><td><strong>{r.name}</strong><details><summary>Why this quantity?</summary><p>{r.explanation}</p><p>{r.warning||'No additional warnings.'}</p></details></td><td>{r.dailyRate.toFixed(2)}<small className="nova-restock-sub">{r.unitsSold} in {r.days} days</small></td><td>{r.stock}</td><td>{r.eligibleIncoming}</td><td data-testid={'restock-buy-'+r.id}><strong>{r.buy}</strong></td><td>{euro(r.cost)}</td><td><span className={'nova-status '+(r.urgent?'cancelled':r.buy?'processing':'paid')}>{r.urgent?'Urgent':r.buy?'Review purchase':'No purchase'}</span></td></tr>)}</tbody></table></div></section>
  </>}
  <section className="nova-card nova-restock-exports"><div><h2>Data exports</h2><p>Export sales transactions and current inventory for reconciliation, purchasing or analysis. Both reports include product IDs and the saved reporting period.</p></div><div className="nova-restock-actions"><button className="nova-button" data-testid="restock-sales-export" onClick={salesExport}>Download sales CSV</button><button className="nova-button" data-testid="restock-inventory-export" onClick={inventoryExport}>Download inventory CSV</button></div></section>
 </div>
}
