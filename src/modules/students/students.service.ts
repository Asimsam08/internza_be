import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewerScopeService } from '@/common/services/reviewer-scope.service';
import { SupabaseStorageService } from '@/common/services/supabase-storage.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DurationType } from '@prisma/client';
import { resolveStoragePublicUrl } from '@/common/helper';
import { CertificatesService } from '@/modules/certificates/certificates.service';
import { Response } from 'express';

const TASK_SCREENSHOTS_FOLDER = 'project-template-images';

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    private readonly reviewerScope: ReviewerScopeService,
    private readonly storage: SupabaseStorageService,
    private readonly certificatesService: CertificatesService,
  ) {}

  private screenshotPrefix(studentId: string, taskId: string): string {
    return `${TASK_SCREENSHOTS_FOLDER}/${studentId}/${taskId}/`;
  }

  private assertScreenshotPaths(
    screenshots: string[],
    studentId: string,
    taskId: string,
  ): void {
    const prefix = this.screenshotPrefix(studentId, taskId);
    const invalid = screenshots.filter(
      (p) => !p.startsWith('http') && !p.startsWith(prefix),
    );
    if (invalid.length) {
      throw new BadRequestException(
        'Invalid screenshot paths. Upload screenshots via the upload API first.',
      );
    }
  }

  async getStudentProfile(userId: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Student profile not found');
    }

    return profile;
  }

  async updateStudentProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    // Verify user exists and is a student
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== 'STUDENT') {
      throw new ForbiddenException('Only students can update their profile');
    }

    // Check if profile exists (should exist from signup)
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Student profile not found. Please contact support.');
    }

    // Map DTO fields to Prisma schema fields
    const prismaData: any = { ...updateProfileDto };
    if (prismaData.gradYear !== undefined) {
      prismaData.graduationYear = prismaData.gradYear;
      delete prismaData.gradYear;
    }

    // Update existing profile
    const updatedProfile = await this.prisma.studentProfile.update({
      where: { userId },
      data: prismaData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    return updatedProfile;
  }

  // Fixed Plan Selection Methods
  async getPlanOptions(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        internshipPlans: {
          where: { isCompleted: false },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const incompletePlans = student.internshipPlans;
    const hasActivePlan = incompletePlans.length > 0;
    const hasCohortPlan = incompletePlans.some((p) => !!p.cohortId);
    const hasSelfPlan = incompletePlans.some((p) => !p.cohortId);

    // Fixed plan options as per product requirements
    const plans = [
      {
        durationType: DurationType.FOUR_WEEKS,
        totalWeeks: 4,
        title: '4-Week Internship',
        description: 'Perfect for beginners to get started with real projects',
        difficulty: 'Beginner',
        skills: ['React', 'TypeScript', 'Git'],
        imageUrl: null,
      },
      {
        durationType: DurationType.EIGHT_WEEKS,
        totalWeeks: 8,
        title: '8-Week Internship',
        description: 'Build a solid foundation with intermediate projects',
        difficulty: 'Intermediate',
        skills: ['Node.js', 'PostgreSQL', 'API Design'],
        imageUrl: null,
      },
      {
        durationType: DurationType.TWELVE_WEEKS,
        totalWeeks: 12,
        title: '12-Week Internship',
        description: 'Comprehensive experience with advanced full-stack projects',
        difficulty: 'Advanced',
        skills: ['Microservices', 'Docker', 'AWS', 'CI/CD'],
        imageUrl: null,
      },
      {
        durationType: DurationType.CUSTOM,
        totalWeeks: 0,
        title: 'Custom Duration',
        description: 'Tailored internship plan based on your goals',
        difficulty: 'Mixed',
        skills: ['Varies based on selection'],
        imageUrl: null,
      },
    ];

    return {
      plans,
      hasActivePlan,
      hasCohortPlan,
      hasSelfPlan,
      canEnrollSelfPlan: !hasSelfPlan,
      activePlanId: hasActivePlan ? incompletePlans[0].id : null,
    };
  }

  async getAvailableProjects(durationType: DurationType) {
    let totalWeeks: number;
    switch (durationType) {
      case DurationType.FOUR_WEEKS:
        totalWeeks = 4;
        break;
      case DurationType.EIGHT_WEEKS:
        totalWeeks = 8;
        break;
      case DurationType.TWELVE_WEEKS:
        totalWeeks = 12;
        break;
      case DurationType.CUSTOM:
        totalWeeks = 0;
        break;
      default:
        throw new BadRequestException('Invalid duration type');
    }

    const templates = await this.prisma.projectTemplate.findMany({
      where: { status: 'PUBLISHED' as any },
      select: {
        id: true,
        title: true,
        description: true,
        shortDescription: true,
        category: true,
        difficulty: true,
        duration: true,
        skills: true,
        imageUrl: true,
      },
      orderBy: { duration: 'asc' },
    });

    // Group projects by duration
    const projectsByDuration = templates.reduce((acc, template) => {
      const duration = template.duration;
      if (!acc[duration]) {
        acc[duration] = [];
      }
      acc[duration].push(template);
      return acc;
    }, {} as Record<number, typeof templates>);

    // Calculate allowed combinations based on duration
    const allowedCombinations = this.calculateAllowedCombinations(totalWeeks, projectsByDuration);

    return {
      totalWeeks,
      projectsByDuration,
      allowedCombinations,
    };
  }

  private calculateAllowedCombinations(totalWeeks: number, projectsByDuration: Record<number, any[]>) {
    const combinations: number[][] = [];
    const availableDurations = Object.keys(projectsByDuration).map(Number).sort((a, b) => a - b);

    if (totalWeeks === 0) {
      // Custom - allow any combination
      return availableDurations.map(d => [d]);
    }

    // Generate combinations that sum to totalWeeks
    const generateCombinations = (remaining: number, current: number[], start: number) => {
      if (remaining === 0) {
        combinations.push([...current]);
        return;
      }
      for (let i = start; i < availableDurations.length; i++) {
        const duration = availableDurations[i];
        if (duration <= remaining) {
          generateCombinations(remaining - duration, [...current, duration], i);
        }
      }
    };

    generateCombinations(totalWeeks, [], 0);

    return combinations;
  }

  async enrollInPlan(userId: string, durationType: DurationType, customWeeks?: number, selectedProjectIds?: string[]) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        internshipPlans: {
          where: { isCompleted: false },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const existingSelfPlan = await this.prisma.internshipPlan.findFirst({
      where: {
        studentId: student.id,
        isCompleted: false,
        cohortId: null,
      },
    });

    if (existingSelfPlan) {
      throw new BadRequestException(
        'You already have an active self-paced internship. Switch to it on your dashboard or complete it first.',
      );
    }

    // Validate duration type and compute total weeks
    let totalWeeks: number;
    let combination: number[];

    switch (durationType) {
      case DurationType.FOUR_WEEKS:
        totalWeeks = 4;
        combination = [4];
        break;
      case DurationType.EIGHT_WEEKS:
        totalWeeks = 8;
        combination = [4, 4];
        break;
      case DurationType.TWELVE_WEEKS:
        totalWeeks = 12;
        combination = [4, 4, 4];
        break;
      case DurationType.CUSTOM:
        if (!customWeeks || customWeeks < 1 || customWeeks > 24) {
          throw new BadRequestException('Custom weeks must be between 1 and 24');
        }
        totalWeeks = customWeeks;
        combination = [customWeeks];
        break;
      default:
        throw new BadRequestException('Invalid duration type');
    }

    // Get published templates - either selected or auto-assign
    let publishedTemplates;
    if (selectedProjectIds && selectedProjectIds.length > 0) {
      // Use selected projects
      publishedTemplates = await this.prisma.projectTemplate.findMany({
        where: {
          id: { in: selectedProjectIds },
          status: 'PUBLISHED' as any,
        },
        orderBy: { duration: 'asc' },
      });
    } else {
      // Auto-assign templates
      publishedTemplates = await this.prisma.projectTemplate.findMany({
        where: { status: 'PUBLISHED' as any },
        orderBy: { duration: 'asc' },
        take: Math.ceil(totalWeeks / 4), // Approximate number of projects
      });
    }

    if (publishedTemplates.length === 0) {
      throw new BadRequestException('No published project templates available');
    }

    // Create internship plan with task deadlines
    const plan = await this.prisma.$transaction(async (tx) => {
      const internshipPlan = await tx.internshipPlan.create({
        data: {
          studentId: student.id,
          durationType,
          totalWeeks,
          combination,
          sequentialCompletion: true,
          startedAt: new Date(),
        },
      });

      // Create plan projects and generate task instances with deadlines
      const now = new Date();
      let currentStartDate = now;

      for (let i = 0; i < publishedTemplates.length; i++) {
        const template = publishedTemplates[i];
        const planProject = await tx.planProject.create({
          data: {
            planId: internshipPlan.id,
            templateId: template.id,
            order: i + 1,
            status: i === 0 ? 'AVAILABLE' : 'LOCKED',
            startedAt: i === 0 ? now : null,
            reviewerId: template.reviewerId,
          },
        });

        // Create milestone for this project
        const milestone = await tx.milestone.create({
          data: {
            projectId: planProject.id,
            title: `${template.title} - Milestone`,
            description: `Complete all tasks for ${template.title}`,
            order: 1,
          },
        });

        // Create task instances with computed deadlines
        const templateTasks = await tx.templateTask.findMany({
          where: { templateId: template.id },
          orderBy: { order: 'asc' },
        });

        for (let j = 0; j < templateTasks.length; j++) {
          const templateTask = templateTasks[j];

          // Task progression logic:
          // First task of first project: DRAFT (unlocked) with dates
          // All other tasks: LOCKED initially, unlock on previous task approval (no dates yet)
          const isFirstTask = i === 0 && j === 0;
          const taskStatus = isFirstTask ? 'DRAFT' : 'LOCKED';

          let taskStartAt = null;
          let taskDueAt = null;

          if (isFirstTask) {
            // First task gets dates calculated from now
            taskStartAt = new Date();
            taskDueAt = new Date();
            taskDueAt.setDate(taskDueAt.getDate() + templateTask.durationDays);
          }

          await tx.task.create({
            data: {
              milestoneId: milestone.id,
              title: templateTask.title,
              description: templateTask.description,
              order: templateTask.order,
              durationDays: templateTask.durationDays,
              status: taskStatus,
              startAt: taskStartAt,
              dueAt: taskDueAt,
              isLocked: !isFirstTask, // First task unlocked, rest locked
            },
          });
        }
      }

      return internshipPlan;
    });

    return {
      planId: plan.id,
      durationType: plan.durationType,
      totalWeeks: plan.totalWeeks,
      startedAt: plan.startedAt,
      message: 'Enrolled successfully',
    };
  }

  async getStudentDashboard(userId: string, requestedPlanId?: string) {
    const planInclude = {
      cohort: {
        select: {
          id: true,
          name: true,
          college: { select: { name: true, logoUrl: true } },
        },
      },
      planProjects: {
        include: {
          template: true,
          milestones: {
            include: {
              tasks: {
                include: {
                  submission: {
                    include: {
                      review: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as const;

    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        internshipPlans: {
          where: { isCompleted: false },
          include: planInclude,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const incompletePlans = student.internshipPlans;
    if (!incompletePlans.length) {
      return {
        hasActivePlan: false,
        message: 'No active internship plan',
        availablePlans: [] as Array<Record<string, unknown>>,
        canEnrollSelfPlan: true,
        hasMultiplePlans: false,
      };
    }

    const availablePlans = incompletePlans.map((plan) => {
      const templateTitle =
        plan.planProjects[0]?.template?.title ?? 'Internship';
      if (plan.cohortId && plan.cohort) {
        return {
          id: plan.id,
          type: 'cohort' as const,
          label: plan.cohort.name,
          subtitle: plan.cohort.college?.name
            ? `${plan.cohort.college.name} cohort`
            : 'College cohort',
          cohortId: plan.cohortId,
          collegeLogoUrl: resolveStoragePublicUrl(plan.cohort.college?.logoUrl ?? null),
        };
      }
      const durationLabel = plan.durationType.replace(/_/g, ' ');
      return {
        id: plan.id,
        type: 'self' as const,
        label: 'Self-paced internship',
        subtitle: `${durationLabel} · ${templateTitle}`,
        cohortId: null as string | null,
      };
    });

    const cohortPlan = incompletePlans.find((p) => p.cohortId);
    const selfPlan = incompletePlans.find((p) => !p.cohortId);
    const defaultPlan = cohortPlan ?? incompletePlans[0];

    const activePlan =
      requestedPlanId && incompletePlans.some((p) => p.id === requestedPlanId)
        ? incompletePlans.find((p) => p.id === requestedPlanId)!
        : defaultPlan;

    const hasSelfPlan = !!selfPlan;
    const canEnrollSelfPlan = !hasSelfPlan;
    const hasMultiplePlans = incompletePlans.length > 1;

    let cohortContext: Record<string, unknown> | null = null;
    if (activePlan.cohortId) {
      const cohort = await this.prisma.cohort.findUnique({
        where: { id: activePlan.cohortId },
        include: {
          college: { select: { name: true, logoUrl: true } },
          _count: { select: { members: true } },
          members: { select: { userId: true } },
        },
      });
      if (cohort) {
        const memberIndex = cohort.members.findIndex((m) => m.userId === userId);
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const elapsed = Date.now() - cohort.startDate.getTime();
        const totalWeeks = Math.max(1, Math.ceil((cohort.endDate.getTime() - cohort.startDate.getTime()) / weekMs));
        const currentWeek = Math.min(totalWeeks, Math.max(1, Math.floor(elapsed / weekMs) + 1));
        cohortContext = {
          cohortId: cohort.id,
          name: cohort.name,
          collegeName: cohort.college.name,
          collegeLogoUrl: resolveStoragePublicUrl(cohort.college.logoUrl),
          weekLabel: `Week ${currentWeek}/${totalWeeks}`,
          rank: memberIndex >= 0 ? `#${memberIndex + 1}/${cohort._count.members}` : null,
        };
      }
    }

    // Auto-unlock next project if all tasks in current project are approved
    await this.checkAndUnlockNextProject(activePlan.id);

    // Re-fetch plan after potential unlock
    const refreshedPlan = await this.prisma.internshipPlan.findUnique({
      where: { id: activePlan.id },
      include: {
        planProjects: {
          include: {
            template: true,
            milestones: {
              include: {
                tasks: {
                  include: {
                    submission: {
                      include: {
                        review: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!refreshedPlan) {
      throw new NotFoundException('Plan not found after refresh');
    }

    // Get project progress
    const projectProgress = await this.getProjectsProgress(refreshedPlan.id);

    // Build project info array
    const projects = refreshedPlan.planProjects.map((pp) => ({
      id: pp.id,
      title: pp.template.title,
      description: pp.template.description,
      category: pp.template.category,
      difficulty: pp.template.difficulty,
      duration: pp.template.duration,
      order: pp.order,
      status: pp.status,
      isCompleted: pp.isCompleted,
      completedAt: pp.completedAt?.toISOString(),
      startedAt: pp.startedAt?.toISOString(),
    }));

    // Find active project (first non-completed project)
    const activeProject = projects.find((p) => !p.isCompleted && (p.status === 'AVAILABLE' || p.status === 'IN_PROGRESS')) || projects[0];
    
    // Find next project
    const nextProject = projects.find((p) => p.order === activeProject.order + 1) || null;

    // Check if next project can be unlocked
    const activeProjectProgress = projectProgress.find((p) => p.projectId === activeProject.id);
    const canUnlockNextProject = activeProjectProgress?.isCompleted || false;

    // Calculate task statistics
    const allTasks = refreshedPlan.planProjects.flatMap((pp) =>
      pp.milestones.flatMap((m) => m.tasks)
    );

    const completedTasks = allTasks.filter((t) => t.status === 'APPROVED');
    const overdueTasks = allTasks.filter((t) => t.isOverdue);
    const now = new Date();
    const dueSoonTasks = allTasks.filter(
      (t) => t.dueAt && !t.isOverdue && new Date(t.dueAt) <= new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
    );
    const lockedTasks = allTasks.filter((t) => t.status === 'DRAFT' && t.startAt && new Date(t.startAt) > now);

    // Find current task (from active project only)
    const currentProjectEntity = refreshedPlan.planProjects.find((pp) => pp.id === activeProject.id);
    const currentTask = currentProjectEntity
      ? currentProjectEntity.milestones.flatMap((m) => m.tasks).find((t) => t.status === 'DRAFT' || t.status === 'SUBMITTED')
      : null;

    // Build task timeline (all tasks from all projects with projectId for frontend filtering)
    const taskTimeline = allTasks.map((task) => {
      // Find which project this task belongs to
      const project = refreshedPlan.planProjects.find(pp => 
        pp.milestones.some(m => m.tasks.some(t => t.id === task.id))
      );
      
      const reviewData = task.submission?.review ? {
        feedback: task.submission.review.feedback,
      } : undefined;

      return {
        id: task.id,
        projectId: project?.id,
        title: task.title,
        description: task.description,
        order: task.order,
        durationDays: task.durationDays,
        status: task.status,
        startAt: task.startAt ? task.startAt.toISOString() : null,
        dueAt: task.dueAt ? task.dueAt.toISOString() : null,
        isOverdue: task.isOverdue,
        isLocked: task.isLocked,
        submission: task.submission ? {
          prLink: task.submission.prLink,
          commitHash: task.submission.commitHash,
          description: task.submission.description,
          screenshots: task.submission.screenshots,
          screenshotUrls: this.storage.toPublicUrls(task.submission.screenshots),
        } : undefined,
        review: reviewData,
      };
    });

    // Generate warnings
    const warnings = [];
    if (overdueTasks.length > 0) {
      warnings.push({
        type: 'OVERDUE_TASKS',
        message: `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}`,
        severity: overdueTasks.length > 2 ? 'high' : 'medium' as 'low' | 'medium' | 'high',
        count: overdueTasks.length,
      });
    }
    if (dueSoonTasks.length > 0) {
      warnings.push({
        type: 'DUE_SOON',
        message: `You have ${dueSoonTasks.length} task${dueSoonTasks.length > 1 ? 's' : ''} due soon`,
        severity: 'low',
        count: dueSoonTasks.length,
      });
    }

    // Update plan status based on overdue count
    if (overdueTasks.length > 3) {
      await this.prisma.internshipPlan.update({
        where: { id: refreshedPlan.id },
        data: { status: 'NEEDS_ATTENTION' as any, overdueTaskCount: overdueTasks.length },
      });
    } else if (overdueTasks.length > 1) {
      await this.prisma.internshipPlan.update({
        where: { id: refreshedPlan.id },
        data: { status: 'AT_RISK' as any, overdueTaskCount: overdueTasks.length },
      });
    }

    // Determine next action
    let nextAction = 'Continue working on your current task';
    if (canUnlockNextProject && nextProject) {
      nextAction = `Start your next project: ${nextProject.title}`;
    } else if (overdueTasks.length > 0) {
      nextAction = 'Complete your overdue tasks immediately';
    } else if (dueSoonTasks.length > 0) {
      nextAction = 'Submit your task before the deadline';
    } else if (!currentTask) {
      nextAction = 'Start your first task';
    }

    if (cohortContext && currentTask?.dueAt) {
      cohortContext = {
        ...cohortContext,
        nextDueLabel: `Task due ${new Date(currentTask.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        nextTaskTitle: currentTask.title,
      };
    }

    const certificate = await this.certificatesService.getPlanCertificateSummary(
      refreshedPlan.id,
      userId,
    );

    return {
      planId: refreshedPlan.id,
      activePlanId: activePlan.id,
      availablePlans,
      canEnrollSelfPlan,
      hasMultiplePlans,
      activePlanType: activePlan.cohortId ? ('cohort' as const) : ('self' as const),
      cohort: cohortContext,
      durationType: refreshedPlan.durationType,
      totalWeeks: refreshedPlan.totalWeeks,
      completedWeeks: refreshedPlan.completedWeeks,
      progressPercentage: Math.round((refreshedPlan.completedWeeks / refreshedPlan.totalWeeks) * 100),
      planStatus: refreshedPlan.status,
      projects,
      activeProject,
      nextProject,
      projectProgress,
      canUnlockNextProject,
      startedAt: refreshedPlan.startedAt.toISOString(),
      currentProject: currentProjectEntity
        ? {
            id: currentProjectEntity.id,
            title: currentProjectEntity.template.title,
            description: currentProjectEntity.template.description,
            category: currentProjectEntity.template.category,
            difficulty: currentProjectEntity.template.difficulty,
            duration: currentProjectEntity.template.duration,
            status: currentProjectEntity.status,
            tasks: currentProjectEntity.milestones.flatMap((m) =>
              m.tasks.map((t) => ({
                id: t.id,
                title: t.title,
                description: t.description,
                order: t.order,
                durationDays: t.durationDays,
                status: t.status,
                startAt: t.startAt ? t.startAt.toISOString() : null,
                dueAt: t.dueAt ? t.dueAt.toISOString() : null,
                isOverdue: t.isOverdue,
                isLocked: t.status === 'DRAFT' && t.startAt && new Date(t.startAt) > now,
              }))
            ),
          }
        : null,
      currentTask: currentTask
        ? {
            id: currentTask.id,
            title: currentTask.title,
            description: currentTask.description,
            order: currentTask.order,
            durationDays: currentTask.durationDays,
            status: currentTask.status,
            startAt: currentTask.startAt ? currentTask.startAt.toISOString() : null,
            dueAt: currentTask.dueAt ? currentTask.dueAt.toISOString() : null,
            isOverdue: currentTask.isOverdue,
            isLocked: false,
          }
        : null,
      completedTaskCount: completedTasks.length,
      overdueTaskCount: overdueTasks.length,
      dueSoonTaskCount: dueSoonTasks.length,
      lockedTaskCount: lockedTasks.length,
      warnings,
      nextAction,
      taskTimeline,
      certificate,
    };
  }

  async uploadTaskScreenshots(
    userId: string,
    taskId: string,
    files: Express.Multer.File[],
  ) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        milestone: {
          include: {
            project: {
              include: { plan: true },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.milestone.project.plan.studentId !== student.id) {
      throw new ForbiddenException('You do not have permission to upload for this task');
    }

    if (task.startAt && new Date(task.startAt) > new Date()) {
      throw new BadRequestException('This task is not yet available');
    }

    if (
      task.status !== 'DRAFT' &&
      task.status !== 'REJECTED' &&
      task.status !== 'CHANGES_REQUESTED'
    ) {
      throw new BadRequestException('Screenshots cannot be uploaded for this task status');
    }

    if (!files?.length) {
      throw new BadRequestException('At least one screenshot file is required');
    }

    const ownerId = `${student.id}/${taskId}`;
    const paths = await this.storage.uploadMany(
      TASK_SCREENSHOTS_FOLDER,
      ownerId,
      files,
    );

    return {
      screenshots: paths.map((path) => ({
        path,
        url: this.storage.toPublicUrl(path),
      })),
    };
  }

  async submitTask(
    userId: string,
    taskId: string,
    prLink: string,
    commitHash?: string,
    description?: string,
    screenshots: string[] = [],
  ) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    // Find the task
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        milestone: {
          include: {
            project: {
              include: {
                plan: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Verify the task belongs to the student's plan
    if (task.milestone.project.plan.studentId !== student.id) {
      throw new ForbiddenException('You do not have permission to submit this task');
    }

    // Check if task is locked
    if (task.startAt && new Date(task.startAt) > new Date()) {
      throw new BadRequestException('This task is not yet available');
    }

    // Check if already submitted
    if (task.status !== 'DRAFT' && task.status !== 'REJECTED' && task.status !== 'CHANGES_REQUESTED') {
      throw new BadRequestException('This task has already been submitted');
    }

    if (!screenshots || screenshots.length < 5) {
      throw new BadRequestException('At least 5 screenshots are required');
    }

    this.assertScreenshotPaths(screenshots, student.id, taskId);

    const existing = await this.prisma.submission.findUnique({
      where: { taskId },
      select: { screenshots: true },
    });

    if (existing?.screenshots?.length) {
      const removed = existing.screenshots.filter((p) => !screenshots.includes(p));
      await this.storage.removeMany(removed);
    }

    // Create or update submission
    const submission = await this.prisma.submission.upsert({
      where: { taskId },
      create: {
        taskId,
        prLink,
        commitHash,
        description,
        screenshots,
      },
      update: {
        prLink,
        commitHash,
        description,
        screenshots,
        submittedAt: new Date(),
      },
    });

    // Update task status to SUBMITTED
    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'SUBMITTED',
      },
    });

    // Write audit event
    await this.prisma.auditLog.create({
      data: {
        action: 'CREATE',
        resource: 'SUBMISSION',
        resourceId: submission.id,
        userId,
        changes: { taskId },
      },
    });

    return {
      taskId,
      status: 'SUBMITTED',
      message: 'Task submitted successfully',
    };
  }

  async unlockNextTask(taskId: string) {
    // Find the approved task
    const approvedTask = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        milestone: {
          include: {
            project: {
              include: {
                plan: true,
              },
            },
          },
        },
      },
    });

    if (!approvedTask) {
      throw new NotFoundException('Task not found');
    }

    if (approvedTask.status !== 'APPROVED') {
      throw new BadRequestException('Task must be approved to unlock next task');
    }

    // Find the next task in the same milestone
    const tasks = await this.prisma.task.findMany({
      where: { milestoneId: approvedTask.milestoneId },
      orderBy: { order: 'asc' },
    });

    const currentIndex = tasks.findIndex(t => t.id === taskId);
    const nextTask = tasks[currentIndex + 1];

    if (!nextTask) {
      // Check if there's a next milestone with tasks
      const nextMilestone = await this.prisma.milestone.findFirst({
        where: {
          projectId: approvedTask.milestone.projectId,
          order: { gt: approvedTask.milestone.order },
        },
        include: {
          tasks: {
            orderBy: { order: 'asc' },
            take: 1,
          },
        },
      });

      if (!nextMilestone || nextMilestone.tasks.length === 0) {
        return { message: 'No next task to unlock' };
      }

      // Unlock first task of next milestone
      const firstTaskOfNextMilestone = nextMilestone.tasks[0];
      if (firstTaskOfNextMilestone.isLocked) {
        const now = new Date();
        const taskDueAt = new Date();
        taskDueAt.setDate(taskDueAt.getDate() + firstTaskOfNextMilestone.durationDays);

        await this.prisma.task.update({
          where: { id: firstTaskOfNextMilestone.id },
          data: {
            status: 'DRAFT',
            isLocked: false,
            startAt: now,
            dueAt: taskDueAt,
          },
        });

        // Write audit event
        await this.prisma.auditLog.create({
          data: {
            action: 'UNLOCK',
            resource: 'TASK',
            resourceId: firstTaskOfNextMilestone.id,
            userId: approvedTask.milestone.project.plan.studentId,
            changes: { unlockedBy: taskId },
          },
        });

        return {
          taskId: firstTaskOfNextMilestone.id,
          message: 'Next task unlocked successfully',
        };
      }

      return { message: 'Next task already unlocked' };
    }

    // Unlock the next task in the same milestone and set its dates
    if (nextTask.isLocked) {
      const now = new Date();
      const taskDueAt = new Date();
      taskDueAt.setDate(taskDueAt.getDate() + nextTask.durationDays);

      await this.prisma.task.update({
        where: { id: nextTask.id },
        data: {
          status: 'DRAFT',
          isLocked: false,
          startAt: now,
          dueAt: taskDueAt,
        },
      });

      // Write audit event
      await this.prisma.auditLog.create({
        data: {
          action: 'UNLOCK',
          resource: 'TASK',
          resourceId: nextTask.id,
          userId: approvedTask.milestone.project.plan.studentId,
          changes: { unlockedBy: taskId },
        },
      });

      return {
        taskId: nextTask.id,
        message: 'Next task unlocked successfully',
      };
    }

    return { message: 'Next task already unlocked' };
  }

  async approveTask(taskId: string, userId: string, feedback?: string, collegeId?: string | null) {
    const { ctx, task } = await this.reviewerScope.assertCanReviewTask(userId, taskId, collegeId);
    const reviewerId = ctx.profileId;

    if (!task.submission) {
      throw new BadRequestException('Task submission not found');
    }

    if (task.status !== 'SUBMITTED' && task.status !== 'UNDER_REVIEW') {
      throw new BadRequestException('Task must be submitted before approval');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: 'APPROVED',
        },
      });

      await tx.review.upsert({
        where: { submissionId: task.submission!.id },
        create: {
          submissionId: task.submission!.id,
          reviewerId,
          status: 'APPROVED',
          feedback,
          reviewedAt: new Date(),
        },
        update: {
          status: 'APPROVED',
          feedback,
          reviewedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'APPROVE',
          resource: 'TASK',
          resourceId: taskId,
          userId: userId,
          changes: { reviewerId },
        },
      });
    });

    // Unlock next task (outside transaction as it's a separate operation)
    await this.unlockNextTask(taskId);

    // Check and unlock next project if all tasks in current project are approved
    await this.checkAndUnlockNextProject(task.milestone.project.planId);

    return {
      taskId,
      status: 'APPROVED',
      message: 'Task approved successfully',
    };
  }

  async rejectTask(taskId: string, userId: string, feedback: string, collegeId?: string | null) {
    const { ctx, task } = await this.reviewerScope.assertCanReviewTask(userId, taskId, collegeId);
    const reviewerId = ctx.profileId;

    if (task.status !== 'SUBMITTED' && task.status !== 'UNDER_REVIEW') {
      throw new BadRequestException('Task must be submitted before rejection');
    }

    if (!task.submission) {
      throw new BadRequestException('Task submission not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: 'REJECTED',
        },
      });

      // Create or update review
      await tx.review.upsert({
        where: { submissionId: task.submission.id },
        create: {
          submissionId: task.submission.id,
          reviewerId,
          status: 'REJECTED',
          feedback,
          reviewedAt: new Date(),
        },
        update: {
          status: 'REJECTED',
          feedback,
          reviewedAt: new Date(),
        },
      });

      // Write audit event
      await tx.auditLog.create({
        data: {
          action: 'REJECT',
          resource: 'TASK',
          resourceId: taskId,
          userId: userId,
          changes: { reviewerId },
        },
      });
    });

    return {
      taskId,
      status: 'REJECTED',
      message: 'Task rejected successfully',
    };
  }

  async getReviewerDashboard(reviewerId: string, collegeId?: string | null) {
    const ctx = await this.reviewerScope.resolveContext(reviewerId, collegeId);

    const submissions = await this.prisma.task.findMany({
      where: {
        status: {
          in: ['SUBMITTED', 'UNDER_REVIEW'],
        },
        ...this.reviewerScope.buildReviewableTaskWhere(ctx),
      },
      include: {
        milestone: {
          include: {
            project: {
              include: {
                plan: {
                  include: {
                    student: {
                      include: {
                        user: true,
                      },
                    },
                    cohort: { select: { id: true, name: true } },
                  },
                },
                template: true,
              },
            },
          },
        },
        submission: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform the data for the frontend
    const reviewTasks = submissions.map((task) => {
      const student = task.milestone.project.plan.student;
      const submittedAt = task.submission?.submittedAt || task.createdAt;
      const timeAgo = this.getTimeAgo(new Date(submittedAt));

      // Map task status to reviewer dashboard status
      let reviewerStatus: 'pending' | 'in_progress';
      if (task.status === 'SUBMITTED') {
        reviewerStatus = 'pending';
      } else if (task.status === 'UNDER_REVIEW') {
        reviewerStatus = 'in_progress';
      } else {
        reviewerStatus = 'pending';
      }

      return {
        id: task.id,
        taskId: task.id,
        student: {
          name: `${student.firstName} ${student.lastName}`,
          email: student.user.email,
          avatar: null, // Can be added later
        },
        milestone: {
          title: task.title,
          description: task.description,
          internship: task.milestone.project.plan.cohort?.name
            ? `${task.milestone.project.plan.cohort.name} · ${task.milestone.project.template.title}`
            : task.milestone.project.template.title,
        },
        cohort: task.milestone.project.plan.cohort
          ? { id: task.milestone.project.plan.cohort.id, name: task.milestone.project.plan.cohort.name }
          : null,
        submittedAt: timeAgo,
        submittedAtDate: submittedAt,
        files: this.storage.toPublicUrls(task.submission?.screenshots ?? []).map((url, index) => ({
          name: `screenshot-${index + 1}`,
          type: 'image',
          size: 'N/A',
          url,
        })),
        notes: task.submission?.description || '',
        prLink: task.submission?.prLink || '',
        commitHash: task.submission?.commitHash || '',
        status: reviewerStatus,
        feedback: '', // Will be populated after Prisma migration with task.review?.feedback
      };
    });

    // Calculate stats
    const stats = {
      total: reviewTasks.length,
      pending: reviewTasks.filter((t) => t.status === 'pending').length,
      inProgress: reviewTasks.filter((t) => t.status === 'in_progress').length,
      urgent: reviewTasks.filter((t) => t.status === 'pending' && t.submittedAtDate &&
        (new Date().getTime() - new Date(t.submittedAtDate).getTime()) > 24 * 60 * 60 * 1000
      ).length,
    };

    return {
      tasks: reviewTasks,
      stats,
    };
  }

  async getReviewerProjects(reviewerId: string, collegeId?: string | null) {
    const ctx = await this.reviewerScope.resolveContext(reviewerId, collegeId);

    const assignedProjects = await this.prisma.planProject.findMany({
      where: this.reviewerScope.buildAccessiblePlanProjectWhere(ctx),
      include: {
        plan: {
          include: {
            student: {
              include: {
                user: true,
              },
            },
            cohort: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Get template info for each project
    const projects = await Promise.all(
      assignedProjects.map(async (project) => {
        const template = await this.prisma.projectTemplate.findUnique({
          where: { id: project.templateId },
        });

        // Count pending tasks for this project
        const pendingTasksCount = await this.prisma.task.count({
          where: {
            milestone: {
              projectId: project.id,
            },
            status: {
              in: ['SUBMITTED', 'UNDER_REVIEW'],
            },
          },
        });

        const cohort = project.plan.cohort;
        return {
          id: project.id,
          title: cohort
            ? `${cohort.name} — ${template?.title || 'Cohort project'}`
            : template?.title || 'Unknown Project',
          description: template?.shortDescription || template?.description || '',
          category: template?.category || '',
          difficulty: template?.difficulty || '',
          duration: template?.duration || 0,
          student: {
            name: `${project.plan.student.firstName} ${project.plan.student.lastName}`,
            email: project.plan.student.user.email,
          },
          cohort: cohort ? { id: cohort.id, name: cohort.name } : null,
          pendingTasks: pendingTasksCount,
          status: project.status,
        };
      }),
    );

    return projects;
  }

  async getReviewerHistory(
    reviewerId: string,
    projectId?: string,
    status?: string,
    projectTitle?: string,
    collegeId?: string | null,
  ) {
    const ctx = await this.reviewerScope.resolveContext(reviewerId, collegeId);
    const accessibleWhere = this.reviewerScope.buildAccessiblePlanProjectWhere(ctx);

    let projectIdsToQuery: string[];

    if (projectTitle) {
      const matchingProjects = await this.prisma.planProject.findMany({
        where: {
          ...accessibleWhere,
          template: { title: projectTitle },
        },
        select: { id: true },
      });
      projectIdsToQuery = matchingProjects.map((p) => p.id);
    } else {
      projectIdsToQuery = await this.reviewerScope.listAccessiblePlanProjectIds(ctx);
    }

    // Build where clause
    const where: any = {
      status: {
        in: ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'],
      },
      milestone: {
        project: {
          id: {
            in: projectIdsToQuery,
          },
        },
      },
    };

    // Further filter by specific project ID if provided
    if (projectId) {
      where.milestone.project.id = {
        in: [projectId],
      };
    }

    // Filter by status if specified
    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    // Get reviewed tasks
    const reviewedTasks = await this.prisma.task.findMany({
      where,
      include: {
        milestone: {
          include: {
            project: {
              include: {
                template: true,
                plan: {
                  include: {
                    student: {
                      include: {
                        user: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        submission: {
          include: {
            review: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Transform the data
    const history = reviewedTasks.map((task) => {
      const student = task.milestone.project.plan.student;
      const template = task.milestone.project.template;
      const review = task.submission?.review;
      const reviewedAt = review?.reviewedAt || task.updatedAt;

      return {
        id: task.id,
        taskId: task.id,
        student: {
          name: `${student.firstName} ${student.lastName}`,
          email: student.user.email,
          avatar: null,
        },
        project: {
          id: task.milestone.project.id,
          title: template?.title || 'Unknown Project',
          duration: `${template?.duration || 0} weeks`,
        },
        task: {
          title: task.title,
          description: task.description,
        },
        reviewedAt: reviewedAt.toISOString(),
        status: review?.status.toLowerCase() || task.status.toLowerCase(),
        reviewDuration: Math.floor(Math.random() * 30) + 30, // Placeholder - would need to track actual review time
      };
    });

    return history;
  }

  async getReviewerProjectDetail(
    reviewerId: string,
    projectId: string,
    collegeId?: string | null,
  ) {
    const ctx = await this.reviewerScope.resolveContext(reviewerId, collegeId);
    const accessibleWhere = this.reviewerScope.buildAccessiblePlanProjectWhere(ctx);

    const project = await this.prisma.planProject.findFirst({
      where: {
        id: projectId,
        ...accessibleWhere,
      },
      include: {
        template: true,
        plan: {
          include: {
            student: {
              include: {
                user: true,
              },
            },
            cohort: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found or not assigned to this reviewer');
    }

    const cohortId = project.plan.cohortId;
    const allAssignments = cohortId
      ? await this.prisma.planProject.findMany({
          where: {
            ...accessibleWhere,
            plan: { cohortId },
          },
          include: {
            plan: {
              include: {
                student: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        })
      : [project];

    // Get all tasks for this project
    const tasks = await this.prisma.task.findMany({
      where: {
        milestone: {
          projectId: projectId,
        },
      },
      include: {
        milestone: true,
        submission: true,
      },
      orderBy: [
        { milestone: { order: 'asc' } },
        { order: 'asc' },
      ],
    });

    // Transform the data
    return {
      id: project.id,
      title: project.template?.title || 'Unknown Project',
      description: project.template?.shortDescription || project.template?.description || '',
      category: project.template?.category || '',
      difficulty: project.template?.difficulty || '',
      duration: project.template?.duration || 0,
      student: {
        name: `${project.plan.student.firstName} ${project.plan.student.lastName}`,
        email: project.plan.student.user.email,
      },
      students: allAssignments.map((a) => ({
        name: `${a.plan.student.firstName} ${a.plan.student.lastName}`,
        email: a.plan.student.user.email,
        university: a.plan.student.university,
        graduationYear: a.plan.student.graduationYear,
      })),
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        order: task.order,
        milestone: {
          id: task.milestone.id,
          title: task.milestone.title,
          order: task.milestone.order,
        },
        submission: task.submission ? {
          prLink: task.submission.prLink,
          commitHash: task.submission.commitHash,
          description: task.submission.description,
        } : undefined,
        student: {
          name: `${project.plan.student.firstName} ${project.plan.student.lastName}`,
          email: project.plan.student.user.email,
        },
      })),
    };
  }

  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else {
      return `${diffDays} days ago`;
    }
  }

  async getProjectTemplates() {
    const templates = await this.prisma.projectTemplate.findMany({
      where: {
        status: 'PUBLISHED' as any,
      },
      select: {
        id: true,
        title: true,
        description: true,
        shortDescription: true,
        category: true,
        difficulty: true,
        duration: true,
        skills: true,
        imageUrl: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return templates.map((t) => ({
      ...t,
      isPublished: true,
    }));
  }

  /**
   * Calculate progress for all projects in a plan
   * Returns detailed progress metrics for each project
   */
  private async getProjectsProgress(planId: string) {
    const projects = await this.prisma.planProject.findMany({
      where: { planId },
      include: {
        template: true,
        milestones: {
          include: {
            tasks: true,
          },
        },
      },
      orderBy: { order: 'asc' },
    });

    return projects.map((project) => {
      const allTasks = project.milestones.flatMap((m) => m.tasks);
      const approvedTasks = allTasks.filter((t) => t.status === 'APPROVED');
      const isCompleted = allTasks.length > 0 && allTasks.every((t) => t.status === 'APPROVED');
      const approvalRate = allTasks.length > 0 ? Math.round((approvedTasks.length / allTasks.length) * 100) : 0;

      return {
        projectId: project.id,
        projectName: project.template.title,
        completedTasks: approvedTasks.length,
        totalTasks: allTasks.length,
        isCompleted,
        approvalRate,
      };
    });
  }

  /**
   * Check if all tasks in the current project are approved
   * If yes, mark project as completed and unlock next project
   */
  private async checkAndUnlockNextProject(planId: string) {
    const plan = await this.prisma.internshipPlan.findUnique({
      where: { id: planId },
      include: {
        planProjects: {
          include: {
            milestones: {
              include: {
                tasks: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!plan) {
      return;
    }

    // Find the first non-completed project (current active project)
    const currentProject = plan.planProjects.find((p) => !p.isCompleted && (p.status === 'AVAILABLE' || p.status === 'IN_PROGRESS'));
    
    if (!currentProject) {
      await this.markPlanCompleted(planId);
      return;
    }

    // Check if all tasks in current project are approved
    const allTasks = currentProject.milestones.flatMap((m) => m.tasks);
    const allApproved = allTasks.length > 0 && allTasks.every((t) => t.status === 'APPROVED');

    if (allApproved && !currentProject.isCompleted) {
      // Mark current project as completed
      await this.prisma.planProject.update({
        where: { id: currentProject.id },
        data: {
          isCompleted: true,
          completedAt: new Date(),
          approvedAt: new Date(),
          status: 'COMPLETED' as any,
        },
      });

      // Find next project
      const nextProject = plan.planProjects.find((p) => p.order === currentProject.order + 1);
      
      if (nextProject) {
        // Unlock next project
        await this.prisma.planProject.update({
          where: { id: nextProject.id },
          data: {
            status: 'AVAILABLE' as any,
            startedAt: new Date(),
          },
        });

        // Unlock first task of next project
        const firstMilestone = nextProject.milestones[0];
        if (firstMilestone) {
          const firstTask = firstMilestone.tasks.find((t) => t.order === 1);
          if (firstTask && firstTask.isLocked) {
            const now = new Date();
            const taskDueAt = new Date();
            taskDueAt.setDate(taskDueAt.getDate() + firstTask.durationDays);

            await this.prisma.task.update({
              where: { id: firstTask.id },
              data: {
                status: 'DRAFT',
                isLocked: false,
                startAt: now,
                dueAt: taskDueAt,
              },
            });
          }
        }
      } else {
        await this.markPlanCompleted(planId);
      }
    }
  }

  async getMyCertificate(userId: string) {
    return this.certificatesService.getStudentCertificate(userId);
  }

  async downloadMyCertificate(userId: string, role: string, res: Response) {
    const meta = await this.certificatesService.getStudentCertificate(userId);
    if (!meta.issued || !meta.planId) {
      const msg = 'message' in meta ? meta.message : 'No certificate available';
      throw new BadRequestException(msg);
    }
    return this.certificatesService.streamPlanCertificate(meta.planId, userId, role, res, false);
  }

  async previewMyCertificate(userId: string, role: string, res: Response) {
    const meta = await this.certificatesService.getStudentCertificate(userId);
    if (!meta.issued || !meta.planId) {
      const msg = 'message' in meta ? meta.message : 'No certificate available';
      throw new BadRequestException(msg);
    }
    return this.certificatesService.streamPlanCertificate(meta.planId, userId, role, res, true);
  }

  async getCertificateMeta(planId: string, userId: string, role: string) {
    return this.certificatesService.getCertificateMeta(planId, userId, role);
  }

  private async markPlanCompleted(planId: string) {
    const plan = await this.prisma.internshipPlan.findUnique({
      where: { id: planId },
      select: { isCompleted: true },
    });
    if (!plan || plan.isCompleted) return;

    await this.prisma.internshipPlan.update({
      where: { id: planId },
      data: {
        isCompleted: true,
        completedAt: new Date(),
        status: 'COMPLETED' as any,
      },
    });

    try {
      await this.certificatesService.issueForCompletedPlan(planId);
    } catch (err) {
      console.error(`Certificate issuance failed for plan ${planId}`, err);
    }
  }
}
