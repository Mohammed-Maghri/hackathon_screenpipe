// A standalone opening instruction describes the node's configured start URL.
// Other instructions (including later navigation steps) remain user-authored.
export function browserInstructions(instructions: string[], startUrl?: string | null): string[] {
  if (!instructions.length || !startUrl) return instructions
  const opening = instructions[0].match(/^(Open|Navigate to|Go to)\s+https?:\/\/\S+\s*$/i)
  if (!opening) return instructions
  return [`${opening[1]} ${startUrl}`, ...instructions.slice(1)]
}
