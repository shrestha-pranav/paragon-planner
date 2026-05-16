import { describe, it, expect } from 'vitest';
import { calculatePlan, gameData } from './engine';

describe('Paragon Engine', () => {
  it('should verify gameData structure', () => {
    expect(gameData.buildings).toBeDefined();
    expect(gameData.buildings['IRON_ARMORY_INFO']).toBeDefined();
    expect(gameData.producers['Iron Sword']).toContain('IRON_ARMORY_INFO');
    expect(gameData.producers['Knight']).toContain('KNIGHT_BARRACKS_INFO');
    expect(gameData.producers['Iron Ingot']).toContain('IRON_SMELTER_INFO');
  });

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

    // Pioneers Hut consumes Fish at 10/3780 per house per sec
    // 10 houses * (10/3780) = 100/3780 ~= 0.026455
    expect(resNormal.resources['Fish'].consumed).toBeCloseTo(0.026455, 5);
    expect(resEasy.resources['Fish'].consumed).toBeCloseTo(0.013227, 5);
  });

  it('should calculate complex recursive dependencies (Knight 0.25/min)', () => {
    const input = {
      population: {},
      units: { 'Knight': 0.25 / 60 },
      difficulty: 'Normal' as const
    };
    const res = calculatePlan(input);

    // 1. Knight Barracks count (5)
    expect(res.buildings['KNIGHT_BARRACKS_INFO']).toBeGreaterThanOrEqual(4.99);

    // 2. Iron Sword requirements (2 Iron Armories)
    expect(res.buildings['IRON_ARMORY_INFO']).toBeGreaterThanOrEqual(1.99);
    
    // 3. Iron Ingot requirements (Iron Smelter)
    // The engine might pick IRON_SMELTER_NORTH_INFO or IRON_SMELTER_INFO
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
        'Knight': 0.25 / 60,
        'Crossbowman': 0.25 / 60,
        'Composite Bow Archer': 0.25 / 60,
        'Cavalry': 0.3 / 60,
        'Pikeman': 0.3 / 60,
        'War Drummer': 0.3 / 60,
        'Glaive Warrior': 0.2 / 60,
        'Shield Guardian': 0.2 / 60
      },
      difficulty: 'Normal' as const
    };
    
    const res = calculatePlan(input);
    
    // Total slots should be reasonable (e.g. < 5000)
    expect(res.totalSlots).toBeGreaterThan(100);
    expect(res.totalSlots).toBeLessThan(5000);
  });
});
