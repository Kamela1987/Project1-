import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { OtpStore } from './otp.store';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly otpStore: OtpStore,
    private readonly jwtService: JwtService,
  ) {}

  requestOtp({ phoneNumber }: RequestOtpDto): { sent: true } {
    const code = this.otpStore.issue(phoneNumber);
    // Dev-only: log the OTP instead of sending it. Wire a real SMS gateway
    // (see architecture doc) before this touches real users.
    this.logger.log(`OTP for ${phoneNumber}: ${code}`);
    return { sent: true };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{ accessToken: string }> {
    const isValid = this.otpStore.verify(dto.phoneNumber, dto.otp);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    let user = await this.users.findOneBy({ phoneNumber: dto.phoneNumber });
    if (!user) {
      if (!dto.name) {
        throw new BadRequestException('name is required to register a new user');
      }
      // Self-service signup only ever creates riders or drivers. Admin
      // accounts must be created out-of-band (see scripts/create-admin.ts)
      // — otherwise anyone could hand themselves the admin role here.
      if (dto.role === UserRole.ADMIN) {
        throw new ForbiddenException('Cannot self-register as admin');
      }
      user = this.users.create({
        phoneNumber: dto.phoneNumber,
        name: dto.name,
        role: dto.role ?? UserRole.RIDER,
      });
      user = await this.users.save(user);
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
    });
    return { accessToken };
  }
}
