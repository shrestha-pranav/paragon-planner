import { describe, it, expect } from 'vitest';
import { calculatePlan } from './engine';

describe('Paragon Engine (Service Logic)', () => {
  it('should calculate population needs correctly', () => {
    const input = {
      population: { POPULATION_PIONEERS_HUT_INFO: 100 },
      units: {},
      difficulty: 'Normal' as const
    };
    const res = calculatePlan(input);
    expect(res.resources['Fish'].consumed).toBeCloseTo(0.026455, 5);
  });

  it('should calculate service needs correctly (Water)', () => {
    const input = {
      population: { POPULATION_PIONEERS_HUT_INFO: 90 }, // 9 houses
      units: {},
      difficulty: 'Normal' as const
    };
    const res = calculatePlan(input);
    // Water capacity = 30 houses per well (or 60 per cistern).
    // 9 houses need 9/30 = 0.3 Wells.
    const waterBuildingsCount = (res.buildings['WELL_INFO'] || 0) + (res.buildings['CISTERN_INFO'] || 0);
    // Cistern capacity is 60, so 9/60 = 0.15. 
    // If Cistern was picked: 0.15. If Well was picked: 0.3.
    expect(waterBuildingsCount).toBeGreaterThan(0.14);
  });

  it('should calculate complex recursive dependencies (Knight 0.25/min)', () => {
    const input = {
      population: {},
      units: { 'Knight': 0.25 / 60 },
      difficulty: 'Normal' as const
    };
    const res = calculatePlan(input);
    expect(res.buildings['KNIGHT_BARRACKS_INFO']).toBeGreaterThanOrEqual(4.99);
    // Either IRON_ARMORY_INFO or IRON_ARMORY_NORTH_INFO
    const armories = (res.buildings['IRON_ARMORY_INFO'] || 0) + (res.buildings['IRON_ARMORY_NORTH_INFO'] || 0);
    expect(armories).toBeGreaterThanOrEqual(1.99);
  });
});
