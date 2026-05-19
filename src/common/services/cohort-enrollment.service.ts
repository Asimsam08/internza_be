import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '@/prisma/prisma.service'
import { EmailService } from '@/common/services/email.service'
import { DurationType, CohortStatus } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'

export interface CsvStudentRow {
  email: string
  name: string
  studentId?: string
}

export interface StudentCredential {
  email: string
  name: string
  temporaryPassword?: string
  isNewAccount: boolean
  emailSent: boolean
}

export interface EnrollCohortResult {
  enrolled: number
  skipped: number
  credentials: StudentCredential[]
}

@Injectable()
export class CohortEnrollmentService {
  private readonly logger = new Logger(CohortEnrollmentService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async enrollCohortStudents(
    cohortId: string,
    rows: CsvStudentRow[],
    reviewerProfileIds: string[],
  ): Promise<EnrollCohortResult> {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      include: { template: { include: { templateTasks: { orderBy: { order: 'asc' } } } }, college: true },
    })
    if (!cohort) throw new NotFoundException('Cohort not found')
    if (cohort.status === CohortStatus.ARCHIVED) {
      throw new BadRequestException('Cannot enroll students in archived cohort')
    }

    const template = cohort.template
    const totalWeeks = Math.max(1, template.duration)
    const durationType = this.mapWeeksToDuration(totalWeeks)
    const combination = this.buildCombination(totalWeeks)
    const loginUrl = `${this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000'}/login`

    let enrolled = 0
    let skipped = 0
    const credentials: StudentCredential[] = []
    if (!reviewerProfileIds.length) {
      throw new BadRequestException(
        'At least one cohort reviewer is required before enrolling students.',
      )
    }
    const primaryReviewerId = reviewerProfileIds[0]

    for (const row of rows) {
      const email = row.email.trim().toLowerCase()
      if (!email) {
        skipped++
        continue
      }

      const nameParts = row.name.trim().split(/\s+/)
      const firstName = nameParts[0] || 'Student'
      const lastName = nameParts.slice(1).join(' ') || ''
      const displayName = row.name.trim() || email

      const existing = await this.prisma.user.findUnique({ where: { email } })
      if (existing) {
        const hasPlan = await this.prisma.internshipPlan.findFirst({
          where: { student: { userId: existing.id }, cohortId },
        })
        if (hasPlan) {
          skipped++
          continue
        }
      }

      let tempPassword: string | undefined

      await this.prisma.$transaction(async (tx) => {
        let userId: string
        let studentProfileId: string

        if (existing) {
          userId = existing.id
          const profile = await tx.studentProfile.findUnique({ where: { userId } })
          if (!profile) {
            const created = await tx.studentProfile.create({
              data: { userId, firstName, lastName, university: cohort.college.name },
            })
            studentProfileId = created.id
          } else {
            studentProfileId = profile.id
            if (!existing.collegeId) {
              await tx.user.update({
                where: { id: userId },
                data: { collegeId: cohort.collegeId },
              })
            }
          }
        } else {
          tempPassword = randomBytes(8).toString('hex')
          const hashed = await bcrypt.hash(tempPassword, 10)
          const user = await tx.user.create({
            data: {
              email,
              password: hashed,
              role: 'STUDENT',
              collegeId: cohort.collegeId,
              studentProfile: {
                create: {
                  firstName,
                  lastName,
                  university: cohort.college.name,
                },
              },
            },
            include: { studentProfile: true },
          })
          userId = user.id
          studentProfileId = user.studentProfile!.id
        }

        await tx.cohortMember.upsert({
          where: { cohortId_userId: { cohortId, userId } },
          create: {
            cohortId,
            userId,
            studentId: studentProfileId,
            externalStudentId: row.studentId,
          },
          update: { externalStudentId: row.studentId },
        })

        const plan = await tx.internshipPlan.create({
          data: {
            studentId: studentProfileId,
            durationType,
            totalWeeks,
            combination,
            cohortId,
            startedAt: cohort.startDate,
          },
        })

        const planProject = await tx.planProject.create({
          data: {
            planId: plan.id,
            templateId: template.id,
            order: 1,
            status: 'AVAILABLE',
            startedAt: cohort.startDate,
            reviewerId: primaryReviewerId,
          },
        })

        const milestone = await tx.milestone.create({
          data: {
            projectId: planProject.id,
            title: `${template.title} — Cohort Tasks`,
            description: template.description,
            order: 1,
          },
        })

        const cohortDays = Math.max(
          1,
          Math.ceil((cohort.endDate.getTime() - cohort.startDate.getTime()) / (1000 * 60 * 60 * 24)),
        )
        const daysPerTask = Math.max(1, Math.floor(cohortDays / Math.max(template.templateTasks.length, 1)))

        for (let j = 0; j < template.templateTasks.length; j++) {
          const tt = template.templateTasks[j]
          const isFirst = j === 0
          const startAt = isFirst ? cohort.startDate : null
          const dueAt = isFirst
            ? new Date(cohort.startDate.getTime() + daysPerTask * 24 * 60 * 60 * 1000)
            : null

          await tx.task.create({
            data: {
              milestoneId: milestone.id,
              title: tt.title,
              description: tt.description,
              order: tt.order,
              durationDays: tt.durationDays,
              status: isFirst ? 'DRAFT' : 'LOCKED',
              startAt,
              dueAt,
              isLocked: !isFirst,
            },
          })
        }
      })

      const emailSent = await this.email.sendCohortStudentInvite({
        to: email,
        cohortName: cohort.name,
        collegeName: cohort.college.name,
        loginUrl,
        tempPassword,
      })

      if (!emailSent && tempPassword) {
        this.logger.warn(`Login email not sent to ${email} — share temporary password manually`)
      }

      credentials.push({
        email,
        name: displayName,
        temporaryPassword: tempPassword,
        isNewAccount: !!tempPassword,
        emailSent,
      })

      enrolled++
    }

    await this.prisma.cohort.update({
      where: { id: cohortId },
      data: { status: CohortStatus.ACTIVE },
    })

    return { enrolled, skipped, credentials }
  }

  /** Reset passwords for cohort students and return new temporary passwords (for testing / resend) */
  async issueCohortLoginCredentials(cohortId: string): Promise<StudentCredential[]> {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      include: {
        college: true,
        members: {
          include: {
            user: { include: { studentProfile: true } },
          },
        },
      },
    })
    if (!cohort) throw new NotFoundException('Cohort not found')

    const loginUrl = `${this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000'}/login`
    const results: StudentCredential[] = []

    for (const member of cohort.members) {
      const email = member.user.email
      const profile = member.user.studentProfile
      const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : email

      const tempPassword = randomBytes(8).toString('hex')
      const hashed = await bcrypt.hash(tempPassword, 10)
      await this.prisma.user.update({
        where: { id: member.userId },
        data: { password: hashed, role: 'STUDENT' },
      })

      const emailSent = await this.email.sendCohortStudentInvite({
        to: email,
        cohortName: cohort.name,
        collegeName: cohort.college.name,
        loginUrl,
        tempPassword,
      })

      results.push({
        email,
        name,
        temporaryPassword: tempPassword,
        isNewAccount: true,
        emailSent,
      })
    }

    return results
  }

  private mapWeeksToDuration(weeks: number): DurationType {
    if (weeks <= 4) return DurationType.FOUR_WEEKS
    if (weeks <= 8) return DurationType.EIGHT_WEEKS
    if (weeks <= 12) return DurationType.TWELVE_WEEKS
    return DurationType.CUSTOM
  }

  private buildCombination(totalWeeks: number): number[] {
    if (totalWeeks <= 4) return [4]
    if (totalWeeks <= 8) return [4, 4]
    if (totalWeeks <= 12) return [4, 4, 4]
    return [totalWeeks]
  }
}
