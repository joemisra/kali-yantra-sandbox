import React from 'react';

export default function Controls({ presets, activeIndex, params, onSelectPreset, onChangeParams }) {
  return (
    <div style={{ padding: 12, width: 320, borderLeft: '1px solid #333', background: '#111', color: '#eee' }}>
      <h3 style={{ marginTop: 0 }}>Presets</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
        {presets.map((p, i) => (
          <button
            key={p.name}
            onClick={() => onSelectPreset(i)}
            style={{
              textAlign: 'left',
              padding: '8px 10px',
              borderRadius: 6,
              border: i === activeIndex ? '1px solid #6cf' : '1px solid #333',
              background: i === activeIndex ? '#113' : '#1a1a1a',
              color: '#eee',
              cursor: 'pointer',
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      <h3 style={{ marginTop: 16 }}>Parameters</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Petals: {params.petals}</span>
          <input
            type="range"
            min={1}
            max={32}
            step={1}
            value={params.petals}
            onChange={(e) => onChangeParams({ petals: Number(e.target.value) })}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={params.triangles}
            onChange={(e) => onChangeParams({ triangles: e.target.checked })}
          />
          <span>Triangles</span>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Distortion: {params.distortion.toFixed(2)}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={params.distortion}
            onChange={(e) => onChangeParams({ distortion: Number(e.target.value) })}
          />
        </label>
      </div>
    </div>
  );
}
