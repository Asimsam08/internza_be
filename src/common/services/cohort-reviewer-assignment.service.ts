import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class CohortReviewerAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  /** College admins grade via a linked reviewer profile (created on demand). */
  async ensureReviewerProfileForUser(userId: string, emailHint?: string): Promise<string> {
    const existing = await this.prisma.reviewerProfile.findUnique({ where: { userId } })
    if (existing) return existing.id

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })
    const email = emailHint ?? user?.email ?? 'officer'
    const firstName = email.split('@')[0] || 'Officer'

    const created = await this.prisma.reviewerProfile.create({
      data: {
        userId,
        firstName,
        lastName: '',
        expertise: [],
      },
    })
    return created.id
  }

  async assignReviewerToCohort(cohortId: string, reviewerProfileId: string): Promise<void> {
    await this.prisma.cohortReviewer.upsert({
      where: {
        cohortId_reviewerId: { cohortId, reviewerId: reviewerProfileId },
      },
      create: { cohortId, reviewerId: reviewerProfileId },
      update: {},
    })
  }

  async assignReviewerToCollegeCohorts(collegeId: string, reviewerProfileId: string): Promise<void> {
    const cohorts = await this.prisma.cohort.findMany({
      where: { collegeId },
      select: { id: true },
    })
    if (!cohorts.length) return

    await this.prisma.cohortReviewer.createMany({
      data: cohorts.map((c) => ({ cohortId: c.id, reviewerId: reviewerProfileId })),
      skipDuplicates: true,
    })
  }

  /** Placement officer is always the first cohort reviewer. */
  async assignCollegeAdminToCohort(cohortId: string, adminUserId: string): Promise<string> {
    const profileId = await this.ensureReviewerProfileForUser(adminUserId)
    await this.assignReviewerToCohort(cohortId, profileId)
    return profileId
  }

  /** All active faculty reviewers for the college (for new cohorts). */
  async collectCollegeReviewerProfileIds(collegeId: string): Promise<string[]> {
    const reviewers = await this.prisma.user.findMany({
      where: { collegeId, role: 'REVIEWER' },
      select: { id: true, reviewerProfile: { select: { id: true } } },
    })

    const ids: string[] = []
    for (const r of reviewers) {
      if (r.reviewerProfile?.id) {
        ids.push(r.reviewerProfile.id)
      } else {
        const profileId = await this.ensureReviewerProfileForUser(r.id)
        ids.push(profileId)
      }
    }
    return ids
  }

  async syncCohortReviewers(cohortId: string, reviewerProfileIds: string[]): Promise<void> {
    const unique = [...new Set(reviewerProfileIds.filter(Boolean))]
    if (!unique.length) return

    await this.prisma.cohortReviewer.createMany({
      data: unique.map((reviewerId) => ({ cohortId, reviewerId })),
      skipDuplicates: true,
    })
  }
}
