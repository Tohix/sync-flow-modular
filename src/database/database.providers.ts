import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema/users.schema';

export const DRIZZLE = Symbol('DRIZZLE');

export type DrizzleDB = NodePgDatabase<typeof schema>;

export const databaseProviders = [
  {
    provide: DRIZZLE,
    inject: [ConfigService],
    useFactory: (configService: ConfigService): DrizzleDB => {
      const pool = new Pool({
        connectionString: configService.getOrThrow<string>('DATABASE_URL'),
      });
      return drizzle(pool, { schema });
    },
  },
];
