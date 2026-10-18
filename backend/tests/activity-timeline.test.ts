import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createActivityTimeline } from '../../src/main/activityTimeline.js'
import { localDayRange } from '../../src/shared/activityTimeline.js'
import { discoveryInputSchema } from '../src/contracts/screenpipeDiscovery.js'
import { discoveryRequestHash } from '../src/modules/discovery/discovery.screenpipe.js'
const range = { startTime: '2026-10-10T00:00:00.000Z', endTime: '2026-10-11T00:00:00.000Z' }
const now = () => Date.parse('2026-10-17T12:00:00Z')
function summary(url: URL, minutes = 5) { return { time_range: { start: url.searchParams.get('start_time'), end: url.searchParams.get('end_time') }, total_active_minutes: minutes, data_status: 'ok', apps: [{ name: 'Chrome', minutes }], audio_summary: { top_transcriptions: ['PRIVATE'] }, key_texts: ['PRIVATE'] } }
test('timeline uses bounded authenticated summaries, strips content, caches and deduplicates requests', async () => {
 let calls = 0, active = 0, maximum = 0
 const fetcher: typeof fetch = async (raw, init) => { calls++; active++; maximum=Math.max(maximum,active); await new Promise(r=>setTimeout(r,1)); active--; const url = new URL(String(raw)); assert.equal(url.pathname,'/activity-summary'); assert.equal(url.searchParams.get('include_key_texts'),'false'); assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer test-token'); return Response.json(summary(url)) }
 const load=createActivityTimeline({key:'test-token',fetch:fetcher,now})
 const [a,b]=await Promise.all([load(range),load(range)])
 assert.deepEqual(a,b); assert.equal(calls,25); assert.ok(maximum<=3); assert.ok(a.ok)
 if(a.ok){assert.equal(a.buckets.length,24);assert.equal(a.buckets[0].minutes,5);assert.equal(a.buckets[0].apps[0].name,'Chrome')}
 assert.ok(!JSON.stringify(a).includes('PRIVATE')); await load(range); assert.equal(calls,25)
})
test('zero measured activity does not invent time from frames or audio',async()=>{
 let calls=0
 const load=createActivityTimeline({key:'test',now,fetch:async raw=>{calls++;return Response.json({...summary(new URL(String(raw)),0),total_frames:5000})}})
 const r=await load(range);assert.ok(r.ok);if(r.ok)assert.equal(r.buckets.reduce((s,b)=>s+b.minutes,0),0);assert.equal(calls,1)
})
test('errors are actionable and never expose remote bodies or secrets',async()=>{
 for(const [status,code] of [[401,'authentication'],[403,'authentication'],[404,'unsupported'],[500,'failed']] as const){ const r=await createActivityTimeline({key:'test',now,fetch:async()=>new Response('PRIVATE',{status})})(range);assert.equal(r.ok,false);if(!r.ok)assert.equal(r.code,code);assert.ok(!JSON.stringify(r).includes('PRIVATE')) }
 const r=await createActivityTimeline({key:'test',now,fetch:async()=>{throw Error('PRIVATE')}})(range);assert.ok(!r.ok && r.code==='disconnected')
})
test('mismatched summaries and partial failures do not produce successful charts',async()=>{
 const r=await createActivityTimeline({key:'test',now,fetch:async raw=>Response.json({...summary(new URL(String(raw))),time_range:{start:'2026-10-09T00:00:00Z',end:range.endTime}})})(range);assert.equal(r.ok,false)
 let calls=0; const partial=await createActivityTimeline({key:'test',now,fetch:async raw=>++calls>2?new Response('',{status:500}):Response.json(summary(new URL(String(raw))))})(range);assert.equal(partial.ok,false)
})
test('invalid ranges and remote base URLs never fetch',async()=>{
 let calls=0;const fetcher:typeof fetch=async()=>{calls++;throw Error()}
 const load=createActivityTimeline({key:'test',now,fetch:fetcher})
 assert.equal((await load({...range,endTime:range.startTime})).ok,false)
 assert.equal((await load({...range,endTime:'2026-11-01T00:00:00Z'})).ok,false)
 assert.equal((await createActivityTimeline({key:'test',url:'https://example.com',fetch:fetcher})(range)).ok,false);assert.equal(calls,0)
})
test('calendar bounds honor local DST days',()=>{
 const old=process.env.TZ;process.env.TZ='Europe/Paris'
 try { for(const [day,hours] of [['2026-03-29T12:00:00',23],['2026-10-25T12:00:00',25]] as const){const r=localDayRange(new Date(day));assert.equal((Date.parse(r.endTime)-Date.parse(r.startTime))/3600000,hours)} }finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old}
})
test('exact discovery selection validates and participates in request identity',()=>{
 const input={prompt:' Keep my original prompt ',timeRange:'Last 7 days',requestId:'40000000-0000-4000-8000-000000000000',selectedRange:range}
 assert.equal(discoveryInputSchema.parse(input).prompt,input.prompt)
 assert.equal(discoveryInputSchema.safeParse({...input,selectedRange:{...range,endTime:range.startTime}}).success,false)
 assert.notEqual(discoveryRequestHash(input.prompt,input.timeRange,range),discoveryRequestHash(input.prompt,input.timeRange))
})

test('today uses whole-second request bounds compatible with Screenpipe timestamp precision',async()=>{
 const r=await createActivityTimeline({key:'test',now:()=>Date.parse('2026-10-10T12:34:56.789Z'),fetch:async raw=>{const url=new URL(String(raw));assert.equal(url.searchParams.get('end_time'),'2026-10-10T12:34:56.000Z');return Response.json({...summary(url,0),data_status:'unknown'})}})(range)
 assert.ok(r.ok);if(r.ok)assert.equal(r.buckets.at(-1)?.endTime,'2026-10-10T12:34:56.000Z')
})

test('recent two-hour windows use 24 authoritative five-minute buckets ending now',async()=>{
 const recent={startTime:'2026-10-17T10:00:00.000Z',endTime:'2026-10-17T12:00:00.000Z'}
 let calls=0
 const result=await createActivityTimeline({key:'test',now,fetch:async raw=>{calls++;return Response.json(summary(new URL(String(raw)),2))}})(recent)
 assert.ok(result.ok)
 if(result.ok){
  assert.equal(result.buckets.length,24)
  assert.equal(result.buckets[0].startTime,recent.startTime)
  assert.equal(result.buckets.at(-1)?.endTime,recent.endTime)
  for(const bucket of result.buckets){assert.equal(Date.parse(bucket.endTime)-Date.parse(bucket.startTime),300000);assert.equal(bucket.minutes,2)}
 }
 assert.equal(calls,25)
})
