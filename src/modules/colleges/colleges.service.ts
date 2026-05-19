import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { StorageService } from '@/common/services/storage.service'
import { EmailService } from '@/common/services/email.service'
import { InviteType } from '@prisma/client'
import { randomBytes } from 'crypto'
import { ConfigService } from '@nestjs/config'
import { CreateCollegeDto } from './dto/create-college.dto'

@Injectable()
export class CollegesService {
  private readonly logger = new Logger(CollegesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async listColleges() {
    const colleges = await this.prisma.college.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { cohorts: true, users: true } },
        cohorts: {
          include: { _count: { select: { members: true } } },
        },
      },
    })

    return colleges.map((c) => {
      const studentsTotal = c.cohorts.reduce((sum, ch) => sum + ch._count.members, 0)
      return {
        id: c.id,
        name: c.name,
        domain: c.domain,
        logoUrl: c.logoUrl,
        cohortsCount: c._count.cohorts,
        studentsTotal,
        createdAt: c.createdAt,
      }
    })
  }

  async createCollege(dto: CreateCollegeDto, logo?: Express.Multer.File) {
    const domain = dto.domain.trim().toLowerCase()
    const existing = await this.prisma.college.findUnique({ where: { domain } })
    if (existing) throw new ConflictException('College domain already exists')

    const college = await this.prisma.college.create({
      data: {
        name: dto.name.trim(),
        domain,
      },
    })

    let logoUrl: string | null = null
    if (logo) {
      const relative = await this.storage.saveCollegeLogo(college.id, logo)
      logoUrl = this.storage.getPublicUrl(relative)
      await this.prisma.college.update({
        where: { id: college.id },
        data: { logoUrl: relative },
      })
    }

    const invite = await this.createInviteToken(college.id, dto.primaryAdminEmail, InviteType.COLLEGE_ADMIN)

    return {
      college: { ...college, logoUrl: logoUrl ?? college.logoUrl },
      invite: invite ? { inviteUrl: invite.inviteUrl, expiresAt: invite.expiresAt } : null,
      inviteSent: invite.emailSent,
    }
  }

  async resendAdminInvite(collegeId: string, email: string) {
    const college = await this.prisma.college.findUnique({ where: { id: collegeId } })
    if (!college) throw new NotFoundException('College not found')
    await this.createInviteToken(collegeId, email, InviteType.COLLEGE_ADMIN)
    return { message: 'Invite resent' }
  }

  async createInviteToken(collegeId: string, email: string, type: InviteType) {
    const normalizedEmail = email.trim().toLowerCase()
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await this.prisma.inviteToken.updateMany({
      where: { collegeId, email: normalizedEmail, type, used: false },
      data: { used: true, usedAt: new Date() },
    })

    await this.prisma.inviteToken.create({
      data: { collegeId, email: normalizedEmail, token, type, expiresAt },
    })

    const college = await this.prisma.college.findUnique({ where: { id: collegeId } })
    const frontend = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3001'
    const inviteUrl = `${frontend}/invite/${collegeId}/${token}`
    const roleLabel = type === InviteType.COLLEGE_ADMIN ? 'College Admin' : 'Reviewer'

    const emailSent = await this.email.sendMagicInvite({
      to: normalizedEmail,
      collegeName: college?.name || 'College',
      inviteUrl,
      roleLabel,
    })

    if (!emailSent) {
      this.logger.warn(`Invite created but email not sent to ${normalizedEmail}. URL: ${inviteUrl}`)
    }

    return { token, expiresAt, inviteUrl, emailSent }
  }

  async getCollegeStats(collegeId: string) {
    const college = await this.prisma.college.findUnique({
      where: { id: collegeId },
      include: {
        cohorts: {
          include: {
            members: true,
            plans: { select: { isCompleted: true } },
          },
        },
      },
    })
    if (!college) throw new NotFoundException('College not found')

    const activeCohorts = college.cohorts.filter((c) => c.status === 'ACTIVE').length
    const totalStudents = college.cohorts.reduce((s, c) => s + c.members.length, 0)
    const completedPlans = college.cohorts.reduce(
      (s, c) => s + c.plans.filter((p) => p.isCompleted).length,
      0,
    )
    const completionPct =
      totalStudents > 0 ? Math.round((completedPlans / totalStudents) * 100) : 0

    return {
      college: {
        id: college.id,
        name: college.name,
        domain: college.domain,
        logoUrl: college.logoUrl,
      },
      stats: {
        activeCohorts,
        students: totalStudents,
        completionPct,
      },
    }
  }

  assertCollegeAccess(user: { userId: string; role: string; collegeId?: string }, collegeId: string) {
    if (user.role === 'SUPER_ADMIN') return
    if (user.role === 'COLLEGE_ADMIN' && user.collegeId === collegeId) return
    throw new ForbiddenException('Access denied to this college')
  }
}
