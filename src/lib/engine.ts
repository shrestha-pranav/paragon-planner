import gameDataRaw from '../gameData.json';

export interface Building {
  id: string;
  name: string;
  region: string;
  icon: string;
  rate_per_sec: number;
  consumes: Record<string, number>;
  produces: string;
  slots: number;
}

export interface PopulationType {
  id: string;
  name: string;
  inhabitants_per_house: number;
  rate_per_sec: number;
  consumes: Record<string, number>;
  produces: string;
}

export interface GameData {
  buildings: Record<string, Building>;
  population: Record<string, PopulationType>;
  producers: Record<string, string[]>;
}

export const gameData = gameDataRaw as unknown as GameData;

export type Difficulty = 'Easy' | 'Normal' | 'Hard';

export interface PlanInput {
  population: Record<string, number>; // popId -> inhabitantCount
  units: Record<string, number>;      // item -> targetPerSec
  difficulty: Difficulty;
}

export interface ResourceFlow {
  produced: number;
  consumed: number;
  net: number;
}

export interface PlanResult {
  buildings: Record<string, number>; // buildingId -> count
  resources: Record<string, ResourceFlow>;
  totalSlots: number;
  regionalBuildings: Record<string, Record<string, number>>;
}

export function calculatePlan(input: PlanInput): PlanResult {
  const buildingCounts: Record<string, number> = {};
  const totalProduced: Record<string, number> = {};
  const totalConsumed: Record<string, number> = {};
  const resourceFlows: Record<string, number> = {};

  const consumptionMultiplier = input.difficulty === 'Easy' ? 0.5 : (input.difficulty === 'Hard' ? 1.5 : 1.0);

  // 1. Calculate population requirements
  for (const [popId, inhabitantCount] of Object.entries(input.population)) {
    if (inhabitantCount <= 0) continue;
    const pop = gameData.population[popId];
    if (!pop) continue;

    const houseCount = inhabitantCount / pop.inhabitants_per_house;
    
    // Track house building counts
    buildingCounts[popId] = (buildingCounts[popId] || 0) + houseCount;
    
    // Population produces (e.g. Militia, Gold)
    const prodRate = pop.rate_per_sec * houseCount;
    if (pop.produces) {
      totalProduced[pop.produces] = (totalProduced[pop.produces] || 0) + prodRate;
      resourceFlows[pop.produces] = (resourceFlows[pop.produces] || 0) + prodRate;
    }

    // Population consumes
    for (const [item, ratePerSec] of Object.entries(pop.consumes)) {
      const totalRate = ratePerSec * houseCount * consumptionMultiplier;
      totalConsumed[item] = (totalConsumed[item] || 0) + totalRate;
      resourceFlows[item] = (resourceFlows[item] || 0) - totalRate;
    }
  }

  // 2. Add military targets
  for (const [item, targetPerSec] of Object.entries(input.units)) {
    if (targetPerSec <= 0) continue;
    totalConsumed[item] = (totalConsumed[item] || 0) + targetPerSec;
    resourceFlows[item] = (resourceFlows[item] || 0) - targetPerSec;
  }

  // 3. Resolve dependencies
  let stable = false;
  let iterations = 0;
  while (!stable && iterations < 200) {
    stable = true;
    iterations++;

    for (const [item, flow] of Object.entries(resourceFlows)) {
      if (flow < -1e-10) {
        stable = false;
        const producerIds = gameData.producers[item];
        if (!producerIds || producerIds.length === 0) continue;

        const bId = producerIds[0];
        const b = gameData.buildings[bId];
        if (!b || b.rate_per_sec <= 0) continue;

        const neededCount = Math.abs(flow) / b.rate_per_sec;
        buildingCounts[bId] = (buildingCounts[bId] || 0) + neededCount;
        
        const actualProduced = neededCount * b.rate_per_sec;
        totalProduced[item] = (totalProduced[item] || 0) + actualProduced;
        resourceFlows[item] += actualProduced;

        for (const [consItem, consRate] of Object.entries(b.consumes)) {
          const totalCons = consRate * neededCount;
          totalConsumed[consItem] = (totalConsumed[consItem] || 0) + totalCons;
          resourceFlows[consItem] = (resourceFlows[consItem] || 0) - totalCons;
        }
      }
    }
  }

  // 4. Summarize
  const resources: Record<string, ResourceFlow> = {};
  const allItems = new Set([...Object.keys(totalProduced), ...Object.keys(totalConsumed)]);
  allItems.forEach(item => {
    const prod = totalProduced[item] || 0;
    const cons = totalConsumed[item] || 0;
    resources[item] = { produced: prod, consumed: cons, net: prod - cons };
  });

  let totalSlots = 0;
  const regionalBuildings: Record<string, Record<string, number>> = {};
  for (const [id, count] of Object.entries(buildingCounts)) {
    if (count <= 0) continue;
    const b = (gameData.buildings[id] || gameData.population[id]) as any;
    if (!b) continue;
    
    totalSlots += Math.ceil(count) * (b.slots || 1);
    
    const region = b.region || 'Temperate';
    if (!regionalBuildings[region]) regionalBuildings[region] = {};
    regionalBuildings[region][id] = count;
  }

  return { buildings: buildingCounts, resources, regionalBuildings, totalSlots };
}
