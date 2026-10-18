'use client'
import { useEffect, useState } from 'react'
export function ThemeToggle() {
 const [dark,setDark]=useState(true)
 useEffect(()=>{setDark(document.documentElement.dataset.theme!=='light')},[])
 function toggle(){const next=!dark;setDark(next);document.documentElement.dataset.theme=next?'dark':'light';try{localStorage.setItem('forma-theme',next?'dark':'light')}catch{}}
 return <button type="button" className="theme-toggle" data-testid="theme-toggle" aria-label="Dark mode" aria-pressed={dark} onClick={toggle}><span aria-hidden="true">{dark?'☾':'☀'}</span>{dark?'Dark mode':'Light mode'}</button>
}
