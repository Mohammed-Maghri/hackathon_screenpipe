import { setTimeout } from 'node:timers/promises'
// Retain the requested development delay. OpenAI creates the actual simulated
// discovery response in the generation endpoint; there is no fixed workflow fixture.
export async function getMockActivity(signal?: AbortSignal) {
  await setTimeout(5000, undefined, { signal })
  return { source: 'development_mock', status: 'ready', simulator: 'openai' }
}
