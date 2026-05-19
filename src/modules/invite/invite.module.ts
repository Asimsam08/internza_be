import { Module } from '@nestjs/common'
import { InviteController } from './invite.controller'
import { InviteService } from './invite.service'
import { AuthModule } from '@/modules/auth/auth.module'
import { CohortSharedModule } from '@/common/cohort-shared.module'

@Module({
  imports: [AuthModule, CohortSharedModule],
  controllers: [InviteController],
  providers: [InviteService],
})
export class InviteModule {}
