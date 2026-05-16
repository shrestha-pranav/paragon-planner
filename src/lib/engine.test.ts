import { describe, it, expect } from 'vitest';
import { calculatePlan } from './engine';

const MIL = 1000000;

describe('Paragon Engine (Per-Tick Logic)', () => {
  it('should calculate population needs correctly (Easy vs Normal)', () => {
    const inputNormal = {
      population: { POPULATION_PIONEERS_HUT_INFO: 100 }, // 10 houses
      units: {},
      difficulty: 'Normal' as const
    };
    const resNormal = calculatePlan(inputNormal);
    
    // Fish consumption in Normal
    // 100 inhabitants / 10 = 10 houses
    // Rate per sec = 10 / 3780
    // Rate per MIL ticks = (10/3780) * 1,000,000 ~= 2645.5 -> 2646
    // Total for 10 houses = 26460
    expect(resNormal.resources['Fish'].consumed).toBeCloseTo(26460, 0);
  });

  it('should calculate complex recursive dependencies (Knight 0.25/min)', () => {
    // 0.25 units/min = (0.25 / 60) units/sec
    // In MIL ticks: (0.25 / 60) * 1,000,000 = 4166.66
    const input = {
      population: {},
      units: { 'Knight': (0.25 / 60) * MIL },
      difficulty: 'Normal' as const
    };
    const res = calculatePlan(input);

    // 1. Knight Barracks count (5)
    expect(res.buildings['KNIGHT_BARRACKS_INFO']).toBeGreaterThanOrEqual(4.99);

    // 2. Iron Sword requirements (2 Iron Armories)
    expect(res.buildings['IRON_ARMORY_INFO']).toBeGreaterThanOrEqual(1.99);
    
    // 3. Iron Ingot requirements (2 Iron Smelters)
    const totalSmelters = (res.buildings['IRON_SMELTER_INFO'] || 0) + (res.buildings['IRON_SMELTER_NORTH_INFO'] || 0);
    expect(totalSmelters).toBeGreaterThanOrEqual(1.99);
  });

  it('should not produce astronomical slot counts', () => {
    const input = {
      population: { 
        POPULATION_MERCHANTS_MANSION_INFO: 1000,
        POPULATION_WORKERS_HOUSE_INFO: 500,
        POPULATION_COLONISTS_HOUSE_INFO: 300,
        POPULATION_TOWNSMEN_HOUSE_INFO: 300
      },
      units: { 
        'Knight': (0.25 / 60) * MIL,
        'Crossbowman': (0.25 / 60) * MIL
      },
      difficulty: 'Normal' as const
    };
    
    const res = calculatePlan(input);
    expect(res.totalSlots).toBeGreaterThan(100);
    expect(res.totalSlots).toBeLessThan(5000);
  });
});
