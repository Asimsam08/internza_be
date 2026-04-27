import { PlanProjectStatus, TaskStatus } from '@prisma/client'

// Transform PlanProjectStatus to frontend-friendly string
export function transformPlanProjectStatus(status: PlanProjectStatus): string {
  const statusMap: Record<PlanProjectStatus, string> = {
    [PlanProjectStatus.LOCKED]: 'locked',
    [PlanProjectStatus.AVAILABLE]: 'available',
    [PlanProjectStatus.IN_PROGRESS]: 'in_progress',
    [PlanProjectStatus.COMPLETED]: 'completed',
    [PlanProjectStatus.SKIPPED]: 'skipped',
  }
  return statusMap[status]
}

// Transform frontend string to PlanProjectStatus
export function parsePlanProjectStatus(status: string): PlanProjectStatus {
  const statusMap: Record<string, PlanProjectStatus> = {
    locked: PlanProjectStatus.LOCKED,
    available: PlanProjectStatus.AVAILABLE,
    in_progress: PlanProjectStatus.IN_PROGRESS,
    completed: PlanProjectStatus.COMPLETED,
    skipped: PlanProjectStatus.SKIPPED,
  }
  const parsed = statusMap[status.toLowerCase()]
  if (!parsed) {
    throw new Error(`Invalid plan project status: ${status}`)
  }
  return parsed
}

// Transform TaskStatus to frontend-friendly string
export function transformTaskStatus(status: TaskStatus): string {
  const statusMap: Record<TaskStatus, string> = {
    [TaskStatus.DRAFT]: 'draft',
    [TaskStatus.SUBMITTED]: 'submitted',
    [TaskStatus.UNDER_REVIEW]: 'under_review',
    [TaskStatus.APPROVED]: 'approved',
    [TaskStatus.REJECTED]: 'rejected',
    [TaskStatus.CHANGES_REQUESTED]: 'changes_requested',
  }
  return statusMap[status]
}

// Transform frontend string to TaskStatus
export function parseTaskStatus(status: string): TaskStatus {
  const statusMap: Record<string, TaskStatus> = {
    draft: TaskStatus.DRAFT,
    submitted: TaskStatus.SUBMITTED,
    under_review: TaskStatus.UNDER_REVIEW,
    approved: TaskStatus.APPROVED,
    rejected: TaskStatus.REJECTED,
    changes_requested: TaskStatus.CHANGES_REQUESTED,
  }
  const parsed = statusMap[status.toLowerCase()]
  if (!parsed) {
    throw new Error(`Invalid task status: ${status}`)
  }
  return parsed
}
