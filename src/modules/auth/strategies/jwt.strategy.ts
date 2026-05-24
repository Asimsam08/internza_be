import { Injectable, UnauthorizedException, Req } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '@/prisma/prisma.service'
import { Request } from 'express'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          // Try to get from cookie first
          let token = null
          if (request && request.cookies) {
            token = request.cookies['accessToken']
          }
          // Fallback to Authorization header
          if (!token) {
            token = ExtractJwt.fromAuthHeaderAsBearerToken()(request)
          }
          return token
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    })
  }

  async validate(payload: any) {
      console.log('JWT PAYLOAD:', payload);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        collegeId: true,
        isActive: true,
      },
    })

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive')
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      collegeId: user.collegeId,
    }
  }
}
