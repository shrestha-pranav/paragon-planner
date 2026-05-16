import { describe, it, expect } from 'vitest';
import { calculatePlan, gameData } from './engine';

describe('Paragon Engine', () => {
  it('should verify gameData producers', () => {
    expect(gameData.producers['Iron Sword']).toContain('IRON_ARMORY_INFO');
    expect(gameData.producers['Iron Ingot']).toContain('IRON_SMELTER_INFO');
    expect(gameData.producers['Knight']).toContain('KNIGHT_BARRACKS_INFO');
  });

  it('should calculate population needs correctly', () => {
    const input = {
      population: { POPULATION_PIONEERS_HUT_INFO: 100 },
      units: {},
      difficulty: 'Normal' as const
    };
    const res = calculatePlan(input);
    // 10 houses * (10/3780) * 1,000,000 ~= 26455
    expect(res.resources['Fish'].consumed).toBeGreaterThan(26000);
  });

  it('should calculate complex recursive dependencies (Knight 0.25/min)', () => {
    const MIL = gameData.config.ticks_per_second;
    const input = {
      population: {},
      units: { 'Knight': (0.25 / 60) * MIL },
      difficulty: 'Normal' as const
    };
    const res = calculatePlan(input);

    // 1. Knight Barracks (5)
    expect(res.buildings['KNIGHT_BARRACKS_INFO']).toBeGreaterThanOrEqual(4.9);

    // 2. Iron Sword (2)
    expect(res.buildings['IRON_ARMORY_INFO']).toBeGreaterThanOrEqual(1.9);
    
    // 3. Iron Ingot (1 fast smelter or 2 slow ones)
    const smelters = (res.buildings['IRON_SMELTER_INFO'] || 0) + (res.buildings['IRON_SMELTER_NORTH_INFO'] || 0);
    expect(smelters).toBeGreaterThanOrEqual(0.9);
    
    // 4. Iron Ore (0.5 fast mines or 1 slow one)
    const mines = (res.buildings['IRON_MINE_INFO'] || 0) + (res.buildings['IRON_MINE_NORTH_INFO'] || 0);
    expect(mines).toBeGreaterThanOrEqual(0.4);
  });

  it('should not produce astronomical slot counts', () => {
    const MIL = gameData.config.ticks_per_second;
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
