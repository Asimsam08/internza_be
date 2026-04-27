import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

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

    // Update existing profile
    const updatedProfile = await this.prisma.studentProfile.update({
      where: { userId },
      data: updateProfileDto,
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
}
