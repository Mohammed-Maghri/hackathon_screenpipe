export type Payment = { id: string; company: string; person: string; email: string; amount: number; status: 'Paid' | 'Pending' | 'Overdue'; date: string; plan: string }
export type Member = { id: string; name: string; email: string; company: string; plan: string; status: 'Active' | 'Paused'; joined: string }
export const payments: Payment[] = [
 {id:'INV-2048',company:'Linear Labs',person:'Olivia Chen',email:'olivia@example.test',amount:2400,status:'Paid',date:'2026-10-13',plan:'Enterprise'},
 {id:'INV-2047',company:'Studio North',person:'James Wilson',email:'james@example.test',amount:890,status:'Pending',date:'2026-10-12',plan:'Growth'},
 {id:'INV-2046',company:'Acme Studio',person:'Amelia Brooks',email:'amelia@example.test',amount:1250,status:'Overdue',date:'2026-10-10',plan:'Growth'},
 {id:'INV-2045',company:'Orbit Digital',person:'Noah Williams',email:'noah@example.test',amount:3200,status:'Paid',date:'2026-10-09',plan:'Enterprise'},
 {id:'INV-2044',company:'Fable & Co.',person:'Sophia Martin',email:'sophia@example.test',amount:490,status:'Paid',date:'2026-10-08',plan:'Starter'},
 {id:'INV-2043',company:'Forma Design',person:'Liam Scott',email:'liam@example.test',amount:890,status:'Pending',date:'2026-10-07',plan:'Growth'},
 {id:'INV-2042',company:'Goodkind',person:'Isabella Lee',email:'isabella@example.test',amount:490,status:'Paid',date:'2026-10-06',plan:'Starter'},
 {id:'INV-2041',company:'Monday Works',person:'Ethan Davis',email:'ethan@example.test',amount:1800,status:'Overdue',date:'2026-10-05',plan:'Enterprise'},
]
export const members: Member[] = payments.map((p,i)=>({id:'USR-'+(100+i),name:p.person,email:p.email,company:p.company,plan:p.plan,status:i===5?'Paused':'Active',joined:'2026-09-'+String(10+i).padStart(2,'0')}))
export const money = (value:number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value)
export function downloadCSV(name:string, rows:string[][]) {
 const csv = rows.map(row=>row.map(value=>'"'+value.replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"').join(',')).join('\r\n')
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}))
 const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
