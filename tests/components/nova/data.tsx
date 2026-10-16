export type Product = { id:string; name:string; price:number; stock:number; image:number; sold:number }
export type Order = { id:string; customer:string; email:string; country:string; productId:string; quantity:number; unitPrice:number; status:'Paid'|'Processing'|'Shipped'|'Cancelled'; date:string; channel:'Online Store'|'Point of Sale'; notes:string }
export type Campaign = { id:string; name:string; audience:string; status:'Draft'|'Scheduled'; date:string }
export type NovaData = { products:Product[]; orders:Order[]; campaigns:Campaign[]; discounts:{code:string; percent:number}[]; storeName:string; notices:string[] }
export const seedProducts:Product[] = [
 {id:'hoodie',name:'Oversized Hoodie – Black',price:89,stock:47,image:0,sold:342},
 {id:'tee',name:'Essential T-Shirt – White',price:24.99,stock:126,image:1,sold:281},
 {id:'cargo',name:'Cargo Pants – Beige',price:46,stock:18,image:2,sold:198},
 {id:'cap',name:'Cap – Nova Logo',price:39,stock:8,image:3,sold:156},
 {id:'shoes',name:'Running Shoes – Grey',price:60,stock:24,image:4,sold:142},
 {id:'tote',name:'Everyday Tote – Sand',price:39.5,stock:6,image:5,sold:87},
]
const names=['Sophie Laurent','Yassine El Amrani','Emma Dubois','Lucas Martin','Chloé Bernard','Mehdi Rahimi','Inès Moreau','Alex Turner','Nora Wilson','Adam Benali','Léa Petit','Thomas Roy']
export const seedData:NovaData={products:seedProducts, orders:Array.from({length:48},(_,i)=>({id:String(10458-i),customer:names[i%names.length],email:`${names[i%names.length].split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}@example.test`,country:['France','Morocco','France','United States','Canada'][i%5],productId:seedProducts[i%6].id,quantity:1+i%3,unitPrice:seedProducts[i%6].price,status:(['Paid','Paid','Processing','Shipped','Paid','Cancelled','Shipped'] as const)[i%7],date:`2026-10-${String(15-Math.floor(i/6)).padStart(2,'0')}`,channel:i%4===0?'Point of Sale':'Online Store',notes:''})),campaigns:[{id:'welcome',name:'Welcome to NOVA',audience:'All customers',status:'Draft',date:'2026-10-15'}],discounts:[{code:'WELCOME10',percent:10}],storeName:'NOVA',notices:[]}
export const euro=(value:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(value)
export const total=(order:Order,products:Product[])=>Math.round((order.unitPrice??products.find(p=>p.id===order.productId)?.price??0)*order.quantity*100)/100
export function ProductImage({index,name}:{index:number;name:string}) {return <span role="img" aria-label={name} className="nova-product-image" style={{backgroundPosition:`${(index%3)*50}% ${Math.floor(index/3)*100}%`}}/>}
