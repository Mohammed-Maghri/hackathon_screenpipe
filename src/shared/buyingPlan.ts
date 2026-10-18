import type {RestockResult} from './novaRestocking'
export interface BuyingPlan {
 budget:number;total:number;unfundedUnits:number
 rows:{id:string;name:string;supplier:string;recommended:number;quantity:number;unitCost:number;cost:number;urgent:boolean;warning:string}[]
}
/** Deterministic priority allocation, not an optimal purchasing solver. Amounts are rounded to cents. */
export function buyingPlan(result:RestockResult,budget:number,quantities?:Record<string,number>):BuyingPlan {
 if(!Number.isFinite(budget)||budget<0||budget>1_000_000_000)throw Error('Budget must be between €0 and €1 billion.')
 if(quantities&&Object.keys(quantities).some(id=>!result.rows.some(row=>row.id===id)))throw Error('Unknown product in buying list.')
 let remaining=Math.round(budget*100)
 const allocations=new Map<string,number>()
 const priority=[...result.rows].sort((a,b)=>Number(b.urgent)-Number(a.urgent)||(a.dailyRate>0?a.stock/a.dailyRate:Infinity)-(b.dailyRate>0?b.stock/b.dailyRate:Infinity)||a.id.localeCompare(b.id))
 for(const row of priority){
  const cents=Math.round(row.unitCost*100)
  const quantity=quantities?quantities[row.id]??row.buy:Math.min(row.buy,cents?Math.max(0,Math.floor(remaining/cents)):row.buy)
  if(!Number.isSafeInteger(quantity)||quantity<0||quantity>1_000_000)throw Error('Quantities must be whole numbers between 0 and 1 million.')
  allocations.set(row.id,quantity);remaining-=quantity*cents
 }
 const rows=result.rows.map(row=>{const quantity=allocations.get(row.id)!,cost=quantity*Math.round(row.unitCost*100)/100;return{id:row.id,name:row.name,supplier:row.supplier,recommended:row.buy,quantity,unitCost:Math.round(row.unitCost*100)/100,cost,urgent:row.urgent,warning:[row.warning,quantity<row.buy?'Below calculated need: '+(row.buy-quantity)+' units remain unfunded.':'',quantity>row.buy?'Manual quantity exceeds calculated need.':''].filter(Boolean).join(' ')}})
 return {budget,total:Math.round(rows.reduce((sum,row)=>sum+row.cost,0)*100)/100,unfundedUnits:rows.reduce((sum,row)=>sum+Math.max(0,row.recommended-row.quantity),0),rows}
}
export function buyingPlanRows(plan:BuyingPlan):(string|number)[][] {
 return [['Product ID','Product','Supplier','Recommended','Proposed quantity','Unit cost EUR','Cost EUR','Urgent','Warnings'],...plan.rows.map(row=>[row.id,row.name,row.supplier,row.recommended,row.quantity,row.unitCost,row.cost,row.urgent?'Yes':'No',row.warning])]
}
export function compareRecommendations(current:RestockResult,previous:RestockResult){
 return [...new Set([...current.rows.map(r=>r.id),...previous.rows.map(r=>r.id)])].map(id=>{const now=current.rows.find(r=>r.id===id),before=previous.rows.find(r=>r.id===id);return{id,name:now?.name??before!.name,previous:before?.buy??null,current:now?.buy??null,delta:now&&before?now.buy-before.buy:null}})
}
