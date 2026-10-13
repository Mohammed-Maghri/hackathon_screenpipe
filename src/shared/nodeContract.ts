export interface ContractField {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file'
  description: string
  required: boolean
  itemType: 'string' | 'number' | 'boolean' | 'object' | null
  fields: { name: string; type: 'string' | 'number' | 'boolean'; description: string; required: boolean }[]
}
export interface NodeContract {
  inputs: (ContractField & { sourceStepId: string | null; sourceOutput: string | null })[]
  outputs: ContractField[]
  validationCriteria: string[]
  requiresHumanReview: boolean
}
