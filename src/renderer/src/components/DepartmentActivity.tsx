import {useState} from 'react'
const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
export function DepartmentActivity({values,name}:{values:number[];name:string}){
 const [active,setActive]=useState<number|null>(null)
 const max=Math.max(1,...values)
 const points=values.map((value,index)=>({x:12+index*46,y:62-value/max*48}))
 const line=points.map(p=>`${p.x},${p.y}`).join(' ')
 return <section className="department-activity" aria-label={`${name} demo weekly automated tasks`}>
 <header><div><strong>This week</strong><span>{active===null?'Automated tasks':`${days[active]} · ${values[active]} tasks`}</span></div><small>Demo data</small></header>
 <div className="department-chart"><svg viewBox="0 0 300 76" preserveAspectRatio="none" aria-hidden="true"><polygon points={`12,72 ${line} 288,72`} fill="currentColor" opacity=".07"/><polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>{active!==null&&<circle cx={points[active].x} cy={points[active].y} r="3.5" fill="currentColor"/>}</svg><div className="department-chart-days">{days.map((day,index)=><button key={day} aria-label={`${day}: ${values[index]} automated tasks, demo data`} onMouseEnter={()=>setActive(index)} onMouseLeave={()=>setActive(null)} onFocus={()=>setActive(index)} onBlur={()=>setActive(null)} onClick={()=>setActive(index)}><span>{day}</span></button>)}</div></div>
 </section>
}
