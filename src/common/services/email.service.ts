import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private transporter: nodemailer.Transporter | null = null

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST')
    const user = this.config.get<string>('SMTP_USER')
    const pass =
      this.config.get<string>('SMTP_PASSWORD') ||
      this.config.get<string>('SMTP_PASS')

    const hasRealCredentials =
      !!host &&
      !!user &&
      !!pass &&
      !user.includes('your-email') &&
      !pass.includes('your-app-password')

    if (hasRealCredentials) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(this.config.get<string>('SMTP_PORT') || '587', 10),
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: { user, pass },
      })
    }
  }

  async sendMagicInvite(params: {
    to: string
    collegeName: string
    inviteUrl: string
    roleLabel: string
  }): Promise<boolean> {
    const { to, collegeName, inviteUrl, roleLabel } = params
    const subject = `You're invited to ${collegeName} on Internza`
    const html = `
      <p>Hello,</p>
      <p>You have been invited as <strong>${roleLabel}</strong> for <strong>${collegeName}</strong>.</p>
      <p><a href="${inviteUrl}">Accept invitation</a></p>
      <p>This link expires in 7 days.</p>
      <p>— Internza</p>
    `
    return this.send({ to, subject, html })
  }

  async sendCohortStudentInvite(params: {
    to: string
    cohortName: string
    collegeName: string
    loginUrl: string
    tempPassword?: string
  }): Promise<boolean> {
    const { to, cohortName, collegeName, loginUrl, tempPassword } = params
    const subject = `Welcome to ${cohortName} — ${collegeName}`
    const html = `
      <p>Hello,</p>
      <p>You have been enrolled in cohort <strong>${cohortName}</strong> at <strong>${collegeName}</strong>.</p>
      <p><a href="${loginUrl}">Sign in to Internza</a></p>
      ${tempPassword ? `<p>Temporary password: <code>${tempPassword}</code> (change after first login)</p>` : ''}
      <p>— Internza</p>
    `
    return this.send({ to, subject, html })
  }

  private async send(opts: { to: string; subject: string; html: string }): Promise<boolean> {
    const from = this.config.get<string>('SMTP_FROM') || 'noreply@internza.com'
    if (!this.transporter) {
      this.logger.warn(`Email skipped (SMTP not configured): ${opts.subject} → ${opts.to}`)
      return false
    }
    try {
      await this.transporter.sendMail({ from, ...opts })
      return true
    } catch (error) {
      this.logger.error(`Email failed for ${opts.to}: ${(error as Error).message}`)
      return false
    }
  }
}
