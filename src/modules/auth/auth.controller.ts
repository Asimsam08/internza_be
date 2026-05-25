import { Controller, Post, Body, Get, Patch, UseGuards, Request, Res,UploadedFile, Req,UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express'
import { AuthService } from './auth.service'
import { StudentSignupDto } from './dto/student-signup.dto'
import { SigninDto } from './dto/signin.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { multerOptions } from '../../common/config/multer.config';

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

    const isProduction = process.env.NODE_ENV === 'production'
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' as const : 'lax' as const,
    }

    res.cookie('accessToken', tokens.accessToken, {
      ...cookieOptions,
      maxAge: 60 * 60 * 1000, // 1 hour
    })

    res.cookie('refreshToken', tokens.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    return { user }
  }

  @Post('signin')
  async signin(@Body() signinDto: SigninDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.authService.signin(signinDto)

    const isProduction = process.env.NODE_ENV === 'production'
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' as const : 'lax' as const,
    }

    res.cookie('accessToken', tokens.accessToken, {
      ...cookieOptions,
      maxAge: 60 * 60 * 1000, // 1 hour
    })

    res.cookie('refreshToken', tokens.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    return { user }
  }

  @Post('refresh')
  async refresh(@Req() req: RequestWithCookies, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refreshToken

    if (!refreshToken) {
      throw new Error('No refresh token provided')
    }

    const { user, tokens } = await this.authService.refresh(refreshToken)

    const isProduction = process.env.NODE_ENV === 'production'
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' as const : 'lax' as const,
    }

    res.cookie('accessToken', tokens.accessToken, {
      ...cookieOptions,
      maxAge: 60 * 60 * 1000, // 1 hour
    })

    res.cookie('refreshToken', tokens.refreshToken, {
      ...cookieOptions,
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

  @UseGuards(JwtAuthGuard)
  @Patch('profile-picture')
  @UseInterceptors(
    FileInterceptor('file', multerOptions),
  )
  async uploadProfilePicture(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.authService.uploadProfilePicture(
      req.user.userId,
      file,
    );
  }

//   @Patch('profile-picture')
// @UseInterceptors(FileInterceptor('file'))
// async uploadProfilePicture(
//   @UploadedFile() file: Express.Multer.File,
// ) {
//   console.log('CONTROLLER HIT');

//   console.log(file);

//   return {
//     success: true,
//   };
// }


// @Patch('profile-picture')
// @UseInterceptors(
//   FileInterceptor('file', multerOptions),
// )
// async uploadProfilePicture(
//   @UploadedFile() file: Express.Multer.File,
//   @Req() req: any,
// ) {
//   try {
//     console.log('CONTROLLER HIT');
//     console.log(req.user);

//     const result =
//       await this.authService.uploadProfilePicture(
//         req.user.userId,
//         file,
//       );

//     console.log(result);

//     return result;
//   } catch (error) {
//     console.error(
//       'FULL ERROR:',
//       error,
//     );

//     throw error;
//   }
// }


}
