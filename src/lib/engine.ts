import gameDataRaw from '../gameData.json';

export interface Building {
  id: string;
  name: string;
  region: string;
  icon: string;
  rate_per_tick: number;
  consumes_per_tick: Record<string, number>;
  produces: string;
  slots: number;
}

export interface PopulationType {
  id: string;
  name: string;
  inhabitants_per_house: number;
  rate_per_tick: number;
  consumes_per_tick: Record<string, number>;
  produces: string;
  icon: string;
  region: string;
  slots: number;
}

export interface GameData {
  config: {
    precision: number;
  };
  buildings: Record<string, Building>;
  population: Record<string, PopulationType>;
  producers: Record<string, string[]>;
}

export const gameData = gameDataRaw as unknown as GameData;

export type Difficulty = 'Easy' | 'Normal' | 'Hard';

export interface PlanInput {
  population: Record<string, number>; 
  units: Record<string, number>;      
  difficulty: Difficulty;
}

export interface ResourceFlow {
  produced: number;
  consumed: number;
  net: number;
}

export interface PlanResult {
  buildings: Record<string, number>;
  resources: Record<string, ResourceFlow>;
  totalSlots: number;
  regionalBuildings: Record<string, Record<string, number>>;
}

export function calculatePlan(input: PlanInput): PlanResult {
  const buildingCounts: Record<string, number> = {};
  const totalProduced: Record<string, number> = {};
  const totalConsumed: Record<string, number> = {};
  const resourceFlows: Record<string, number> = {};

  const multiplier = input.difficulty === 'Easy' ? 0.5 : (input.difficulty === 'Hard' ? 1.5 : 1.0);

  // 1. Households
  for (const [popId, count] of Object.entries(input.population)) {
    if (count <= 0) continue;
    const pop = gameData.population[popId];
    if (!pop) continue;

    const houseCount = count / pop.inhabitants_per_house;
    buildingCounts[popId] = (buildingCounts[popId] || 0) + houseCount;
    
    if (pop.produces) {
      const rate = pop.rate_per_tick * houseCount;
      totalProduced[pop.produces] = (totalProduced[pop.produces] || 0) + rate;
      resourceFlows[pop.produces] = (resourceFlows[pop.produces] || 0) + rate;
    }

    for (const [item, rate] of Object.entries(pop.consumes_per_tick)) {
      const houseRate = rate * houseCount * multiplier;
      totalConsumed[item] = (totalConsumed[item] || 0) + houseRate;
      resourceFlows[item] = (resourceFlows[item] || 0) - houseRate;
    }
  }

  // 2. Unit Goals
  for (const [item, rate] of Object.entries(input.units)) {
    if (rate <= 0) continue;
    totalConsumed[item] = (totalConsumed[item] || 0) + rate;
    resourceFlows[item] = (resourceFlows[item] || 0) - rate;
  }

  // 3. Chain Solver
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 300) {
    changed = false;
    iterations++;

    // Find first item with deficit
    for (const [item, flow] of Object.entries(resourceFlows)) {
      if (flow < -0.1) {
        const producers = gameData.producers[item];
        if (!producers) continue;
        
        // Filter out houses (we don't auto-scale population)
        const validProducers = producers.filter(id => !id.startsWith('POPULATION_'));
        if (validProducers.length === 0) continue;

        // Pick producer (prefer non-North for Temperate? No, just pick first for now)
        const bId = validProducers[0];
        const b = gameData.buildings[bId];
        if (!b || b.rate_per_tick <= 0) continue;

        const needed = Math.abs(flow) / b.rate_per_tick;
        buildingCounts[bId] = (buildingCounts[bId] || 0) + needed;
        
        // Update balance
        const prod = needed * b.rate_per_tick;
        totalProduced[item] = (totalProduced[item] || 0) + prod;
        resourceFlows[item] += prod;

        for (const [cItem, cRate] of Object.entries(b.consumes_per_tick)) {
          const cTotal = cRate * needed;
          totalConsumed[cItem] = (totalConsumed[cItem] || 0) + cTotal;
          resourceFlows[cItem] = (resourceFlows[cItem] || 0) - cTotal;
        }
        changed = true;
      }
    }
  }

  // 4. Results
  const resources: Record<string, ResourceFlow> = {};
  const allItems = new Set([...Object.keys(totalProduced), ...Object.keys(totalConsumed)]);
  allItems.forEach(item => {
    const p = totalProduced[item] || 0;
    const c = totalConsumed[item] || 0;
    resources[item] = { produced: p, consumed: c, net: p - c };
  });

  let totalSlots = 0;
  const regionalBuildings: Record<string, Record<string, number>> = {};
  for (const [id, count] of Object.entries(buildingCounts)) {
    const b = (gameData.buildings[id] || gameData.population[id]);
    if (!b) continue;
    totalSlots += Math.ceil(count) * (b.slots || 1);
    
    const region = b.region || 'Temperate';
    if (!regionalBuildings[region]) regionalBuildings[region] = {};
    regionalBuildings[region][id] = count;
  }

  return { buildings: buildingCounts, resources, regionalBuildings, totalSlots };
}
