import gameDataRaw from '../gameData.json';

export interface Building {
  id: string;
  name: string;
  region: string;
  icon: string;
  rate_per_sec: number; 
  consumes_per_sec: Record<string, number>;
  produces: string;
  slots: number;
}

export interface PopulationType {
  id: string;
  name: string;
  inhabitants_per_house: number;
  rate_per_sec: number;
  consumes_per_sec: Record<string, number>;
  produces: string;
  icon: string;
  region: string;
  slots: number;
}

export interface GameData {
  config: {
      precision?: number;
      base_tick?: number;
  };
  buildings: Record<string, Building>;
  population: Record<string, PopulationType>;
  producers: Record<string, string[]>;
  services: Record<string, number>;
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
  for (const [popId, inhabitantCount] of Object.entries(input.population)) {
    if (inhabitantCount <= 0) continue;
    const pop = gameData.population[popId];
    if (!pop) continue;

    const houseCount = inhabitantCount / pop.inhabitants_per_house;
    buildingCounts[popId] = (buildingCounts[popId] || 0) + houseCount;
    
    if (pop.produces && !pop.produces.includes('Population')) {
      const prodRate = pop.rate_per_sec * houseCount;
      totalProduced[pop.produces] = (totalProduced[pop.produces] || 0) + prodRate;
      resourceFlows[pop.produces] = (resourceFlows[pop.produces] || 0) + prodRate;
    }

    for (const [item, ratePerSec] of Object.entries(pop.consumes_per_sec)) {
      if (gameData.services[item]) {
          const totalServiceDemand = houseCount;
          totalConsumed[item] = (totalConsumed[item] || 0) + totalServiceDemand;
          resourceFlows[item] = (resourceFlows[item] || 0) - totalServiceDemand;
      } else {
          const totalRate = ratePerSec * houseCount * multiplier;
          totalConsumed[item] = (totalConsumed[item] || 0) + totalRate;
          resourceFlows[item] = (resourceFlows[item] || 0) - totalRate;
      }
    }
  }

  // 2. Unit targets
  for (const [item, ratePerSec] of Object.entries(input.units)) {
    if (ratePerSec <= 0) continue;
    totalConsumed[item] = (totalConsumed[item] || 0) + ratePerSec;
    resourceFlows[item] = (resourceFlows[item] || 0) - ratePerSec;
  }

  // 3. Solver
  let iterations = 0;
  let changed = true;
  while (changed && iterations < 1000) {
    changed = false;
    iterations++;

    for (const item in resourceFlows) {
      const deficit = resourceFlows[item];
      if (deficit < -1e-12) {
        const producerIds = gameData.producers[item];
        if (!producerIds) continue;
        
        const validProducerIds = producerIds.filter(id => !id.startsWith('POPULATION_'));
        if (validProducerIds.length === 0) continue;

        const bId = validProducerIds[0];
        const b = gameData.buildings[bId];
        if (!b) continue;

        const capacity = gameData.services[item] || b.rate_per_sec;
        if (capacity <= 0) continue;

        const needed = Math.abs(deficit) / capacity;
        buildingCounts[bId] = (buildingCounts[bId] || 0) + needed;
        
        // Update flows
        const addedProd = needed * capacity;
        totalProduced[item] = (totalProduced[item] || 0) + addedProd;
        resourceFlows[item] += addedProd;

        for (const cItem in b.consumes_per_sec) {
          const cRate = b.consumes_per_sec[cItem];
          const addedCons = cRate * needed;
          totalConsumed[cItem] = (totalConsumed[cItem] || 0) + addedCons;
          resourceFlows[cItem] = (resourceFlows[cItem] || 0) - addedCons;
        }
        changed = true;
      }
    }
  }

  // 4. Summarize
  const resources: Record<string, ResourceFlow> = {};
  for (const item in totalProduced) {
      resources[item] = { produced: totalProduced[item], consumed: totalConsumed[item] || 0, net: totalProduced[item] - (totalConsumed[item] || 0) };
  }
  for (const item in totalConsumed) {
      if (!resources[item]) {
          resources[item] = { produced: 0, consumed: totalConsumed[item], net: -totalConsumed[item] };
      }
  }

  let totalSlots = 0;
  const regionalBuildings: Record<string, Record<string, number>> = {};
  for (const [id, count] of Object.entries(buildingCounts)) {
    if (count <= 0) continue;
    const b = (gameData.buildings[id] || gameData.population[id]);
    if (!b) continue;
    
    totalSlots += Math.ceil(count) * (b.slots || 1);
    
    const region = b.region || 'Temperate';
    if (!regionalBuildings[region]) regionalBuildings[region] = {};
    regionalBuildings[region][id] = count;
  }

  return { buildings: buildingCounts, resources, regionalBuildings, totalSlots };
}
