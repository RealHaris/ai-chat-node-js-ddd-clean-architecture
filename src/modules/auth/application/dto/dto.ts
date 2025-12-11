import { z } from 'zod';

// Register DTO
export const RegisterDTOSchema = z.object({
  email: z.string().email('Invalid email format').max(320),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number'),
  phone: z.string().max(20).optional(),
});

export type RegisterDTO = z.infer<typeof RegisterDTOSchema>;

// Login DTO
export const LoginDTOSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginDTO = z.infer<typeof LoginDTOSchema>;

// Refresh Token DTO
export const RefreshTokenDTOSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenDTO = z.infer<typeof RefreshTokenDTOSchema>;

// Reset Password DTO
export const ResetPasswordDTOSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number'),
});

export type ResetPasswordDTO = z.infer<typeof ResetPasswordDTOSchema>;
