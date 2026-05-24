import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { Role, TemplateStatus } from '@prisma/client'
import { CreateReviewerDto } from './dto/create-reviewer.dto'
import { InviteTokenService } from '@/common/services/invite-token.service'
import { CreateTemplateDto, TemplateTaskDto } from './dto/create-template.dto'
import { UpdateTemplateDto } from './dto/update-template.dto'
import { PublishTemplateDto } from './dto/publish-template.dto'

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private readonly invites: InviteTokenService,
  ) {}

  async getAllUsers(role?: string) {
    // Convert lowercase role to uppercase to match Prisma enum
    const where = role ? { role: role.toUpperCase() as Role } : {}

    const users = await this.prisma.user.findMany({
      where,
      include: {
        studentProfile: true,
        reviewerProfile: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Transform users to a consistent format
    return users.map(user => ({
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      name: this.getUserName(user),
      studentProfile: user.studentProfile,
      reviewerProfile: user.reviewerProfile,
    }))
  }

  async inviteReviewer(createReviewerDto: CreateReviewerDto) {
    const { fullName, email } = createReviewerDto
    const normalizedEmail = email.trim().toLowerCase()

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { reviewerProfile: true },
    })

    if (existingUser) {
      if (existingUser.role === Role.REVIEWER) {
        throw new ConflictException(
          'A reviewer with this email already exists. They can sign in or use a new invite if you resend.',
        )
      }
      throw new ConflictException('User with this email already exists with a different role')
    }

    const invite = await this.invites.createGlobalReviewerInvite(normalizedEmail, fullName)

    return {
      email: normalizedEmail,
      fullName: fullName.trim(),
      inviteSent: invite.emailSent,
      inviteUrl: invite.inviteUrl,
      expiresAt: invite.expiresAt,
      message: invite.emailSent
        ? 'Reviewer invite email sent'
        : 'Invite created but email was not sent — check SMTP configuration or share the invite URL from server logs',
    }
  }

  private getUserName(user: any): string {
    if (user.studentProfile) {
      return `${user.studentProfile.firstName} ${user.studentProfile.lastName}`.trim()
    }
    if (user.reviewerProfile) {
      return `${user.reviewerProfile.firstName} ${user.reviewerProfile.lastName}`.trim()
    }
    return user.email
  }

  // ==================== Project Template Methods ====================

  async createTemplate(createTemplateDto: CreateTemplateDto) {
    const { tasks, ...templateData } = createTemplateDto

    // Create template with tasks in a transaction
    const template = await this.prisma.$transaction(async (tx) => {
      const newTemplate = await tx.projectTemplate.create({
        data: {
          ...templateData,
          status: TemplateStatus.DRAFT,
          version: 1,
        },
      })

      // Create tasks if provided
      if (tasks && tasks.length > 0) {
        await tx.templateTask.createMany({
          data: tasks.map((task) => ({
            templateId: newTemplate.id,
            title: task.title,
            description: task.description,
            order: task.order,
            durationDays: task.durationDays,
            dependsOnTaskId: task.dependsOnTaskId,
          })),
        })
      }

      return newTemplate
    })

    // Return template with tasks
    return this.getTemplateById(template.id)
  }

  async getTemplateById(id: string) {
    const template = await this.prisma.projectTemplate.findUnique({
      where: { id },
      include: {
        templateTasks: {
          orderBy: { order: 'asc' },
        },
        reviewer: true,
      },
    })

    if (!template) {
      throw new NotFoundException('Template not found')
    }

    return template
  }

  async getAllTemplates(includeDrafts = false) {
    const where = includeDrafts ? {} : { status: TemplateStatus.PUBLISHED }

    const templates = await this.prisma.projectTemplate.findMany({
      where,
      include: {
        templateTasks: {
          orderBy: { order: 'asc' },
        },
        reviewer: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return templates
  }

  async updateTemplate(id: string, updateTemplateDto: UpdateTemplateDto) {
    const { tasks, ...templateData } = updateTemplateDto

    // Check if template exists
    const existingTemplate = await this.prisma.projectTemplate.findUnique({
      where: { id },
    })

    if (!existingTemplate) {
      throw new NotFoundException('Template not found')
    }

    // Prevent editing published templates (create new version instead)
    if (existingTemplate.status === TemplateStatus.PUBLISHED) {
      throw new BadRequestException('Cannot edit published templates. Create a new version instead.')
    }

    // Update template with tasks in a transaction
    const updatedTemplate = await this.prisma.$transaction(async (tx) => {
      // Update template fields
      const template = await tx.projectTemplate.update({
        where: { id },
        data: templateData,
      })

      // Update tasks if provided
      if (tasks !== undefined) {
        // Delete existing tasks
        await tx.templateTask.deleteMany({
          where: { templateId: id },
        })

        // Create new tasks
        if (tasks.length > 0) {
          await tx.templateTask.createMany({
            data: tasks.map((task) => ({
              templateId: id,
              title: task.title,
              description: task.description,
              order: task.order,
              durationDays: task.durationDays,
              dependsOnTaskId: task.dependsOnTaskId,
            })),
          })
        }
      }

      return template
    })

    return this.getTemplateById(updatedTemplate.id)
  }

  async publishTemplate(publishTemplateDto: PublishTemplateDto) {
    const { templateId } = publishTemplateDto

    // Check if template exists
    const template = await this.prisma.projectTemplate.findUnique({
      where: { id: templateId },
      include: {
        templateTasks: true,
      },
    })

    if (!template) {
      throw new NotFoundException('Template not found')
    }

    // Validate template before publishing
    this.validateTemplateForPublishing(template)

    // Ensure reviewer is assigned before publishing
    if (!template.reviewerId) {
      throw new BadRequestException('Cannot publish template without assigning a reviewer. Please assign a reviewer first.')
    }

    // Update template status to PUBLISHED
    const publishedTemplate = await this.prisma.projectTemplate.update({
      where: { id: templateId },
      data: {
        status: TemplateStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    })

    return this.getTemplateById(publishedTemplate.id)
  }

  async archiveTemplate(id: string) {
    const template = await this.prisma.projectTemplate.findUnique({
      where: { id },
    })

    if (!template) {
      throw new NotFoundException('Template not found')
    }

    const archivedTemplate = await this.prisma.projectTemplate.update({
      where: { id },
      data: {
        status: TemplateStatus.ARCHIVED,
      },
    })

    return this.getTemplateById(archivedTemplate.id)
  }

  async deleteTemplate(id: string) {
    const template = await this.prisma.projectTemplate.findUnique({
      where: { id },
    })

    if (!template) {
      throw new NotFoundException('Template not found')
    }

    // Prevent deletion of published templates
    if (template.status === TemplateStatus.PUBLISHED) {
      throw new BadRequestException('Cannot delete published templates. Archive them instead.')
    }

    await this.prisma.projectTemplate.delete({
      where: { id },
    })

    return { message: 'Template deleted successfully' }
  }

  async assignReviewer(templateId: string, reviewerId: string | null) {
    // Verify template exists
    const template = await this.prisma.projectTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      throw new NotFoundException('Template not found')
    }

    // If assigning a reviewer, verify they exist in ReviewerProfile
    if (reviewerId) {
      const reviewer = await this.prisma.reviewerProfile.findUnique({
        where: { id: reviewerId },
        include: {
          user: true,
        },
      })

      if (!reviewer || reviewer.user.role !== 'REVIEWER') {
        throw new BadRequestException('Invalid reviewer')
      }
    }

    // Update template with reviewer
    const updatedTemplate = await this.prisma.projectTemplate.update({
      where: { id: templateId },
      data: { reviewerId },
      include: {
        templateTasks: true,
      },
    })

    return updatedTemplate
  }

  private validateTemplateForPublishing(template: any) {
    // Validate required fields
    if (!template.title || template.title.trim() === '') {
      throw new BadRequestException('Template title is required')
    }

    if (!template.description || template.description.trim() === '') {
      throw new BadRequestException('Template description is required')
    }

    if (!template.duration || template.duration <= 0) {
      throw new BadRequestException('Template duration must be greater than 0')
    }

    if (!template.category || template.category.trim() === '') {
      throw new BadRequestException('Template category is required')
    }

    if (!template.difficulty || template.difficulty.trim() === '') {
      throw new BadRequestException('Template difficulty is required')
    }

    // Validate tasks
    if (!template.templateTasks || template.templateTasks.length === 0) {
      throw new BadRequestException('Template must have at least one task')
    }

    // Validate each task
    for (const task of template.templateTasks) {
      if (!task.title || task.title.trim() === '') {
        throw new BadRequestException('All tasks must have a title')
      }

      if (!task.description || task.description.trim() === '') {
        throw new BadRequestException('All tasks must have a description')
      }

      if (!task.durationDays || task.durationDays <= 0) {
        throw new BadRequestException('All tasks must have a valid duration in days')
      }

      if (task.order === undefined || task.order < 0) {
        throw new BadRequestException('All tasks must have a valid order')
      }
    }

    // Check for circular dependencies
    this.checkCircularDependencies(template.templateTasks)
  }

  private checkCircularDependencies(tasks: any[]) {
    const taskMap = new Map<string, string[]>()
    
    // Build dependency map
    for (const task of tasks) {
      if (task.dependsOnTaskId) {
        if (!taskMap.has(task.dependsOnTaskId)) {
          taskMap.set(task.dependsOnTaskId, [])
        }
        taskMap.get(task.dependsOnTaskId)!.push(task.id)
      }
    }

    // Check for cycles using DFS
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const hasCycle = (taskId: string): boolean => {
      visited.add(taskId)
      recursionStack.add(taskId)

      const dependencies = taskMap.get(taskId) || []
      for (const depId of dependencies) {
        if (!visited.has(depId)) {
          if (hasCycle(depId)) return true
        } else if (recursionStack.has(depId)) {
          return true
        }
      }

      recursionStack.delete(taskId)
      return false
    }

    for (const task of tasks) {
      if (!visited.has(task.id)) {
        if (hasCycle(task.id)) {
          throw new BadRequestException('Circular dependency detected in tasks')
        }
      }
    }
  }
}
