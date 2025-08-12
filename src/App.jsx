import React from 'react';
import Canvas3D from './components/Canvas3D';
import Controls from './components/Controls';
import presets from './presets';

export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      <Canvas3D />
      <Controls presets={presets} />
    </div>
  );
}
