import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import { readFile } from 'fs/promises'
import { PrismaService } from '@/prisma/prisma.service'
import { CollegesService } from '@/modules/colleges/colleges.service'
import { CohortEnrollmentService, CsvStudentRow } from '@/common/services/cohort-enrollment.service'
import { CohortReviewerAssignmentService } from '@/common/services/cohort-reviewer-assignment.service'
import { CreateCohortDto } from './dto/create-cohort.dto'
import { InviteType, CohortStatus } from '@prisma/client'

@Injectable()
export class CollegeAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collegesService: CollegesService,
    private readonly enrollment: CohortEnrollmentService,
    private readonly cohortReviewers: CohortReviewerAssignmentService,
  ) {}

  async listCohorts(collegeId: string, user: any) {
    this.collegesService.assertCollegeAccess(user, collegeId)
    const cohorts = await this.prisma.cohort.findMany({
      where: { collegeId },
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { id: true, title: true, duration: true } },
        _count: { select: { members: true } },
        plans: { select: { isCompleted: true } },
      },
    })

    return cohorts.map((c) => {
      const completed = c.plans.filter((p) => p.isCompleted).length
      const total = c._count.members
      const needsLaunch = c.status === 'DRAFT' || total === 0
      return {
        id: c.id,
        name: c.name,
        planTitle: c.template.title,
        templateId: c.templateId,
        startDate: c.startDate,
        endDate: c.endDate,
        status: c.status,
        studentsCompleted: completed,
        studentsTotal: total,
        needsLaunch,
        progressLabel: needsLaunch ? `${total} enrolled · launch pending` : `${completed}/${total} complete`,
      }
    })
  }

  async createCohort(collegeId: string, dto: CreateCohortDto, user: any) {
    this.collegesService.assertCollegeAccess(user, collegeId)

    const template = await this.prisma.projectTemplate.findFirst({
      where: { id: dto.templateId, status: 'PUBLISHED' },
    })
    if (!template) throw new BadRequestException('Published project template required')

    const cohort = await this.prisma.cohort.create({
      data: {
        collegeId,
        name: dto.name.trim(),
        templateId: dto.templateId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: CohortStatus.DRAFT,
      },
    })

    let adminUserId: string | undefined =
      user?.role === 'COLLEGE_ADMIN' && user?.collegeId === collegeId ? user.userId : undefined
    if (!adminUserId) {
      const college = await this.prisma.college.findUnique({
        where: { id: collegeId },
        select: { primaryAdminId: true },
      })
      adminUserId = college?.primaryAdminId ?? undefined
    }

    const reviewerProfileIds: string[] = []

    if (adminUserId) {
      const adminProfileId = await this.cohortReviewers.assignCollegeAdminToCohort(cohort.id, adminUserId)
      reviewerProfileIds.push(adminProfileId)
    }

    const existingFacultyIds = await this.cohortReviewers.collectCollegeReviewerProfileIds(collegeId)
    reviewerProfileIds.push(...existingFacultyIds)

    if (dto.reviewerUserIds?.length) {
      for (const uid of dto.reviewerUserIds) {
        const rp = await this.prisma.reviewerProfile.findUnique({ where: { userId: uid } })
        if (rp) reviewerProfileIds.push(rp.id)
        else {
          const profileId = await this.cohortReviewers.ensureReviewerProfileForUser(uid)
          reviewerProfileIds.push(profileId)
        }
      }
    }

    await this.cohortReviewers.syncCohortReviewers(cohort.id, reviewerProfileIds)

    if (dto.inviteReviewerEmails?.length) {
      for (const email of dto.inviteReviewerEmails) {
        await this.collegesService.createInviteToken(collegeId, email, InviteType.REVIEWER)
      }
    }

    return cohort
  }

  parseCsv(buffer: Buffer): CsvStudentRow[] {
    const text = buffer.toString('utf-8').trim()
    const lines = text.split(/\r?\n/).filter(Boolean)
    if (lines.length < 2) throw new BadRequestException('CSV must include header and at least one row')

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const emailIdx = header.indexOf('email')
    const nameIdx = header.indexOf('name')
    const sidIdx = header.indexOf('studentid')

    if (emailIdx === -1 || nameIdx === -1) {
      throw new BadRequestException('CSV must have email,name columns (optional studentId)')
    }

    return lines.slice(1).map((line) => {
      const cols = line.split(',').map((c) => c.trim())
      return {
        email: cols[emailIdx],
        name: cols[nameIdx],
        studentId: sidIdx >= 0 ? cols[sidIdx] : undefined,
      }
    })
  }

  async importStudents(
    collegeId: string,
    cohortId: string,
    file: Express.Multer.File,
    user: any,
  ) {
    this.collegesService.assertCollegeAccess(user, collegeId)
    const cohort = await this.prisma.cohort.findFirst({ where: { id: cohortId, collegeId } })
    if (!cohort) throw new NotFoundException('Cohort not found')

    const buffer = file.buffer ?? (file.path ? await readFile(file.path) : null)
    if (!buffer?.length) throw new BadRequestException('Could not read CSV file')
    const rows = this.parseCsv(buffer)
    let reviewers = await this.prisma.cohortReviewer.findMany({
      where: { cohortId },
      select: { reviewerId: true },
    })
    if (!reviewers.length) {
      const college = await this.prisma.college.findUnique({
        where: { id: collegeId },
        select: { primaryAdminId: true },
      })
      const fallbackAdminId =
        user?.role === 'COLLEGE_ADMIN' && user?.collegeId === collegeId
          ? user.userId
          : college?.primaryAdminId
      if (fallbackAdminId) {
        await this.cohortReviewers.assignCollegeAdminToCohort(cohortId, fallbackAdminId)
        reviewers = await this.prisma.cohortReviewer.findMany({
          where: { cohortId },
          select: { reviewerId: true },
        })
      }
    }
    if (!reviewers.length) {
      throw new BadRequestException(
        'This cohort has no reviewers assigned. Create the cohort again or contact support.',
      )
    }
    const result = await this.enrollment.enrollCohortStudents(
      cohortId,
      rows,
      reviewers.map((r) => r.reviewerId),
    )
    return {
      ...result,
      loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`,
    }
  }

  async issueStudentCredentials(collegeId: string, cohortId: string, user: any) {
    this.collegesService.assertCollegeAccess(user, collegeId)
    const cohort = await this.prisma.cohort.findFirst({ where: { id: cohortId, collegeId } })
    if (!cohort) throw new NotFoundException('Cohort not found')
    const credentials = await this.enrollment.issueCohortLoginCredentials(cohortId)
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`
    return {
      message: 'New temporary passwords generated. Share securely with students.',
      loginUrl,
      credentials,
    }
  }

  async listTeam(collegeId: string, user: any) {
    this.collegesService.assertCollegeAccess(user, collegeId)
    const [admins, reviewers] = await Promise.all([
      this.prisma.user.findMany({
        where: { collegeId, role: 'COLLEGE_ADMIN' },
        select: { id: true, email: true, createdAt: true },
      }),
      this.prisma.user.findMany({
        where: { collegeId, role: 'REVIEWER' },
        select: {
          id: true,
          email: true,
          createdAt: true,
          reviewerProfile: { select: { firstName: true, lastName: true, isAvailable: true } },
        },
      }),
    ])
    return { admins, reviewers }
  }

  async inviteReviewer(collegeId: string, email: string, user: any) {
    this.collegesService.assertCollegeAccess(user, collegeId)
    return this.collegesService.createInviteToken(collegeId, email, InviteType.REVIEWER)
  }

  async listPublishedTemplates() {
    return this.prisma.projectTemplate.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        description: true,
        duration: true,
        difficulty: true,
        category: true,
      },
      orderBy: { title: 'asc' },
    })
  }

  async listCollegeReviewers(collegeId: string, user: any) {
    this.collegesService.assertCollegeAccess(user, collegeId)
    return this.prisma.user.findMany({
      where: { collegeId, role: 'REVIEWER' },
      select: {
        id: true,
        email: true,
        reviewerProfile: { select: { id: true, firstName: true, lastName: true } },
      },
    })
  }
}
