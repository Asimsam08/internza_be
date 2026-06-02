import { Module } from '@nestjs/common'
import { CertificatesController } from './certificates.controller'
import { CertificatesService } from './certificates.service'
import { CohortCertificatesService } from './cohort-certificates.service'
import { CertificatePdfRenderer } from './certificate-pdf.renderer'
import { CertificateImageLoader } from './certificate-image.loader'
import { CollegesModule } from '@/modules/colleges/colleges.module'

@Module({
  imports: [CollegesModule],
  controllers: [CertificatesController],
  providers: [
    CertificatesService,
    CohortCertificatesService,
    CertificatePdfRenderer,
    CertificateImageLoader,
  ],
  exports: [CertificatesService, CohortCertificatesService, CertificatePdfRenderer],
})
export class CertificatesModule {}
