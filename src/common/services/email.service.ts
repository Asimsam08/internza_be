import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private resend: Resend | null = null
  private readonly fromAddress: string

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY')
    this.fromAddress = this.config.get<string>('EMAIL_FROM') || 'Internza <onboarding@resend.dev>'

    if (apiKey) {
      this.resend = new Resend(apiKey)
    } else {
      this.logger.warn('RESEND_API_KEY not set — emails will be skipped')
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

  async sendStudentInvite(params: {
    to: string
    cohortName: string
    collegeName: string
    inviteUrl: string
  }): Promise<boolean> {
    const { to, cohortName, collegeName, inviteUrl } = params
    const subject = `You're enrolled in ${cohortName} — ${collegeName}`
    const html = `
      <p>Hello,</p>
      <p>You have been enrolled in cohort <strong>${cohortName}</strong> at <strong>${collegeName}</strong>.</p>
      <p><a href="${inviteUrl}">Set up your account and sign in</a></p>
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
    if (!this.resend) {
      this.logger.warn(`Email skipped (Resend not configured): ${opts.subject} → ${opts.to}`)
      return false
    }
    try {
      const { error } = await this.resend.emails.send({
        from: this.fromAddress,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      })

      if (error) {
        this.logger.error(`Email failed for ${opts.to}: ${error.message}`)
        return false
      }

      this.logger.log(`Email sent to ${opts.to}: ${opts.subject}`)
      return true
    } catch (error) {
      this.logger.error(`Email failed for ${opts.to}: ${(error as Error).message}`)
      return false
    }
  }
}
