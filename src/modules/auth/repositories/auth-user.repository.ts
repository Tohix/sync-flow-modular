import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.providers';
import type { DrizzleDB } from '../../../database/database.providers';
import { users } from '../../../database/schema/users.schema';

export type AuthUser = typeof users.$inferSelect;

export interface CreateAuthUserInput {
  email: string;
  password: string;
}

export interface CreatedAuthUser {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AuthUserRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByEmail(email: string): Promise<AuthUser | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user;
  }

  async create(input: CreateAuthUserInput): Promise<CreatedAuthUser> {
    const [user] = await this.db.insert(users).values(input).returning({
      id: users.id,
      email: users.email,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

    return user;
  }
}
