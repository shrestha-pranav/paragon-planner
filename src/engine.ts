import gameDataRaw from './gameData.json';

export interface Building {
  id: string;
  name: string;
  image: string;
  time_sec: number;
  produce_qty: number;
  consumes: Record<string, number>;
  category: string;
  produces: string;
}

export interface Population {
  name: string;
  needs: Record<string, number>;
}

export interface GameData {
  buildings: Record<string, Building>;
  population: Record<string, Population>;
  item_producers: Record<string, string[]>;
}

const gameData = gameDataRaw as unknown as GameData;

export interface PlanInput {
  population: Record<string, number>; // popName -> count
  units: Record<string, number>;      // unitItemName -> targetPerMin
}

export interface PlanResult {
  buildings: Record<string, number>;  // buildingId -> count
  resources: Record<string, {
    produced: number;
    consumed: number;
    net: number;
  }>;
  regionalBuildings: Record<string, Record<string, number>>; // region -> buildingId -> count
}

export function calculatePlan(input: PlanInput): PlanResult {
  const buildingCounts: Record<string, number> = {};
  const totalProduced: Record<string, number> = {};
  const totalConsumed: Record<string, number> = {};
  const resourceFlows: Record<string, number> = {}; 

  const REGION_MAP: Record<string, string> = {
    'pioneers': 'Temperate',
    'colonists': 'Temperate',
    'merchants': 'Temperate',
    'paragons': 'Temperate',
    'farmers': 'Tropical',
    'workers': 'Tropical',
    'northern-islands': 'North',
  };

  // 1. Calculate population consumption
  for (const [popId, count] of Object.entries(input.population)) {
    const pop = gameData.population[popId];
    if (!pop) continue;
    for (const [item, ratePerSec] of Object.entries(pop.needs)) {
      const ratePerMin = ratePerSec * 60 * count;
      totalConsumed[item] = (totalConsumed[item] || 0) + ratePerMin;
      resourceFlows[item] = (resourceFlows[item] || 0) - ratePerMin;
    }
  }

  // 2. Add unit production targets to resource flows
  for (const [item, targetPerMin] of Object.entries(input.units)) {
    totalConsumed[item] = (totalConsumed[item] || 0) + targetPerMin;
    resourceFlows[item] = (resourceFlows[item] || 0) - targetPerMin;
  }

  // 3. Solve dependencies recursively
  let stable = false;
  let iterations = 0;
  while (!stable && iterations < 30) {
    stable = true;
    iterations++;

    for (const [item, flow] of Object.entries(resourceFlows)) {
      if (flow < -0.0001) { 
        stable = false;
        
        const producerIds = gameData.item_producers[item];
        if (!producerIds || producerIds.length === 0) continue;
        
        const producerId = producerIds[0]; 
        const building = gameData.buildings[producerId];
        
        const prodPerMin = (building.produce_qty / building.time_sec) * 60;
        const needed = Math.abs(flow) / prodPerMin;
        
        buildingCounts[producerId] = (buildingCounts[producerId] || 0) + needed;
        
        const actualProduced = needed * prodPerMin;
        totalProduced[item] = (totalProduced[item] || 0) + actualProduced;
        resourceFlows[item] += actualProduced;
        
        for (const [consItem, consQty] of Object.entries(building.consumes)) {
          const consRatePerMin = (consQty / building.time_sec) * 60 * needed;
          totalConsumed[consItem] = (totalConsumed[consItem] || 0) + consRatePerMin;
          resourceFlows[consItem] = (resourceFlows[consItem] || 0) - consRatePerMin;
        }
      }
    }
  }

  const resources: PlanResult['resources'] = {};
  const allItems = new Set([...Object.keys(totalProduced), ...Object.keys(totalConsumed)]);
  allItems.forEach(item => {
    const prod = totalProduced[item] || 0;
    const cons = totalConsumed[item] || 0;
    resources[item] = {
      produced: prod,
      consumed: cons,
      net: prod - cons
    };
  });

  const regionalBuildings: Record<string, Record<string, number>> = {};
  for (const [id, count] of Object.entries(buildingCounts)) {
    const b = gameData.buildings[id];
    const region = REGION_MAP[b.category] || 'Other';
    if (!regionalBuildings[region]) regionalBuildings[region] = {};
    regionalBuildings[region][id] = count;
  }

  return { buildings: buildingCounts, resources, regionalBuildings };
}

export { gameData };
