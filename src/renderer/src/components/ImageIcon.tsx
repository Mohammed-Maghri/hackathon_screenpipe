import type { CSSProperties, ComponentType, HTMLAttributes } from 'react'
import controls from '../assets/ui-imagery/controls.png'
import './ImageIcon.css'
export interface ImageIconProps extends HTMLAttributes<HTMLElement> {
  size?: number | string
  strokeWidth?: number | string
  fill?: string
}
export type ImageIcon = ComponentType<ImageIconProps>
function createIcon(index: number, name: string): ImageIcon {
  const Icon = ({ size = 20, strokeWidth: _strokeWidth, fill: _fill, style, className = '', ...props }: ImageIconProps) => (
    <i {...props} aria-hidden={props['aria-label'] ? undefined : true} className={`ui-image-icon ${className}`} data-icon={name} style={{ width: size, height: size, ...style } as CSSProperties}>
      <img src={controls} alt="" draggable={false} style={{ left: `${-(index % 8) * 100}%`, top: `${-Math.floor(index / 8) * 100}%` }} />
    </i>
  )
  Icon.displayName = name
  return Icon
}
export const ArrowDownToLine = createIcon(0, 'ArrowDownToLine')
export const ArrowLeft = createIcon(1, 'ArrowLeft')
export const ArrowRight = createIcon(2, 'ArrowRight')
export const Bell = createIcon(3, 'Bell')
export const CalendarDays = createIcon(4, 'CalendarDays')
export const Check = createIcon(5, 'Check')
export const ChevronDown = createIcon(6, 'ChevronDown')
export const ChevronRight = createIcon(7, 'ChevronRight')
export const Circle = createIcon(8, 'Circle')
export const CircleDot = createIcon(9, 'CircleDot')
export const CircleHelp = createIcon(10, 'CircleHelp')
export const Clock3 = createIcon(11, 'Clock3')
export const Code2 = createIcon(12, 'Code2')
export const Copy = createIcon(13, 'Copy')
export const Download = createIcon(14, 'Download')
export const Expand = createIcon(15, 'Expand')
export const FileText = createIcon(16, 'FileText')
export const Globe = createIcon(17, 'Globe')
export const Hand = createIcon(18, 'Hand')
export const Home = createIcon(19, 'Home')
export const LayoutGrid = createIcon(20, 'LayoutGrid')
export const Library = createIcon(21, 'Library')
export const Lightbulb = createIcon(22, 'Lightbulb')
export const Link = createIcon(23, 'Link')
export const LoaderCircle = createIcon(24, 'LoaderCircle')
export const LockKeyhole = createIcon(25, 'LockKeyhole')
export const Map = createIcon(26, 'Map')
export const Maximize = createIcon(27, 'Maximize')
export const Minus = createIcon(28, 'Minus')
export const MoreHorizontal = createIcon(29, 'MoreHorizontal')
export const MousePointer2 = createIcon(30, 'MousePointer2')
export const Paperclip = createIcon(31, 'Paperclip')
export const Pause = createIcon(32, 'Pause')
export const Pencil = createIcon(33, 'Pencil')
export const Play = createIcon(34, 'Play')
export const Plus = createIcon(35, 'Plus')
export const RefreshCw = createIcon(36, 'RefreshCw')
export const RotateCw = createIcon(37, 'RotateCw')
export const ScanLine = createIcon(38, 'ScanLine')
export const Search = createIcon(39, 'Search')
export const Settings = createIcon(40, 'Settings')
export const Share = createIcon(41, 'Share')
export const Square = createIcon(42, 'Square')
export const Trash2 = createIcon(43, 'Trash2')
export const Unplug = createIcon(44, 'Unplug')
export const Workflow = createIcon(45, 'Workflow')
export const X = createIcon(46, 'X')
export const Zap = createIcon(47, 'Zap')
