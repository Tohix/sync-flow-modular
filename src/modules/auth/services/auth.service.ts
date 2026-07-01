import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.providers';
import type { DrizzleDB } from '../../../database/database.providers';
import { users } from '../../../database/schema/users.schema';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

const BCRYPT_COST = 12;

// Compared against when no user is found, so login() takes the same amount
// of time regardless of whether the email exists (timing-safe opaque 401).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  'dummy-password-for-timing-safety',
  BCRYPT_COST,
);

export interface SafeUser {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginResult {
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<SafeUser> {
    const email = this.normalizeEmail(dto.email);

    const [existingUser] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_COST);

    const [user] = await this.db
      .insert(users)
      .values({ email, password: hashedPassword })
      .returning({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return user;
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const email = this.normalizeEmail(dto.email);

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user?.password ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
