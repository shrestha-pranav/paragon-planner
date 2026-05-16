import gameDataRaw from '../gameData.json';

export interface Building {
  id: string;
  name: string;
  category: string;
  image: string;
  produce_rate_per_sec: number;
  consume_rates_per_sec: Record<string, number>;
  produces: string;
  slots: number;
}

export interface Population {
  id: string;
  name: string;
  inhabitants: number;
  produce_rate_per_sec: number;
  consume_rates_per_sec: Record<string, number>;
  produces: string;
}

export interface GameData {
  buildings: Record<string, Building>;
  population: Record<string, Population>;
  item_producers: Record<string, string[]>;
}

export const gameData = gameDataRaw as unknown as GameData;

export type Difficulty = 'Easy' | 'Normal' | 'Hard';

export interface PlanInput {
  population: Record<string, number>; // popId -> inhabitantCount
  units: Record<string, number>;      // item -> targetPerSec (Internally we use sec)
  difficulty: Difficulty;
}

export interface ResourceFlow {
  produced: number; // per sec
  consumed: number; // per sec
  net: number;      // per sec
}

export interface PlanResult {
  buildings: Record<string, number>; // buildingId -> count
  resources: Record<string, ResourceFlow>;
  totalSlots: number;
  regionalBuildings: Record<string, Record<string, number>>;
}

export function calculatePlan(input: PlanInput): PlanResult {
  const buildingCounts: Record<string, number> = {};
  const totalProduced: Record<string, number> = {}; // per sec
  const totalConsumed: Record<string, number> = {}; // per sec
  const resourceFlows: Record<string, number> = {}; // per sec balance

  const consumptionMultiplier = input.difficulty === 'Easy' ? 0.5 : (input.difficulty === 'Hard' ? 1.5 : 1.0);

  const REGION_MAP: Record<string, string> = {
    'pioneers': 'Temperate',
    'colonists': 'Temperate',
    'merchants': 'Temperate',
    'paragons': 'Temperate',
    'farmers': 'Tropical',
    'workers': 'Tropical',
    'northern-islands': 'North',
  };

  // 1. Calculate population requirements
  for (const [popId, inhabitantCount] of Object.entries(input.population)) {
    if (inhabitantCount <= 0) continue;
    const pop = gameData.population[popId];
    if (!pop) continue;

    const houseCount = inhabitantCount / pop.inhabitants;
    
    // Houses act as buildings (they produce militia/gold/favor)
    buildingCounts[popId] = (buildingCounts[popId] || 0) + houseCount;
    
    const prodRate = (pop.produce_rate_per_sec || 0) * houseCount;
    if (pop.produces) {
      totalProduced[pop.produces] = (totalProduced[pop.produces] || 0) + prodRate;
      resourceFlows[pop.produces] = (resourceFlows[pop.produces] || 0) + prodRate;
    }

    // Population needs
    for (const [item, ratePerSec] of Object.entries(pop.consume_rates_per_sec)) {
      const totalRate = ratePerSec * houseCount * consumptionMultiplier;
      totalConsumed[item] = (totalConsumed[item] || 0) + totalRate;
      resourceFlows[item] = (resourceFlows[item] || 0) - totalRate;
    }
  }

  // 2. Add military targets (Input is target per min usually, let's normalize to per sec)
  for (const [item, targetPerSec] of Object.entries(input.units)) {
    if (targetPerSec <= 0) continue;
    totalConsumed[item] = (totalConsumed[item] || 0) + targetPerSec;
    resourceFlows[item] = (resourceFlows[item] || 0) - targetPerSec;
  }

  // 3. Resolve dependencies recursively
  let stable = false;
  let iterations = 0;
  while (!stable && iterations < 200) {
    stable = true;
    iterations++;

    for (const [item, flow] of Object.entries(resourceFlows)) {
      if (flow < -1e-9) { // Using a smaller epsilon
        stable = false;
        const producerIds = gameData.item_producers[item];
        if (!producerIds || producerIds.length === 0) {
          // No producer found for this item, it's an external requirement (like island spots)
          continue;
        }

        // Simplest: pick first producer
        const bId = producerIds[0];
        const b = gameData.buildings[bId];
        if (!b) continue;
        
        const prodPerSec = b.produce_rate_per_sec;
        if (prodPerSec <= 0) continue;

        const neededCount = Math.abs(flow) / prodPerSec;
        buildingCounts[bId] = (buildingCounts[bId] || 0) + neededCount;
        
        // Add production
        const actualProduced = neededCount * prodPerSec;
        totalProduced[item] = (totalProduced[item] || 0) + actualProduced;
        resourceFlows[item] += actualProduced;

        // Add consumption of the producer
        for (const [consItem, consRatePerSec] of Object.entries(b.consume_rates_per_sec)) {
          const totalConsRate = consRatePerSec * neededCount;
          totalConsumed[consItem] = (totalConsumed[consItem] || 0) + totalConsRate;
          resourceFlows[consItem] = (resourceFlows[consItem] || 0) - totalConsRate;
        }
      }
    }
  }

  // 4. Final aggregation
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
    const b = gameData.buildings[id] || gameData.population[id];
    if (!b) continue;
    
    totalSlots += Math.ceil(count) * (b.slots || 1);
    
    const region = REGION_MAP[b.category] || 'Temperate';
    if (!regionalBuildings[region]) regionalBuildings[region] = {};
    regionalBuildings[region][id] = count;
  }

  return { buildings: buildingCounts, resources, regionalBuildings, totalSlots };
}
