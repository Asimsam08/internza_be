import { DurationType } from '@prisma/client'

// Transform backend enum to frontend-friendly string
export function transformDurationType(durationType: DurationType): string {
  const durationMap: Record<DurationType, string> = {
    [DurationType.FOUR_WEEKS]: '4_weeks',
    [DurationType.EIGHT_WEEKS]: '8_weeks',
    [DurationType.TWELVE_WEEKS]: '12_weeks',
    [DurationType.CUSTOM]: 'custom',
  }
  return durationMap[durationType]
}

// Transform frontend string to backend enum
export function parseDurationType(durationType: string): DurationType {
  const durationMap: Record<string, DurationType> = {
    '4_weeks': DurationType.FOUR_WEEKS,
    '8_weeks': DurationType.EIGHT_WEEKS,
    '12_weeks': DurationType.TWELVE_WEEKS,
    custom: DurationType.CUSTOM,
  }
  const parsed = durationMap[durationType.toLowerCase()]
  if (!parsed) {
    throw new Error(`Invalid duration type: ${durationType}`)
  }
  return parsed
}
