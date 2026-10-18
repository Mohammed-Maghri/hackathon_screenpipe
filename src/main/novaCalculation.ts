import {parse} from 'csv-parse/sync'
import {recommendRestock,type StockItem,type Sale,type RestockSettings} from '../shared/novaRestocking'
export function calculateNova(salesCSV:string,inventoryCSV:string){
 function rows(csv:string,required:string[]){
  const header=parse(csv,{to_line:1,bom:true})[0] as string[]|undefined
  if(!header||required.some(key=>!header.includes(key)))throw Error('Export columns do not match the NOVA schema.')
  const rows=parse(csv,{columns:true,bom:true,skip_empty_lines:true,max_record_size:20000}) as Record<string,string>[]
  if(rows.length>10000)throw Error('Export exceeds 10000 rows.');return rows
 }
 const inventory=rows(inventoryCSV,['Product ID','Product','Stock','Supplier','Unit cost EUR','Lead days','Incoming quantity','Incoming ETA','Planning date','Review days','Safety days','Budget EUR','Window start','Window end'])
 if(!inventory.length)throw Error('Inventory export is empty.')
 const number=(row:Record<string,string>,key:string)=>{if(!row[key]?.trim()||!Number.isFinite(Number(row[key])))throw Error('Invalid numeric export column: '+key);return Number(row[key])}
 const first=inventory[0]
 const settingKeys=['Planning date','Review days','Safety days','Budget EUR','Window start','Window end']
 if(inventory.some(row=>settingKeys.some(key=>row[key]!==first[key])))throw Error('Inventory rows contain inconsistent planning assumptions.')
 const settings:RestockSettings={start:first['Window start'],end:first['Window end'],asOf:first['Planning date'],reviewDays:number(first,'Review days'),safetyDays:number(first,'Safety days'),budget:number(first,'Budget EUR')}
 const items:StockItem[]=inventory.map(row=>{if(!row['Product ID']||!row.Product||!row.Supplier)throw Error('Inventory identity or supplier missing.');return{id:row['Product ID'],name:row.Product,stock:number(row,'Stock'),unitCost:number(row,'Unit cost EUR'),supplier:row.Supplier,leadDays:number(row,'Lead days'),incoming:number(row,'Incoming quantity'),incomingDate:row['Incoming ETA']}})
 const sales:Sale[]=rows(salesCSV,['Order ID','Product ID','Date','Quantity','Status','Window start','Window end']).map(row=>{if(row['Window start']!==settings.start||row['Window end']!==settings.end)throw Error('Sales and inventory reporting periods differ.');if(!row['Order ID']||!items.some(item=>item.id===row['Product ID']))throw Error('Sales contain an unknown product or missing order ID.');return{id:row['Order ID'],productId:row['Product ID'],date:row.Date,quantity:number(row,'Quantity'),status:row.Status}})
 return {settings,result:recommendRestock(items,sales,settings)}
}
