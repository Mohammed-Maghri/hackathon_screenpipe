// Upgrade only the unchanged original sandbox inventory. Never rewrite real sites or custom stock.
export const novaDemoStock={hoodie:1,tee:2,cargo:1,cap:0,shoes:60} as const
export function migrateNovaDemoInventory(raw:string|null):string|null {
 if(!raw)return null
 const data=JSON.parse(raw)
 const old:Record<string,number>={hoodie:47,tee:126,cargo:18,cap:8,shoes:24}
 if(!Array.isArray(data.products)||!Object.entries(old).every(([id,stock])=>data.products.filter((p:{id:string;stock:number})=>p.id===id&&p.stock===stock).length===1))return null
 return JSON.stringify({...data,products:data.products.map((p:{id:string;stock:number})=>({...p,stock:novaDemoStock[p.id as keyof typeof novaDemoStock]??p.stock}))})
}
