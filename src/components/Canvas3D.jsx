import React, { useRef, useEffect } from 'react';

const VERTEX_SHADER_SOURCE = `#version 300 es
in vec4 a_position;
void main() {
  gl_Position = a_position;
}`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_petals;
uniform float u_distortion;
uniform float u_triangles; // 1.0 or 0.0

float sdTriangle(in vec2 p) {
  // Equilateral triangle SDF in NDC-like space
  const float k = sqrt(3.0);
  p.x = abs(p.x) - 1.0;
  p.y = p.y + 1.0/k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k*p.y, -k*p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0, 0.0);
  return -length(p) * sign(p.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy / u_resolution.xy) * 2.0 - 1.0;
  uv.x *= u_resolution.x / u_resolution.y;

  float t = u_time * 0.35;
  float petals = max(1.0, u_petals);
  float rings = 6.0;

  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float petalWave = cos(a * petals) * (0.5 + 0.5 * sin(t));
  float base = smoothstep(0.0, 0.02 + 0.1*u_distortion, abs(r - (0.4 + 0.2 * petalWave)));

  float ring = 0.0;
  for (float i = 1.0; i <= rings; i += 1.0) {
    float rr = 0.15 * i + 0.03 * sin(t + i*1.7);
    ring += 1.0 - smoothstep(0.0, 0.02 + 0.04*u_distortion, abs(r - rr));
  }

  float tri = 0.0;
  if (u_triangles > 0.5) {
    float ang = floor((a + 3.14159) / (6.28318 / 3.0)) * (6.28318 / 3.0);
    vec2 rp = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * uv * (1.2 + 0.1*sin(t));
    tri = 1.0 - smoothstep(-0.02, 0.02, sdTriangle(rp));
  }

  float mask = clamp(base + 0.6*ring + 0.8*tri, 0.0, 1.0);
  vec3 colA = vec3(0.08, 0.0, 0.12);
  vec3 colB = vec3(0.9, 0.1, 0.2);
  vec3 color = mix(colA, colB, mask);
  outColor = vec4(color, 1.0);
}`;

export default function Canvas3D({ params }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2');
    if (!gl) {
      // eslint-disable-next-line no-alert
      alert('WebGL2 not supported in this browser');
      return;
    }

    function createShader(glContext, type, source) {
      const shader = glContext.createShader(type);
      if (!shader) return null;
      glContext.shaderSource(shader, source);
      glContext.compileShader(shader);
      const compiled = glContext.getShaderParameter(shader, glContext.COMPILE_STATUS);
      if (!compiled) {
        const info = glContext.getShaderInfoLog(shader) || 'Shader compile failed';
        glContext.deleteShader(shader);
        throw new Error(info);
      }
      return shader;
    }

    function createProgram(glContext, vertexSrc, fragmentSrc) {
      const vert = createShader(glContext, glContext.VERTEX_SHADER, vertexSrc);
      const frag = createShader(glContext, glContext.FRAGMENT_SHADER, fragmentSrc);
      if (!vert || !frag) return null;
      const program = glContext.createProgram();
      if (!program) return null;
      glContext.attachShader(program, vert);
      glContext.attachShader(program, frag);
      glContext.linkProgram(program);
      const linked = glContext.getProgramParameter(program, glContext.LINK_STATUS);
      if (!linked) {
        const info = glContext.getProgramInfoLog(program) || 'Program link failed';
        glContext.deleteProgram(program);
        throw new Error(info);
      }
      glContext.deleteShader(vert);
      glContext.deleteShader(frag);
      return program;
    }

    // Setup program
    let program;
    try {
      program = createProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      return () => { };
    }
    if (!program) return () => { };

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // Fullscreen triangle
    const positions = new Float32Array([
      -1, -1,
      3, -1,
      -1, 3,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const aPositionLocation = gl.getAttribLocation(program, 'a_position');
    const uResolution = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uPetals = gl.getUniformLocation(program, 'u_petals');
    const uDistortion = gl.getUniformLocation(program, 'u_distortion');
    const uTriangles = gl.getUniformLocation(program, 'u_triangles');

    function resizeCanvasToDisplaySize() {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const displayWidth = Math.floor(canvas.clientWidth * pixelRatio) || canvas.width;
      const displayHeight = Math.floor(canvas.clientHeight * pixelRatio) || canvas.height;
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    let startTime = performance.now();
    let rafId = 0;

    function render(now) {
      resizeCanvasToDisplaySize();
      const elapsed = (now - startTime) * 0.001;

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);

      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, elapsed);
      gl.uniform1f(uPetals, params?.petals ?? 8);
      gl.uniform1f(uDistortion, params?.distortion ?? 0.0);
      gl.uniform1f(uTriangles, params?.triangles ? 1.0 : 0.0);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(aPositionLocation);
      gl.vertexAttribPointer(aPositionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      rafId = requestAnimationFrame(render);
    }

    rafId = requestAnimationFrame(render);
    const onResize = () => { };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }, [params]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={800}
      style={{ display: 'block', background: '#000', width: '100%', height: '100%' }}
    />
  );
}
