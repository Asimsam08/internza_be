import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { PrismaModule } from '@/prisma/prisma.module'
import { EmailService } from '@/common/services/email.service'
import { InviteTokenService } from '@/common/services/invite-token.service'

@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [AdminService, EmailService, InviteTokenService],
  exports: [AdminService],
})
export class AdminModule {}
