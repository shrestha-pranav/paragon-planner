import { describe, it, expect } from 'vitest';
import { calculatePlan } from './engine';

describe('Paragon Engine', () => {
  it('should calculate population needs correctly (Easy vs Normal)', () => {
    const inputNormal = {
      population: { POPULATION_PIONEERS_HUT_INFO: 100 }, // 10 houses
      units: {},
      difficulty: 'Normal' as const
    };
    const resNormal = calculatePlan(inputNormal);
    
    const inputEasy = {
      population: { POPULATION_PIONEERS_HUT_INFO: 100 },
      units: {},
      difficulty: 'Easy' as const
    };
    const resEasy = calculatePlan(inputEasy);

    // Fish consumption in Normal
    // 100 inhabitants / 10 = 10 houses
    // Per house rate: 10/3780 per sec
    // Total Fish per sec = 10 * (10 / 3780) = 100 / 3780 ~= 0.026455
    expect(resNormal.resources['Fish'].consumed).toBeCloseTo(0.026455, 5);
    
    // In Easy, it should be half
    expect(resEasy.resources['Fish'].consumed).toBeCloseTo(0.013227, 5);
  });

  it('should calculate complex recursive dependencies (Knight 0.25/min)', () => {
    // Knight 0.25/min = 0.25 / 60 per sec ~= 0.0041666
    
    const input = {
      population: {},
      units: { 'Knight': 0.25 / 60 },
      difficulty: 'Normal' as const
    };
    const res = calculatePlan(input);

    // 1. Knight Barracks count
    // Knight iteration = 1200s
    // Prod rate = 1 / 1200 per sec
    // Needed per sec = 0.25 / 60
    // Count = (0.25 / 60) / (1 / 1200) = (0.25 / 60) * 1200 = 0.25 * 20 = 5 barracks.
    expect(res.buildings['KNIGHT_BARRACKS_INFO']).toBeGreaterThanOrEqual(4.99);

    // 2. Iron Sword requirements
    // 1 Knight consumes 1 Sword.
    // Needed Swords per sec = 0.25 / 60.
    // Iron Armory prod rate = 2 / 960 per sec (from gameData.json) = 1 / 480 per sec.
    // Count = (0.25 / 60) / (1 / 480) = (0.25 / 60) * 480 = 0.25 * 8 = 2 Iron Armories.
    expect(res.buildings['IRON_ARMORY_INFO']).toBeGreaterThanOrEqual(1.99);

    // 3. Militia requirements
    // 1 Knight consumes 4 Militia.
    // Needed Militia per sec = 4 * (0.25 / 60) = 1 / 60 per sec.
    // Pioneer Hut prod rate = 0.057 / 60 per sec.
    // Count = (1 / 60) / (0.057 / 60) = 1 / 0.057 ~= 17.54 huts.
    expect(res.buildings['PIONEERS_HUT_INFO']).toBeGreaterThanOrEqual(17.5);
  });
});
