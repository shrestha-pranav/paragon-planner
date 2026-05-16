import { gameData } from './engine';
import type { PlanResult } from './engine';

export interface Island {
  id: string;
  name: string;
  region: string;
  buildings: Record<string, number>;
  totalSlots: number;
  inputs: Record<string, number>; // item -> rate/sec needed from trade
  outputs: Record<string, number>; // item -> rate/sec surplus available
}

export interface TradeLink {
  from: string;
  to: string;
  item: string;
  rate: number;
}

export interface IslandNetwork {
  islands: Island[];
  links: TradeLink[];
}

const MAX_SLOTS = 350;

export function partitionIslands(plan: PlanResult): IslandNetwork {
  const islands: Island[] = [];
  
  // For each region, create a "Main" island for housing and population-specific buildings
  // Then create specialized hubs for production chains.
  
  for (const [region, buildings] of Object.entries(plan.regionalBuildings)) {
    let currentIslandBuildings: Record<string, number> = {};
    let currentSlots = 0;
    let islandCount = 1;

    const addToIsland = (id: string, count: number) => {
      const b = (gameData.buildings[id] || gameData.population[id]);
      const slots = Math.ceil(count) * (b?.slots || 1);
      
      if (currentSlots + slots > MAX_SLOTS) {
        // Finalize current island
        islands.push(createIsland(`${region} ${islandCount}`, region, currentIslandBuildings));
        // Reset
        currentIslandBuildings = {};
        currentSlots = 0;
        islandCount++;
      }
      
      currentIslandBuildings[id] = (currentIslandBuildings[id] || 0) + count;
      currentSlots += slots;
    };

    // Sort buildings: Houses first, then supply chain
    const sortedIds = Object.keys(buildings).sort((a, b) => {
        if (a.startsWith('POPULATION_') && !b.startsWith('POPULATION_')) return -1;
        if (!a.startsWith('POPULATION_') && b.startsWith('POPULATION_')) return 1;
        return 0;
    });

    for (const id of sortedIds) {
      addToIsland(id, buildings[id]);
    }

    if (currentSlots > 0) {
      islands.push(createIsland(`${region} ${islandCount}`, region, currentIslandBuildings));
    }
  }

  // Calculate Trade Links
  const links: TradeLink[] = [];
  const globalDeficits: Record<string, { islandId: string; amount: number }[]> = {};
  const globalSurplus: Record<string, { islandId: string; amount: number }[]> = {};

  islands.forEach(isl => {
    Object.entries(isl.inputs).forEach(([item, rate]) => {
      if (!globalDeficits[item]) globalDeficits[item] = [];
      globalDeficits[item].push({ islandId: isl.id, amount: rate });
    });
    Object.entries(isl.outputs).forEach(([item, rate]) => {
      if (!globalSurplus[item]) globalSurplus[item] = [];
      globalSurplus[item].push({ islandId: isl.id, amount: rate });
    });
  });

  // Basic matching
  Object.keys(globalDeficits).forEach(item => {
    const deficits = globalDeficits[item];
    const surpluses = globalSurplus[item] || [];

    deficits.forEach(d => {
      let remaining = d.amount;
      for (const s of surpluses) {
        if (s.amount <= 0) continue;
        const trade = Math.min(remaining, s.amount);
        if (trade > 0) {
          links.push({ from: s.islandId, to: d.islandId, item, rate: trade });
          s.amount -= trade;
          remaining -= trade;
        }
        if (remaining <= 0) break;
      }
    });
  });

  return { islands, links };
}

function createIsland(name: string, region: string, buildings: Record<string, number>): Island {
  const inputs: Record<string, number> = {};
  const outputs: Record<string, number> = {};
  let totalSlots = 0;

  const prod: Record<string, number> = {};
  const cons: Record<string, number> = {};

  Object.entries(buildings).forEach(([id, count]) => {
    const b = (gameData.buildings[id] || gameData.population[id]);
    if (!b) return;
    totalSlots += Math.ceil(count) * (b.slots || 1);

    if (b.produces) {
      prod[b.produces] = (prod[b.produces] || 0) + b.rate_per_tick * count;
    }
    Object.entries(b.consumes_per_tick).forEach(([item, rate]) => {
      cons[item] = (cons[item] || 0) + rate * count;
    });
  });

  const allItems = new Set([...Object.keys(prod), ...Object.keys(cons)]);
  allItems.forEach(item => {
    const p = prod[item] || 0;
    const c = cons[item] || 0;
    const net = p - c;
    if (net < -0.01) inputs[item] = Math.abs(net);
    else if (net > 0.01) outputs[item] = net;
  });

  return { id: name.replace(/\s/g, '_'), name, region, buildings, totalSlots, inputs, outputs };
}
