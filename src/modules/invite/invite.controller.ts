import { Controller, Get, Post, Param, Body, Res, UseGuards, Request } from '@nestjs/common'
import { Response } from 'express'
import { InviteService } from './invite.service'
import { InviteSetupDto } from './dto/invite-setup.dto'
import { Public } from '@/common/decorators/public.decorator'
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard'

@Controller('invite')
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  @Public()
  @Get('platform/:token')
  validatePlatform(@Param('token') token: string) {
    return this.inviteService.validatePlatformToken(token)
  }

  @Public()
  @Get(':collegeId/:token')
  validate(@Param('collegeId') collegeId: string, @Param('token') token: string) {
    return this.inviteService.validateToken(collegeId, token)
  }

  @UseGuards(JwtAuthGuard)
  @Post('platform/:token/accept')
  async acceptExistingPlatform(
    @Param('token') token: string,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.inviteService.acceptExistingPlatformUser(
      token,
      req.user.userId,
    )
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000,
    })
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    return { user }
  }

  @Public()
  @Post('setup')
  async setup(@Body() dto: InviteSetupDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.inviteService.setupAccount(dto)
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000,
    })
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    return { user }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':collegeId/:token/accept')
  async acceptExisting(
    @Param('collegeId') collegeId: string,
    @Param('token') token: string,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.inviteService.acceptExistingUser(
      collegeId,
      token,
      req.user.userId,
    )
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000,
    })
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    return { user }
  }
}
