import { SCENARIOS, type ScenarioCategory } from "./scenarios.ts";

type Value = { scenarioCategory?: ScenarioCategory; scenario?: string };
export function ScenarioFields({ value, onChange, disabled = false }: {
  value: Value; onChange: (patch: Value) => void; disabled?: boolean;
}) {
  return <div className="lab-scenario-fields">
    <label className="field"><span>Lab scenario</span>
      <select value={value.scenarioCategory || ""} disabled={disabled} onChange={event => {
        const selected = SCENARIOS.find(item => item.id === event.target.value);
        onChange({ scenarioCategory: selected?.id, scenario: selected?.example || "" });
      }}>
        <option value="">General discovery</option>
        {SCENARIOS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
    <label className="field"><span>Your scenario</span>
      <textarea value={value.scenario || ""} maxLength={1000} rows={4} disabled={disabled}
        onChange={event => onChange({ ...value, scenario: event.target.value })}
        placeholder="Describe your goal, preferences, comfort needs and constraints—or edit an example above."
        aria-describedby="lab-scenario-help" />
    </label>
    <p className="helper" id="lab-scenario-help">Examples are editable starting points, not assumptions. Scenario text stays in this browser’s Lab data and exports; it is not sent to Qloo or synced to your account. Local planning suggestions use explicit preferences, not medical advice or verified suitability. Avoid identifying or sensitive details.</p>
  </div>;
}
