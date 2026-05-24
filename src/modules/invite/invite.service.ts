import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { AuthService } from '@/modules/auth/auth.service'
import { CohortReviewerAssignmentService } from '@/common/services/cohort-reviewer-assignment.service'
import * as bcrypt from 'bcrypt'
import { InviteType, Role } from '@prisma/client'
import { InviteSetupDto } from './dto/invite-setup.dto'

@Injectable()
export class InviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly cohortReviewers: CohortReviewerAssignmentService,
  ) {}

  async validateToken(collegeId: string, token: string) {
    const invite = await this.findActiveInvite({ collegeId, token })
    return this.buildValidationResponse(invite)
  }

  async validatePlatformToken(token: string) {
    const invite = await this.findActiveInvite({ token, collegeId: null })
    if (invite.type !== InviteType.GLOBAL_REVIEWER) {
      throw new NotFoundException('Invalid or expired invite')
    }
    return this.buildValidationResponse(invite)
  }

  async acceptExistingUser(collegeId: string, token: string, userId: string) {
    const invite = await this.assertValidInvite({ collegeId, token })
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.email !== invite.email) {
      throw new UnauthorizedException('Email does not match invite')
    }
    await this.applyInviteToUser(invite, user.id)
    await this.linkReviewerToCollegeCohorts(invite, user.id, user.email)
    return this.authService.signinWithUserId(user.id)
  }

  async acceptExistingPlatformUser(token: string, userId: string) {
    const invite = await this.assertValidInvite({ token, collegeId: null })
    if (invite.type !== InviteType.GLOBAL_REVIEWER) {
      throw new BadRequestException('Invalid invite type')
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.email !== invite.email) {
      throw new UnauthorizedException('Email does not match invite')
    }
    await this.applyGlobalReviewerInvite(invite, user.id)
    return this.authService.signinWithUserId(user.id)
  }

  async setupAccount(dto: InviteSetupDto) {
    const collegeId = dto.collegeId?.trim() || null
    const invite = await this.assertValidInvite({ collegeId, token: dto.token })

    const existing = await this.prisma.user.findUnique({ where: { email: invite.email } })
    if (invite.type === InviteType.STUDENT) {
      return this.setupStudentAccount(invite, dto.password, existing)
    }

    if (existing) {
      throw new BadRequestException('Account already exists. Please sign in.')
    }

    const hashed = await bcrypt.hash(dto.password, 10)

    if (invite.type === InviteType.GLOBAL_REVIEWER) {
      const user = await this.createGlobalReviewerFromInvite(invite, hashed)
      return this.authService.signinWithUserId(user.id)
    }

    const role: Role =
      invite.type === InviteType.COLLEGE_ADMIN ? Role.COLLEGE_ADMIN : Role.REVIEWER

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: invite.email,
          password: hashed,
          role,
          collegeId: invite.collegeId,
          ...(role === Role.REVIEWER
            ? {
                reviewerProfile: {
                  create: this.reviewerNamesFromInvite(invite),
                },
              }
            : {}),
        },
      })

      if (role === Role.COLLEGE_ADMIN && invite.collegeId) {
        await tx.college.update({
          where: { id: invite.collegeId },
          data: { primaryAdminId: created.id },
        })
        await tx.reviewerProfile.upsert({
          where: { userId: created.id },
          create: {
            userId: created.id,
            ...this.reviewerNamesFromInvite(invite),
            expertise: [],
          },
          update: {},
        })
      }

      await tx.inviteToken.update({
        where: { id: invite.id },
        data: { used: true, usedAt: new Date() },
      })

      return created
    })

    await this.linkReviewerToCollegeCohorts(invite, user.id, user.email)
    return this.authService.signinWithUserId(user.id)
  }

  private async setupStudentAccount(
    invite: { id: string; email: string; collegeId: string | null },
    password: string,
    existing: { id: string; role: Role } | null,
  ) {
    if (!existing) {
      throw new BadRequestException('Student account not found. Contact your college admin.')
    }
    if (existing.role !== Role.STUDENT) {
      throw new BadRequestException('This invite is not valid for your account type.')
    }

    const hashed = await bcrypt.hash(password, 10)
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.id },
        data: { password: hashed },
      })
      await tx.inviteToken.update({
        where: { id: invite.id },
        data: { used: true, usedAt: new Date() },
      })
    })

    return this.authService.signinWithUserId(existing.id)
  }

  private async createGlobalReviewerFromInvite(
    invite: { id: string; email: string; inviteeName: string | null },
    hashed: string,
  ) {
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: invite.email,
          password: hashed,
          role: Role.REVIEWER,
          reviewerProfile: {
            create: {
              ...this.reviewerNamesFromInvite(invite),
              expertise: [],
            },
          },
        },
      })

      await tx.inviteToken.update({
        where: { id: invite.id },
        data: { used: true, usedAt: new Date() },
      })

      return created
    })

    return user
  }

  private reviewerNamesFromInvite(invite: { email: string; inviteeName?: string | null }) {
    if (invite.inviteeName?.trim()) {
      const parts = invite.inviteeName.trim().split(/\s+/)
      return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' ') || '',
      }
    }
    return {
      firstName: invite.email.split('@')[0],
      lastName: '',
    }
  }

  private async buildValidationResponse(invite: {
    email: string
    collegeId: string | null
    type: InviteType
    college: { name: string; logoUrl: string | null } | null
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: invite.email },
    })

    const requiresPassword =
      invite.type === InviteType.STUDENT
        ? true
        : !existingUser

    return {
      valid: true,
      email: invite.email,
      collegeId: invite.collegeId,
      collegeName: invite.college?.name ?? 'Internza',
      collegeLogoUrl: invite.college?.logoUrl ?? null,
      type: invite.type,
      userExists: !!existingUser,
      requiresPassword,
    }
  }

  private async findActiveInvite(params: { collegeId?: string | null; token: string }) {
    const invite = await this.prisma.inviteToken.findFirst({
      where: {
        token: params.token,
        used: false,
        collegeId: params.collegeId ?? null,
      },
      include: { college: true },
    })
    if (!invite) throw new NotFoundException('Invalid or expired invite')
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite token has expired')
    }
    return invite
  }

  private async linkReviewerToCollegeCohorts(
    invite: { collegeId: string | null; type: InviteType },
    userId: string,
    email: string,
  ) {
    if (!invite.collegeId) return
    if (invite.type !== InviteType.REVIEWER && invite.type !== InviteType.COLLEGE_ADMIN) {
      return
    }
    const profileId = await this.cohortReviewers.ensureReviewerProfileForUser(userId, email)
    await this.cohortReviewers.assignReviewerToCollegeCohorts(invite.collegeId, profileId)
  }

  private async applyInviteToUser(
    invite: { id: string; collegeId: string | null; email: string; type: InviteType },
    userId: string,
  ) {
    const role: Role =
      invite.type === InviteType.COLLEGE_ADMIN ? Role.COLLEGE_ADMIN : Role.REVIEWER

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { role, collegeId: invite.collegeId },
      })
      if (role === Role.COLLEGE_ADMIN && invite.collegeId) {
        await tx.college.update({
          where: { id: invite.collegeId },
          data: { primaryAdminId: userId },
        })
      }
      if (role === Role.REVIEWER) {
        const existing = await tx.reviewerProfile.findUnique({ where: { userId } })
        if (!existing) {
          await tx.reviewerProfile.create({
            data: {
              userId,
              firstName: invite.email.split('@')[0],
              lastName: '',
              expertise: [],
            },
          })
        }
      }
      await tx.inviteToken.update({
        where: { id: invite.id },
        data: { used: true, usedAt: new Date() },
      })
    })
  }

  private async applyGlobalReviewerInvite(
    invite: { id: string; email: string; inviteeName?: string | null },
    userId: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { role: Role.REVIEWER, collegeId: null },
      })
      const existing = await tx.reviewerProfile.findUnique({ where: { userId } })
      if (!existing) {
        await tx.reviewerProfile.create({
          data: {
            userId,
            ...this.reviewerNamesFromInvite(invite),
            expertise: [],
          },
        })
      }
      await tx.inviteToken.update({
        where: { id: invite.id },
        data: { used: true, usedAt: new Date() },
      })
    })
  }

  private async assertValidInvite(params: { collegeId?: string | null; token: string }) {
    return this.findActiveInvite({
      collegeId: params.collegeId ?? null,
      token: params.token,
    })
  }
}
