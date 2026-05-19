import { Module } from '@nestjs/common'
import { CollegeAdminController } from './college-admin.controller'
import { CollegeAdminService } from './college-admin.service'
import { CollegesModule } from '@/modules/colleges/colleges.module'
import { CohortSharedModule } from '@/common/cohort-shared.module'
import { CertificatesModule } from '@/modules/certificates/certificates.module'

@Module({
  imports: [CollegesModule, CohortSharedModule, CertificatesModule],
  controllers: [CollegeAdminController],
  providers: [CollegeAdminService],
})
export class CollegeAdminModule {}
