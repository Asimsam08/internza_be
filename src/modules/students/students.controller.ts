import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  Query,
  Res,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { multerScreenshotsOptions } from '@/common/config/multer.config';
import { StudentsService } from './students.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SubmitTaskDto } from './dto/submit-task.dto';
import { ApproveTaskDto } from './dto/approve-task.dto';
import { EnrollInPlanDto } from '../../common/dto/student.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'SUPER_ADMIN')
  @Get('profile')
  async getProfile(@Request() req) {
    return this.studentsService.getStudentProfile(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @Patch('profile')
  async updateProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.studentsService.updateStudentProfile(
      req.user.userId,
      updateProfileDto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @Get('plans/options')
  async getPlanOptions(@Request() req) {
    return this.studentsService.getPlanOptions(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @Get('plans/:durationType/projects')
  async getAvailableProjects(@Request() req, @Param('durationType') durationType: string) {
    return this.studentsService.getAvailableProjects(durationType as any);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @Post('plans/enroll')
  async enrollInPlan(
    @Request() req,
    @Body() enrollDto: EnrollInPlanDto,
  ) {
    return this.studentsService.enrollInPlan(
      req.user.userId,
      enrollDto.durationType,
      enrollDto.customWeeks,
      enrollDto.selectedProjectIds,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @Get('dashboard')
  async getDashboard(@Request() req, @Query('planId') planId?: string) {
    return this.studentsService.getStudentDashboard(req.user.userId, planId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @Get('certificate')
  async getMyCertificate(@Request() req) {
    return this.studentsService.getMyCertificate(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @Get('certificate/download')
  async downloadMyCertificate(@Request() req, @Res() res: Response) {
    return this.studentsService.downloadMyCertificate(req.user.userId, req.user.role, res);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @Get('certificate/preview')
  async previewMyCertificate(@Request() req, @Res() res: Response) {
    return this.studentsService.previewMyCertificate(req.user.userId, req.user.role, res);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'COLLEGE_ADMIN', 'SUPER_ADMIN')
  @Get('plans/:planId/certificate')
  async getCertificateMeta(@Request() req, @Param('planId') planId: string) {
    return this.studentsService.getCertificateMeta(
      planId,
      req.user.userId,
      req.user.role,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @Get('projects/templates')
  async getProjectTemplates() {
    return this.studentsService.getProjectTemplates();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @Post('tasks/:taskId/screenshots')
  @UseInterceptors(FilesInterceptor('files', 10, multerScreenshotsOptions))
  async uploadTaskScreenshots(
    @Request() req,
    @Param('taskId') taskId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.studentsService.uploadTaskScreenshots(
      req.user.userId,
      taskId,
      files,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @Post('tasks/submit')
  async submitTask(
    @Request() req,
    @Body() submitTaskDto: SubmitTaskDto,
  ) {
    return this.studentsService.submitTask(
      req.user.userId,
      submitTaskDto.taskId,
      submitTaskDto.prLink,
      submitTaskDto.commitHash,
      submitTaskDto.description,
      submitTaskDto.screenshots,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('REVIEWER', 'COLLEGE_ADMIN', 'SUPER_ADMIN')
  @Post('tasks/approve')
  async approveTask(
    @Request() req,
    @Body() approveTaskDto: ApproveTaskDto,
  ) {
    return this.studentsService.approveTask(
      approveTaskDto.taskId,
      req.user.userId,
      approveTaskDto.feedback,
      req.user.collegeId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('REVIEWER', 'COLLEGE_ADMIN', 'SUPER_ADMIN')
  @Post('tasks/reject')
  async rejectTask(
    @Request() req,
    @Body() approveTaskDto: ApproveTaskDto,
  ) {
    return this.studentsService.rejectTask(
      approveTaskDto.taskId,
      req.user.userId,
      approveTaskDto.feedback || 'Task rejected',
      req.user.collegeId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('REVIEWER', 'COLLEGE_ADMIN', 'SUPER_ADMIN')
  @Get('reviewer/dashboard')
  async getReviewerDashboard(@Request() req) {
    return this.studentsService.getReviewerDashboard(req.user.userId, req.user.collegeId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('REVIEWER', 'COLLEGE_ADMIN', 'SUPER_ADMIN')
  @Get('reviewer/projects')
  async getReviewerProjects(@Request() req) {
    return this.studentsService.getReviewerProjects(req.user.userId, req.user.collegeId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('REVIEWER', 'COLLEGE_ADMIN', 'SUPER_ADMIN')
  @Get('reviewer/history')
  async getReviewerHistory(
    @Request() req,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Query('projectTitle') projectTitle?: string,
  ) {
    return this.studentsService.getReviewerHistory(
      req.user.userId,
      projectId,
      status,
      projectTitle,
      req.user.collegeId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('REVIEWER', 'COLLEGE_ADMIN', 'SUPER_ADMIN')
  @Get('reviewer/project/:projectId')
  async getReviewerProjectDetail(@Request() req, @Param('projectId') projectId: string) {
    return this.studentsService.getReviewerProjectDetail(
      req.user.userId,
      projectId,
      req.user.collegeId,
    );
  }
}
