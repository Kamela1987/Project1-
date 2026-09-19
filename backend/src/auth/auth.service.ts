import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { OtpStore } from './otp.store';
import { SmsService } from './sms.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly otpStore: OtpStore,
    private readonly smsService: SmsService,
    private readonly jwtService: JwtService,
  ) {}

  async requestOtp({ phoneNumber }: RequestOtpDto): Promise<{ sent: true }> {
    const code = this.otpStore.issue(phoneNumber);
    await this.smsService.send(phoneNumber, `Your Monze Ride verification code is ${code}. It expires in 5 minutes.`);
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
