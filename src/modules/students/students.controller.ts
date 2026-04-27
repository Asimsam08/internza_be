import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { StudentsService } from './students.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
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
}
