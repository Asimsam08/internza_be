import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { CollegesService } from '@/modules/colleges/colleges.service'
import PDFDocument from 'pdfkit'
import * as archiver from 'archiver'
import { Response } from 'express'
@Injectable()
export class CohortCertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collegesService: CollegesService,
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
          },
        },
      },
    })

    if (!cohort) throw new NotFoundException('Cohort not found')

    const certifiedStudents = cohort.members
      .map((m) => {
        const name = m.user.studentProfile
          ? `${m.user.studentProfile.firstName} ${m.user.studentProfile.lastName}`.trim()
          : m.user.email
        const completed = cohort.plans.some((p) => p.student?.userId === m.userId)
        return { name, completed }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    const facultyNames = cohort.reviewers
      .map((r) => `${r.reviewer.firstName} ${r.reviewer.lastName}`.trim())
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

    const batchBuffer = await this.renderBatchPdf({
      collegeName: cohort.college.name,
      cohortName: cohort.name,
      programName: cohort.template.title,
      completedCount,
      total,
      facultyNames,
      students: certifiedStudents,
    })
    archive.append(batchBuffer, { name: 'batch-certificate.pdf' })

    for (const student of certifiedStudents.filter((s) => s.completed)) {
      const individual = await this.renderIndividualPdf({
        collegeName: cohort.college.name,
        cohortName: cohort.name,
        programName: cohort.template.title,
        studentName: student.name,
        facultyNames,
        issuedMonth: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      })
      const safeName = student.name.replace(/[^a-z0-9_-]/gi, '_')
      archive.append(individual, { name: `individual/${safeName}.pdf` })
    }

    await archive.finalize()
  }

  private renderBatchPdf(data: {
    collegeName: string
    cohortName: string
    programName: string
    completedCount: number
    total: number
    facultyNames: string
    students: { name: string; completed: boolean }[]
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 })
      const chunks: Buffer[] = []
      doc.on('data', (c) => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      doc.fontSize(22).text('Official Batch Certificate', { align: 'center' })
      doc.moveDown()
      doc.fontSize(12)
      doc.text(`College: ${data.collegeName}`)
      doc.text(`Cohort: ${data.cohortName}`)
      doc.text(`Program: ${data.programName}`)
      doc.text(`${data.completedCount}/${data.total} students certified`)
      doc.moveDown()
      doc.text(`Faculty: ${data.facultyNames || '—'}`)
      doc.moveDown()
      doc.text('Students:')
      data.students.forEach((s, i) => {
        doc.text(`${i + 1}. ${s.name} ${s.completed ? '✓' : '—'}`)
      })
      doc.end()
    })
  }

  private renderIndividualPdf(data: {
    collegeName: string
    cohortName: string
    programName: string
    studentName: string
    facultyNames: string
    issuedMonth: string
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 })
      const chunks: Buffer[] = []
      doc.on('data', (c) => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      doc.fontSize(20).text('Certificate of Completion', { align: 'center' })
      doc.moveDown(2)
      doc.fontSize(16).text(data.studentName, { align: 'center' })
      doc.moveDown()
      doc.fontSize(12)
      doc.text(`${data.collegeName} — ${data.cohortName}`, { align: 'center' })
      doc.text(data.programName, { align: 'center' })
      doc.moveDown(2)
      doc.text(`Faculty: ${data.facultyNames || '—'}`, { align: 'center' })
      doc.text(data.issuedMonth, { align: 'center' })
      doc.end()
    })
  }
}
