import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { multerOptions } from '@/common/config/multer.config'
import { CollegesService } from './colleges.service'
import { CreateCollegeDto } from './dto/create-college.dto'
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard'
import { RolesGuard } from '@/common/guards/roles.guard'
import { Roles } from '@/common/decorators/roles.decorator'
import { ResendInviteDto } from './dto/resend-invite.dto'

@Controller('super-admin/colleges')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class CollegesController {
  constructor(private readonly collegesService: CollegesService) {}

  @Get()
  list() {
    return this.collegesService.listColleges()
  }

  @Post()
  @UseInterceptors(FileInterceptor('logo', multerOptions))
  create(@Body() dto: CreateCollegeDto, @UploadedFile() logo?: Express.Multer.File) {
    return this.collegesService.createCollege(dto, logo)
  }

  @Post(':id/invite-admin')
  resendInvite(@Param('id') id: string, @Body() dto: ResendInviteDto) {
    return this.collegesService.resendAdminInvite(id, dto.email)
  }
}

@Controller('admin/colleges')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CollegeAdminStatsController {
  constructor(private readonly collegesService: CollegesService) {}

  @Get(':collegeId')
  @Roles('SUPER_ADMIN', 'COLLEGE_ADMIN')
  getCollege(@Param('collegeId') collegeId: string, @Request() req: any) {
    this.collegesService.assertCollegeAccess(req.user, collegeId)
    return this.collegesService.getCollegeStats(collegeId)
  }
}
