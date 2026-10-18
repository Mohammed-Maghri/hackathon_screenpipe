import type { WebContents, BrowserWindow } from 'electron'
import type { SavedLogin } from './loginVault'
// Runs only in an isolated world for an explicitly configured, same-origin login.
// Never returns field values or takes a password as a JavaScript argument.
export function loginPageOperation(operation: 'inspect'|'username'|'password'|'submit', origin:string) {
 if(location.origin!==origin)throw new Error('Login redirected to another website. Automatic sign-in stopped.')
 const visible=(el:Element)=>{const r=el.getBoundingClientRect();const s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'}
 if([...document.querySelectorAll('input[autocomplete=one-time-code],input[name*=otp],iframe[src*=captcha]')].some(visible))throw new Error('Verification code or CAPTCHA requires manual completion.')
 const passwords=[...document.querySelectorAll<HTMLInputElement>('input[type=password]')].filter(visible)
 if(operation==='inspect')return {passwords:passwords.length}
 if(passwords.length!==1)throw new Error('Expected exactly one visible password field.')
 const password=passwords[0], form=password.form
 if(!form)throw new Error('Automatic login currently requires a standard sign-in form.')
 if(new URL(form.action || location.href,location.href).origin!==origin)throw new Error('Sign-in form submits to another website.')
 const users=[...form.querySelectorAll<HTMLInputElement>('input')].filter(el=>visible(el)&&!el.disabled&&['text','email',''].includes(el.type))
 if(users.length!==1)throw new Error('The username field is missing or ambiguous.')
 if(operation==='submit'){
  const buttons=[...form.querySelectorAll<HTMLButtonElement|HTMLInputElement>('button,input[type=submit]')].filter(el=>visible(el)&&!el.disabled&&el.type==='submit')
  if(buttons.length!==1)throw new Error('The sign-in submit button is missing or ambiguous.')
  const button=buttons[0];button.scrollIntoView({block:'center'});const r=button.getBoundingClientRect();if(!button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)))throw new Error('The sign-in button is covered.')
  return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}
 }
 const input=operation==='username'?users[0]:password
 if(input.disabled||input.readOnly)throw new Error('Sign-in field is unavailable.')
 input.focus();input.select();if(document.activeElement!==input)throw new Error('Unable to focus sign-in field.')
 return {focused:true}
}
export async function signInWithSavedLogin(contents:WebContents, owner:BrowserWindow, login:SavedLogin, signal:AbortSignal, options: {demo?: boolean; progress?: (action: string) => Promise<void>} = {}){
 const origin=new URL(login.loginURL).origin
 const check=()=>{if(signal.aborted||contents.isDestroyed()||owner.isDestroyed())throw new Error('Sign-in cancelled.')}
 async function bounded<T>(promise:Promise<T>, timeout=20000):Promise<T>{let timer:ReturnType<typeof setInterval>|undefined;try{return await Promise.race([promise,new Promise<never>((_,reject)=>{const start=Date.now();timer=setInterval(()=>{try{check();if(Date.now()-start>timeout)reject(new Error('Sign-in timed out. Check the page; no automatic retry was attempted.'))}catch(error){reject(error)}},50)})])}finally{clearInterval(timer)}}
 const page=(op:'inspect'|'username'|'password'|'submit')=>bounded(contents.executeJavaScriptInIsolatedWorld(1003,[{code:`(${loginPageOperation.toString()})(${JSON.stringify(op)},${JSON.stringify(origin)})`}] ))
 let attached=false
 try{
  check();await options.progress?.('Opening login page');await bounded(contents.loadURL(login.loginURL))
  if(contents.getURL()===login.successURL && (await page('inspect')).passwords===0)return
  const started=Date.now();while((await page('inspect')).passwords===0){check();if(contents.getURL()===login.successURL)return;if(Date.now()-started>10000)throw new Error('No supported login form appeared.');await new Promise(r=>setTimeout(r,50))}
  if(contents.debugger.isAttached())throw new Error('Close developer tools before automatic sign-in.')
  contents.debugger.attach('1.3');attached=true;owner.focus();contents.focus()
  await bounded(contents.debugger.sendCommand('Emulation.setFocusEmulationEnabled',{enabled:true}))
  for(const [field,value] of [['username',login.username],['password',login.password]] as const){
   check();await options.progress?.(field==='username'?'Entering email':'Entering password');await page(field);check();
   if(new URL(contents.getURL()).origin!==origin)throw new Error('Login origin changed.');
   await bounded(contents.debugger.sendCommand('Input.insertText',{text:value}));
   // Compare inside Chromium; never return or log the field contents.
   const verified=await bounded(contents.executeJavaScriptInIsolatedWorld(1003,[{code:`(()=>{const e=document.activeElement;return e instanceof HTMLInputElement && e.value===${JSON.stringify(value)}})()`}]))
   if(!verified)throw new Error('Login input did not retain the supplied value.')
   if(options.demo)await bounded(new Promise(resolve=>setTimeout(resolve,400)))
  }
  await options.progress?.('Clicking Sign in');const point=await page('submit');check()
  await bounded(contents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1}))
  await bounded(contents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1}))
  await options.progress?.('Waiting for signed-in dashboard')
  const submitted=Date.now()
  while(true){check();if(new URL(contents.getURL()).origin!==origin)throw new Error('Login redirected to another website. Finish sign-in manually.');if(!contents.isLoading()&&contents.getURL()===login.successURL&&(await page('inspect')).passwords===0)return;if(Date.now()-submitted>20000)throw new Error('Sign-in was not verified. Check credentials or complete MFA/CAPTCHA manually; no retry was attempted.');await new Promise(r=>setTimeout(r,100))}
 }finally{if(attached&&!contents.isDestroyed()&&contents.debugger.isAttached()){await bounded(contents.debugger.sendCommand('Emulation.setFocusEmulationEnabled',{enabled:false}),1000).catch(()=>{});contents.debugger.detach()}}
}
