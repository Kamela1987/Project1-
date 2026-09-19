import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ZonesService } from './zones.service';

describe('ZonesService', () => {
  let zonesRepo: any;
  let townsService: any;
  let service: ZonesService;

  const closedRing: [number, number][] = [
    [27.47, -16.4],
    [27.49, -16.4],
    [27.49, -16.38],
    [27.47, -16.38],
    [27.47, -16.4],
  ];

  beforeEach(() => {
    zonesRepo = {
      create: jest.fn((data: any) => ({ ...data, id: 'zone-1' })),
      save: jest.fn(async (data: any) => data),
      find: jest.fn(),
      findOneBy: jest.fn(),
      delete: jest.fn(),
      manager: { query: jest.fn() },
    };
    townsService = { findById: jest.fn() };
    service = new ZonesService(zonesRepo, townsService);
  });

  describe('create', () => {
    it('creates a zone with no boundary (plain pricing bucket)', async () => {
      const zone = await service.create({ name: 'Town Center' } as any);
      expect(zone.name).toBe('Town Center');
      expect(zonesRepo.manager.query).not.toHaveBeenCalled();
    });

    it('accepts a well-formed closed-ring boundary', async () => {
      await service.create({ name: 'Town Center', boundary: closedRing } as any);
      expect(zonesRepo.manager.query).toHaveBeenCalledWith(expect.stringContaining('ST_GeomFromGeoJSON'), [
        expect.stringContaining('"type":"Polygon"'),
        'zone-1',
      ]);
    });

    it('rejects a boundary that is not a closed ring', async () => {
      const openRing: [number, number][] = [
        [27.47, -16.4],
        [27.49, -16.4],
        [27.49, -16.38],
        [27.47, -16.38],
      ];
      await expect(service.create({ name: 'Bad Zone', boundary: openRing } as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(zonesRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a malformed point in the ring', async () => {
      const malformed = [...closedRing.slice(0, -1), ['not', 'numbers']] as any;
      await expect(service.create({ name: 'Bad Zone', boundary: malformed } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('validates townId against TownsService and 404s on an unknown town', async () => {
      townsService.findById.mockRejectedValue(new NotFoundException('Town not found'));
      await expect(service.create({ name: 'Zone', townId: 'bogus' } as any)).rejects.toThrow(NotFoundException);
      expect(zonesRepo.save).not.toHaveBeenCalled();
    });

    it('translates a unique-name violation into 409', async () => {
      zonesRepo.save.mockRejectedValue({ code: '23505' });
      await expect(service.create({ name: 'Duplicate' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('filters by townId when given', async () => {
      zonesRepo.find.mockResolvedValue([]);
      await service.findAll('town-1');
      expect(zonesRepo.find).toHaveBeenCalledWith({ where: { townId: 'town-1' }, order: { name: 'ASC' } });
    });

    it('returns everything when no townId is given', async () => {
      zonesRepo.find.mockResolvedValue([]);
      await service.findAll();
      expect(zonesRepo.find).toHaveBeenCalledWith({ where: {}, order: { name: 'ASC' } });
    });
  });

  describe('findContainingPoint', () => {
    it('returns null when no zone contains the point', async () => {
      zonesRepo.manager.query.mockResolvedValue([]);
      expect(await service.findContainingPoint(-16.39, 27.48)).toBeNull();
    });

    it('returns the matching zone, querying with lng before lat', async () => {
      zonesRepo.manager.query.mockResolvedValue([{ id: 'zone-1', name: 'Town Center' }]);
      const zone = await service.findContainingPoint(-16.39, 27.48);
      expect(zone?.id).toBe('zone-1');
      expect(zonesRepo.manager.query).toHaveBeenCalledWith(expect.any(String), [27.48, -16.39]);
    });
  });

  describe('delete', () => {
    it('404s when nothing was deleted', async () => {
      zonesRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.delete('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
