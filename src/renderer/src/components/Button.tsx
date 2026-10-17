import type { ButtonHTMLAttributes } from 'react'
export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  return <button className={`button button--${variant} dash-button ${variant === 'primary' ? 'dash-button--primary' : ''} ${className}`} {...props} />
}
