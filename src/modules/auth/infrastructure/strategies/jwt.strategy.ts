import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../domain/auth.types';
import { UnauthorizedException } from '@nestjs/common';
import { UserRepositoryPort } from '@modules/user/database/user.repository.port';
import { USER_DI_TOKENS } from '@modules/user/user.di-tokens';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(USER_DI_TOKENS.UserRepository)
    private readonly userRepository: UserRepositoryPort,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_TOKEN_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Verify that the token is an access token
    if (payload.tokenType !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Verify user still exists and is active
    const userOption = await this.userRepository.findOneById(payload.sub);
    if (userOption.isNone()) {
      throw new UnauthorizedException('User not found');
    }

    const user = userOption.unwrap();
    const userProps = user.getProps();

    // Check if user is still active
    if (!userProps.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Return the JWT payload (this will be attached to request.user)
    return payload;
  }
}