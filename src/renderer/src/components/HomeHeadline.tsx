import {useEffect,useState,useRef} from 'react'
import {AnimatePresence,motion,useReducedMotion,useMotionValue,useSpring,useAnimationControls} from 'motion/react'
import {Pause,Play} from 'lucide-react'
import '@fontsource-variable/geist'

const phrases=['the busywork.','your next report.','the repeat tasks.']
export function HomeHeadline({onPrompt,compact=false,active=false,busy=false}:{onPrompt:()=>void;compact?:boolean;active?:boolean;busy?:boolean}){
 const reduced=useReducedMotion()
 const mascot=useRef<HTMLDivElement>(null)
 const reaction=useAnimationControls()
 const [focused,setFocused]=useState(false)
 const [paused,setPaused]=useState(false),[index,setIndex]=useState(0),[hover,setHover]=useState(false)
 const pointerX=useMotionValue(0),pointerY=useMotionValue(0)
 const eyeX=useSpring(pointerX,{stiffness:170,damping:18}),eyeY=useSpring(pointerY,{stiffness:170,damping:18})
 useEffect(()=>{if(compact||reduced||paused)return;const timer=setInterval(()=>setIndex(i=>(i+1)%phrases.length),4200);return()=>clearInterval(timer)},[compact,reduced,paused])
 useEffect(()=>{
  if(!compact) return
  const form=mascot.current?.closest('form')
  if(!form) return
  const move=(event:PointerEvent)=>{
   if(reduced) return
   const box=mascot.current!.getBoundingClientRect()
   pointerX.set(Math.max(-3,Math.min(3,(event.clientX-box.left-box.width/2)/60)))
   pointerY.set(Math.max(-2,Math.min(2,(event.clientY-box.top-box.height/2)/30)))
  }
  const reset=()=>{pointerX.set(0);pointerY.set(0)}
  const focus=()=>setFocused(true)
  const blur=(event:FocusEvent)=>{if(!form.contains(event.relatedTarget as Node|null))setFocused(false)}
  let lastReaction=0
  const type=()=>{
   if(reduced||Date.now()-lastReaction<350)return
   lastReaction=Date.now()
   void reaction.start({y:[0,-5,0],rotate:[0,-7,4,0],transition:{duration:.38,ease:'easeOut'}})
  }
  form.addEventListener('pointermove',move)
  form.addEventListener('pointerleave',reset)
  form.addEventListener('focusin',focus)
  form.addEventListener('focusout',blur)
  form.addEventListener('input',type)
  return()=>{form.removeEventListener('pointermove',move);form.removeEventListener('pointerleave',reset);form.removeEventListener('focusin',focus);form.removeEventListener('focusout',blur);form.removeEventListener('input',type)}
 },[compact,reduced,pointerX,pointerY,reaction])
 const still=reduced||paused||(compact&&hover)
 if(compact) return <div ref={mascot} className="home-headline is-compact" data-state={busy?'thinking':active?'ready':'idle'} aria-hidden="true">
  <motion.span animate={reaction} style={{display:'inline-flex'}}><motion.svg className="home-composer-ghost" width="28" height="34" viewBox="0 0 38 45" fill="none" animate={reduced?{y:0,rotate:0}:{y:busy?[0,-3,0]:focused?-2:[0,-2,0],rotate:active&&!busy?-5:0,scale:focused?1.1:1}} transition={{duration:busy?1.8:focused?.3:3.5,repeat:!reduced&&(busy||!focused)?Infinity:0,ease:'easeInOut'}}>
   <path d="M3.1 19C3.7 8.1 10.1 1 19 1S34.3 8.1 34.9 19L37 40.3c.3 3.1-2.2 4.4-4.6 2.8l-5.1-3.3-5.4 3.3a5.7 5.7 0 0 1-5.8 0l-5.4-3.3-5.1 3.3c-2.4 1.6-4.9.3-4.6-2.8L3.1 19Z" fill="currentColor"/>
   <motion.g style={{x:reduced?0:eyeX,y:reduced?0:eyeY}}><motion.g animate={reduced?{scaleY:1}:{scaleY:busy?[1,.3,1]:[1,1,.1,1]}} transition={{duration:busy?1.8:5,repeat:reduced?0:Infinity}} style={{transformOrigin:'19px 19px'}}><ellipse cx="13.2" cy="19" rx="2.7" ry="3.2" fill="var(--surface-canvas)"/><ellipse cx="24.8" cy="19" rx="2.7" ry="3.2" fill="var(--surface-canvas)"/></motion.g>
  </motion.g></motion.svg></motion.span>
 </div>
 return <div className={"home-headline"+(compact?" is-compact":"")} onPointerMove={event=>{if(still)return;const box=event.currentTarget.getBoundingClientRect();pointerX.set(Math.max(-2,Math.min(2,(event.clientX-box.left-box.width/2)/80)));pointerY.set(Math.max(-1.5,Math.min(1.5,(event.clientY-box.top-45)/100)))}} onPointerLeave={()=>{pointerX.set(0);pointerY.set(0)}}>
  <motion.button className="home-ghost-mascot" type="button" aria-label="Tell Ghost what you want to automate" tabIndex={compact?-1:0} aria-hidden={compact||undefined} onClick={compact?undefined:onPrompt} onHoverStart={()=>setHover(true)} onHoverEnd={()=>setHover(false)} whileHover={still?{}:{scale:1.1,rotate:-6}} whileTap={still?{}:{scale:.92,rotate:5}} transition={{type:'spring',stiffness:280,damping:16}}>
   <motion.span className="home-ghost-halo" aria-hidden="true" animate={{opacity:hover?.5:.18,scale:hover?1.2:1}} transition={{duration:.4}}/>
   <motion.svg width="52" height="62" viewBox={compact?"0 0 38 52":"0 0 38 45"} fill="none" aria-hidden="true" animate={still?{y:0,rotate:0}:compact?{y:[0,-12,0],scaleY:[1,1.02,1],scaleX:[1,.99,1]}:{y:[0,-6,0],rotate:[-2,2,-2]}} transition={still?{duration:0}:{duration:compact?2.2:3.6,repeat:Infinity,ease:'easeInOut',...(compact?{times:[0,.5,1]}:{})}}>
    <path d="M3.1 19C3.7 8.1 10.1 1 19 1S34.3 8.1 34.9 19L37 40.3c.3 3.1-2.2 4.4-4.6 2.8l-5.1-3.3-5.4 3.3a5.7 5.7 0 0 1-5.8 0l-5.4-3.3-5.1 3.3c-2.4 1.6-4.9.3-4.6-2.8L3.1 19Z" fill="currentColor"/>
    <motion.g style={{x:still?0:eyeX,y:still?0:eyeY}}>
     <motion.g animate={still?{scaleY:1}:{scaleY:[1,1,.12,1,1]}} transition={{duration:5.5,times:[0,.85,.88,.91,1],repeat:Infinity}} style={{transformOrigin:'19px 19px'}}><ellipse cx="13.2" cy="19" rx="2.7" ry="3.2" fill="var(--surface-canvas)"/><ellipse cx="24.8" cy="19" rx="2.7" ry="3.2" fill="var(--surface-canvas)"/></motion.g>
    </motion.g>
    {compact&&<g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
     <motion.path d="M12 42 L10 48 L7 48" animate={{y:0}} transition={{duration:.48,repeat:Infinity,ease:'easeInOut'}}/>
     <motion.path d="M26 42 L28 48 L31 48" animate={{y:0}} transition={{duration:.48,repeat:Infinity,ease:'easeInOut'}}/>
    </g>}
   </motion.svg>
  </motion.button>
  {!compact&&<>
  <h1 className="home-hero-title" aria-label="Let Ghost handle the busywork.">
   <span className="home-headline-intro" aria-hidden="true">{['Let','Ghost','handle'].map((word,i)=><span className="home-word-mask" key={word}><motion.span initial={reduced?false:{y:'110%',opacity:0,rotate:3}} animate={{y:0,opacity:1,rotate:0}} transition={{type:'spring',damping:24,stiffness:130,delay:i*.1}}>{word}</motion.span></span>)}</span>
   <span className="home-headline-phrases" aria-hidden="true"><AnimatePresence initial={false} mode="popLayout"><motion.span key={reduced?'static':index} initial={still?false:{y:32,opacity:0,filter:'blur(6px)'}} animate={{y:0,opacity:1,filter:'blur(0px)'}} exit={still?{opacity:0}:{y:-28,opacity:0,filter:'blur(6px)'}} transition={{duration:still?0:.55,ease:[.22,1,.36,1]}}>{phrases[reduced?0:index]}</motion.span></AnimatePresence></span>
  </h1>
  <motion.p className="home-headline-caption" initial={reduced?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:.35,duration:.5}}>Describe the task. Teach it once. Make it a routine.</motion.p>
  {!reduced&&<button className="home-headline-motion" type="button" onClick={()=>setPaused(value=>!value)} aria-label={paused?'Play headline animation':'Pause headline animation'} aria-pressed={paused} title={paused?'Play animation':'Pause animation'}>{paused?<Play size={12}/>:<Pause size={12}/>}</button>}
  </>}
 </div>
}
