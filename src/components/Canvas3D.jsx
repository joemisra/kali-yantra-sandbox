import React, { useRef, useEffect } from 'react';

export default function Canvas3D() {
  const canvasRef = useRef();
  useEffect(() => {
    const gl = canvasRef.current.getContext('webgl2');
    if (!gl) {
      alert('WebGL2 not supported');
    }
    // Shader setup would go here
  }, []);
  return <canvas ref={canvasRef} width={800} height={800} />;
}
