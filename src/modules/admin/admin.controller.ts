import { Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus, Put, Delete, Param, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger'
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard'
import { RolesGuard } from '@/common/guards/roles.guard'
import { Roles } from '@/common/decorators/roles.decorator'
import { Role } from '@prisma/client'
import { AdminService } from './admin.service'
import { CreateReviewerDto } from './dto/create-reviewer.dto'
import { CreateTemplateDto } from './dto/create-template.dto'
import { UpdateTemplateDto } from './dto/update-template.dto'
import { PublishTemplateDto } from './dto/publish-template.dto'

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all users (admin only)' })
  @ApiQuery({ name: 'role', required: false, enum: Role, description: 'Filter by role' })
  @ApiResponse({ status: 200, description: 'Returns list of all users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  async getAllUsers(@Query('role') role?: string) {
    return this.adminService.getAllUsers(role)
  }

  @Post('users/reviewer')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new reviewer account (admin only)' })
  @ApiResponse({ status: 201, description: 'Reviewer created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  @ApiResponse({ status: 409, description: 'Conflict - email already exists' })
  async createReviewer(@Body() createReviewerDto: CreateReviewerDto) {
    return this.adminService.createReviewer(createReviewerDto)
  }

  // ==================== Project Template Endpoints ====================

  @Post('templates')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new project template (admin only)' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  async createTemplate(@Body() createTemplateDto: CreateTemplateDto) {
    return this.adminService.createTemplate(createTemplateDto)
  }

  @Get('templates')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all project templates (admin only)' })
  @ApiQuery({ name: 'includeDrafts', required: false, type: Boolean, description: 'Include draft templates' })
  @ApiResponse({ status: 200, description: 'Returns list of templates' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  async getAllTemplates(@Query('includeDrafts') includeDrafts?: string) {
    return this.adminService.getAllTemplates(includeDrafts === 'true')
  }

  @Get('templates/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiOperation({ summary: 'Get a specific project template (admin only)' })
  @ApiResponse({ status: 200, description: 'Returns template details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getTemplateById(@Param('id') id: string) {
    return this.adminService.getTemplateById(id)
  }

  @Put('templates/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiOperation({ summary: 'Update a project template (admin only)' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid data or cannot edit published template' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async updateTemplate(@Param('id') id: string, @Body() updateTemplateDto: UpdateTemplateDto) {
    return this.adminService.updateTemplate(id, updateTemplateDto)
  }

  @Post('templates/publish')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a project template (admin only)' })
  @ApiResponse({ status: 200, description: 'Template published successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - template validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async publishTemplate(@Body() publishTemplateDto: PublishTemplateDto) {
    return this.adminService.publishTemplate(publishTemplateDto)
  }

  @Post('templates/:id/archive')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiOperation({ summary: 'Archive a project template (admin only)' })
  @ApiResponse({ status: 200, description: 'Template archived successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async archiveTemplate(@Param('id') id: string) {
    return this.adminService.archiveTemplate(id)
  }

  @Delete('templates/:id')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiOperation({ summary: 'Delete a project template (admin only)' })
  @ApiResponse({ status: 200, description: 'Template deleted successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - cannot delete published template' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async deleteTemplate(@Param('id') id: string) {
    return this.adminService.deleteTemplate(id)
  }

  @Put('templates/:id/assign-reviewer')
  @Roles(Role.SUPER_ADMIN)
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiOperation({ summary: 'Assign a reviewer to a template (admin only)' })
  @ApiResponse({ status: 200, description: 'Reviewer assigned successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async assignReviewer(@Param('id') id: string, @Body() body: { reviewerId: string | null }) {
    return this.adminService.assignReviewer(id, body.reviewerId)
  }
}
