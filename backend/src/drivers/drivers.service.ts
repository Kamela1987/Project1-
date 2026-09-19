import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver, DriverVerificationStatus } from '../entities/driver.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { WalletService } from '../wallet/wallet.service';
import { LocationService } from '../realtime/location.service';
import { MIN_WALLET_BALANCE_TO_GO_ONLINE } from '../config/commission.config';
import { RegisterDriverDto } from './dto/register-driver.dto';
import { RegisterVehicleDto } from './dto/register-vehicle.dto';

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    private readonly walletService: WalletService,
    private readonly locationService: LocationService,
  ) {}

  async register(userId: string, dto: RegisterDriverDto): Promise<Driver> {
    const existing = await this.drivers.findOneBy({ userId });
    if (existing) {
      throw new ConflictException('Driver profile already exists for this user');
    }
    const driver = this.drivers.create({
      userId,
      licenseNumber: dto.licenseNumber,
      verificationStatus: DriverVerificationStatus.PENDING,
    });
    return this.drivers.save(driver);
  }

  async registerVehicle(userId: string, dto: RegisterVehicleDto): Promise<Vehicle> {
    const driver = await this.getByUserId(userId);
    const vehicle = this.vehicles.create({ driverId: driver.id, ...dto });
    return this.vehicles.save(vehicle);
  }

  async setOnline(userId: string, isOnline: boolean): Promise<Driver> {
    const driver = await this.getByUserId(userId);
    if (isOnline && driver.verificationStatus !== DriverVerificationStatus.APPROVED) {
      throw new BadRequestException('Driver is not yet approved to go online');
    }
    if (isOnline) {
      const balance = await this.walletService.getBalance(driver.id);
      if (balance < MIN_WALLET_BALANCE_TO_GO_ONLINE) {
        throw new BadRequestException(
          `Outstanding platform commission of ${(-balance).toFixed(2)} must be settled before going online`,
        );
      }
    }
    driver.isOnline = isOnline;
    const saved = await this.drivers.save(driver);
    if (!isOnline) {
      // Stop influencing distance-sorted matching the moment they go
      // offline, rather than leaving a stale position behind for up to
      // the Redis TTL (see LocationService).
      await this.locationService.clearLocation(driver.id);
    }
    return saved;
  }

  /** Phase 1 stand-in for the admin dashboard's driver-approval screen (Phase 3). */
  async approve(driverId: string): Promise<Driver> {
    const driver = await this.drivers.findOneBy({ id: driverId });
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }
    driver.verificationStatus = DriverVerificationStatus.APPROVED;
    return this.drivers.save(driver);
  }

  async getByUserId(userId: string): Promise<Driver> {
    const driver = await this.drivers.findOne({ where: { userId }, relations: ['vehicle'] });
    if (!driver) {
      throw new NotFoundException('Driver profile not found; register as a driver first');
    }
    return driver;
  }

  /** Used by the payments webhook flow, where all we have is the driver's own id (no user session). */
  async findById(driverId: string): Promise<Driver> {
    const driver = await this.drivers.findOne({ where: { id: driverId }, relations: ['vehicle'] });
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }
    return driver;
  }

  async findAvailable(): Promise<Driver[]> {
    return this.drivers.find({
      where: { isOnline: true, verificationStatus: DriverVerificationStatus.APPROVED },
    });
  }

  /** Admin's driver list — the onboarding queue by default (`?status=pending`), or everyone. */
  async listAll(status?: DriverVerificationStatus): Promise<Driver[]> {
    return this.drivers.find({
      where: status ? { verificationStatus: status } : {},
      relations: ['user', 'vehicle'],
    });
  }
}
