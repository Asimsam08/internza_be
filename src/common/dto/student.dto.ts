import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsNumber, IsArray, IsString } from 'class-validator';

export enum DurationType {
  FOUR_WEEKS = 'FOUR_WEEKS',
  EIGHT_WEEKS = 'EIGHT_WEEKS',
  TWELVE_WEEKS = 'TWELVE_WEEKS',
  CUSTOM = 'CUSTOM',
}

// Plan Selection DTOs
export class PlanOptionDto {
  @ApiProperty({ example: 'FOUR_WEEKS' })
  durationType: DurationType;

  @ApiProperty({ example: 4 })
  totalWeeks: number;

  @ApiProperty({ example: '4-Week Internship' })
  title: string;

  @ApiProperty({ example: 'Perfect for beginners to get started with real projects' })
  description: string;

  @ApiProperty({ example: 'Beginner' })
  difficulty: string;

  @ApiProperty({ example: ['React', 'TypeScript', 'Node.js'] })
  skills: string[];

  @ApiProperty({ example: 'https://example.com/4-week-plan.jpg', required: false })
  imageUrl?: string;
}

export class GetPlanOptionsResponseDto {
  @ApiProperty({ type: [PlanOptionDto] })
  plans: PlanOptionDto[];

  @ApiProperty({ example: false, description: 'Whether student already has an active plan' })
  hasActivePlan: boolean;

  @ApiProperty({ required: false, nullable: true })
  activePlanId?: string;
}

export class EnrollInPlanDto {
  @ApiProperty({ example: 'FOUR_WEEKS' })
  @IsEnum(DurationType)
  @IsNotEmpty()
  durationType: DurationType;

  @ApiProperty({ example: 4, required: false, description: 'Required only for CUSTOM duration type' })
  @IsOptional()
  @IsNumber()
  customWeeks?: number;

  @ApiProperty({ example: ['project-id-1', 'project-id-2'], required: false, description: 'Selected project IDs for the plan' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedProjectIds?: string[];
}

export class EnrollInPlanResponseDto {
  @ApiProperty({ example: 'plan-123' })
  planId: string;

  @ApiProperty({ example: 'FOUR_WEEKS' })
  durationType: string;

  @ApiProperty({ example: 4 })
  totalWeeks: number;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  startedAt: string;

  @ApiProperty({ example: 'Enrolled successfully' })
  message: string;
}

// Task Timeline DTOs
export class TaskTimelineDto {
  @ApiProperty({ example: 'task-123' })
  id: string;

  @ApiProperty({ example: 'Setup Development Environment' })
  title: string;

  @ApiProperty({ example: 'Initialize Next.js project with TypeScript' })
  description: string;

  @ApiProperty({ example: 1 })
  order: number;

  @ApiProperty({ example: 3 })
  durationDays: number;

  @ApiProperty({ example: 'DRAFT' })
  status: string;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  startAt: string;

  @ApiProperty({ example: '2024-01-18T10:00:00Z' })
  dueAt: string;

  @ApiProperty({ example: false })
  isOverdue: boolean;

  @ApiProperty({ example: false })
  isLocked: boolean;
}

export class ProjectInfoDto {
  @ApiProperty({ example: 'project-123' })
  id: string;

  @ApiProperty({ example: 'AI/ML Image Classifier' })
  title: string;

  @ApiProperty({ example: 'Build a CNN model for image classification' })
  description: string;

  @ApiProperty({ example: 'AI/ML' })
  category: string;

  @ApiProperty({ example: 'Intermediate' })
  difficulty: string;

  @ApiProperty({ example: 4 })
  duration: number;

  @ApiProperty({ example: 1 })
  order: number;

  @ApiProperty({ example: 'IN_PROGRESS' })
  status: string;

  @ApiProperty({ example: false })
  isCompleted: boolean;

  @ApiProperty({ example: '2024-01-15T10:00:00Z', required: false })
  completedAt?: string;

  @ApiProperty({ example: '2024-01-15T10:00:00Z', required: false })
  startedAt?: string;
}

export class ProjectProgressDto {
  @ApiProperty({ example: 'project-123' })
  projectId: string;

  @ApiProperty({ example: 'AI/ML Image Classifier' })
  projectName: string;

  @ApiProperty({ example: 3 })
  completedTasks: number;

  @ApiProperty({ example: 6 })
  totalTasks: number;

  @ApiProperty({ example: false })
  isCompleted: boolean;

  @ApiProperty({ example: 50 })
  approvalRate: number;
}

export class CurrentProjectDto {
  @ApiProperty({ example: 'project-123' })
  id: string;

  @ApiProperty({ example: 'AI/ML Image Classifier' })
  title: string;

  @ApiProperty({ example: 'Build a CNN model for image classification' })
  description: string;

  @ApiProperty({ example: 'AI/ML' })
  category: string;

  @ApiProperty({ example: 'Intermediate' })
  difficulty: string;

  @ApiProperty({ example: 4 })
  duration: number;

  @ApiProperty({ example: 'IN_PROGRESS' })
  status: string;

  @ApiProperty({ type: [TaskTimelineDto] })
  tasks: TaskTimelineDto[];
}

// Dashboard Warning DTOs
export class DashboardWarningDto {
  @ApiProperty({ example: 'OVERDUE_TASKS' })
  type: string;

  @ApiProperty({ example: 'You have 2 overdue tasks' })
  message: string;

  @ApiProperty({ example: 'high' })
  severity: 'low' | 'medium' | 'high';

  @ApiProperty({ example: 2 })
  count: number;
}

export class StudentDashboardDto {
  @ApiProperty({ example: 'plan-123' })
  planId: string;

  @ApiProperty({ example: 'FOUR_WEEKS' })
  durationType: string;

  @ApiProperty({ example: 4 })
  totalWeeks: number;

  @ApiProperty({ example: 1 })
  completedWeeks: number;

  @ApiProperty({ example: 25 })
  progressPercentage: number;

  @ApiProperty({ example: 'ACTIVE' })
  planStatus: string;

  @ApiProperty({ type: [ProjectInfoDto] })
  projects: ProjectInfoDto[];

  @ApiProperty()
  activeProject: ProjectInfoDto;

  @ApiProperty({ required: false, nullable: true })
  nextProject?: ProjectInfoDto;

  @ApiProperty({ type: [ProjectProgressDto] })
  projectProgress: ProjectProgressDto[];

  @ApiProperty({ example: false })
  canUnlockNextProject: boolean;

  @ApiProperty({ required: false, nullable: true })
  currentProject?: CurrentProjectDto;

  @ApiProperty({ required: false, nullable: true })
  currentTask?: TaskTimelineDto;

  @ApiProperty({ example: 5 })
  completedTaskCount: number;

  @ApiProperty({ example: 2 })
  overdueTaskCount: number;

  @ApiProperty({ example: 1 })
  dueSoonTaskCount: number;

  @ApiProperty({ example: 3 })
  lockedTaskCount: number;

  @ApiProperty({ type: [DashboardWarningDto], required: false })
  warnings?: DashboardWarningDto[];

  @ApiProperty({ example: 'Submit your task by tomorrow' })
  nextAction: string;

  @ApiProperty({ type: [TaskTimelineDto] })
  taskTimeline: TaskTimelineDto[];
}
