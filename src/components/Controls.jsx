import React from 'react';

export default function Controls({ presets }) {
  return (
    <div style={{ padding: 10 }}>
      <h3>Presets</h3>
      <ul>
        {presets.map((p, i) => (
          <li key={i}>{p.name}</li>
        ))}
      </ul>
    </div>
  );
}
