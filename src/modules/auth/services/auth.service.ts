import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthUserRepository } from '../repositories/auth-user.repository';
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
    private readonly authUserRepository: AuthUserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<SafeUser> {
    const email = this.normalizeEmail(dto.email);

    const existingUser = await this.authUserRepository.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_COST);

    return this.authUserRepository.create({
      email,
      password: hashedPassword,
    });
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const email = this.normalizeEmail(dto.email);

    const user = await this.authUserRepository.findByEmail(email);

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
