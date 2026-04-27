import { Injectable, BadRequestException } from '@nestjs/common'
import { DurationType } from '@prisma/client'

export interface DurationRule {
  durationType: DurationType
  totalWeeks: number
  allowedCombinations: number[][]
  description: string
}

export interface DurationOption {
  value: string
  label: string
  weeks: number
  description: string
  popular?: boolean
}

export interface PlanOption {
  id: string
  combination: number[]
  totalWeeks: number
  description: string
  recommended: boolean
}

@Injectable()
export class DurationRulesService {
  private readonly DURATION_RULES: Record<DurationType, DurationRule> = {
    [DurationType.FOUR_WEEKS]: {
      durationType: DurationType.FOUR_WEEKS,
      totalWeeks: 4,
      allowedCombinations: [[4]],
      description: 'Single 4-week project for focused skill building',
    },
    [DurationType.EIGHT_WEEKS]: {
      durationType: DurationType.EIGHT_WEEKS,
      totalWeeks: 8,
      allowedCombinations: [[8], [4, 4]],
      description: 'Either one 8-week project or two 4-week projects',
    },
    [DurationType.TWELVE_WEEKS]: {
      durationType: DurationType.TWELVE_WEEKS,
      totalWeeks: 12,
      allowedCombinations: [[12], [8, 4], [4, 8], [4, 4, 4]],
      description: 'One 12-week project, or 8+4, 4+8, or three 4-week projects',
    },
    [DurationType.CUSTOM]: {
      durationType: DurationType.CUSTOM,
      totalWeeks: 0,
      allowedCombinations: [],
      description: 'Custom duration with system-validated combinations',
    },
  }

  private readonly DURATION_OPTIONS: DurationOption[] = [
    {
      value: '4_weeks',
      label: '4 Weeks',
      weeks: 4,
      description: 'Quick skill boost in a focused area',
      popular: true,
    },
    {
      value: '8_weeks',
      label: '8 Weeks',
      weeks: 8,
      description: 'Balanced depth across two projects',
      popular: true,
    },
    {
      value: '12_weeks',
      label: '12 Weeks',
      weeks: 12,
      description: 'Comprehensive internship experience',
      popular: false,
    },
    {
      value: 'custom',
      label: 'Custom Duration',
      weeks: 0,
      description: 'Build your own combination',
      popular: false,
    },
  ]

  /**
   * Validate if a combination is allowed for a given duration type
   */
  isValidCombination(
    durationType: DurationType,
    combination: number[],
    customWeeks?: number,
  ): boolean {
    const rule = this.DURATION_RULES[durationType]

    if (durationType === DurationType.CUSTOM && customWeeks) {
      const totalWeeks = combination.reduce((sum, weeks) => sum + weeks, 0)
      return totalWeeks === customWeeks && combination.every((w) => [4, 8, 12].includes(w))
    }

    return rule.allowedCombinations.some(
      (allowedCombination) =>
        allowedCombination.length === combination.length &&
        allowedCombination.every((weeks, index) => weeks === combination[index]),
    )
  }

  /**
   * Get valid plan options for a duration type
   */
  getPlanOptions(
    durationType: DurationType,
    availableProjects: Array<{ id: string; title: string; duration: number }>,
    customWeeks?: number,
  ): PlanOption[] {
    const rule = this.DURATION_RULES[durationType]
    const options: PlanOption[] = []

    if (durationType === DurationType.CUSTOM && customWeeks) {
      const validCombinations = this.generateValidCombinations(customWeeks)
      validCombinations.forEach((combination, index) => {
        options.push(this.createPlanOption(combination, index, true))
      })
    } else {
      rule.allowedCombinations.forEach((combination, index) => {
        options.push(this.createPlanOption(combination, index, false))
      })
    }

    return options
  }

  /**
   * Generate valid combinations for custom duration
   */
  private generateValidCombinations(totalWeeks: number): number[][] {
    const combinations: number[][] = []
    const blockSizes = [4, 8, 12]

    if (totalWeeks === 4) combinations.push([4])
    if (totalWeeks === 8) combinations.push([8], [4, 4])
    if (totalWeeks === 12) combinations.push([12], [8, 4], [4, 8], [4, 4, 4])

    // For other custom values, try to find valid combinations
    if (![4, 8, 12].includes(totalWeeks)) {
      // For MVP, only support combinations that exactly match
      // Future: Add more sophisticated combination generation
    }

    return combinations
  }

  /**
   * Create a plan option from a combination
   */
  private createPlanOption(combination: number[], index: number, isCustom: boolean): PlanOption {
    const totalWeeks = combination.reduce((sum, weeks) => sum + weeks, 0)

    return {
      id: `plan-${isCustom ? 'custom' : 'standard'}-${index}`,
      combination,
      totalWeeks,
      description: this.generateDescription(combination),
      recommended: index === 0,
    }
  }

  /**
   * Generate human-readable description for a plan
   */
  private generateDescription(combination: number[]): string {
    if (combination.length === 1) {
      return `${combination[0]}-week project`
    }
    if (combination.length === 2) {
      return `${combination[0]}-week + ${combination[1]}-week projects`
    }
    return `${combination.length} projects (${combination.join(' + ')} weeks)`
  }

  /**
   * Get all duration options
   */
  getDurationOptions(): DurationOption[] {
    return this.DURATION_OPTIONS
  }

  /**
   * Validate duration type
   */
  validateDurationType(durationType: string): DurationType {
    const validTypes = Object.values(DurationType)
    const parsed = validTypes.find((type) => type === durationType.toUpperCase())

    if (!parsed) {
      throw new BadRequestException(`Invalid duration type: ${durationType}`)
    }

    return parsed
  }

  /**
   * Validate custom weeks
   */
  validateCustomWeeks(weeks: number): void {
    if (weeks < 4 || weeks > 24) {
      throw new BadRequestException('Custom duration must be between 4 and 24 weeks')
    }

    if (!Number.isInteger(weeks)) {
      throw new BadRequestException('Custom duration must be a whole number')
    }
  }

  /**
   * Get recommended plan for a duration
   */
  getRecommendedPlan(
    durationType: DurationType,
    availableProjects: Array<{ id: string; title: string; duration: number }>,
  ): PlanOption | null {
    const options = this.getPlanOptions(durationType, availableProjects)
    return options.find((opt) => opt.recommended) || options[0] || null
  }

  /**
   * Check if a plan can be completed based on duration rules
   */
  checkPlanCompletion(
    totalWeeks: number,
    completedWeeks: number,
    allBlocksApproved: boolean,
  ): { isEligible: boolean; reason?: string } {
    if (completedWeeks < totalWeeks) {
      return {
        isEligible: false,
        reason: `Complete ${totalWeeks - completedWeeks} more week${totalWeeks - completedWeeks > 1 ? 's' : ''}`,
      }
    }

    if (!allBlocksApproved) {
      return {
        isEligible: false,
        reason: 'All project blocks must be approved',
      }
    }

    return { isEligible: true }
  }
}
