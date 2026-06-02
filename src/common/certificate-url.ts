/** Public app URL used on certificates for verification links. */
export function getFrontendBaseUrl(): string {
  const base =
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    'https://internza.vercel.app'
  return base.replace(/\/$/, '')
}

export function buildCertificateVerificationUrl(verificationId: string): string {
  const id = verificationId.trim()
  return `${getFrontendBaseUrl()}/verify/${encodeURIComponent(id)}`
}
