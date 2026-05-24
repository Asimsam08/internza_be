import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@/prisma/prisma.service'

export interface ReviewerContext {
  userId: string
  profileId: string
  collegeId: string | null
  /** When set, queue is limited to cohort-backed plans for this college. */
  isCollegeScoped: boolean
}

@Injectable()
export class ReviewerScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves reviewer profile for REVIEWER and COLLEGE_ADMIN users.
   * College admins get a profile on demand (cohort grading).
   */
  async resolveContext(
    userId: string,
    collegeId?: string | null,
  ): Promise<ReviewerContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, collegeId: true, email: true },
    })
    if (!user) {
      throw new NotFoundException('User not found')
    }

    let profile = await this.prisma.reviewerProfile.findUnique({
      where: { userId },
    })

    if (!profile && user.role === 'COLLEGE_ADMIN') {
      const email = user.email ?? 'officer'
      profile = await this.prisma.reviewerProfile.create({
        data: {
          userId,
          firstName: email.split('@')[0] || 'Officer',
          lastName: '',
          expertise: [],
        },
      })
    }

    if (!profile) {
      throw new NotFoundException('Reviewer profile not found')
    }

    const scopeCollegeId = collegeId ?? user.collegeId ?? null
    const isCollegeScoped = !!scopeCollegeId

    return {
      userId,
      profileId: profile.id,
      collegeId: scopeCollegeId,
      isCollegeScoped,
    }
  }

  /**
   * Plan projects this user may review.
   * College users: cohort plans only, via CohortReviewer (not template.reviewerId).
   * Platform reviewers: non-cohort plans where planProject.reviewerId matches.
   */
  buildAccessiblePlanProjectWhere(
    ctx: ReviewerContext,
  ): Prisma.PlanProjectWhereInput {
    if (ctx.isCollegeScoped && ctx.collegeId) {
      return {
        plan: {
          cohortId: { not: null },
          cohort: {
            collegeId: ctx.collegeId,
            reviewers: { some: { reviewerId: ctx.profileId } },
          },
        },
      }
    }

    return {
      reviewerId: ctx.profileId,
      plan: { cohortId: null },
    }
  }

  /** Nested filter for Task → milestone → project */
  buildReviewableTaskWhere(ctx: ReviewerContext): Prisma.TaskWhereInput {
    return {
      milestone: {
        project: this.buildAccessiblePlanProjectWhere(ctx),
      },
    }
  }

  async listAccessiblePlanProjectIds(ctx: ReviewerContext): Promise<string[]> {
    const rows = await this.prisma.planProject.findMany({
      where: this.buildAccessiblePlanProjectWhere(ctx),
      select: { id: true },
    })
    return rows.map((r) => r.id)
  }

  async assertCanReviewTask(userId: string, taskId: string, collegeId?: string | null) {
    const ctx = await this.resolveContext(userId, collegeId)

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        submission: true,
        milestone: {
          include: {
            project: {
              include: {
                plan: {
                  include: {
                    cohort: {
                      select: {
                        id: true,
                        collegeId: true,
                        reviewers: {
                          where: { reviewerId: ctx.profileId },
                          select: { id: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!task) {
      throw new NotFoundException('Task not found')
    }

    const plan = task.milestone.project.plan
    const cohortId = plan.cohortId

    if (ctx.isCollegeScoped && ctx.collegeId) {
      if (!cohortId || !plan.cohort) {
        throw new ForbiddenException('This submission is not part of your college cohort')
      }
      if (plan.cohort.collegeId !== ctx.collegeId) {
        throw new ForbiddenException('You cannot review submissions outside your college')
      }
      const onCohort = plan.cohort.reviewers.length > 0
      if (!onCohort) {
        throw new ForbiddenException('You are not assigned as a reviewer for this cohort')
      }
      return { ctx, task }
    }

    if (cohortId) {
      throw new ForbiddenException('Cohort submissions are reviewed by college faculty only')
    }

    if (task.milestone.project.reviewerId !== ctx.profileId) {
      throw new ForbiddenException('This task is not assigned to you')
    }

    return { ctx, task }
  }
}
