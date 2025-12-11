import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';

import Config from '~/configs';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

@injectable()
export class TokenService {
  generateAccessToken(payload: TokenPayload): string {
    const options: SignOptions = {
      expiresIn: Config.JWT_ACCESS_EXPIRY as SignOptions['expiresIn'],
    };
    return jwt.sign(
      {
        sub: payload.userId,
        email: payload.email,
        role: payload.role,
        type: 'access',
      },
      Config.JWT_SECRET,
      options
    );
  }

  generateRefreshToken(payload: TokenPayload): string {
    const tokenId = uuidv4();
    const options: SignOptions = {
      expiresIn: Config.JWT_REFRESH_EXPIRY as SignOptions['expiresIn'],
    };
    return jwt.sign(
      {
        sub: payload.userId,
        email: payload.email,
        role: payload.role,
        type: 'refresh',
        jti: tokenId,
      },
      Config.JWT_SECRET,
      options
    );
  }

  generateTokenPair(payload: TokenPayload): TokenPair {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    // Calculate expiry dates
    const accessTokenExpiresAt = this.getExpirationDate(
      Config.JWT_ACCESS_EXPIRY
    );
    const refreshTokenExpiresAt = this.getExpirationDate(
      Config.JWT_REFRESH_EXPIRY
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    };
  }

  verifyAccessToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, Config.JWT_SECRET) as JwtPayload;

      if (decoded.type !== 'access') {
        return null;
      }

      return {
        userId: decoded.sub as string,
        email: decoded.email as string,
        role: decoded.role as string,
      };
    } catch {
      return null;
    }
  }

  verifyRefreshToken(token: string): (TokenPayload & { jti: string }) | null {
    try {
      const decoded = jwt.verify(token, Config.JWT_SECRET) as JwtPayload;

      if (decoded.type !== 'refresh') {
        return null;
      }

      return {
        userId: decoded.sub as string,
        email: decoded.email as string,
        role: decoded.role as string,
        jti: decoded.jti as string,
      };
    } catch {
      return null;
    }
  }

  private getExpirationDate(expiresIn: string): Date {
    const now = new Date();
    const match = expiresIn.match(/^(\d+)([smhd])$/);

    if (!match) {
      // Default to 15 minutes if invalid format
      return new Date(now.getTime() + 15 * 60 * 1000);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return new Date(now.getTime() + value * 1000);
      case 'm':
        return new Date(now.getTime() + value * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 15 * 60 * 1000);
    }
  }

  getRefreshTokenExpiry(): Date {
    return this.getExpirationDate(Config.JWT_REFRESH_EXPIRY);
  }
}
