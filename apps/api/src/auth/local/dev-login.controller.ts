import { Controller, HttpCode, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AppConfigService } from '../../config/app-config.service.js';
import { AuthRateLimitGuard } from '../../common/rate-limit.guard.js';
import { signLocalJwt } from './local-jwt.js';

export interface DevLoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

/**
 * Only registered when APP_PROFILE=local, AUTH_PROVIDER=local and
 * DEV_AUTH_ENABLED=true all hold at once (enforced both here and by
 * AuthModule only importing this controller when the profile matches).
 * Always issues a token for the fixed DEV_USER_ID — never accepts a
 * client-supplied userId.
 */
@ApiExcludeController()
@Controller('api/dev')
export class DevLoginController {
  constructor(private readonly config: AppConfigService) {}

  @Post('login')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(200)
  login(): DevLoginResponse {
    if (!this.config.devAuthEnabled) {
      // 404, not 403: the endpoint must appear to not exist outside local dev.
      throw new NotFoundException();
    }

    const accessToken = signLocalJwt({
      subject: this.config.devUserId,
      email: this.config.devUserEmail,
      roles: ['parent'],
      secret: this.config.devAuthSecret,
    });

    return { accessToken, tokenType: 'Bearer', expiresIn: 15 * 60 };
  }
}
