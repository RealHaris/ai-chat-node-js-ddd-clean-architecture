import bcrypt from 'bcrypt';
import { injectable } from 'tsyringe';

import Config from '~/configs';

@injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, Config.BCRYPT_SALT_ROUNDS);
  }

  async compare(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  validatePasswordStrength(password: string): {
    valid: boolean;
    message?: string;
  } {
    if (password.length < 8) {
      return {
        valid: false,
        message: 'Password must be at least 8 characters long',
      };
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      return {
        valid: false,
        message: 'Password must contain at least one uppercase letter',
      };
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      return {
        valid: false,
        message: 'Password must contain at least one lowercase letter',
      };
    }

    // Check for at least one number
    if (!/\d/.test(password)) {
      return {
        valid: false,
        message: 'Password must contain at least one number',
      };
    }

    return { valid: true };
  }
}
