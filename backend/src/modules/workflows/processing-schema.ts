import { z } from 'zod'
import { generationResponseSchema } from '../../contracts/processingPlan.js'

// Zod 4 emits oneOf for discriminated unions, but Responses strict output schemas
// accept anyOf. These branches have distinct operation tags, so they stay exclusive.
function responseSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(responseSchema)
  if (!value || typeof value !== 'object') return value
  const object = value as Record<string, unknown>
  if (Array.isArray(object.oneOf)) {
    const tags = object.oneOf.map(branch => branch?.properties?.type?.const)
    if (tags.some(tag => typeof tag !== 'string') || new Set(tags).size !== tags.length) {
      throw new Error('Only disjoint operation unions may be converted to anyOf.')
    }
  }
  return Object.fromEntries(Object.entries(object).filter(([key]) => key !== '$schema').map(([key, item]) => [key === 'oneOf' ? 'anyOf' : key, responseSchema(item)]))
}
export const processingResponseJsonSchema = responseSchema(z.toJSONSchema(generationResponseSchema))
