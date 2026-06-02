import { Injectable } from '@nestjs/common'
import PDFDocument = require('pdfkit')
import { CertificateImageLoader } from './certificate-image.loader'
import { CertificateRenderInput, CertificateVariant } from './certificate.types'

type PdfDoc = InstanceType<typeof PDFDocument>

interface Theme {
  primary: string
  accent: string
  muted: string
  paper: string
  ink: string
}

const THEMES: Record<CertificateVariant, Theme> = {
  cohort: {
    primary: '#0f2744',
    accent: '#c9a227',
    muted: '#5c6b7a',
    paper: '#faf8f4',
    ink: '#1a1a1a',
  },
  'self-paced': {
    primary: '#312e81',
    accent: '#6366f1',
    muted: '#64748b',
    paper: '#f8f7ff',
    ink: '#0f172a',
  },
}

@Injectable()
export class CertificatePdfRenderer {
  constructor(private readonly images: CertificateImageLoader) {}

  async render(input: CertificateRenderInput): Promise<Buffer> {
    const internzaMark = await this.images.loadInternzaMark()
    return this.buildPdf(input, internzaMark)
  }

  private buildPdf(input: CertificateRenderInput, internzaMark: Buffer | null): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const theme = THEMES[input.variant]
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margins: { top: 36, bottom: 36, left: 48, right: 48 },
      })
      const chunks: Buffer[] = []
      doc.on('data', (c) => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const pageW = doc.page.width
      const pageH = doc.page.height
      const innerX = 40
      const innerY = 32
      const innerW = pageW - 80
      const innerH = pageH - 64

      doc.save()
      doc.rect(0, 0, pageW, pageH).fill(theme.paper)
      doc.restore()

      this.drawFrame(doc, innerX, innerY, innerW, innerH, theme)
      this.drawHeader(doc, input, theme, innerX, innerY, innerW, internzaMark)
      this.drawBody(doc, input, theme, innerX, innerY, innerW, innerH)
      this.drawFooter(doc, input, theme, innerX, innerY, innerW, innerH, internzaMark)

      doc.end()
    })
  }

  private drawFrame(
    doc: PdfDoc,
    x: number,
    y: number,
    w: number,
    h: number,
    theme: Theme,
  ) {
    doc.save()
    doc.lineWidth(2).strokeColor(theme.accent).rect(x, y, w, h).stroke()
    doc.lineWidth(0.75).strokeColor(theme.primary).rect(x + 8, y + 8, w - 16, h - 16).stroke()

    const corner = 18
    const corners: [number, number][] = [
      [x + 14, y + 14],
      [x + w - 14, y + 14],
      [x + 14, y + h - 14],
      [x + w - 14, y + h - 14],
    ]
    doc.lineWidth(1.5).strokeColor(theme.accent)
    for (const [cx, cy] of corners) {
      doc.moveTo(cx, cy).lineTo(cx + (cx < x + w / 2 ? corner : -corner), cy).stroke()
      doc.moveTo(cx, cy).lineTo(cx, cy + (cy < y + h / 2 ? corner : -corner)).stroke()
    }
    doc.restore()
  }

  private drawHeader(
    doc: PdfDoc,
    input: CertificateRenderInput,
    theme: Theme,
    frameX: number,
    frameY: number,
    frameW: number,
    internzaMark: Buffer | null,
  ) {
    const centerX = frameX + frameW / 2
    let y = frameY + 24

    if (input.variant === 'cohort') {
      if (input.collegeLogoBuffer) {
        try {
          const logoSize = 64
          doc.image(input.collegeLogoBuffer, centerX - logoSize / 2, y, {
            fit: [logoSize, logoSize],
            align: 'center',
            valign: 'center',
          })
          y += logoSize + 12
        } catch {
          this.drawCollegeMonogram(doc, input.collegeName || 'College', centerX, y, theme)
          y += 68
        }
      } else {
        this.drawCollegeMonogram(doc, input.collegeName || 'College', centerX, y, theme)
        y += 68
      }

      doc
        .font('Helvetica-Bold')
        .fontSize(22)
        .fillColor(theme.primary)
        .text(input.collegeName || 'Partner Institution', frameX + 24, y, {
          width: frameW - 48,
          align: 'center',
        })
      y += 30

      if (input.cohortName) {
        doc
          .font('Helvetica')
          .fontSize(11)
          .fillColor(theme.muted)
          .text(input.cohortName, frameX + 24, y, { width: frameW - 48, align: 'center' })
        y += 20
      }
    } else {
      // Self-paced: Internza icon + wordmark
      const iconSize = 44
      this.drawInternzaMark(doc, centerX - iconSize / 2, y, iconSize, theme, internzaMark)
      y += iconSize + 10

      this.drawInternzaWordmark(doc, centerX, y, theme, true)
      // Space for wordmark + subtitle so CERTIFICATE line doesn't collide
      y += 72
    }

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(input.variant === 'cohort' ? theme.accent : theme.accent)
      .text('CERTIFICATE OF COMPLETION', frameX + 24, y, {
        width: frameW - 48,
        align: 'center',
        characterSpacing: 3,
      })
  }

  private drawBody(
    doc: PdfDoc,
    input: CertificateRenderInput,
    theme: Theme,
    frameX: number,
    frameY: number,
    frameW: number,
    frameH: number,
  ) {
    const centerY = frameY + frameH * 0.44
    const textW = frameW - 80
    const textX = frameX + 40

    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor(theme.muted)
      .text('This is to certify that', textX, centerY - 52, { width: textW, align: 'center' })

    doc
      .font('Times-BoldItalic')
      .fontSize(34)
      .fillColor(theme.ink)
      .text(input.studentName, textX, centerY - 28, { width: textW, align: 'center' })

    const programLine =
      input.variant === 'cohort'
        ? 'has successfully completed the internship program'
        : 'has successfully completed the self-paced internship'

    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor(theme.muted)
      .text(programLine, textX, centerY + 22, { width: textW, align: 'center' })

    doc
      .font('Helvetica-Bold')
      .fontSize(15)
      .fillColor(theme.primary)
      .text(input.programName, textX, centerY + 42, { width: textW, align: 'center' })

    let detailY = centerY + 66
    if (input.durationLabel && input.variant === 'self-paced') {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(theme.muted)
        .text(input.durationLabel, textX, detailY, { width: textW, align: 'center' })
      detailY += 18
    }

    if (input.reviewerNames) {
      const label = input.variant === 'cohort' ? 'Reviewed by' : 'Mentored by'
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(theme.muted)
        .text(`${label} ${input.reviewerNames}`, textX, detailY, {
          width: textW,
          align: 'center',
        })
    }

    const issued = input.issuedDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(theme.muted)
      .text(`Issued on ${issued}`, textX, frameY + frameH - 108, { width: textW, align: 'center' })
  }

  private drawFooter(
    doc: PdfDoc,
    input: CertificateRenderInput,
    theme: Theme,
    frameX: number,
    frameY: number,
    frameW: number,
    frameH: number,
    internzaMark: Buffer | null,
  ) {
    const footerY = frameY + frameH - 78
    const centerX = frameX + frameW / 2

    doc
      .moveTo(frameX + 60, footerY - 8)
      .lineTo(frameX + frameW - 60, footerY - 8)
      .lineWidth(0.5)
      .strokeColor(theme.muted)
      .opacity(0.4)
      .stroke()
      .opacity(1)

    if (input.variant === 'cohort') {
      this.drawPoweredByInternza(doc, centerX, footerY + 2, theme, internzaMark)
    } else {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(theme.muted)
        .text('Verified Internship Platform', frameX + 24, footerY + 4, {
          width: frameW - 48,
          align: 'center',
        })
    }

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(theme.muted)
      .text(`Verification ID: ${input.certificateId}`, frameX + 24, footerY + 22, {
        width: frameW - 48,
        align: 'center',
      })

    if (input.verificationUrl) {
      this.drawVerificationLink(doc, input.verificationUrl, frameX + 24, footerY + 36, frameW - 48, theme)
    }
  }

  private drawVerificationLink(
    doc: PdfDoc,
    url: string,
    x: number,
    y: number,
    width: number,
    theme: Theme,
  ) {
    // Avoid PDFKit width/underline NaN edge-cases by using centered text layout.
    // Still copyable and stable across viewers.
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(theme.muted)
      .text(`Verify at ${url}`, x, y, { width, align: 'center' })
  }

  /** Cohort footer: [logo] Powered by internza */
  private drawPoweredByInternza(
    doc: PdfDoc,
    centerX: number,
    y: number,
    theme: Theme,
    internzaMark: Buffer | null,
  ) {
    const markSize = 18
    const gap = 5
    const label = 'Powered by '
    const brand = 'internza'

    doc.font('Helvetica').fontSize(9)
    const labelW = doc.widthOfString(label)
    doc.font('Helvetica-Bold').fontSize(9)
    const brandW = doc.widthOfString(brand)
    const totalW = markSize + gap + labelW + brandW
    let x = centerX - totalW / 2

    this.drawInternzaMark(doc, x, y - 2, markSize, theme, internzaMark)
    x += markSize + gap

    doc.font('Helvetica').fontSize(9).fillColor(theme.muted).text(label, x, y)
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(theme.accent)
      .text(brand, x + labelW, y)
  }

  private drawInternzaMark(
    doc: PdfDoc,
    x: number,
    y: number,
    size: number,
    theme: Theme,
    imageBuffer: Buffer | null,
  ) {
    if (imageBuffer) {
      try {
        doc.image(imageBuffer, x, y, { width: size, height: size })
        return
      } catch {
        /* fall through to vector mark */
      }
    }
    const cx = x + size / 2
    const cy = y + size / 2
    const r = size / 2
    doc.save()
    doc.circle(cx, cy, r).fill(theme.accent)
    doc
      .font('Helvetica-Bold')
      .fontSize(size * 0.55)
      .fillColor('#ffffff')
      .text('i', x, y + size * 0.2, { width: size, align: 'center' })
    doc.restore()
  }

  private drawCollegeMonogram(
    doc: PdfDoc,
    collegeName: string,
    centerX: number,
    y: number,
    theme: Theme,
  ) {
    const initials = collegeName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('')
    const size = 56
    const x = centerX - size / 2
    doc.save()
    doc.circle(centerX, y + size / 2, size / 2).fill(theme.primary)
    doc
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor('#ffffff')
      .text(initials || 'C', x, y + 16, { width: size, align: 'center' })
    doc.restore()
  }

  private drawInternzaWordmark(
    doc: PdfDoc,
    centerX: number,
    y: number,
    theme: Theme,
    large: boolean,
  ) {
    const fontSize = large ? 36 : 14
    doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(theme.primary)
    const text = 'internza'
    const w = doc.widthOfString(text)
    doc.text(text, centerX - w / 2, y)
    if (large) {
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor(theme.muted)
        .text('Internship Platform', centerX - 70, y + fontSize + 6, {
          width: 140,
          align: 'center',
        })
    }
  }
}
