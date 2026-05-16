import { gameData } from './engine';
import type { PlanResult } from './engine';

export interface Island {
  id: string;
  name: string;
  region: string;
  buildings: Record<string, number>;
  totalSlots: number;
  inputs: Record<string, number>; 
  outputs: Record<string, number>; 
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
  
  for (const [region, buildings] of Object.entries(plan.regionalBuildings)) {
    let currentIslandBuildings: Record<string, number> = {};
    let currentSlots = 0;
    let islandCount = 1;

    const finalize = () => {
      if (currentSlots > 0) {
        islands.push(createIsland(`${region} ${islandCount}`, region, currentIslandBuildings));
        currentIslandBuildings = {};
        currentSlots = 0;
        islandCount++;
      }
    };

    const sortedIds = Object.keys(buildings).sort((a, b) => {
        if (a.startsWith('POPULATION_') && !b.startsWith('POPULATION_')) return -1;
        if (!a.startsWith('POPULATION_') && b.startsWith('POPULATION_')) return 1;
        return a.localeCompare(b);
    });

    for (const id of sortedIds) {
      const count = buildings[id];
      const b = (gameData.buildings[id] || gameData.population[id]);
      if (!b) continue;
      const slotsPer = (b.slots || 1);
      
      let remaining = count;
      while (remaining > 0) {
        const canFit = Math.floor((MAX_SLOTS - currentSlots) / slotsPer);
        if (canFit <= 0) {
          finalize();
          continue;
        }
        
        const toAdd = Math.min(remaining, canFit);
        currentIslandBuildings[id] = (currentIslandBuildings[id] || 0) + toAdd;
        currentSlots += Math.ceil(toAdd) * slotsPer;
        remaining -= toAdd;
        
        if (currentSlots >= MAX_SLOTS - 1) finalize();
      }
    }
    finalize();
  }

  const links: TradeLink[] = [];
  const globalSurplus: { islandId: string; item: string; amount: number }[] = [];

  islands.forEach(isl => {
    Object.entries(isl.outputs).forEach(([item, rate]) => {
      globalSurplus.push({ islandId: isl.id, item, amount: rate });
    });
  });

  islands.forEach(isl => {
    Object.entries(isl.inputs).forEach(([item, needed]) => {
      let remaining = needed;
      for (const s of globalSurplus) {
        if (s.item === item && s.amount > 0) {
          const trade = Math.min(remaining, s.amount);
          if (trade > 1e-6) {
            links.push({ from: s.islandId, to: isl.id, item, rate: trade });
            s.amount -= trade;
            remaining -= trade;
          }
        }
        if (remaining <= 1e-6) break;
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
      cons[item] = (cons[item] || 0) + (rate as number) * count;
    });
  });

  const allItems = new Set([...Object.keys(prod), ...Object.keys(cons)]);
  allItems.forEach(item => {
    const p = prod[item] || 0;
    const c = cons[item] || 0;
    const net = p - c;
    if (item.includes('Deposit')) return;
    
    if (net < -0.1) inputs[item] = Math.abs(net);
    else if (net > 0.1) outputs[item] = net;
  });

  return { id: name.replace(/\s/g, '_'), name, region, buildings, totalSlots, inputs, outputs };
}
