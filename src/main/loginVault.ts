import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { browserURL } from './browserAddress'
import type { SavedLogin, LoginSummary } from '../shared/login'
export type { SavedLogin } from '../shared/login'
export function validateLogin(input: SavedLogin): SavedLogin {
 if (!input || typeof input.username !== 'string' || !input.username.trim() || input.username.length>320 || typeof input.password!=='string' || !input.password || input.password.length>4096 || typeof input.remember!=='boolean') throw new Error('Enter a username and password.')
 const loginURL=browserURL(input.loginURL), successURL=browserURL(input.successURL)
 const a=new URL(loginURL),b=new URL(successURL)
 if(a.origin!==b.origin || loginURL===successURL || a.search || a.hash || b.search || b.hash) throw new Error('Use separate login and signed-in page URLs on the same website, without query strings or fragments.')
 if(a.protocol!=='https:' && !['localhost','127.0.0.1','[::1]'].includes(a.hostname)) throw new Error('Saved login requires HTTPS, except for local development websites.')
 return {loginURL,successURL,username:input.username.trim(),password:input.password,remember:input.remember}
}
export class LoginVault {
 private memory=new Map<string,SavedLogin>()
 constructor(private root:string,private encryption:{available:()=>boolean;encrypt:(value:string)=>Buffer;decrypt:(value:Buffer)=>string}){}
 private path(scope:string){return join(this.root,createHash('sha256').update(scope).digest('hex')+'.bin')}
 async save(scope:string,input:SavedLogin){const value=validateLogin(input)
  if(value.remember){if(!this.encryption.available())throw new Error('Unlock or configure the system keyring, or choose session-only storage.');const encrypted=this.encryption.encrypt(JSON.stringify(value));await mkdir(this.root,{recursive:true,mode:0o700});const temp=this.path(scope)+'.'+randomUUID();try{await writeFile(temp,encrypted,{mode:0o600});await rename(temp,this.path(scope))}finally{await rm(temp,{force:true})}}
  else await rm(this.path(scope),{force:true})
  this.memory.set(scope,value)
 }
 async get(scope:string){const cached=this.memory.get(scope);if(cached)return cached;let data:Buffer;try{data=await readFile(this.path(scope))}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw new Error('Unable to read the saved login.')}
  if(!this.encryption.available())throw new Error('Unlock your system keyring to use this saved login.')
  try{const value=validateLogin(JSON.parse(this.encryption.decrypt(data)));this.memory.set(scope,value);return value}catch{throw new Error('Unable to unlock saved login. Save it again in Login settings.')}
 }
 async summary(scope:string):Promise<LoginSummary>{const value=await this.get(scope);return {configured:!!value,secureStorage:this.encryption.available(),...(value?{loginURL:value.loginURL,successURL:value.successURL,username:value.username,remembered:value.remember}:{})}}
 async remove(scope:string){this.memory.delete(scope);await rm(this.path(scope),{force:true})}
}
