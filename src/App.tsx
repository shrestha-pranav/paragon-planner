import { useState, useMemo } from 'react'
import { gameData, calculatePlan } from './engine'
import './App.css'

function App() {
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
    return calculatePlan({ population: popCounts, units: unitTargets });
  }, [popCounts, unitTargets]);

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
          <h2>Inputs</h2>
          <div className="input-group">
            <h3>Population Targets</h3>
            {Object.keys(gameData.population).map(id => (
              <div key={id} className="input-row">
                <label>{gameData.population[id].name}</label>
                <input 
                  type="number" 
                  value={popCounts[id] || 0} 
                  onChange={(e) => updatePop(id, e.target.value)} 
                />
              </div>
            ))}
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
          <div className="card buildings-card">
            <h2>Required Buildings (Regional Aggregate)</h2>
            <div className="building-groups">
              {Object.entries(plan.regionalBuildings).map(([region, buildings]) => (
                <div key={region} className="region-block">
                  <h3>{region} Region</h3>
                  <div className="building-grid">
                    {Object.entries(buildings).map(([id, count]) => {
                      const b = gameData.buildings[id];
                      const iconSrc = b.image ? b.image.replace(/^.*\/icons\//, '/icons/') : '';
                      return (
                        <div key={id} className="building-item" title={`${b.name} (${b.category})`}>
                          {iconSrc && <img src={iconSrc} alt={b.name} className="b-icon" />}
                          <div className="b-info">
                            <div className="count">{Math.ceil(count)}</div>
                            <div className="name">{b.name}</div>
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
                        .map(([id]) => (
                          <span key={id} className="pill">{gameData.buildings[id].produces} Hub</span>
                        ))
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card resources-card">
            <h2>Global Resource Flow (/min)</h2>
            <div className="resource-list">
              {Object.entries(plan.resources)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([item, info]) => (
                <div key={item} className="resource-row">
                  <span className="item-name">{item}</span>
                  <div className="flow-details">
                    <span className="cons">-{info.consumed.toFixed(1)}</span>
                    <span className="prod">+{info.produced.toFixed(1)}</span>
                    <span className={`flow ${info.net >= -0.01 ? 'surplus' : 'deficit'}`}>
                      {info.net >= 0 ? '+' : ''}{info.net.toFixed(1)}
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
