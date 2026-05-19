import { Module } from '@nestjs/common'
import { CollegesController, CollegeAdminStatsController } from './colleges.controller'
import { CollegesService } from './colleges.service'
import { EmailService } from '@/common/services/email.service'
import { StorageService } from '@/common/services/storage.service'

@Module({
  controllers: [CollegesController, CollegeAdminStatsController],
  providers: [CollegesService, EmailService, StorageService],
  exports: [CollegesService, EmailService],
})
export class CollegesModule {}
