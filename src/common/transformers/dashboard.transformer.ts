import {
  DashboardSummaryDto,
  ActivePlanDto,
  ProjectBlockDto,
  DashboardStatsDto,
  ReviewerDashboardDto,
  ReviewTaskDto,
  ProofDataDto,
  AdminDashboardDto,
  PlatformStatsDto,
  ReviewerSummaryDto,
  ProjectTemplateSummaryDto,
} from '../dto/dashboard.dto'
import { transformRole, transformDurationType, transformPlanProjectStatus } from './index'
import { User, InternshipPlan, PlanProject, ProjectTemplate, Submission, Review, ReviewerProfile } from '@prisma/client'

export class DashboardTransformer {
  static toDashboardSummary(
    user: User & { studentProfile?: any },
    activePlan?: InternshipPlan & { planProjects: (PlanProject & { template: ProjectTemplate })[] } | null,
  ): DashboardSummaryDto {
    const hasActivePlan = !!activePlan

    return {
      userId: user.id,
      firstName: user.studentProfile?.firstName || '',
      role: transformRole(user.role),
      hasActivePlan,
      activePlan: activePlan ? this.toActivePlan(activePlan) : undefined,
      stats: hasActivePlan ? this.calculateDashboardStats(activePlan) : undefined,
    }
  }

  static toActivePlan(
    plan: InternshipPlan & { planProjects: (PlanProject & { template: ProjectTemplate })[] },
  ): ActivePlanDto {
    const projectBlocks = plan.planProjects
      .sort((a, b) => a.order - b.order)
      .map((pp) => this.toProjectBlock(pp))

    const currentBlock = projectBlocks.find((pb) => pb.status === 'in_progress')
    const nextBlock = projectBlocks.find((pb) => pb.status === 'available')
    const percentage = Math.round((plan.completedWeeks / plan.totalWeeks) * 100)

    return {
      planId: plan.id,
      durationType: transformDurationType(plan.durationType),
      totalWeeks: plan.totalWeeks,
      combination: plan.combination,
      completedWeeks: plan.completedWeeks,
      percentage,
      sequentialCompletion: plan.sequentialCompletion,
      projectBlocks,
      currentBlock,
      nextBlock,
      canUnlockCertificate: this.checkCertificateEligibility(plan),
    }
  }

  static toProjectBlock(planProject: PlanProject & { template: ProjectTemplate }): ProjectBlockDto {
    return {
      id: planProject.id,
      projectId: planProject.templateId,
      projectTitle: planProject.template.title,
      duration: planProject.template.duration,
      order: planProject.order,
      status: transformPlanProjectStatus(planProject.status),
      enrolledAt: planProject.startedAt?.toISOString(),
      completedAt: planProject.completedAt?.toISOString(),
      approvedAt: planProject.approvedAt?.toISOString(),
      skills: planProject.template.skills,
    }
  }

  static calculateDashboardStats(
    plan: InternshipPlan & { planProjects: (PlanProject & { template: ProjectTemplate })[] },
  ): DashboardStatsDto {
    const completedBlocks = plan.planProjects.filter((pp) => pp.status === 'COMPLETED').length
    const totalBlocks = plan.planProjects.length

    return {
      activeInternships: 1,
      completedMilestones: completedBlocks,
      proofsSubmitted: completedBlocks,
      pendingReviews: plan.planProjects.filter((pp) => pp.status === 'IN_PROGRESS').length,
      verificationScore: '94%',
    }
  }

  static toReviewerDashboard(
    reviewer: ReviewerProfile & { user: any },
    queue: (Submission & { task: any; review?: Review; student: any })[],
  ): ReviewerDashboardDto {
    const reviewTasks = queue.map((s) => this.toReviewTask(s))

    return {
      reviewerId: reviewer.id,
      firstName: reviewer.firstName,
      role: transformRole(reviewer.user.role),
      queue: reviewTasks,
      pendingCount: reviewTasks.length,
      completedThisWeek: 0, // Calculate from database
    }
  }

  static toReviewTask(submission: Submission & { task: any; review?: Review; student: any }): ReviewTaskDto {
    return {
      id: submission.review?.id || '',
      submissionId: submission.id,
      taskId: submission.taskId,
      taskTitle: submission.task.title,
      projectId: submission.task.milestone.projectId,
      projectName: '', // Fetch from template
      studentId: submission.student.id,
      studentName: `${submission.student.studentProfile.firstName} ${submission.student.studentProfile.lastName}`,
      status: submission.review?.status?.toLowerCase() || 'pending',
      submittedAt: submission.submittedAt.toISOString(),
      proofData: {
        prLink: submission.prLink,
        commitHash: submission.commitHash,
        screenshots: submission.screenshots,
        description: submission.description,
      },
    }
  }

  static toAdminDashboard(
    stats: PlatformStatsDto,
    reviewers: ReviewerProfile[],
    templates: ProjectTemplate[],
  ): AdminDashboardDto {
    return {
      stats,
      reviewers: reviewers.map((r) => this.toReviewerSummary(r)),
      projectTemplates: templates.map((t) => this.toProjectTemplateSummary(t)),
    }
  }

  static toReviewerSummary(reviewer: ReviewerProfile): ReviewerSummaryDto {
    return {
      id: reviewer.id,
      name: `${reviewer.firstName} ${reviewer.lastName}`,
      isAvailable: reviewer.isAvailable,
      pendingAssignments: 0, // Calculate from database
      completedReviews: 0, // Calculate from database
    }
  }

  static toProjectTemplateSummary(template: ProjectTemplate): ProjectTemplateSummaryDto {
    return {
      id: template.id,
      title: template.title,
      category: template.category,
      difficulty: template.difficulty,
      duration: template.duration,
      isPublished: template.status === 'PUBLISHED',
      assignedReviewer: template.reviewerId,
    }
  }

  static checkCertificateEligibility(plan: InternshipPlan): boolean {
    if (plan.completedWeeks < plan.totalWeeks) return false

    // All blocks must be completed
    // This will be checked by the service when querying with relations
    return true
  }
}
