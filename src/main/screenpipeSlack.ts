export type SlackReceipt={channel:string;workspace:string;ts:string}
// User-selected destination, resolved through Screenpipe's conversations API.
export const ghostSlackDestination={workspace:'T0C9MCC8BE3',channel:'C0CA6EHDX7W',name:'daily-reports'}
export async function postNovaReport(text:string,signal:AbortSignal,dispatch:()=>Promise<void>,request:typeof fetch=fetch):Promise<SlackReceipt>{
 const base=new URL(process.env.SCREENPIPE_LOCAL_API_URL??'http://localhost:3030')
 if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname)||!['http:','https:'].includes(base.protocol)||base.username||base.password)throw Error('Use a local Screenpipe API address.')
 const key=process.env.SCREENPIPE_LOCAL_API_KEY
 if(!key)throw Error('Configure SCREENPIPE_LOCAL_API_KEY to send the report through Screenpipe.')
 if(!text.trim()||text.length>35000)throw Error('Report message is empty or too long.')
 const headers={Authorization:`Bearer ${key}`,'Content-Type':'application/json','X-Screenpipe-Client':'api','X-Screenpipe-Agent':'ghost'}
 const {workspace,channel,name}=ghostSlackDestination
 const get=await request(new URL(`/connections/slack/conversations?instance=${workspace}`,base),{headers,redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])})
 if(!get.ok)throw Error('Screenpipe could not verify the Slack destination. Check its Slack connection.')
 const listing=await get.json()
 if(!listing.ok||!Array.isArray(listing.channels)||!listing.channels.some((c:{id:string;name:string;context_team_id:string;is_archived:boolean})=>c.id===channel&&c.name===name&&c.context_team_id===workspace&&!c.is_archived))throw Error('GHOST LLC #daily-reports was not found. No message sent.')
 signal.throwIfAborted()
 await dispatch() // Durable intent before sending; never retry an uncertain POST.
 const response=await request(new URL('/connections/slack/send',base),{method:'POST',headers,redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),body:JSON.stringify({instance:workspace,channel,text})})
 if(!response.ok)throw Error('Slack delivery was not confirmed. Check the channel before sending again.')
 const receipt=await response.json()
 if(receipt.ok!==true||receipt.channel!==channel||typeof receipt.ts!=='string'||!/^\d+\.\d+$/.test(receipt.ts))throw Error('Screenpipe did not return a verified Slack message receipt. Check the channel; do not retry automatically.')
 return {workspace,channel,ts:receipt.ts}
}
