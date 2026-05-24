import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '@/prisma/prisma.service'
import { EmailService } from '@/common/services/email.service'
import { InviteType } from '@prisma/client'
import { randomBytes } from 'crypto'

export interface CreatedInvite {
  token: string
  expiresAt: Date
  inviteUrl: string
  emailSent: boolean
}

@Injectable()
export class InviteTokenService {
  private readonly logger = new Logger(InviteTokenService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async createCollegeInvite(
    collegeId: string,
    email: string,
    type: 'COLLEGE_ADMIN' | 'REVIEWER',
  ): Promise<CreatedInvite> {
    const college = await this.prisma.college.findUnique({ where: { id: collegeId } })
    const normalizedEmail = email.trim().toLowerCase()
    const { token, expiresAt } = await this.persistToken({
      collegeId,
      email: normalizedEmail,
      type,
    })

    const inviteUrl = this.buildCollegeInviteUrl(collegeId, token)
    const roleLabel = type === 'COLLEGE_ADMIN' ? 'College Admin' : 'Reviewer'
    const emailSent = await this.email.sendMagicInvite({
      to: normalizedEmail,
      collegeName: college?.name || 'College',
      inviteUrl,
      roleLabel,
    })

    this.logIfNotSent(emailSent, normalizedEmail, inviteUrl)
    return { token, expiresAt, inviteUrl, emailSent }
  }

  async createGlobalReviewerInvite(email: string, fullName: string): Promise<CreatedInvite> {
    const normalizedEmail = email.trim().toLowerCase()
    const inviteeName = fullName.trim()
    const { token, expiresAt } = await this.persistToken({
      collegeId: null,
      email: normalizedEmail,
      type: InviteType.GLOBAL_REVIEWER,
      inviteeName,
    })

    const inviteUrl = this.buildPlatformInviteUrl(token)
    const emailSent = await this.email.sendMagicInvite({
      to: normalizedEmail,
      collegeName: 'Internza',
      inviteUrl,
      roleLabel: 'Reviewer',
    })

    this.logIfNotSent(emailSent, normalizedEmail, inviteUrl)
    return { token, expiresAt, inviteUrl, emailSent }
  }

  async createStudentInvite(
    collegeId: string,
    cohortId: string,
    email: string,
    cohortName: string,
    collegeName: string,
  ): Promise<CreatedInvite> {
    const normalizedEmail = email.trim().toLowerCase()
    const { token, expiresAt } = await this.persistToken({
      collegeId,
      cohortId,
      email: normalizedEmail,
      type: InviteType.STUDENT,
    })

    const inviteUrl = this.buildCollegeInviteUrl(collegeId, token)
    const emailSent = await this.email.sendStudentInvite({
      to: normalizedEmail,
      cohortName,
      collegeName,
      inviteUrl,
    })

    this.logIfNotSent(emailSent, normalizedEmail, inviteUrl)
    return { token, expiresAt, inviteUrl, emailSent }
  }

  async sendExistingStudentEnrolledEmail(
    email: string,
    cohortName: string,
    collegeName: string,
  ): Promise<boolean> {
    const loginUrl = `${this.frontendBase()}/login`
    return this.email.sendCohortStudentInvite({
      to: email,
      cohortName,
      collegeName,
      loginUrl,
    })
  }

  private async persistToken(params: {
    collegeId: string | null
    cohortId?: string
    email: string
    type: InviteType
    inviteeName?: string
  }) {
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await this.prisma.inviteToken.updateMany({
      where: {
        email: params.email,
        type: params.type,
        used: false,
        collegeId: params.collegeId,
        ...(params.cohortId ? { cohortId: params.cohortId } : {}),
      },
      data: { used: true, usedAt: new Date() },
    })

    await this.prisma.inviteToken.create({
      data: {
        collegeId: params.collegeId,
        cohortId: params.cohortId,
        email: params.email,
        token,
        type: params.type,
        inviteeName: params.inviteeName,
        expiresAt,
      },
    })

    return { token, expiresAt }
  }

  private buildCollegeInviteUrl(collegeId: string, token: string) {
    return `${this.frontendBase()}/invite/${collegeId}/${token}`
  }

  private buildPlatformInviteUrl(token: string) {
    return `${this.frontendBase()}/invite/platform/${token}`
  }

  private frontendBase() {
    return this.config.get<string>('FRONTEND_URL') || 'http://localhost:3001'
  }

  private logIfNotSent(sent: boolean, email: string, inviteUrl: string) {
    if (!sent) {
      this.logger.warn(`Invite created but email not sent to ${email}. URL: ${inviteUrl}`)
    }
  }
}
