import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '@/prisma/prisma.service'
import { Role } from '@prisma/client'
import { StudentSignupDto } from './dto/student-signup.dto'
import { SigninDto } from './dto/signin.dto'
import { RefreshDto } from './dto/refresh.dto'
import { AuthResponseDto } from './dto/auth-response.dto'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async studentSignup(studentSignupDto: StudentSignupDto): Promise<{ user: any; tokens: { accessToken: string; refreshToken: string } }> {
    const { fullName, email, university, graduationYear, password } = studentSignupDto

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      throw new ConflictException('User with this email already exists')
    }

    // Split full name into first and last name
    const nameParts = fullName.trim().split(' ')
    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(' ') || ''

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user with student profile including university and graduation year
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: Role.STUDENT,
        studentProfile: {
          create: {
            firstName,
            lastName,
            university,
            graduationYear,
          },
        },
      },
      include: {
        studentProfile: true,
      },
    })

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.role)

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        studentProfile: user.studentProfile,
      },
      tokens,
    }
  }

  async signin(signinDto: SigninDto): Promise<{ user: any; tokens: { accessToken: string; refreshToken: string } }> {
    const { email, password } = signinDto

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        studentProfile: true,
        reviewerProfile: true,
      },
    })

    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated')
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.role)

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        studentProfile: user.studentProfile,
        reviewerProfile: user.reviewerProfile,
      },
      tokens,
    }
  }

  async refresh(refreshToken: string): Promise<{ user: any; tokens: { accessToken: string; refreshToken: string } }> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      })

      // Check if user exists and is active
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          studentProfile: true,
          reviewerProfile: true,
        },
      })

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token')
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user.id, user.role)

      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          studentProfile: user.studentProfile,
          reviewerProfile: user.reviewerProfile,
        },
        tokens,
      }
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        studentProfile: true,
        reviewerProfile: true,
      },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    return user
  }

  private async generateTokens(
    userId: string,
    role: Role,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: userId, role }

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    })

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    })

    // In production, store refresh token in database for revocation
    // For MVP, we're not implementing refresh token storage

    return { accessToken, refreshToken }
  }

  async validateUser(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    })

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive')
    }

    return user
  }
}
