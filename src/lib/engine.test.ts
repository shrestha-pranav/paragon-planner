import { describe, it, expect } from 'vitest';
import { calculatePlan, gameData } from './engine';

describe('Paragon Engine (Fixed Imports)', () => {
  it('should calculate population needs correctly', () => {
    const input = {
      population: { POPULATION_PIONEERS_HUT_INFO: 100 },
      units: {},
      difficulty: 'Normal' as const
    };
    const res = calculatePlan(input);
    // 10 houses * (10/3780) * 1,000,000 ~= 26455
    // Actually extractor rounds 10/3780 * 1MIL = 2646
    // 10 houses * 2646 = 26460
    expect(res.resources['Fish'].consumed).toBeCloseTo(26460, 0);
  });

  it('should calculate complex recursive dependencies (Knight 0.25/min)', () => {
    const MIL = gameData.config.precision;
    const input = {
      population: {},
      units: { 'Knight': (0.25 / 60) * MIL },
      difficulty: 'Normal' as const
    };
    const res = calculatePlan(input);

    // 1. Knight Barracks (5)
    expect(res.buildings['KNIGHT_BARRACKS_INFO']).toBeGreaterThanOrEqual(4.9);

    // 2. Iron Sword (2 Iron Armories)
    expect(res.buildings['IRON_ARMORY_INFO']).toBeGreaterThanOrEqual(1.9);
  });

  it('should not produce astronomical slot counts', () => {
    const MIL = gameData.config.precision;
    const input = {
      population: { 
        POPULATION_MERCHANTS_MANSION_INFO: 1000,
        POPULATION_WORKERS_HOUSE_INFO: 500
      },
      units: { 'Knight': (0.25 / 60) * MIL },
      difficulty: 'Normal' as const
    };
    const res = calculatePlan(input);
    expect(res.totalSlots).toBeLessThan(10000);
  });
});
