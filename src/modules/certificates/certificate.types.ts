export type CertificateVariant = 'cohort' | 'self-paced'

export interface CertificateRenderInput {
  variant: CertificateVariant
  studentName: string
  programName: string
  issuedDate: Date
  certificateId: string
  /** Full public URL, e.g. https://internza.vercel.app/verify/{id} */
  verificationUrl?: string
  collegeName?: string
  cohortName?: string
  collegeLogoBuffer?: Buffer | null
  durationLabel?: string
  /** Reviewers (cohort) or mentors (self-paced) */
  reviewerNames?: string
}

export interface SampleCertificateOptions {
  collegeLogoBuffer?: Buffer | null
}
