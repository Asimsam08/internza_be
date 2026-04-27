import { ApiProperty } from '@nestjs/swagger'

// Base DTOs
export class ProofDataDto {
  @ApiProperty({ required: false })
  prLink?: string

  @ApiProperty({ required: false })
  commitHash?: string

  @ApiProperty({ example: ['https://example.com/screenshot1.jpg'] })
  screenshots: string[]

  @ApiProperty({ example: 'I completed the CNN model with 95% accuracy' })
  description: string
}

export class ProjectBlockDto {
  @ApiProperty({ example: 'block-123' })
  id: string

  @ApiProperty({ example: 'template-123' })
  projectId: string

  @ApiProperty({ example: 'AI/ML Image Classifier' })
  projectTitle: string

  @ApiProperty({ example: 4 })
  duration: number

  @ApiProperty({ example: 1 })
  order: number

  @ApiProperty({ example: 'in_progress' })
  status: string

  @ApiProperty({ required: false, nullable: true })
  enrolledAt?: string

  @ApiProperty({ required: false, nullable: true })
  completedAt?: string

  @ApiProperty({ required: false, nullable: true })
  approvedAt?: string

  @ApiProperty({ example: ['Python', 'TensorFlow', 'Machine Learning'] })
  skills: string[]
}

export class DashboardStatsDto {
  @ApiProperty({ example: 3 })
  activeInternships: number

  @ApiProperty({ example: 12 })
  completedMilestones: number

  @ApiProperty({ example: 8 })
  proofsSubmitted: number

  @ApiProperty({ example: 2 })
  pendingReviews: number

  @ApiProperty({ example: '94%' })
  verificationScore: string
}

export class ActivePlanDto {
  @ApiProperty({ example: 'plan-123' })
  planId: string

  @ApiProperty({ example: '8_weeks' })
  durationType: string

  @ApiProperty({ example: 8 })
  totalWeeks: number

  @ApiProperty({ example: [4, 4] })
  combination: number[]

  @ApiProperty({ example: 4 })
  completedWeeks: number

  @ApiProperty({ example: 50 })
  percentage: number

  @ApiProperty({ example: true })
  sequentialCompletion: boolean

  @ApiProperty({ type: [ProjectBlockDto] })
  projectBlocks: ProjectBlockDto[]

  @ApiProperty({ required: false, nullable: true })
  currentBlock?: ProjectBlockDto

  @ApiProperty({ required: false, nullable: true })
  nextBlock?: ProjectBlockDto

  @ApiProperty({ example: false })
  canUnlockCertificate: boolean
}

export class DashboardSummaryDto {
  @ApiProperty({ example: 'dashboard-123' })
  userId: string

  @ApiProperty({ example: 'Alex' })
  firstName: string

  @ApiProperty({ example: 'student' })
  role: string

  @ApiProperty({ example: false, description: 'Whether student has an active internship plan' })
  hasActivePlan: boolean

  @ApiProperty({ required: false, nullable: true })
  activePlan?: ActivePlanDto

  @ApiProperty({ required: false, nullable: true })
  stats?: DashboardStatsDto
}

export class ReviewTaskDto {
  @ApiProperty({ example: 'review-123' })
  id: string

  @ApiProperty({ example: 'submission-123' })
  submissionId: string

  @ApiProperty({ example: 'task-123' })
  taskId: string

  @ApiProperty({ example: 'Build CNN Model' })
  taskTitle: string

  @ApiProperty({ example: 'project-123' })
  projectId: string

  @ApiProperty({ example: 'AI/ML Image Classifier' })
  projectName: string

  @ApiProperty({ example: 'student-123' })
  studentId: string

  @ApiProperty({ example: 'Alex Student' })
  studentName: string

  @ApiProperty({ example: 'pending' })
  status: string

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  submittedAt: string

  @ApiProperty()
  proofData: ProofDataDto
}

export class ReviewerDashboardDto {
  @ApiProperty({ example: 'reviewer-123' })
  reviewerId: string

  @ApiProperty({ example: 'Jordan' })
  firstName: string

  @ApiProperty({ example: 'reviewer' })
  role: string

  @ApiProperty({ type: [ReviewTaskDto] })
  queue: ReviewTaskDto[]

  @ApiProperty({ example: 5 })
  pendingCount: number

  @ApiProperty({ example: 12 })
  completedThisWeek: number
}

export class PlatformStatsDto {
  @ApiProperty({ example: 150 })
  totalStudents: number

  @ApiProperty({ example: 25 })
  totalReviewers: number

  @ApiProperty({ example: 30 })
  totalProjects: number

  @ApiProperty({ example: 45 })
  totalCertificates: number

  @ApiProperty({ example: 12 })
  pendingReviews: number
}

export class ReviewerSummaryDto {
  @ApiProperty({ example: 'reviewer-123' })
  id: string

  @ApiProperty({ example: 'Jordan Reviewer' })
  name: string

  @ApiProperty({ example: true })
  isAvailable: boolean

  @ApiProperty({ example: 5 })
  pendingAssignments: number

  @ApiProperty({ example: 45 })
  completedReviews: number
}

export class ProjectTemplateSummaryDto {
  @ApiProperty({ example: 'template-123' })
  id: string

  @ApiProperty({ example: 'AI/ML Image Classifier' })
  title: string

  @ApiProperty({ example: 'ai_ml' })
  category: string

  @ApiProperty({ example: 'Intermediate' })
  difficulty: string

  @ApiProperty({ example: 4 })
  duration: number

  @ApiProperty({ example: true })
  isPublished: boolean

  @ApiProperty({ required: false, nullable: true })
  assignedReviewer?: string
}

export class AdminDashboardDto {
  @ApiProperty()
  stats: PlatformStatsDto

  @ApiProperty({ type: [ReviewerSummaryDto] })
  reviewers: ReviewerSummaryDto[]

  @ApiProperty({ type: [ProjectTemplateSummaryDto] })
  projectTemplates: ProjectTemplateSummaryDto[]
}
