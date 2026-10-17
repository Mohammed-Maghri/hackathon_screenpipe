import { createContext, useState, type ReactNode } from 'react'
import { TitleBar } from './TitleBar'

// The sidebar owns its actions; the native title bar only provides their slot.
export const WorkspaceChromeContext = createContext<HTMLElement | null>(null)

export function WorkspaceFrame({ children, nativeChrome }: { children: ReactNode; nativeChrome: boolean }) {
  const [controls, setControls] = useState<HTMLDivElement | null>(null)
  return <WorkspaceChromeContext.Provider value={controls}>
    <div className="workspace-frame flex h-full min-h-0 flex-col">
      {nativeChrome && <div className="workspace-titlebar relative h-14 shrink-0 border-b border-line bg-canvas text-muted [&>.titlebar]:h-full">
        <TitleBar />
        <div ref={setControls} className="workspace-titlebar-controls absolute inset-y-0 left-28 z-10 flex items-center gap-1" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center font-sans text-xs font-medium">Ghost</span>
      </div>}
      <div className="workspace-content relative min-h-0 flex-1">{children}</div>
    </div>
  </WorkspaceChromeContext.Provider>
}
