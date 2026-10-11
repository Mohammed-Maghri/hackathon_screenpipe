export function GhostLogo({ compact = false }: { compact?: boolean }) {
  return <div className="brand" aria-label="Ghost">
    <svg width="38" height="45" viewBox="0 0 38 45" fill="none" aria-hidden="true">
      <path d="M3.1 19C3.7 8.1 10.1 1 19 1S34.3 8.1 34.9 19L37 40.3c.3 3.1-2.2 4.4-4.6 2.8l-5.1-3.3-5.4 3.3a5.7 5.7 0 0 1-5.8 0l-5.4-3.3-5.1 3.3c-2.4 1.6-4.9.3-4.6-2.8L3.1 19Z" fill="currentColor" />
      <ellipse cx="13.2" cy="19" rx="2.7" ry="3.2" fill="#080808" /><ellipse cx="24.8" cy="19" rx="2.7" ry="3.2" fill="#080808" />
    </svg>{!compact && <span>GHOST</span>}
  </div>
}
