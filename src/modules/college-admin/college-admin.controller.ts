import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  Res,
  UseInterceptors,
  UploadedFile,
  Patch,
} from '@nestjs/common'
import { Response } from 'express'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { multerOptions } from '@/common/config/multer.config'
import { CollegeAdminService } from './college-admin.service'
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard'
import { RolesGuard } from '@/common/guards/roles.guard'
import { Roles } from '@/common/decorators/roles.decorator'
import { CreateCohortDto } from './dto/create-cohort.dto'
import { InviteReviewerDto } from './dto/invite-reviewer.dto'
import { CohortCertificatesService } from '@/modules/certificates/cohort-certificates.service'

@Controller('admin/colleges/:collegeId')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COLLEGE_ADMIN', 'SUPER_ADMIN')
export class CollegeAdminController {
  constructor(
    private readonly service: CollegeAdminService,
    private readonly certificates: CohortCertificatesService,
  ) {}

  @Patch('logo')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  updateLogo(
    @Param('collegeId') collegeId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    return this.service.updateCollegeLogo(collegeId, file, req.user)
  }

  @Get('cohorts')
  listCohorts(@Param('collegeId') collegeId: string, @Request() req: any) {
    return this.service.listCohorts(collegeId, req.user)
  }

  @Post('cohorts')
  createCohort(
    @Param('collegeId') collegeId: string,
    @Body() dto: CreateCohortDto,
    @Request() req: any,
  ) {
    return this.service.createCohort(collegeId, dto, req.user)
  }

  @Post('cohorts/:cohortId/students/csv')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  importCsv(
    @Param('collegeId') collegeId: string,
    @Param('cohortId') cohortId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    return this.service.importStudents(collegeId, cohortId, file, req.user)
  }

  @Get('team')
  team(@Param('collegeId') collegeId: string, @Request() req: any) {
    return this.service.listTeam(collegeId, req.user)
  }

  @Post('team/reviewers/invite')
  inviteReviewer(
    @Param('collegeId') collegeId: string,
    @Body() dto: InviteReviewerDto,
    @Request() req: any,
  ) {
    return this.service.inviteReviewer(collegeId, dto.email, req.user)
  }

  @Get('templates')
  templates() {
    return this.service.listPublishedTemplates()
  }

  @Get('reviewers')
  reviewers(@Param('collegeId') collegeId: string, @Request() req: any) {
    return this.service.listCollegeReviewers(collegeId, req.user)
  }

  @Post('cohorts/:cohortId/students/issue-credentials')
  issueCredentials(
    @Param('collegeId') collegeId: string,
    @Param('cohortId') cohortId: string,
    @Request() req: any,
  ) {
    return this.service.issueStudentCredentials(collegeId, cohortId, req.user)
  }

  @Get('cohorts/:cohortId/certificates')
  async downloadCertificates(
    @Param('collegeId') collegeId: string,
    @Param('cohortId') cohortId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    return this.certificates.streamZip(collegeId, cohortId, req.user, res)
  }
}
