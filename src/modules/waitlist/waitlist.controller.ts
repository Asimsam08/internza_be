import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { Role } from '@prisma/client'
import { Public } from '@/common/decorators/public.decorator'
import { Roles } from '@/common/decorators/roles.decorator'
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard'
import { RolesGuard } from '@/common/guards/roles.guard'
import { JoinWaitlistDto } from './dto/join-waitlist.dto'
import { WaitlistService } from './waitlist.service'

@Controller()
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Public()
  @Post('waitlist')
  join(@Body() dto: JoinWaitlistDto) {
    return this.waitlistService.join(dto)
  }

  @Get('super-admin/waitlist')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  list() {
    return this.waitlistService.listAll()
  }
}
