import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { CollegesService } from '@/modules/colleges/colleges.service'
import { CertificatePdfRenderer } from './certificate-pdf.renderer'
import { CertificateImageLoader } from './certificate-image.loader'
import { CertificatesService } from './certificates.service'
import { buildCertificateVerificationUrl } from '@/common/certificate-url'
import * as archiver from 'archiver'
import { Response } from 'express'

@Injectable()
export class CohortCertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collegesService: CollegesService,
    private readonly renderer: CertificatePdfRenderer,
    private readonly images: CertificateImageLoader,
    private readonly certificatesService: CertificatesService,
  ) {}

  async streamZip(collegeId: string, cohortId: string, user: any, res: Response) {
    this.collegesService.assertCollegeAccess(user, collegeId)

    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, collegeId },
      include: {
        college: true,
        template: true,
        members: {
          include: {
            user: { include: { studentProfile: true } },
          },
        },
        reviewers: {
          include: {
            reviewer: { include: { user: true } },
          },
        },
        plans: {
          where: { isCompleted: true },
          include: {
            student: { include: { user: true } },
            certificate: true,
          },
        },
      },
    })

    if (!cohort) throw new NotFoundException('Cohort not found')

    const collegeLogoBuffer = await this.images.loadFromUrlOrPath(cohort.college.logoUrl)

    const certifiedStudents = cohort.members
      .map((m) => {
        const name = m.user.studentProfile
          ? `${m.user.studentProfile.firstName} ${m.user.studentProfile.lastName}`.trim()
          : m.user.email
        const plan = cohort.plans.find((p) => p.student?.userId === m.userId)
        return { name, completed: !!plan, planId: plan?.id }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    const reviewerNames = cohort.reviewers
      .map((r) => `${r.reviewer.firstName} ${r.reviewer.lastName}`.trim())
      .filter(Boolean)
      .join(', ')

    const completedCount = certifiedStudents.filter((s) => s.completed).length
    const total = certifiedStudents.length

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${cohort.name.replace(/\s+/g, '_')}_certificates.zip"`,
    )

    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.pipe(res)

    const batchId = `BATCH-${cohort.name.replace(/\s+/g, '-').slice(0, 12).toUpperCase()}`
    const batchBuffer = await this.renderer.render({
      variant: 'cohort',
      collegeName: cohort.college.name,
      cohortName: `${cohort.name} — Batch Summary`,
      programName: cohort.template.title,
      studentName: `${completedCount} of ${total} students certified`,
      reviewerNames: reviewerNames || 'Program Reviewers',
      issuedDate: new Date(),
      certificateId: batchId,
      verificationUrl: buildCertificateVerificationUrl(batchId),
      collegeLogoBuffer,
    })
    archive.append(batchBuffer, { name: 'batch-certificate.pdf' })

    for (const student of certifiedStudents.filter((s) => s.completed && s.planId)) {
      await this.certificatesService.issueForCompletedPlan(student.planId!)
      const pdf = await this.certificatesService.renderCertificatePdfForPlan(student.planId!)
      const safeName = student.name.replace(/[^a-z0-9_-]/gi, '_')
      archive.append(pdf, { name: `individual/${safeName}.pdf` })
    }

    await archive.finalize()
  }
}
