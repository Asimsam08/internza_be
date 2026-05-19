import { Module } from '@nestjs/common'
import { CohortCertificatesService } from './cohort-certificates.service'
import { CollegesModule } from '@/modules/colleges/colleges.module'

@Module({
  imports: [CollegesModule],
  providers: [CohortCertificatesService],
  exports: [CohortCertificatesService],
})
export class CertificatesModule {}
