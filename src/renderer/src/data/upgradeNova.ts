import type {SavedWorkflowDetail} from '../../../shared/discovery'
import {demoWorkflow} from './demoDiscovery'
/** Upgrade only the original prepared five-node NOVA template; custom graphs stay untouched. */
export function upgradeNova(workflow:SavedWorkflowDetail):SavedWorkflowDetail|null {
 const rename=workflow.nodes.some(node=>node.config.novaOperation==='calculate'&&node.label==='Calculate the buying list')
 if(rename)return {...workflow,nodes:workflow.nodes.map(node=>node.config.novaOperation==='calculate'&&node.label==='Calculate the buying list'?{...node,label:'Parse buying list to readable JSON',config:{...node.config,description:'Convert browser CSV and Excel exports to readable JSON on this computer, then calculate the buying recommendation.'}}:node),updatedAt:new Date().toISOString()}
 const nodes=[...workflow.nodes].sort((a,b)=>Number(a.config.order)-Number(b.config.order))
 if(nodes.length!==5||nodes.some(n=>n.config.source!=='demo'||n.config.demoScenario!=='nova'||n.config.novaOperation)||nodes.map(n=>n.config.stepType).join(',')!=='application,browser,application,review,integration')return null
 if(workflow.edges.length!==4||nodes.slice(1).some((n,i)=>!workflow.edges.some(e=>e.sourceNodeId===nodes[i].id&&e.targetNodeId===n.id)))return null
 if(nodes[1].config.startUrl!=='https://hackathon-screenpipe.vercel.app/nova/restocking')return null
 const next=demoWorkflow('nova',String(nodes[0].config.originalPrompt??workflow.description??workflow.name))
 const previous=[nodes[0],nodes[1],nodes[2],undefined,nodes[4],nodes[3]]
 const upgraded=next.nodes!.map((node,i)=>({...node,id:previous[i]?.id??node.id,...(i===1?{config:{...nodes[1].config,novaOperation:'browser',order:1}}:{})}))
 return {...workflow,description:next.description,nodes:upgraded,edges:upgraded.slice(1).map((n,i)=>({id:crypto.randomUUID(),sourceNodeId:upgraded[i].id,targetNodeId:n.id})),updatedAt:new Date().toISOString()}
}
