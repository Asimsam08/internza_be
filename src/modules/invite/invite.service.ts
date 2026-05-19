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
    const invite = await this.prisma.inviteToken.findFirst({
      where: { collegeId, token, used: false },
      include: { college: true },
    })
    if (!invite) throw new NotFoundException('Invalid or expired invite')
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite token has expired')
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invite.email },
    })

    return {
      valid: true,
      email: invite.email,
      collegeId: invite.collegeId,
      collegeName: invite.college.name,
      collegeLogoUrl: invite.college.logoUrl,
      type: invite.type,
      userExists: !!existingUser,
      requiresPassword: !existingUser,
    }
  }

  async acceptExistingUser(collegeId: string, token: string, userId: string) {
    const invite = await this.assertValidInvite(collegeId, token)
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.email !== invite.email) {
      throw new UnauthorizedException('Email does not match invite')
    }
    await this.applyInviteToUser(invite, user.id)
    await this.linkReviewerToCollegeCohorts(invite, user.id, user.email)
    return this.authService.signinWithUserId(user.id)
  }

  async setupAccount(dto: InviteSetupDto) {
    const invite = await this.assertValidInvite(dto.collegeId, dto.token)
    const existing = await this.prisma.user.findUnique({ where: { email: invite.email } })
    if (existing) {
      throw new BadRequestException('Account already exists. Please sign in.')
    }

    const hashed = await bcrypt.hash(dto.password, 10)
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
                  create: {
                    firstName: invite.email.split('@')[0],
                    lastName: '',
                    expertise: [],
                  },
                },
              }
            : {}),
        },
      })

      if (role === Role.COLLEGE_ADMIN) {
        await tx.college.update({
          where: { id: invite.collegeId },
          data: { primaryAdminId: created.id },
        })
        await tx.reviewerProfile.upsert({
          where: { userId: created.id },
          create: {
            userId: created.id,
            firstName: invite.email.split('@')[0],
            lastName: '',
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

  private async linkReviewerToCollegeCohorts(
    invite: { collegeId: string; type: InviteType },
    userId: string,
    email: string,
  ) {
    if (invite.type !== InviteType.REVIEWER && invite.type !== InviteType.COLLEGE_ADMIN) {
      return
    }
    const profileId = await this.cohortReviewers.ensureReviewerProfileForUser(userId, email)
    await this.cohortReviewers.assignReviewerToCollegeCohorts(invite.collegeId, profileId)
  }

  private async applyInviteToUser(
    invite: { id: string; collegeId: string; email: string; type: InviteType },
    userId: string,
  ) {
    const role: Role =
      invite.type === InviteType.COLLEGE_ADMIN ? Role.COLLEGE_ADMIN : Role.REVIEWER

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { role, collegeId: invite.collegeId },
      })
      if (role === Role.COLLEGE_ADMIN) {
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

  private async assertValidInvite(collegeId: string, token: string) {
    const invite = await this.prisma.inviteToken.findFirst({
      where: { collegeId, token, used: false },
    })
    if (!invite) throw new NotFoundException('Invalid or expired invite')
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite token has expired')
    }
    return invite
  }
}
