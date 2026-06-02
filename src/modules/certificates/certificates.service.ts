import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { CertificatePdfRenderer } from './certificate-pdf.renderer'
import { CertificateImageLoader } from './certificate-image.loader'
import { CertificateRenderInput, CertificateVariant } from './certificate.types'
import { resolveStoragePublicUrl } from '@/common/helper'
import { buildCertificateVerificationUrl } from '@/common/certificate-url'
import * as fs from 'fs/promises'
import * as path from 'path'
import { randomBytes } from 'crypto'
import { Response } from 'express'

@Injectable()
export class CertificatesService {
  private readonly certDir: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly renderer: CertificatePdfRenderer,
    private readonly images: CertificateImageLoader,
  ) {
    this.certDir = path.join(process.cwd(), 'uploads', 'certificates')
  }

  async issueForCompletedPlan(planId: string): Promise<void> {
    const plan = await this.prisma.internshipPlan.findUnique({
      where: { id: planId },
      include: {
        certificate: true,
        student: { include: { user: true } },
        cohort: {
          include: {
            college: true,
            template: true,
            reviewers: {
              include: { reviewer: true },
            },
          },
        },
        planProjects: {
          include: {
            template: { include: { reviewer: true } },
            reviewer: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!plan?.isCompleted || plan.certificate) return

    const verificationId = this.generateVerificationId()
    const input = await this.buildRenderInputFromPlan(plan, verificationId)
    const pdf = await this.renderer.render(input)
    await this.persistCertificate(
      plan.id,
      plan.studentId,
      plan.student.userId,
      verificationId,
      pdf,
    )
  }

  /** Self-paced student sidebar: certificate + verification id */
  async getStudentCertificate(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        internshipPlans: {
          where: { cohortId: null },
          orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
          include: {
            certificate: true,
            planProjects: { include: { template: true }, orderBy: { order: 'asc' } },
          },
        },
      },
    })
    if (!student) throw new NotFoundException('Student profile not found')

    const plan =
      student.internshipPlans.find((p) => p.certificate) ??
      student.internshipPlans.find((p) => p.isCompleted) ??
      student.internshipPlans[0]

    if (!plan) {
      return {
        available: false,
        issued: false,
        eligible: false,
        variant: 'self-paced' as const,
        message: 'No self-paced internship plan found',
      }
    }

    if (plan.isCompleted && !plan.certificate) {
      await this.issueForCompletedPlan(plan.id)
      const refreshed = await this.prisma.internshipPlan.findUnique({
        where: { id: plan.id },
        include: { certificate: true, planProjects: { include: { template: true }, orderBy: { order: 'asc' } } },
      })
      if (refreshed?.certificate) {
        const detail = await this.loadPlanForCertificateRender(refreshed.id)
        return this.formatStudentCertificate(
          refreshed.id,
          refreshed.certificate,
          refreshed.isCompleted,
          detail.cohortId,
          { reviewerNames: this.resolveReviewerNames(detail) },
        )
      }
    }

    if (plan.certificate) {
      const detail = await this.loadPlanForCertificateRender(plan.id)
      return this.formatStudentCertificate(plan.id, plan.certificate, plan.isCompleted, detail.cohortId, {
        reviewerNames: this.resolveReviewerNames(detail),
      })
    }

    return {
      available: false,
      issued: false,
      eligible: plan.isCompleted,
      planId: plan.id,
      variant: 'self-paced' as const,
      message: plan.isCompleted
        ? 'Certificate is being generated'
        : 'Complete your internship to unlock your certificate',
    }
  }

  async issueCertificateForPlan(planId: string, userId: string, role: string) {
    await this.assertPlanCertificateAccess(planId, userId, role)
    const plan = await this.prisma.internshipPlan.findUnique({ where: { id: planId } })
    if (!plan?.isCompleted) {
      throw new BadRequestException('Internship must be completed before issuing a certificate')
    }
    await this.issueForCompletedPlan(planId)
    return this.getCertificateMeta(planId, userId, role)
  }

  async getCertificateByIdentifier(id: string, userId?: string, role?: string) {
    if (id === 'verify' || id === 'samples' || id === 'plans' || id === 'issue') {
      throw new NotFoundException('Certificate not found')
    }

    const cert =
      (await this.prisma.certificate.findUnique({ where: { id } })) ??
      (await this.prisma.certificate.findUnique({ where: { planId: id } })) ??
      (await this.prisma.certificate.findFirst({ where: { certificateHash: id } }))

    if (!cert) {
      if (id.length >= 8 && id.length <= 64) {
        try {
          return this.verifyCertificate(id)
        } catch {
          throw new NotFoundException('Certificate not found')
        }
      }
      throw new NotFoundException('Certificate not found')
    }

    if (userId && role) {
      return this.getCertificateMeta(cert.planId, userId, role)
    }

    return this.verifyCertificate(cert.certificateHash)
  }

  async getPlanCertificateSummary(planId: string, userId: string) {
    const plan = await this.prisma.internshipPlan.findUnique({
      where: { id: planId },
      include: { certificate: true, student: { include: { user: true } } },
    })
    if (!plan || plan.student.userId !== userId) return null
    if (!plan.certificate) {
      return {
        issued: false,
        eligible: plan.isCompleted,
        planId: plan.id,
        variant: plan.cohortId ? 'cohort' : 'self-paced',
      }
    }
    return this.formatStudentCertificate(plan.id, plan.certificate, plan.isCompleted, plan.cohortId)
  }

  async getCertificateMeta(planId: string, userId: string, role: string) {
    await this.assertPlanCertificateAccess(planId, userId, role)
    const cert = await this.prisma.certificate.findUnique({
      where: { planId },
      include: {
        plan: {
          select: {
            isCompleted: true,
            cohortId: true,
            cohort: { select: { name: true, college: { select: { name: true } } } },
          },
        },
      },
    })
    if (!cert) {
      const plan = await this.prisma.internshipPlan.findUnique({ where: { id: planId } })
      return {
        issued: false,
        eligible: plan?.isCompleted ?? false,
        planId,
        variant: plan?.cohortId ? 'cohort' : 'self-paced',
      }
    }
    const detail = await this.loadPlanForCertificateRender(planId)
    return this.formatStudentCertificate(
      planId,
      cert,
      cert.plan.isCompleted,
      cert.plan.cohortId,
      {
        cohortName: cert.plan.cohort?.name,
        collegeName: cert.plan.cohort?.college?.name,
        reviewerNames: this.resolveReviewerNames(detail),
      },
    )
  }

  private formatStudentCertificate(
    planId: string,
    cert: { certificateHash: string; certificateUrl: string; issuedAt: Date; status: string },
    isCompleted: boolean,
    cohortId?: string | null,
    extra?: { cohortName?: string; collegeName?: string; reviewerNames?: string },
  ) {
    const variant = cohortId ? 'cohort' : 'self-paced'
    return {
      available: true,
      issued: true,
      eligible: isCompleted,
      planId,
      certificateId: cert.certificateHash,
      verificationId: cert.certificateHash,
      certificateUrl: resolveStoragePublicUrl(cert.certificateUrl),
      issuedAt: cert.issuedAt.toISOString(),
      status: cert.status,
      variant,
      cohortName: extra?.cohortName,
      collegeName: extra?.collegeName,
      reviewerNames: extra?.reviewerNames,
      downloadPath: `/certificates/plans/${planId}/download`,
      previewPath: `/certificates/plans/${planId}/preview`,
      verifyPath: `/certificates/verify/${cert.certificateHash}`,
      verifyUrl: buildCertificateVerificationUrl(cert.certificateHash),
      verificationUrl: buildCertificateVerificationUrl(cert.certificateHash),
    }
  }

  async streamPlanCertificate(
    planId: string,
    userId: string,
    role: string,
    res: Response,
    inline: boolean,
  ) {
    await this.assertPlanCertificateAccess(planId, userId, role)
    const cert = await this.prisma.certificate.findUnique({ where: { planId } })
    if (!cert) {
      const plan = await this.prisma.internshipPlan.findUnique({ where: { id: planId } })
      if (!plan?.isCompleted) {
        throw new BadRequestException('Internship is not completed yet')
      }
      await this.issueForCompletedPlan(planId)
      return this.streamPlanCertificate(planId, userId, role, res, inline)
    }

    const buffer = await this.renderCertificatePdfForPlan(planId)
    const filename = `internza-certificate-${cert.certificateHash.slice(0, 8)}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
    )
    res.send(buffer)
  }

  async verifyCertificate(hash: string) {
    const cert = await this.prisma.certificate.findFirst({
      where: { certificateHash: hash },
      include: {
        plan: {
          include: {
            student: true,
            cohort: {
              include: {
                college: true,
                reviewers: { include: { reviewer: true } },
              },
            },
            planProjects: {
              include: {
                template: { include: { reviewer: true } },
                reviewer: true,
              },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    })
    if (!cert) {
      // Support verification of sample certificates used in PDF samples.
      // These IDs are intentionally not stored in DB.
      const id = hash.trim()
      const sample = this.sampleVerificationPayload(id)
      if (sample) return sample
      throw new NotFoundException('Certificate not found')
    }
    const studentName = `${cert.plan.student.firstName} ${cert.plan.student.lastName}`.trim()
    const programName = this.resolveProgramName(cert.plan.planProjects)
    const reviewerNames = this.resolveReviewerNames(cert.plan)
    return {
      valid: cert.status === 'ISSUED',
      status: cert.status,
      certificateId: cert.certificateHash,
      verificationId: cert.certificateHash,
      verificationUrl: buildCertificateVerificationUrl(cert.certificateHash),
      studentName,
      programName,
      reviewerNames,
      issuedAt: cert.issuedAt.toISOString(),
      variant: cert.plan.cohortId ? 'cohort' : 'self-paced',
      collegeName: cert.plan.cohort?.college?.name,
      cohortName: cert.plan.cohort?.name,
    }
  }

  private sampleVerificationPayload(verificationId: string) {
    const known = new Set(['SAMPLE-COHORT', 'DEMO-COHORT-2026', 'DEMO-SELF-2026'])
    if (!known.has(verificationId)) return null

    const isCohort = verificationId.includes('COHORT')
    return {
      valid: true,
      status: 'ISSUED',
      certificateId: verificationId,
      verificationId,
      verificationUrl: buildCertificateVerificationUrl(verificationId),
      studentName: isCohort ? 'Sample Student' : 'Jordan Martinez',
      programName: isCohort ? 'Internship Program' : 'Cloud & DevOps Engineering Track',
      reviewerNames: isCohort ? 'Program Reviewers' : 'Alex Rivera',
      issuedAt: new Date().toISOString(),
      variant: isCohort ? ('cohort' as const) : ('self-paced' as const),
      collegeName: isCohort ? 'Partner Institution' : undefined,
      cohortName: isCohort ? 'Sample Cohort' : undefined,
    }
  }

  /** Render official PDF from current plan data (always includes latest verification URL). */
  async renderCertificatePdfForPlan(planId: string): Promise<Buffer> {
    const plan = await this.loadPlanForCertificateRender(planId)
    const cert = plan.certificate
    if (!cert) {
      throw new NotFoundException('Certificate not issued for this plan')
    }
    const input = await this.buildRenderInputFromPlan(plan, cert.certificateHash)
    return this.renderer.render(input)
  }

  async renderSample(variant: CertificateVariant, collegeId?: string): Promise<Buffer> {
    if (variant === 'cohort' && collegeId) {
      return this.renderCohortSampleForCollege(collegeId)
    }

    const input: CertificateRenderInput =
      variant === 'cohort'
        ? {
            variant: 'cohort',
            studentName: 'Alexandra Chen',
            programName: 'Full-Stack Web Development Internship',
            collegeName: 'Riverside Institute of Technology',
            cohortName: 'Spring 2026 Industry Cohort',
            reviewerNames: 'Dr. Sarah Mitchell, Prof. James Okonkwo',
            issuedDate: new Date(),
            certificateId: 'DEMO-COHORT-2026',
            verificationUrl: buildCertificateVerificationUrl('DEMO-COHORT-2026'),
            collegeLogoBuffer: null,
          }
        : {
            variant: 'self-paced',
            studentName: 'Jordan Martinez',
            programName: 'Cloud & DevOps Engineering Track',
            durationLabel: '12-week self-paced program',
            reviewerNames: 'Alex Rivera',
            issuedDate: new Date(),
            certificateId: 'DEMO-SELF-2026',
            verificationUrl: buildCertificateVerificationUrl('DEMO-SELF-2026'),
          }
    return this.renderer.render(input)
  }

  private async renderCohortSampleForCollege(collegeId: string): Promise<Buffer> {
    const college = await this.prisma.college.findUnique({
      where: { id: collegeId },
      include: {
        cohorts: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            template: true,
            reviewers: { include: { reviewer: true } },
          },
        },
      },
    })
    if (!college) throw new NotFoundException('College not found')

    const cohort = college.cohorts[0]
    const collegeLogoBuffer = await this.images.loadFromUrlOrPath(college.logoUrl)
    const reviewerNames =
      cohort?.reviewers
        .map((r) => `${r.reviewer.firstName} ${r.reviewer.lastName}`.trim())
        .filter(Boolean)
        .join(', ') || 'Program Reviewers'
    const sampleId = 'SAMPLE-COHORT'

    return this.renderer.render({
      variant: 'cohort',
      studentName: 'Sample Student',
      programName: cohort?.template?.title ?? 'Internship Program',
      collegeName: college.name,
      cohortName: cohort?.name ?? 'Sample Cohort',
      reviewerNames,
      issuedDate: new Date(),
      certificateId: sampleId,
      verificationUrl: buildCertificateVerificationUrl(sampleId),
      collegeLogoBuffer,
    })
  }

  streamSamplePdf(
    variant: CertificateVariant,
    res: Response,
    inline: boolean,
    collegeId?: string,
  ) {
    return this.renderSample(variant, collegeId).then((buffer) => {
      const filename =
        variant === 'cohort' ? 'internza-cohort-certificate-sample.pdf' : 'internza-self-paced-certificate-sample.pdf'
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader(
        'Content-Disposition',
        `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
      )
      res.send(buffer)
    })
  }

  private async persistCertificate(
    planId: string,
    studentId: string,
    userId: string,
    verificationId: string,
    pdf: Buffer,
  ) {
    await fs.mkdir(this.certDir, { recursive: true })
    const relativeUrl = `/uploads/certificates/${planId}.pdf`
    const fullPath = path.join(this.certDir, `${planId}.pdf`)
    await fs.writeFile(fullPath, pdf)

    await this.prisma.certificate.create({
      data: {
        planId,
        studentId,
        certificateUrl: relativeUrl,
        certificateHash: verificationId,
      },
    })

    await this.prisma.notification.create({
      data: {
        userId,
        type: 'CERTIFICATE_ISSUED',
        title: 'Your certificate is ready',
        message: 'Congratulations! Your internship certificate has been issued and is ready to download.',
        metadata: {
          planId,
          certificateHash: verificationId,
          verificationUrl: buildCertificateVerificationUrl(verificationId),
        },
      },
    })
  }

  private generateVerificationId(): string {
    return randomBytes(8).toString('hex').toUpperCase()
  }

  private async loadPlanForCertificateRender(planId: string) {
    const plan = await this.prisma.internshipPlan.findUnique({
      where: { id: planId },
      include: {
        certificate: true,
        student: true,
        cohort: {
          include: {
            college: true,
            template: true,
            reviewers: { include: { reviewer: true } },
          },
        },
        planProjects: {
          include: {
            template: { include: { reviewer: true } },
            reviewer: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    })
    if (!plan) throw new NotFoundException('Plan not found')
    return plan
  }

  private async buildRenderInputFromPlan(
    plan: {
      id: string
      cohortId: string | null
      durationType: string
      cohort?: {
        name: string
        college: { name: string; logoUrl: string | null }
        template: { title: string }
        reviewers: { reviewer: { firstName: string; lastName: string } }[]
      } | null
      student: { firstName: string; lastName: string }
      planProjects: {
        template: { title: string; reviewer?: { firstName: string; lastName: string } | null }
        reviewer?: { firstName: string; lastName: string } | null
      }[]
    },
    verificationId: string,
  ): Promise<CertificateRenderInput> {
    const studentName = `${plan.student.firstName} ${plan.student.lastName}`.trim()
    const programName = plan.cohort?.template?.title ?? this.resolveProgramName(plan.planProjects)
    const verificationUrl = buildCertificateVerificationUrl(verificationId)

    if (plan.cohortId && plan.cohort) {
      const logoBuffer = await this.images.loadFromUrlOrPath(plan.cohort.college.logoUrl)
      const reviewerNames = plan.cohort.reviewers
        .map((r) => `${r.reviewer.firstName} ${r.reviewer.lastName}`.trim())
        .filter(Boolean)
        .join(', ')
      return {
        variant: 'cohort',
        studentName,
        programName,
        collegeName: plan.cohort.college.name,
        cohortName: plan.cohort.name,
        collegeLogoBuffer: logoBuffer,
        reviewerNames: reviewerNames || undefined,
        issuedDate: new Date(),
        certificateId: verificationId,
        verificationUrl,
      }
    }

    const durationLabel = plan.durationType.replace(/_/g, ' ').toLowerCase()
    const reviewerNames = this.resolveReviewerNames(plan)
    return {
      variant: 'self-paced',
      studentName,
      programName,
      durationLabel: `${durationLabel} self-paced program`,
      reviewerNames,
      issuedDate: new Date(),
      certificateId: verificationId,
      verificationUrl,
    }
  }

  private resolveReviewerNames(plan: {
    cohortId?: string | null
    cohort?: {
      reviewers: { reviewer: { firstName: string; lastName: string } }[]
    } | null
    planProjects?: {
      reviewer?: { id?: string; firstName: string; lastName: string } | null
      template?: { reviewer?: { id?: string; firstName: string; lastName: string } | null }
    }[]
  }): string | undefined {
    if (plan.cohort?.reviewers?.length) {
      const names = plan.cohort.reviewers
        .map((r) => `${r.reviewer.firstName} ${r.reviewer.lastName}`.trim())
        .filter(Boolean)
      return names.length ? names.join(', ') : undefined
    }

    const unique = new Map<string, string>()
    for (const pp of plan.planProjects ?? []) {
      const reviewer = pp.reviewer ?? pp.template?.reviewer
      if (!reviewer) continue
      const name = `${reviewer.firstName} ${reviewer.lastName}`.trim()
      if (name) unique.set(reviewer.id ?? name, name)
    }
    const joined = [...unique.values()].join(', ')
    return joined || undefined
  }

  private resolveProgramName(
    planProjects: { template: { title: string } }[],
  ): string {
    if (!planProjects.length) return 'Internship Program'
    if (planProjects.length === 1) return planProjects[0].template.title
    return planProjects.map((p) => p.template.title).join(' · ')
  }

  private async readCertificateFile(certificateUrl: string): Promise<Buffer> {
    const localPath = certificateUrl.startsWith('/uploads')
      ? path.join(process.cwd(), certificateUrl.replace(/^\//, ''))
      : path.join(this.certDir, path.basename(certificateUrl))
    return fs.readFile(localPath)
  }

  private async assertPlanCertificateAccess(planId: string, userId: string, role: string) {
    const plan = await this.prisma.internshipPlan.findUnique({
      where: { id: planId },
      include: { student: { include: { user: true } }, cohort: true },
    })
    if (!plan) throw new NotFoundException('Plan not found')

    if (role === 'SUPER_ADMIN') return

    if (role === 'STUDENT') {
      if (plan.student.userId !== userId) {
        throw new ForbiddenException('You cannot access this certificate')
      }
      return
    }

    if (role === 'COLLEGE_ADMIN') {
      const admin = await this.prisma.user.findUnique({ where: { id: userId } })
      const cohort = plan.cohortId
        ? await this.prisma.cohort.findUnique({
            where: { id: plan.cohortId },
            select: { collegeId: true },
          })
        : null
      if (cohort?.collegeId && admin?.collegeId === cohort.collegeId) return
      throw new ForbiddenException('You cannot access this certificate')
    }

    throw new ForbiddenException('You cannot access this certificate')
  }
}
