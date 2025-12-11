import express from 'express';
import { inject, injectable } from 'tsyringe';

import { LoginUseCase } from '~/modules/auth/application/usecase/login';
import { RefreshTokenUseCase } from '~/modules/auth/application/usecase/refresh_token';
import { RegisterUseCase } from '~/modules/auth/application/usecase/register';
import { ResetPasswordUseCase } from '~/modules/auth/application/usecase/reset_password';
import HttpStatus from '~/shared/common/enums/http_status';
import {
  AuthenticatedRequest,
  authMiddleware,
} from '~/shared/infra/http/middleware/auth';
import { BaseController } from '~/shared/infra/http/utils/base_controller';

@injectable()
export class AuthController extends BaseController {
  private router: express.Router;

  constructor(
    @inject(RegisterUseCase)
    private registerUseCase: RegisterUseCase,
    @inject(LoginUseCase)
    private loginUseCase: LoginUseCase,
    @inject(RefreshTokenUseCase)
    private refreshTokenUseCase: RefreshTokenUseCase,
    @inject(ResetPasswordUseCase)
    private resetPasswordUseCase: ResetPasswordUseCase
  ) {
    super();
    this.router = express.Router();
  }

  register() {
    this.router.post('/register', this.handleRegister.bind(this));
    this.router.post('/login', this.handleLogin.bind(this));
    this.router.post('/refresh', this.handleRefreshToken.bind(this));
    this.router.post(
      '/reset-password',
      authMiddleware,
      this.handleResetPassword.bind(this)
    );

    return this.router;
  }

  handleRegister = async (
    req: express.Request,
    res: express.Response
  ): Promise<void> => {
    try {
      const result = await this.registerUseCase.execute(req.body);

      if (result.isFail()) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: result.error(),
        });
        return;
      }

      res.status(HttpStatus.CREATED).json({
        message: 'Registration successful',
        data: result.value(),
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Registration failed';
      const errorName = error instanceof Error ? error.name : 'Error';

      if (errorName === 'ValidationError') {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: errorMessage,
        });
        return;
      }

      console.error('Register error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Registration failed',
      });
    }
  };

  handleLogin = async (
    req: express.Request,
    res: express.Response
  ): Promise<void> => {
    try {
      const result = await this.loginUseCase.execute(req.body);

      if (result.isFail()) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: result.error(),
        });
        return;
      }

      res.status(HttpStatus.OK).json({
        message: 'Login successful',
        data: result.value(),
      });
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'Error';

      if (errorName === 'UnauthorizedError') {
        res.status(HttpStatus.UNAUTHORIZED).json({
          error: error instanceof Error ? error.message : 'Unauthorized',
        });
        return;
      }

      console.error('Login error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Login failed',
      });
    }
  };

  handleRefreshToken = async (
    req: express.Request,
    res: express.Response
  ): Promise<void> => {
    try {
      const result = await this.refreshTokenUseCase.execute(req.body);

      if (result.isFail()) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: result.error(),
        });
        return;
      }

      res.status(HttpStatus.OK).json({
        message: 'Token refreshed successfully',
        data: result.value(),
      });
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'Error';

      if (errorName === 'UnauthorizedError') {
        res.status(HttpStatus.UNAUTHORIZED).json({
          error: error instanceof Error ? error.message : 'Unauthorized',
        });
        return;
      }

      console.error('Refresh token error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Token refresh failed',
      });
    }
  };

  handleResetPassword = async (
    req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          error: 'User not authenticated',
        });
        return;
      }

      const result = await this.resetPasswordUseCase.execute({
        ...req.body,
        userId: req.user.id,
      });

      if (result.isFail()) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: result.error(),
        });
        return;
      }

      res.status(HttpStatus.OK).json({
        message: result.value().message,
      });
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'Error';

      if (
        errorName === 'ValidationError' ||
        errorName === 'UnauthorizedError'
      ) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: error instanceof Error ? error.message : 'Invalid request',
        });
        return;
      }

      console.error('Reset password error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Password reset failed',
      });
    }
  };
}
