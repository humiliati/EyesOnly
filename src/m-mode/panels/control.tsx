/* ============================================================
   EYES ONLY — M Mode: Control Panel
   Scenario, lane, actor, escalation, and event management.
   ============================================================ */

import { useState, useEffect } from 'preact/hooks';
import {
  getState, subscribe,
  createScenario, activateScenario, selectScenario,
  addLane, addActor,
  injectEvent, escalate,
  generateJoinCode, fetchScenarios,
} from '../store';

export function ControlPanel() {
  const [s, setS] = useState(getState());
  useEffect(() => {
    fetchScenarios();
    return subscribe(() => setS(getState()));
  }, []);

  return (
    <div class="ctrl-grid">
      <ScenarioSection />
      <LaneSection />
      <ActorSection />
      <EscalationSection />
      <EventInjectSection />
      <JoinCodeSection />
    </div>
  );
}

function ScenarioSection() {
  const [s, setS] = useState(getState());
  const [name, setName] = useState('');
  useEffect(() => subscribe(() => setS(getState())), []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createScenario(name.trim());
    setName('');
  };

  return (
    <div class="ctrl-section">
      <h3>SCENARIOS</h3>
      {s.scenarios.length > 0 && (
        <div style={{ marginBottom: '6px' }}>
          {s.scenarios.map((sc) => (
            <div key={sc.id} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '2px 0', fontSize: '11px',
            }}>
              <span style={{ color: sc.id === s.scenarioId ? '#33ff33' : '#555' }}>
                {sc.id === s.scenarioId ? '>' : ' '} {sc.name}
              </span>
              <span style={{ color: '#333', fontSize: '9px' }}>[{sc.status}]</span>
              {sc.id !== s.scenarioId && (
                <button class="ctrl-btn" style={{ fontSize: '8px', padding: '1px 6px' }}
                  onClick={() => selectScenario(sc.id)}>SELECT</button>
              )}
              {sc.status === 'draft' && (
                <button class="ctrl-btn amber" style={{ fontSize: '8px', padding: '1px 6px' }}
                  onClick={() => activateScenario(sc.id)}>ACTIVATE</button>
              )}
            </div>
          ))}
        </div>
      )}
      <div class="ctrl-row">
        <div class="ctrl-field">
          <label>NEW SCENARIO</label>
          <input value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="Operation Name" />
        </div>
        <button class="ctrl-btn" onClick={handleCreate}>CREATE</button>
      </div>
    </div>
  );
}

function LaneSection() {
  const [laneId, setLaneId] = useState('');
  const [label, setLabel] = useState('');

  const handleAdd = async () => {
    if (!laneId.trim() || !label.trim()) return;
    await addLane(laneId.trim(), label.trim());
    setLaneId(''); setLabel('');
  };

  return (
    <div class="ctrl-section">
      <h3>ADD LANE</h3>
      <div class="ctrl-row">
        <div class="ctrl-field">
          <label>LANE ID</label>
          <input value={laneId} onInput={(e) => setLaneId((e.target as HTMLInputElement).value)}
            placeholder="A1" style={{ width: '60px' }} />
        </div>
        <div class="ctrl-field">
          <label>LABEL</label>
          <input value={label} onInput={(e) => setLabel((e.target as HTMLInputElement).value)}
            placeholder="Main Street" />
        </div>
        <button class="ctrl-btn" onClick={handleAdd}>ADD</button>
      </div>
    </div>
  );
}

function ActorSection() {
  const [s, setS] = useState(getState());
  const [callsign, setCallsign] = useState('');
  const [team, setTeam] = useState('red');
  const [password, setPassword] = useState('');
  const [laneId, setLaneId] = useState('');

  useEffect(() => subscribe(() => setS(getState())), []);

  const handleAdd = async () => {
    if (!callsign.trim() || !team) return;
    await addActor(callsign.trim(), team, password || undefined, laneId || undefined);
    setCallsign(''); setPassword(''); setLaneId('');
  };

  return (
    <div class="ctrl-section">
      <h3>ADD ACTOR</h3>
      <div class="ctrl-row">
        <div class="ctrl-field">
          <label>CALLSIGN</label>
          <input value={callsign} onInput={(e) => setCallsign((e.target as HTMLInputElement).value)}
            placeholder="Operative" />
        </div>
        <div class="ctrl-field">
          <label>TEAM</label>
          <select value={team} onChange={(e) => setTeam((e.target as HTMLSelectElement).value)}>
            <option value="red">RED</option>
            <option value="blue">BLUE</option>
            <option value="director">DIRECTOR</option>
          </select>
        </div>
      </div>
      <div class="ctrl-row">
        <div class="ctrl-field">
          <label>PASSWORD</label>
          <input type="password" value={password}
            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            placeholder="Optional" />
        </div>
        <div class="ctrl-field">
          <label>LANE</label>
          <select value={laneId} onChange={(e) => setLaneId((e.target as HTMLSelectElement).value)}>
            <option value="">Unassigned</option>
            {s.lanes.map((l) => (
              <option key={l.lane_id} value={l.lane_id}>{l.lane_id} — {l.label}</option>
            ))}
          </select>
        </div>
        <button class="ctrl-btn" onClick={handleAdd}>ADD</button>
      </div>
    </div>
  );
}

function EscalationSection() {
  const [tier, setTier] = useState('1');
  const [msg, setMsg] = useState('');

  const handleEscalate = async () => {
    await escalate(parseInt(tier, 10) || 1, msg || undefined);
    setMsg('');
  };

  return (
    <div class="ctrl-section">
      <h3>ESCALATION</h3>
      <div class="ctrl-row">
        <div class="ctrl-field">
          <label>TIER</label>
          <select value={tier} onChange={(e) => setTier((e.target as HTMLSelectElement).value)}>
            <option value="1">1 — OBSERVATION</option>
            <option value="2">2 — SURVEILLANCE</option>
            <option value="3">3 — ACTIVE OPS</option>
            <option value="4">4 — CRITICAL</option>
            <option value="5">5 — BLACK</option>
          </select>
        </div>
        <div class="ctrl-field">
          <label>MESSAGE</label>
          <input value={msg} onInput={(e) => setMsg((e.target as HTMLInputElement).value)}
            placeholder="Broadcast message" />
        </div>
        <button class="ctrl-btn danger" onClick={handleEscalate}>ESCALATE</button>
      </div>
    </div>
  );
}

function EventInjectSection() {
  const [s, setS] = useState(getState());
  const [type, setType] = useState('intel_drop');
  const [message, setMessage] = useState('');
  const [laneId, setLaneId] = useState('');

  useEffect(() => subscribe(() => setS(getState())), []);

  const handleInject = async () => {
    if (!type) return;
    await injectEvent(type, { message: message || type }, laneId || undefined);
    setMessage('');
  };

  return (
    <div class="ctrl-section">
      <h3>INJECT EVENT</h3>
      <div class="ctrl-row">
        <div class="ctrl-field">
          <label>TYPE</label>
          <select value={type} onChange={(e) => setType((e.target as HTMLSelectElement).value)}>
            <option value="intel_drop">INTEL DROP</option>
            <option value="radio_intercept">RADIO INTERCEPT</option>
            <option value="authority_alert">AUTHORITY ALERT</option>
            <option value="asset_compromise">ASSET COMPROMISE</option>
            <option value="dead_drop_compromised">DROP COMPROMISED</option>
            <option value="extraction_order">EXTRACTION ORDER</option>
            <option value="custom">CUSTOM</option>
          </select>
        </div>
        <div class="ctrl-field">
          <label>LANE</label>
          <select value={laneId} onChange={(e) => setLaneId((e.target as HTMLSelectElement).value)}>
            <option value="">ALL</option>
            {s.lanes.map((l) => (
              <option key={l.lane_id} value={l.lane_id}>{l.lane_id}</option>
            ))}
          </select>
        </div>
      </div>
      <div class="ctrl-row">
        <div class="ctrl-field">
          <label>MESSAGE</label>
          <input value={message} onInput={(e) => setMessage((e.target as HTMLInputElement).value)}
            placeholder="Event payload..." />
        </div>
        <button class="ctrl-btn amber" onClick={handleInject}>INJECT</button>
      </div>
    </div>
  );
}

function JoinCodeSection() {
  const [team, setTeam] = useState('red');
  const [code, setCode] = useState<string | null>(null);

  const handleGenerate = async () => {
    const c = await generateJoinCode(team);
    setCode(c);
  };

  return (
    <div class="ctrl-section">
      <h3>JOIN CODES</h3>
      <div class="ctrl-row">
        <div class="ctrl-field">
          <label>TEAM</label>
          <select value={team} onChange={(e) => setTeam((e.target as HTMLSelectElement).value)}>
            <option value="red">RED TEAM</option>
            <option value="blue">BLUE TEAM</option>
          </select>
        </div>
        <button class="ctrl-btn" onClick={handleGenerate}>GENERATE</button>
      </div>
      {code && (
        <div style={{ marginTop: '6px', fontSize: '16px', letterSpacing: '3px', color: '#33ff33', textAlign: 'center' }}>
          {code}
        </div>
      )}
    </div>
  );
}
