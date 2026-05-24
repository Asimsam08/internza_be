import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { SupabaseStorageService } from '@/common/services/supabase-storage.service'
import { resolveStoragePublicUrl } from '@/common/helper'
import { InviteTokenService } from '@/common/services/invite-token.service'
import { InviteType } from '@prisma/client'
import { CreateCollegeDto } from './dto/create-college.dto'

@Injectable()
export class CollegesService {
  private readonly logger = new Logger(CollegesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
    private readonly invites: InviteTokenService,
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
        logoUrl: this.resolveLogoUrl(c.logoUrl),
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

    let logoPath: string | null = null
    if (logo) {
      logoPath = await this.uploadCollegeLogoFile(college.id, logo)
    }

    const invite = await this.createInviteToken(college.id, dto.primaryAdminEmail, InviteType.COLLEGE_ADMIN)

    return {
      college: {
        ...college,
        logoUrl: this.resolveLogoUrl(logoPath ?? college.logoUrl),
      },
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
    if (type !== InviteType.COLLEGE_ADMIN && type !== InviteType.REVIEWER) {
      throw new BadRequestException('Invalid invite type for college invite')
    }
    return this.invites.createCollegeInvite(collegeId, email, type)
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
        logoUrl: this.resolveLogoUrl(college.logoUrl),
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

  resolveLogoUrl(logoUrl?: string | null): string | null {
    return resolveStoragePublicUrl(logoUrl)
  }

  async uploadCollegeLogoFile(collegeId: string, file: Express.Multer.File): Promise<string> {
    this.storage.validateLogo(file)

    const college = await this.prisma.college.findUnique({
      where: { id: collegeId },
      select: { logoUrl: true },
    })
    if (!college) throw new NotFoundException('College not found')

    const path = await this.storage.upload({
      folder: 'logo',
      ownerId: collegeId,
      file,
    })

    await this.storage.remove(college.logoUrl)

    await this.prisma.college.update({
      where: { id: collegeId },
      data: { logoUrl: path },
    })

    return path
  }

  async updateCollegeLogo(
    collegeId: string,
    file: Express.Multer.File,
    user: { userId: string; role: string; collegeId?: string },
  ) {
    this.assertCollegeAccess(user, collegeId)
    const path = await this.uploadCollegeLogoFile(collegeId, file)
    const college = await this.prisma.college.findUnique({
      where: { id: collegeId },
      select: { id: true, name: true, domain: true },
    })
    if (!college) throw new NotFoundException('College not found')

    return {
      college: {
        ...college,
        logoUrl: this.resolveLogoUrl(path),
      },
    }
  }
}
