// Utility types for validation and common functions

export type Primitive = string | number | boolean | null | undefined;

export type ValidationResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type FunctionType = (...args: unknown[]) => unknown;

export type ObjectType = Record<string, unknown>;

export type ArrayType = unknown[];

export type Nullable<T> = T | null | undefined;
