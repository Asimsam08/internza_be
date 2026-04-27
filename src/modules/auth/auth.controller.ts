import { Controller, Post, Body, Get, UseGuards, Request, Res, Req } from '@nestjs/common'
import { Response } from 'express'
import { AuthService } from './auth.service'
import { StudentSignupDto } from './dto/student-signup.dto'
import { SigninDto } from './dto/signin.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'

interface RequestWithCookies extends Request {
  cookies?: {
    accessToken?: string
    refreshToken?: string
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('student/signup')
  async studentSignup(
    @Body() studentSignupDto: StudentSignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.authService.studentSignup(studentSignupDto)

    // Set httpOnly cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour
    })

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    // Return only user data (not tokens)
    return { user }
  }

  @Post('signin')
  async signin(@Body() signinDto: SigninDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.authService.signin(signinDto)

    // Set httpOnly cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour
    })

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    // Return only user data (not tokens)
    return { user }
  }

  @Post('refresh')
  async refresh(@Req() req: RequestWithCookies, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refreshToken

    if (!refreshToken) {
      throw new Error('No refresh token provided')
    }

    const { user, tokens } = await this.authService.refresh(refreshToken)

    // Set new httpOnly cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour
    })

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    // Return only user data (not tokens)
    return { user }
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    // Clear cookies
    res.clearCookie('accessToken')
    res.clearCookie('refreshToken')
    return { message: 'Logged out successfully' }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getCurrentUser(@Request() req) {
    return this.authService.getCurrentUser(req.user.userId)
  }
}
