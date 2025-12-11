// Simplified types for Drizzle ORM

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface IBaseFields {
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
