import { useState, useMemo } from 'react'
import { gameData, calculatePlan } from './lib/engine'
import type { Difficulty } from './lib/engine'
import './App.css'

type RateUnit = 'sec' | 'min' | 'hour';

function App() {
  const [unit, setUnit] = useState<RateUnit>('min');
  const [difficulty, setDifficulty] = useState<Difficulty>('Normal');
  const unitMult = unit === 'sec' ? 1 : (unit === 'min' ? 60 : 3600);
  const [popCounts, setPopCounts] = useState<Record<string, number>>({
    POPULATION_MERCHANTS_MANSION_INFO: 1000,
    POPULATION_WORKERS_HOUSE_INFO: 500,
    POPULATION_COLONISTS_HOUSE_INFO: 300,
    POPULATION_TOWNSMEN_HOUSE_INFO: 300,
  });

  const [unitTargets, setUnitTargets] = useState<Record<string, number>>({
    'Knight': 0.25,
    'Crossbowman': 0.25,
    'Composite Bow Archer': 0.25,
    'Cavalry': 0.3,
    'Pikeman': 0.3,
    'War Drummer': 0.3,
    'Glaive Warrior': 0.2,
    'Shield Guardian': 0.2,
  });

  const plan = useMemo(() => {
    // Normalize unit targets from per-minute to per-second for the engine
    const normalizedUnits: Record<string, number> = {};
    for (const [item, ratePerMin] of Object.entries(unitTargets)) {
      normalizedUnits[item] = ratePerMin / 60;
    }

    return calculatePlan({ 
      population: popCounts, 
      units: normalizedUnits,
      difficulty 
    });
  }, [popCounts, unitTargets, difficulty]);

  const updatePop = (id: string, val: string) => {
    setPopCounts(prev => ({ ...prev, [id]: parseInt(val) || 0 }));
  };

  const updateUnit = (item: string, val: string) => {
    setUnitTargets(prev => ({ ...prev, [item]: parseFloat(val) || 0 }));
  };

  return (
    <div className="planner-container">
      <header>
        <h1>Paragon Planner</h1>
        <p className="subtitle">Aggregate Production & Population Optimizer</p>
      </header>

      <main className="planner-layout">
        <section className="input-section card">
          <h2>Global Settings</h2>
          <div className="input-group">
            <label>Game Difficulty</label>
            <select 
              value={difficulty} 
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="difficulty-select"
            >
              <option value="Easy">Easy (0.5x Cons)</option>
              <option value="Normal">Normal (1.0x Cons)</option>
              <option value="Hard">Hard (1.5x Cons)</option>
            </select>
          </div>

          <h2>Inputs</h2>
          <div className="input-group">
            <h3>Population Targets (Inhabitants)</h3>
            <div className="input-grid">
              {Object.keys(gameData.population).map(id => {
                const pop = gameData.population[id];
                const cleanName = pop.name.replace('Population', '').replace('House', '').replace('Mansion', '').replace('Residence', '').replace('Shack', '').trim();
                const iconSrc = pop.icon ? `/paragon-planner${pop.icon}` : '';
                return (
                  <div key={id} className="input-row-with-icon">
                    <div className="label-with-icon">
                      {iconSrc && <img src={iconSrc} alt={cleanName} className="small-icon" />}
                      <label>{cleanName}</label>
                    </div>
                    <input 
                      type="number" 
                      value={popCounts[id] || 0} 
                      onChange={(e) => updatePop(id, e.target.value)} 
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="input-group">
            <h3>Military Targets (units/min)</h3>
            {Object.keys(unitTargets).map(unit => (
              <div key={unit} className="input-row">
                <label>{unit}</label>
                <input 
                  type="number" 
                  step="0.05"
                  value={unitTargets[unit] || 0} 
                  onChange={(e) => updateUnit(unit, e.target.value)} 
                />
              </div>
            ))}
          </div>
        </section>

        <section className="results-section">
          <div className="card summary-card">
            <h2>Empire Overview</h2>
            <div className="summary-stats">
              <div className="stat-item">
                <span className="label">Total Building Slots</span>
                <span className="value">{plan.totalSlots}</span>
              </div>
              <div className="stat-item">
                <span className="label">Estimated Islands (Size 22)</span>
                <span className="value">{Math.ceil(plan.totalSlots / 350)}</span>
              </div>
            </div>
          </div>

          <div className="card buildings-card">
            <h2>Required Buildings (Regional Aggregate)</h2>
            <div className="building-groups">
              {Object.entries(plan.regionalBuildings).map(([region, buildings]) => (
                <div key={region} className="region-block">
                  <h3>{region} Region</h3>
                  <div className="building-grid">
                    {Object.entries(buildings).map(([id, count]) => {
                      const b = (gameData.buildings[id] || gameData.population[id]);
                      const iconSrc = b?.icon ? `/paragon-planner${b.icon}` : '';
                      
                      return (
                        <div key={id} className="building-item" title={`${b?.name} (${b?.region})`}>
                          {iconSrc && <img src={iconSrc} alt={b?.name} className="b-icon" />}
                          <div className="b-info">
                            <div className="count">{Math.ceil(count)}</div>
                            <div className="name">{b?.name}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card islands-card">
            <h2>Recommended Island Specializations</h2>
            <div className="island-suggestions">
              {Object.entries(plan.regionalBuildings).map(([region, buildings]) => {
                const totalBuildings = Object.values(buildings).reduce((a, b) => a + b, 0);
                const estimatedIslands = Math.ceil(totalBuildings / 25);
                return (
                  <div key={region} className="region-suggestion">
                    <h3>{region} Region ({Math.ceil(totalBuildings)} Slots)</h3>
                    <p>Estimated: <strong>{estimatedIslands} specialized islands</strong> (avg 25 slots/island)</p>
                    <div className="specialization-pills">
                      {Object.entries(buildings)
                        .filter(([_, count]) => count > 5)
                        .sort((a, b) => b[1] - a[1])
                        .map(([id]) => {
                          const b = (gameData.buildings[id] || gameData.population[id]);
                          return (
                            <span key={id} className="pill">{b?.produces} Hub</span>
                          )
                        })
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card resources-card">
            <div className="card-header-with-toggle">
              <h2>Global Resource Flow</h2>
              <div className="unit-toggle">
                {(['sec', 'min', 'hour'] as RateUnit[]).map(u => (
                  <button 
                    key={u} 
                    className={unit === u ? 'active' : ''} 
                    onClick={() => setUnit(u)}
                  >
                    /{u}
                  </button>
                ))}
              </div>
            </div>
            <div className="resource-list">
              {Object.entries(plan.resources)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([item, info]) => (
                <div key={item} className="resource-row">
                  <span className="item-name">{item}</span>
                  <div className="flow-details">
                    <span className="cons">-{(info.consumed * unitMult).toFixed(2)}</span>
                    <span className="prod">+{(info.produced * unitMult).toFixed(2)}</span>
                    <span className={`flow ${info.net >= -0.0001 ? 'surplus' : 'deficit'}`}>
                      {info.net >= 0 ? '+' : ''}{(info.net * unitMult).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
