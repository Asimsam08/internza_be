import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Res,
  Request,
  UseGuards,
} from '@nestjs/common'
import { Response } from 'express'
import { CertificatesService } from './certificates.service'
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard'
import { RolesGuard } from '@/common/guards/roles.guard'
import { Roles } from '@/common/decorators/roles.decorator'
import { Public } from '@/common/decorators/public.decorator'

@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Public()
  @Get('samples/cohort')
  sampleCohort(
    @Res() res: Response,
    @Query('inline') inline?: string,
    @Query('collegeId') collegeId?: string,
  ) {
    return this.certificates.streamSamplePdf(
      'cohort',
      res,
      inline === '1' || inline === 'true',
      collegeId,
    )
  }

  @Public()
  @Get('samples/self-paced')
  sampleSelfPaced(@Res() res: Response, @Query('inline') inline?: string) {
    return this.certificates.streamSamplePdf('self-paced', res, inline === '1' || inline === 'true')
  }

  @Public()
  @Get('verify/:hash')
  verify(@Param('hash') hash: string) {
    return this.certificates.verifyCertificate(hash)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'COLLEGE_ADMIN', 'SUPER_ADMIN')
  @Post('issue')
  issue(@Body('planId') planId: string, @Request() req: any) {
    return this.certificates.issueCertificateForPlan(planId, req.user.userId, req.user.role)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'COLLEGE_ADMIN', 'SUPER_ADMIN')
  @Get('plans/:planId/download')
  download(@Param('planId') planId: string, @Request() req: any, @Res() res: Response) {
    return this.certificates.streamPlanCertificate(planId, req.user.userId, req.user.role, res, false)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'COLLEGE_ADMIN', 'SUPER_ADMIN')
  @Get('plans/:planId/preview')
  preview(@Param('planId') planId: string, @Request() req: any, @Res() res: Response) {
    return this.certificates.streamPlanCertificate(planId, req.user.userId, req.user.role, res, true)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'COLLEGE_ADMIN', 'SUPER_ADMIN')
  @Get('plans/:planId')
  getMeta(@Param('planId') planId: string, @Request() req: any) {
    return this.certificates.getCertificateMeta(planId, req.user.userId, req.user.role)
  }

  /** README alias: id = certificate uuid, plan id, or verification hash */
  @Public()
  @Get(':id')
  getById(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.userId
    const role = req.user?.role
    return this.certificates.getCertificateByIdentifier(id, userId, role)
  }
}
