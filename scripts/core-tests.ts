import { browserURL, initialBrowserURL } from '../src/main/browserAddress'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareReplay } from '../src/main/prepareReplay'
import { RecordingStore } from '../src/main/recordingStore'
import { recordedURL } from '../src/shared/recordedURL'
import { buildReplayPlan } from '../src/main/replayPlan'
import type { RecordedEvent } from '../src/shared/recording'
let n=0
const event=(type:string,data:Record<string,unknown>={}):RecordedEvent=>({sequence:++n,type,timestamp:'',elapsedMs:n*10,url:'https://example.com/',data:{target:{selector:'#field',id:'field',tag:'input',label:'Name'},...data}})
assert.ok(recordedURL('https://example.com/callback?code=SECRET&access_token=SECRET').redacted)
assert.ok(!recordedURL('https://example.com/callback?code=SECRET&access_token=SECRET').url.includes('SECRET'))
const submitInput = buildReplayPlan([event('click',{target:{selector:'#submit',id:'submit',tag:'input',role:'button',inputType:'submit'}})]).steps[0]
assert.equal(submitInput.data.requiresApproval,true);assert.equal(submitInput.data.focusOnly,false)
const root=await mkdtemp(join(tmpdir(),'ghost-store-test-'))
try {
for(const type of ['popup-open','drag-move','dblclick','unsupported']) {
  const plan=prepareReplay([event(type),event('click')]);assert.ok(plan.preview.blockers.some(b=>b.includes(type)),type+' blocker lost')
}
const input=event('input',{value:'first'}), last=event('input',{value:'final'})
const plan=prepareReplay([input,last],[{sequence:last.sequence,label:'Name',value:'edited'}]);assert.equal(plan.steps.length,1);assert.equal(plan.steps[0].data.value,'edited');assert.equal(last.data.value,'final')
assert.throws(()=>prepareReplay([input],[{sequence:999,label:'Unknown',value:'bad'}]))
assert.ok(prepareReplay([event('click',{target:{selector:'#react-12345',id:'react-12345',tag:'input'}})]).preview.blockers.length)
assert.ok(prepareReplay([event('click',{pointer:{button:1}})]).preview.blockers.length)
assert.ok(prepareReplay([]).preview.blockers.length)
const navigationOnly = prepareReplay([event('navigation'), event('navigation'), event('page-ready')])
assert.equal(navigationOnly.preview.steps, 2)
assert.equal(navigationOnly.preview.interactions, 0)
assert.equal(navigationOnly.preview.navigations, 2)
assert.ok(navigationOnly.preview.blockers.some(message => message.includes('no clicks, inputs')))
const withClick = prepareReplay([event('navigation'), event('click')])
assert.equal(withClick.preview.interactions, 1)
assert.equal(withClick.preview.navigations, 1)
assert.ok(prepareReplay([event('input',{value:'[REDACTED]'})]).preview.blockers.length)
assert.ok(prepareReplay([event('page-ready',{iframeCount:1}),event('click')]).preview.blockers.some(b=>b.includes('frames')))
assert.deepEqual(prepareReplay([event('page-ready',{iframeCount:3,framePolicy:'guarded-main-frame-v1'}),event('click')]).preview.blockers,[])
const frameReason='An embedded frame was entered during recording.'
assert.ok(prepareReplay([event('page-ready',{iframeCount:1,framePolicy:'guarded-main-frame-v1'}),event('unsupported',{reason:frameReason}),event('click')]).preview.blockers.includes(frameReason))
assert.ok(prepareReplay([event('unsupported',{reason:'This page contains frames; frame-aware capture is not supported.'}),event('click')]).preview.blockers.length)
assert.equal(prepareReplay([event('input',{value:'a',framePath:[{name:'first',url:'https://example.com/frame'}]}),event('input',{value:'b',framePath:[{name:'second',url:'https://example.com/frame'}]})]).steps.length,2)
const click=event('click',{actionId:'cause'}), submit=event('submit',{causedBy:'cause'});
assert.equal(buildReplayPlan([click,submit]).steps.length,1)
assert.ok(buildReplayPlan([event('click'),event('submit')]).preview.blockers.some(b=>b.includes('triggering')))
const checked=event('input',{checked:true});assert.equal(buildReplayPlan([event('click'),checked]).steps[0].type,'input')
const store=new RecordingStore(root,'orders','slack');store.append('input','https://example.com/',{value:'test'})
await store.stop();await writeFile(join(store.directory,'inputs.json'),JSON.stringify([{sequence:1,label:'Name',value:'changed'}]));const exported=JSON.parse(await store.exportJSON());assert.equal(exported.exportVersion,3);assert.equal(exported.inputs[0].value,'changed');assert.equal(exported.events[0].data.value,'test');assert.ok((await readFile(join(store.directory,'events.jsonl'),'utf8')).includes('test'))
console.log('PASS core: original blockers, overrides, empty/sensitive/frame cases, causal submission deduplication, control deduplication, complete persistence/export.')
}finally{await rm(root,{recursive:true,force:true})}

assert.equal(initialBrowserURL('about:blank'), 'about:blank')
assert.equal(initialBrowserURL('http://127.0.0.1:3100/finance'), 'http://127.0.0.1:3100/finance')
for (const url of ['about:blank', 'file:///tmp/test', 'javascript:alert(1)', 'data:text/html,test', 'https://user:secret@example.com']) {
  assert.throws(() => browserURL(url))
  if (url !== 'about:blank') assert.throws(() => initialBrowserURL(url))
}

const edit = event('edit-shortcut', { target: { tag: 'input', testId: 'name', selector: '#name', role: 'textbox' }, key: 'v' })
const edited = event('input', { target: { tag: 'input', testId: 'name', selector: '#name', role: 'textbox' }, value: 'Pasted text' })
assert.equal(prepareReplay([edit, edited]).preview.blockers.length, 0)
assert.ok(prepareReplay([edit]).preview.blockers.some(value => value.includes('shortcut')))
const downloadClick = event('click', { actionId: 'download-action', target: { tag: 'button', testId: 'export', selector: '#export', accessibleName: 'Export' } })
const downloadStart = event('download-start', { downloadId: 'file-1', causedBy: 'download-action', filename: 'report.csv', mimeType: 'text/csv' })
const downloadDone = event('download-done', { downloadId: 'file-1', state: 'completed' })
const downloadPlan = prepareReplay([downloadClick, downloadStart, downloadDone])
assert.deepEqual(downloadPlan.preview.blockers, [])
assert.deepEqual(downloadPlan.steps[0].data.expectedDownloads, [{ filename: 'report.csv', mimeType: 'text/csv' }])
assert.ok(prepareReplay([downloadClick, downloadStart]).preview.blockers.some(value => value.includes('download')))
assert.ok(prepareReplay([downloadStart, downloadDone]).preview.blockers.some(value => value.includes('download')))
assert.ok(prepareReplay([event('unsupported', { reason: 'Downloads are disabled and cannot be verified.' })]).preview.blockers.includes('Downloads are disabled and cannot be verified.'))

// Saved credentials are separately scoped and never exposed through summaries.
const { LoginVault, validateLogin } = await import('../src/main/loginVault')
const vaultRoot = await mkdtemp(join(tmpdir(), 'ghost-login-test-'))
const config = { loginURL: 'https://example.test/login', successURL: 'https://example.test/dashboard', username: 'demo', password: 'test-secret', remember: false }
const unavailable = { available: () => false, encrypt: () => { throw Error('unavailable') }, decrypt: () => { throw Error('unavailable') } }
try {
 const vault = new LoginVault(vaultRoot, unavailable)
 await vault.save('node-a', config)
 assert.equal((await vault.get('node-a'))?.password, config.password)
 assert.equal(await vault.get('node-b'), null)
 assert.ok(!JSON.stringify(await vault.summary('node-a')).includes(config.password))
 assert.equal(await new LoginVault(vaultRoot, unavailable).get('node-a'), null)
 await assert.rejects(vault.save('node-a', { ...config, remember: true }), /keyring/)
 assert.throws(() => validateLogin({ ...config, successURL: 'https://other.test/dashboard' }), /same website/)
 assert.throws(() => validateLogin({ ...config, loginURL: 'http://example.test/login', successURL: 'http://example.test/dashboard' }), /HTTPS/)
 await vault.remove('node-a')
 assert.equal(await vault.get('node-a'), null)
 console.log('PASS saved-login: scope isolation, session-only storage, secret-free summary, secure-storage requirement, origin validation and removal')
} finally { await rm(vaultRoot, { recursive: true, force: true }) }

const { RecordingSecrets } = await import('../src/main/recordingSecrets')
const secretRoot = await mkdtemp(join(tmpdir(), 'ghost-encrypted-input-'))
try {
 const secrets = new RecordingSecrets(secretRoot)
 const encrypted = secrets.encrypt('demo-password-123', 'recording:https://example.test/login')
 assert.ok(!JSON.stringify(encrypted).includes('demo-password-123'))
 assert.equal(new RecordingSecrets(secretRoot).decrypt(encrypted, 'recording:https://example.test/login'), 'demo-password-123')
 assert.throws(() => secrets.decrypt(encrypted, 'recording:https://wrong.test/login'), /decrypt/)
 assert.throws(() => secrets.decrypt({ ...encrypted, data: Buffer.from('tampered').toString('base64') }, 'recording:https://example.test/login'), /decrypt/)
 const recording = new RecordingStore(secretRoot, 'workflow', 'node')
 const captured = recording.append('input', 'https://example.test/login', { target: { selector: '#password', tag: 'input', id: 'password', inputType: 'password', credential: true, redacted: true }, secretValue: 'demo-password-123', value: '[REDACTED]' })!
 await recording.stop()
 assert.equal(recording.decryptInput(captured), 'demo-password-123')
 assert.ok(!(await recording.exportJSON()).includes('demo-password-123'))
 assert.ok(!JSON.stringify(captured).includes('secretValue'))
 assert.deepEqual(prepareReplay([captured]).preview.blockers, [])
 console.log('PASS encrypted inputs: restart decryption, authenticated ciphertext, origin binding, sanitized events/export, replay planning')
} finally { await rm(secretRoot, { recursive: true, force: true }) }

// Native select completion may carry button=-1. Validate the final selected
// value rather than blocking a click that the planner already deduplicates.
const statusTarget = { selector: '#status', id: 'status', tag: 'select', role: 'combobox', label: 'Status' }
const selection = event('input', { target: statusTarget, value: 'paid', selectedValues: ['paid'] })
const completion = event('click', { target: statusTarget, pointer: { button: -1, buttons: 0 } })
const selectPlan = prepareReplay([selection, completion])
assert.deepEqual(selectPlan.preview.blockers, [])
assert.deepEqual(selectPlan.steps.map(step => step.type), ['input'])
assert.deepEqual(selectPlan.steps[0].data.selectedValues, ['paid'])
assert.equal(completion.data.pointer && (completion.data.pointer as { button: number }).button, -1)
assert.deepEqual(prepareReplay([event('click', { pointer: { button: -1 } })]).preview.blockers, [])
assert.deepEqual(prepareReplay([event('click', { pointer: { button: -1, buttons: 0 } })]).preview.blockers, [])
for (const pointer of [{ button: 1 }, { button: 2 }, { button: -1, buttons: 2 }, { button: -1, modifiers: { ctrl: true } }, { button: -2 }]) {
 assert.ok(prepareReplay([event('click', { pointer })]).preview.blockers.length, JSON.stringify(pointer))
}
console.log('PASS click activation: native select completion, legacy -1 events, secondary/modified clicks still blocked')

const secretInput = event('input', { target: { selector: '#password', id: 'password', credential: true, redacted: true }, value: '[ENCRYPTED]', encryptedValue: { version: 1, data: 'ciphertext' } })
const secretPreview = prepareReplay([secretInput]).preview.inputs[0]
assert.equal(secretPreview.secret, true)
assert.equal(secretPreview.saved, true)
assert.equal(secretPreview.value, '')
assert.deepEqual(prepareReplay([secretInput], [{ ...secretPreview, value: '' }]).steps[0].data.encryptedValue, secretInput.data.encryptedValue)
assert.throws(() => prepareReplay([secretInput], [{ ...secretPreview, value: 'plaintext-password' }]), /encrypted/)
const replacement = { version: 1, data: 'replacement-ciphertext' }
assert.deepEqual(prepareReplay([secretInput], [{ ...secretPreview, encryptedValue: replacement }]).steps[0].data.encryptedValue, replacement)
assert.equal(prepareReplay([secretInput], [{ ...secretPreview, encryptedValue: replacement }]).preview.inputs[0].value, '')
console.log('PASS password editor: visible saved state, blank preserves secret, encrypted replacements, plaintext rejected')

const blankFormClick = event('click', { actionId: 'blank-form', target: { selector: 'main > form', tag: 'form', role: '', text: '' }, pointer: { button: 0 } })
const fieldFocus = event('click', { target: { selector: '#email', id: 'email', tag: 'input', inputType: 'email' } })
const backgroundPlan = prepareReplay([blankFormClick, fieldFocus])
assert.deepEqual(backgroundPlan.preview.blockers, [])
assert.equal(backgroundPlan.steps.length, 2)
assert.equal(backgroundPlan.steps[0].sequence, blankFormClick.sequence)
assert.deepEqual(backgroundPlan.preview.notes, [])
assert.equal(prepareReplay([blankFormClick]).steps.length, 1)
assert.equal(prepareReplay([blankFormClick, event('action-outcome', { actionId: 'blank-form', evidence: [] }), fieldFocus]).steps.length, 2)
assert.equal(prepareReplay([blankFormClick, event('submit', { causedBy: 'blank-form' }), fieldFocus]).steps.length, 2)
console.log('PASS background clicks: all background actions retained; no missing-evidence omission')

const containerClick = event('click', { actionId: 'background-div', target: { tag: 'div', selector: 'main > section > div:nth-of-type(2)', context: { name: 'Transactions' } } })
const filterChange = event('input', { target: statusTarget, value: 'paid', selectedValues: ['paid'] })
assert.deepEqual(prepareReplay([containerClick, filterChange]).preview.blockers, [])
assert.equal(prepareReplay([containerClick, filterChange]).steps.length, 2)
const unnamed = event('click', { target: { tag: 'button', selector: 'main > button' } })
assert.deepEqual(prepareReplay([unnamed]).preview.blockers, [])
assert.equal(prepareReplay([unnamed]).steps.length, 1)
console.log('PASS unnamed targets: container before filter retained; structural button retained for live validation')
const selectHome = event('keydown', { target: statusTarget, key: 'Home' })
const selectArrow = event('keydown', { target: statusTarget, key: 'ArrowDown' })
const selectEnter = event('keydown', { target: statusTarget, key: 'Enter' })
const selectMenu = event('contextmenu', { target: statusTarget, actionId: 'select-menu' })
const dropdownPlan = prepareReplay([selectMenu, selectHome, selectArrow, selection, selectEnter])
assert.deepEqual(dropdownPlan.preview.blockers, [])
assert.deepEqual(dropdownPlan.steps.map(step => step.type), ['input'])
assert.ok(prepareReplay([selectMenu]).preview.blockers.length)
assert.ok(prepareReplay([event('contextmenu', { target: { tag: 'button', id: 'export', selector: '#export' } }), selection]).preview.blockers.length)
assert.equal(prepareReplay([selectHome]).steps.length, 1)
console.log('PASS dropdown workflow: context gesture and navigation keys consolidated into verified selection')

const emailField = { tag: 'input', selector: '#login-email', id: 'login-email', inputType: 'email' }
const passwordField = { tag: 'input', selector: '#login-password', id: 'login-password', inputType: 'password', credential: true, redacted: true }
const tab = event('keydown', { target: emailField, key: 'Tab' })
const password = event('input', { target: passwordField, value: '[ENCRYPTED]', encryptedValue: { version: 1, data: 'ciphertext' } })
const filler = event('click', { actionId: 'layout-blank', target: { tag: 'div', selector: 'main > section > div', text: '', role: '' } })
const manualLogin = prepareReplay([tab, password, filler, { ...filler, sequence: ++n, data: { ...filler.data, actionId: 'layout-blank-2' } }, event('click', { target: { tag: 'button', id: 'login-submit', selector: '#login-submit' } })])
assert.deepEqual(manualLogin.preview.blockers, [])
assert.deepEqual(manualLogin.steps.map(step => step.type), ['keydown', 'input', 'click', 'click', 'click'])
assert.equal(manualLogin.steps[0].data.key, 'Tab')
assert.equal(manualLogin.preview.inputs[0].saved, true)
console.log('PASS manual login planning: Tab preserved, encrypted password present, repeated background clicks retained for verification')

assert.deepEqual(manualLogin.steps[0].data.focusTarget, passwordField)

// Checkpoints are atomic snapshots bound to exactly the plan and recording.
const checkpointRoot = await mkdtemp(join(tmpdir(), 'ghost-checkpoint-'))
try {
 const recording = new RecordingStore(checkpointRoot, 'checkpoint-workflow', 'node')
 await recording.flush()
 const planSteps = [event('navigation')]
 const hash = recording.planHash(planSteps)
 const first = { state: 'running' as const, completed: 0, total: 1, sequence: 1, action: 'navigation', error: null, currentActionIndex: 0, lastVerifiedCheckpoint: -1 }
 const latest = { ...first, state: 'failed' as const, failureCode: 'TARGET_NOT_FOUND' as const }
 await Promise.all([recording.saveReplay(first, hash), recording.saveReplay(latest, hash)])
 const saved = await recording.loadReplay(hash)
 assert.equal(saved.state, 'failed')
 assert.equal(saved.workflowId, 'checkpoint-workflow')
 assert.equal(saved.recordingId, recording.id)
 await assert.rejects(recording.loadReplay(recording.planHash([...planSteps, event('click')])), /changed/)
 console.log('PASS checkpoints: ordered persistence, workflow/recording identity, changed-plan rejection')
} finally { await rm(checkpointRoot, { recursive: true, force: true }) }
const { failureCode, diagnosticTarget } = await import('../src/main/replayDiagnostics')
assert.equal(failureCode(new Error('Ambiguous target')), 'TARGET_AMBIGUOUS')
assert.equal(failureCode(new Error('Expected frame is missing')), 'TARGET_NOT_FOUND')
assert.equal(failureCode(new Error('Unsupported action')), 'ACTION_UNSUPPORTED')
assert.ok(!JSON.stringify(diagnosticTarget({ selector: '#password', credential: true, accessibleName: 'TEST-SECRET', text: 'TEST-SECRET', label: 'TEST-SECRET' })).includes('TEST-SECRET'))

const repeated = event('input', {value:'Original'}), duplicate = event('input', {value:'Original'})
const overridePlan = prepareReplay([repeated,event('scroll',{scrollTop:10}),duplicate], [{sequence:repeated.sequence,label:'Name',value:'Edited'},{sequence:duplicate.sequence,label:'Name',value:'Original'}])
assert.ok(overridePlan.steps.filter(step=>step.type==='input').every(step=>step.data.value==='Edited'))
assert.equal(duplicate.data.value,'Original')
console.log('PASS duplicate input overrides: scrolling does not restore the original value')

const changingA=event('input',{value:'Original',target:{tag:'input',label:'Report',selector:'#react-12345'}})
const changingB=event('input',{value:'Original',target:{tag:'input',label:'Report',selector:'#react-67890'}})
assert.ok(prepareReplay([changingA,event('scroll'),changingB],[{sequence:changingA.sequence,label:'Report',value:'Edited'}]).steps.filter(e=>e.type==='input').every(e=>e.data.value==='Edited'))

const savedRoot=await mkdtemp(join(tmpdir(),'ghost-saved-step-'))
try {
 const original=new RecordingStore(savedRoot,'workflow-reuse','login')
 original.append('input','https://example.com/login',{target:{tag:'input',selector:'#password',credential:true},secretValue:'restore-test-secret'})
 await original.stop(true)
 await writeFile(join(original.directory,'inputs.json'),JSON.stringify([{sequence:1,label:'Password',value:'',secret:true,saved:true}]))
 const restored=await RecordingStore.restore(savedRoot,'workflow-reuse','login')
 assert.ok(restored);assert.equal(restored.id,original.id);assert.equal(restored.state,'stopped')
 const exported=JSON.parse(await restored.exportJSON());assert.equal(exported.inputs.length,1)
 assert.equal(restored.decryptInput(exported.events[0]),'restore-test-secret')
 assert.ok(!JSON.stringify(exported).includes('restore-test-secret'))
 assert.equal(await RecordingStore.restore(savedRoot,'other','login'),null)
 const empty=new RecordingStore(savedRoot,'workflow-reuse','login');await empty.stop(true)
 assert.equal((await RecordingStore.restore(savedRoot,'workflow-reuse','login'))?.id,original.id)
 console.log('PASS saved steps: restore same recording, encrypted credentials and overrides; workflow isolation; empty recording preserves saved version')
} finally { await rm(savedRoot,{recursive:true,force:true}) }
