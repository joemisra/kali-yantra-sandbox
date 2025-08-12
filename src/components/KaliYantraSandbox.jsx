import React, { useEffect, useRef, useState } from 'react';

// Kali Yantra Shader Sandbox — 2D/3D with distortion, presets, PNG export, and audio-react

const vert = `#version 300 es
precision highp float;
in vec2 position;
out vec2 v_uv;
void main(){
  v_uv = (position + 1.0) * 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const frag = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_res;
uniform float u_time;
uniform float u_dpr;

uniform float u_outline;
uniform float u_smooth;
uniform float u_rot;
uniform float u_scale;
uniform vec4 u_colBG;
uniform vec4 u_colLine;
uniform vec4 u_colAccent;
uniform int   u_mode;

uniform float u_pulseAmt;
uniform float u_pulseFreq;
uniform float u_noiseAmt;

uniform bool  u_use3D;
uniform float u_camOrbit;
uniform float u_camElev;
uniform float u_camDist;

uniform float u_distortAmp;
uniform float u_distortFreq;
uniform float u_distortFlow;
uniform float u_thickness;

uniform float u_audio;

uniform bool u_showBhupura;
uniform bool u_showCircles;
uniform bool u_showLotus;
uniform bool u_showTriangles;

uniform int   u_petalCount;
uniform float u_lotusR;
uniform float u_lotusW;

uniform float u_r1;
uniform float u_r2;

uniform int   u_triCount;
uniform float u_triR;
uniform float u_triW;
uniform float u_triSkew;
uniform float u_triRot;

float PI = 3.141592653589793;

mat2 rot(float a){
  float c = cos(a), s = sin(a);
  return mat2(c,-s,s,c);
}

float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float sdBox(vec2 p, vec2 b){
  vec2 d = abs(p) - b;
  return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

float sdCircle(vec2 p, float r){
  return length(p) - r;
}

float sdEquiTriangle(vec2 p, float r, float skew){
  p.y *= mix(1.0, 0.85, clamp(skew, 0.0, 1.0));
  const float k = sqrt(3.0);
  p.x = abs(p.x) - r;
  p.y = p.y + r/k;
  if(p.x + k*p.y > 0.0){
    p = vec2(p.x - k*p.y, -k*p.x - p.y) / 2.0;
  }
  p.x -= clamp(p.x, -2.0*r, 0.0);
  return -length(p) * sign(p.y);
}

float sdLotus(vec2 p, float R, float W, int petals){
  float ang = atan(p.y, p.x);
  float rr  = length(p);
  float k = float(max(1, petals));
  float bump = 0.25 + 0.75 * pow(abs(sin(ang * k * 0.5)), 1.5);
  float target = R * mix(1.0 - 0.2, 1.0 + 0.2, bump);
  return abs(rr - target) - W*0.5;
}

float sdBhupura(vec2 p, float size, float frameW, float gateW, float gateD){
  float outer = sdBox(p, vec2(size));
  float inner = sdBox(p, vec2(size - frameW));
  float ring  = max(-outer, inner);

  float g = 1e5;
  g = min(g, sdBox(p - vec2(0.0,  size - gateD*0.5), vec2(gateW*0.5, gateD*0.5)));
  g = min(g, sdBox(p - vec2(0.0, -size + gateD*0.5), vec2(gateW*0.5, gateD*0.5)));
  g = min(g, sdBox(p - vec2( size - gateD*0.5, 0.0), vec2(gateD*0.5, gateW*0.5)));
  g = min(g, sdBox(p - vec2(-size - -gateD*0.5, 0.0), vec2(gateD*0.5, gateW*0.5)));
  float gap = -g;
  float s = 2.0;
  float ringWithGaps = max(ring, gap + s);
  return ringWithGaps;
}

float sdTriangleRing(vec2 p, int n, float R, float W, float skew, float offset){
  float d = 1e5;
  for(int i=0;i<24;i++){
    if(i>=n) break;
    float a = (float(i)/float(max(n,1))) * 2.0*PI + offset;
    vec2 q = rot(a) * p;
    float dt = sdEquiTriangle(q, R, skew);
    d = min(d, abs(dt) - W*0.5);
  }
  return d;
}

float yantra2D(vec2 p, float px){
  float d = 1e5;
  float d1 = abs(sdCircle(p, u_r1)) - (px*0.5);
  float d2 = abs(sdCircle(p, u_r2)) - (px*0.5);
  if(u_showCircles){ d = min(d, min(d1, d2)); }
  if(u_showLotus){
    float dL = sdLotus(p, u_lotusR, u_lotusW, u_petalCount);
    d = min(d, abs(dL));
  }
  if(u_showTriangles){
    float dT = sdTriangleRing(p, u_triCount, u_triR, u_triW, u_triSkew, u_triRot);
    d = min(d, abs(dT));
  }
  if(u_showBhupura){
    float size   = 0.38 * min(u_res.x, u_res.y);
    float frameW = 24.0;
    float gateW  = 72.0;
    float gateD  = 48.0;
    float dB = sdBhupura(p, size, frameW, gateW, gateD);
    d = min(d, abs(dB));
  }
  return d;
}

float along(vec2 p){
  float a = atan(p.y,p.x);
  float r = length(p);
  return a*0.5 + r*0.01;
}

float map3D(vec3 p3, float px){
  float u = along(p3.xy);
  float warp = u_distortAmp * (0.5 + 0.5*u_audio) * sin(u_distortFreq*6.28318*u + u_distortFlow*u_time);
  vec3 q = p3;
  q.z -= warp;
  float d2 = yantra2D(q.xy, px);
  float dz = abs(q.z) - u_thickness;
  float d = max(d2, dz);
  return d;
}

vec3 camPos(vec3 target){
  float elev = u_camElev;
  float orbit = u_camOrbit;
  float dist = u_camDist;
  vec3 dir = vec3(cos(elev)*cos(orbit), cos(elev)*sin(orbit), sin(elev));
  return target - dir * dist;
}

vec3 shade(vec3 pos, vec3 rd, float px){
  float e = 1.0;
  vec2 h = vec2(e,0);
  float d = map3D(pos, px);
  vec3 n = normalize(vec3(
    map3D(pos + vec3(h.x, h.y, h.y), px) - d,
    map3D(pos + vec3(h.y, h.x, h.y), px) - d,
    map3D(pos + vec3(h.y, h.y, h.x), px) - d
  ));
  vec3 L = normalize(vec3(0.6, 0.4, 0.8));
  float diff = max(0.0, dot(n,L));
  float spec = pow(max(0.0, dot(reflect(-L,n), -rd)), 32.0);
  vec3 base = mix(u_colLine.rgb, u_colAccent.rgb, 0.25 + 0.25*sin(0.5*u_time));
  vec3 col = base*(0.2 + 0.8*diff) + spec*0.6;
  return col;
}

vec4 render3D(vec2 fragXY){
  vec2 res = u_res;
  float px = u_outline * u_dpr;
  vec3 target = vec3(0.0,0.0,0.0);
  vec3 eye = camPos(target);
  vec3 ww = normalize(target - eye);
  vec3 uu = normalize(cross(ww, vec3(0,0,1)));
  vec3 vv = cross(uu, ww);
  vec2 ndc = (fragXY / res - 0.5) * vec2(1.0, -1.0);
  ndc.x *= res.x / res.y;
  float fov = 1.2;
  vec3 rd = normalize(uu*ndc.x + vv*ndc.y + ww * (1.0/tan(fov*0.5)));
  vec3 p = eye;
  float t = 0.0;
  float hit = -1.0;
  for(int i=0;i<128;i++){
    vec3 pos = eye + rd * t;
    float d = map3D(pos, px);
    if(d < 0.8){
      hit = t; break;
    }
    t += clamp(d, 0.8, 40.0);
    if(t>4000.0) break;
  }
  vec4 col = vec4(u_colBG.rgb,1.0);
  if(hit>0.0){
    vec3 pos = eye + rd * hit;
    vec3 c = shade(pos, rd, px);
    col = vec4(c,1.0);
  }
  float r = length((fragXY/res - 0.5)*vec2(res.x/res.y,1.0));
  col.rgb *= 1.0 - 0.35*pow(r,2.0);
  return col;
}

float stroke(float d, float px, float sm){
  return 1.0 - smoothstep(px - sm, px + sm, abs(d));
}

float fillMask(float d, float sm){
  return 1.0 - smoothstep(0.0, sm, d);
}

void main(){
  vec2 uv = v_uv;
  vec2 res = u_res;
  float t  = u_time;
  vec2 p = (uv * res - 0.5*res);
  p.y = -p.y;
  float n = (hash12(uv * 1000.0 + t*0.02) - 0.5) * 2.0 * u_noiseAmt;
  p += n;
  p *= u_scale;
  p = rot(u_rot) * p;
  float pulse = 1.0 + u_pulseAmt * (0.04 + 0.12*u_audio) * sin(2.0*PI*u_pulseFreq*t);
  vec4 col = u_colBG;
  float px = u_outline * u_dpr;
  float sm = u_smooth * u_dpr;
  if(u_use3D){
    fragColor = render3D(uv * res);
    return;
  }
  float aLine = 0.0;
  if(u_showBhupura){
    float size   = 0.38 * min(res.x, res.y) * pulse;
    float frameW = 24.0;
    float gateW  = 72.0;
    float gateD  = 48.0;
    float dB = sdBhupura(p, size, frameW, gateW, gateD);
    float sB = stroke(dB, px, sm);
    float fB = (u_mode==1) ? fillMask(dB, sm) : 0.0;
    col = mix(col, u_colAccent, fB*0.08);
    aLine = max(aLine, sB);
  }
  if(u_showCircles){
    float d1 = abs(sdCircle(p, u_r1 * pulse)) - (px*0.5);
    float d2 = abs(sdCircle(p, u_r2 * pulse)) - (px*0.5);
    float s1 = 1.0 - smoothstep(px - sm, px + sm, abs(d1));
    float s2 = 1.0 - smoothstep(px - sm, px + sm, abs(d2));
    aLine = max(aLine, max(s1, s2));
  }
  if(u_showLotus){
    float dL = sdLotus(p, u_lotusR * pulse, u_lotusW, u_petalCount);
    float sL = stroke(dL, px, sm);
    float fL = (u_mode==1) ? fillMask(dL, sm) : 0.0;
    col = mix(col, u_colAccent, fL*0.06);
    aLine = max(aLine, sL);
  }
  if(u_showTriangles){
    float dT = sdTriangleRing(p, u_triCount, u_triR * pulse, u_triW, u_triSkew, u_triRot);
    float sT = stroke(dT, px, sm);
    float fT = (u_mode==1) ? fillMask(dT, sm) : 0.0;
    col = mix(col, u_colAccent, fT*0.08);
    aLine = max(aLine, sT);
  }
  float dC = sdCircle(p, 3.5 * pulse);
  float fC = 1.0 - smoothstep(0.0, sm, dC);
  col = mix(col, u_colLine, fC);
  col = mix(col, u_colLine, clamp(aLine, 0.0, 1.0));
  fragColor = col;
}`;

function createGL(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 not supported');
    const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(s) || 'Shader compile error');
        }
        return s;
    };
    const vs = compile(gl.VERTEX_SHADER, vert);
    const fs = compile(gl.FRAGMENT_SHADER, frag);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'position');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(prog) || 'Program link error');
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const verts = new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        -1, 1,
        1, -1,
        1, 1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(prog);
    const uni = (name) => gl.getUniformLocation(prog, name);
    return { gl, prog, vao, uni };
}

function useAnimationFrame(callback) {
    const ref = useRef();
    useEffect(() => {
        let start = performance.now();
        let mounted = true;
        const tick = (now) => {
            if (!mounted) return;
            callback((now - start) / 1000);
            ref.current = requestAnimationFrame(tick);
        };
        ref.current = requestAnimationFrame(tick);
        return () => { mounted = false; if (ref.current) cancelAnimationFrame(ref.current); };
    }, [callback]);
}

function hexToRGB(hex) {
    const s = hex.replace('#', '');
    const bigint = parseInt(s, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return [r / 255, g / 255, b / 255, 1];
}

function Row({ label, children }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
            <div style={{ width: 140, fontSize: 12, color: '#cbd5e1' }}>{label}</div>
            <div style={{ flex: 1 }}>{children}</div>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{title}</div>
            {children}
        </div>
    );
}

function Slider({ min, max, step, value, onChange }) {
    return (
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: '100%' }} />
    );
}

function Toggle({ label, value, onChange }) {
    return (
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ fontSize: 12 }}>{label}</span>
            <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        </label>
    );
}

function Select({ value, options, onChange }) {
    return (
        <select style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 8px', color: '#eee' }} value={value} onChange={(e) => onChange(parseInt(e.target.value, 10))}>
            {options.map((o) => (
                <option key={o.v} value={o.v}>{o.l}</option>
            ))}
        </select>
    );
}

function Color({ value, onChange }) {
    return (
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 32, height: 32, borderRadius: 8 }} />
    );
}

export default function KaliYantraSandbox() {
    const canvasRef = useRef(null);
    const glRef = useRef(null);
    const [paused, setPaused] = useState(false);
    const [analyser, setAnalyser] = useState(null);
    const audioLevelRef = useRef(0);

    const [params, setParams] = useState({
        outline: 2,
        smooth: 1.5,
        rot: 0,
        scale: 1,
        pulseAmt: 0.6,
        pulseFreq: 0.25,
        noiseAmt: 0.35,
        mode: 0,
        use3D: true,
        camOrbit: 0.35,
        camElev: 0.3,
        camDist: 1200,
        distortAmp: 12,
        distortFreq: 0.9,
        distortFlow: 1.2,
        thickness: 6,
        showBhupura: true,
        showCircles: true,
        showLotus: true,
        showTriangles: true,
        petalCount: 8,
        lotusR: 150,
        lotusW: 36,
        r1: 90,
        r2: 220,
        triCount: 2,
        triR: 120,
        triW: 28,
        triSkew: 0.1,
        triRot: Math.PI / 2,
        bg: '#0b0b0e',
        line: '#f4f2f0',
        accent: '#2ab3a6',
        audio: 0,
    });

    const PRESETS = {
        'Classic Star + Lotus': {
            showBhupura: true, showCircles: true, showLotus: true, showTriangles: true,
            petalCount: 8, lotusR: 150, lotusW: 36, r1: 90, r2: 220, triCount: 2, triR: 120, triW: 28, triSkew: 0.1, triRot: Math.PI / 2,
            pulseAmt: 0.6, pulseFreq: 0.25,
        },
        'Shakti Ring': {
            showBhupura: true, showCircles: false, showLotus: true, showTriangles: true,
            petalCount: 12, lotusR: 170, lotusW: 30, triCount: 3, triR: 135, triW: 24, triSkew: 0.05, triRot: 0.0,
        },
        Fierce: {
            showBhupura: true, showCircles: true, showLotus: true, showTriangles: true,
            petalCount: 12, lotusR: 160, lotusW: 40, r1: 100, r2: 240, triCount: 6, triR: 130, triW: 22, triSkew: 0.15, triRot: 0.0,
            pulseAmt: 1.0, pulseFreq: 0.45,
        },
        Minimal: {
            showBhupura: false, showCircles: true, showLotus: false, showTriangles: true,
            r1: 110, r2: 210, triCount: 2, triR: 140, triW: 18,
        },
    };

    function applyPreset(name) {
        const p = PRESETS[name];
        if (!p) return;
        setParams((prev) => ({ ...prev, ...p }));
    }

    // Resize & GL init
    useEffect(() => {
        const canvas = canvasRef.current;
        const onResize = () => {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;
            canvas.width = Math.max(2, Math.floor(w * dpr));
            canvas.height = Math.max(2, Math.floor(h * dpr));
        };
        onResize();
        window.addEventListener('resize', onResize);
        if (!glRef.current) {
            glRef.current = createGL(canvas);
        }
        return () => { window.removeEventListener('resize', onResize); };
    }, []);

    // Audio analyser loop
    useEffect(() => {
        if (!analyser) return;
        const buf = new Uint8Array(analyser.frequencyBinCount);
        let raf;
        const loop = () => {
            analyser.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i += 1) { const v = (buf[i] - 128) / 128; sum += v * v; }
            const rms = Math.sqrt(sum / buf.length);
            audioLevelRef.current = Math.min(1, rms * 4);
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [analyser]);

    useAnimationFrame((t) => {
        if (paused) return;
        const ctx = glRef.current; if (!ctx) return;
        const { gl, uni } = ctx;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(uni('u_res'), gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.uniform1f(uni('u_time'), t);
        gl.uniform1f(uni('u_dpr'), dpr);
        const colBG = hexToRGB(params.bg);
        const colLine = hexToRGB(params.line);
        const colAccent = hexToRGB(params.accent);
        gl.uniform1f(uni('u_outline'), params.outline);
        gl.uniform1f(uni('u_smooth'), params.smooth);
        gl.uniform1f(uni('u_rot'), params.rot);
        gl.uniform1f(uni('u_scale'), params.scale);
        gl.uniform4f(uni('u_colBG'), colBG[0], colBG[1], colBG[2], 1);
        gl.uniform4f(uni('u_colLine'), colLine[0], colLine[1], colLine[2], 1);
        gl.uniform4f(uni('u_colAccent'), colAccent[0], colAccent[1], colAccent[2], 1);
        gl.uniform1i(uni('u_mode'), params.mode);
        gl.uniform1f(uni('u_pulseAmt'), params.pulseAmt);
        gl.uniform1f(uni('u_pulseFreq'), params.pulseFreq);
        gl.uniform1f(uni('u_noiseAmt'), params.noiseAmt);
        gl.uniform1i(uni('u_use3D'), params.use3D ? 1 : 0);
        gl.uniform1f(uni('u_camOrbit'), params.camOrbit);
        gl.uniform1f(uni('u_camElev'), params.camElev);
        gl.uniform1f(uni('u_camDist'), params.camDist);
        gl.uniform1f(uni('u_distortAmp'), params.distortAmp);
        gl.uniform1f(uni('u_distortFreq'), params.distortFreq);
        gl.uniform1f(uni('u_distortFlow'), params.distortFlow);
        gl.uniform1f(uni('u_thickness'), params.thickness);
        const audioLevel = audioLevelRef.current;
        gl.uniform1f(uni('u_audio'), audioLevel);
        gl.uniform1i(uni('u_showBhupura'), params.showBhupura ? 1 : 0);
        gl.uniform1i(uni('u_showCircles'), params.showCircles ? 1 : 0);
        gl.uniform1i(uni('u_showLotus'), params.showLotus ? 1 : 0);
        gl.uniform1i(uni('u_showTriangles'), params.showTriangles ? 1 : 0);
        gl.uniform1i(uni('u_petalCount'), params.petalCount);
        gl.uniform1f(uni('u_lotusR'), params.lotusR);
        gl.uniform1f(uni('u_lotusW'), params.lotusW);
        gl.uniform1f(uni('u_r1'), params.r1);
        gl.uniform1f(uni('u_r2'), params.r2);
        gl.uniform1i(uni('u_triCount'), params.triCount);
        gl.uniform1f(uni('u_triR'), params.triR);
        gl.uniform1f(uni('u_triW'), params.triW);
        gl.uniform1f(uni('u_triSkew'), params.triSkew);
        gl.uniform1f(uni('u_triRot'), params.triRot);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    });

    async function enableMic() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const Ctor = window.AudioContext || window.webkitAudioContext;
            const ctx = new Ctor();
            const src = ctx.createMediaStreamSource(stream);
            const an = ctx.createAnalyser();
            an.fftSize = 1024;
            src.connect(an);
            setAnalyser(an);
        } catch (e) {
            // eslint-disable-next-line no-alert
            alert('Mic permission failed');
        }
    }

    function downloadPNG() {
        const c = canvasRef.current;
        const url = c.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url; a.download = 'kali-yantra.png'; a.click();
    }

    const containerStyle = { width: '100%', height: '100vh', background: '#000', color: '#e5e7eb', display: 'grid', gridTemplateColumns: '1fr 380px' };
    const buttonStyle = { padding: '6px 10px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#eee', cursor: 'pointer' };

    return (
        <div style={containerStyle}>
            <div style={{ position: 'relative' }}>
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
                <div style={{ position: 'absolute', top: 12, left: 12, fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>Kali Yantra Shader • 2D/3D SDF • MechaKali</div>
                <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8 }}>
                    <button onClick={() => setPaused((p) => !p)} style={buttonStyle}>
                        {paused ? 'Resume' : 'Pause'}
                    </button>
                    <button onClick={downloadPNG} style={buttonStyle}>PNG</button>
                </div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', padding: 16, overflowY: 'auto' }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Kali Yantra — 3D Shader Sandbox</div>
                <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 16 }}>Toggle 2D vs 3D. Distort along the form. Presets capture common variants; use audio to drive pulse and warp.</div>

                <Section title="Presets">
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {Object.keys(PRESETS).map((name) => (
                            <button key={name} onClick={() => applyPreset(name)} style={{ ...buttonStyle, borderRadius: 8, fontSize: 12 }}>{name}</button>
                        ))}
                    </div>
                </Section>

                <Section title="Display">
                    <Row label="2D / 3D">
                        <Toggle label={params.use3D ? '3D' : '2D'} value={params.use3D} onChange={(v) => setParams({ ...params, use3D: v })} />
                    </Row>
                    <Row label="Outline px"><Slider min={0.5} max={6} step={0.1} value={params.outline} onChange={(v) => setParams({ ...params, outline: v })} /></Row>
                    <Row label="AA smooth"><Slider min={0.5} max={3} step={0.1} value={params.smooth} onChange={(v) => setParams({ ...params, smooth: v })} /></Row>
                    <Row label="Rotation (2D)"><Slider min={-Math.PI} max={Math.PI} step={0.001} value={params.rot} onChange={(v) => setParams({ ...params, rot: v })} /></Row>
                    <Row label="Scale (2D)"><Slider min={0.5} max={1.5} step={0.01} value={params.scale} onChange={(v) => setParams({ ...params, scale: v })} /></Row>
                    <Row label="Mode"><Select value={params.mode} onChange={(v) => setParams({ ...params, mode: v })} options={[{ v: 0, l: 'Outline' }, { v: 1, l: 'Fill + Outline' }]} /></Row>
                    <Row label="BG / Line / Accent">
                        <div style={{ display: 'flex', gap: 8 }}>
                            <Color value={params.bg} onChange={(v) => setParams({ ...params, bg: v })} />
                            <Color value={params.line} onChange={(v) => setParams({ ...params, line: v })} />
                            <Color value={params.accent} onChange={(v) => setParams({ ...params, accent: v })} />
                        </div>
                    </Row>
                </Section>

                <Section title="Animation">
                    <Row label="Pulse amt"><Slider min={0} max={2} step={0.01} value={params.pulseAmt} onChange={(v) => setParams({ ...params, pulseAmt: v })} /></Row>
                    <Row label="Pulse Hz"><Slider min={0} max={2} step={0.01} value={params.pulseFreq} onChange={(v) => setParams({ ...params, pulseFreq: v })} /></Row>
                    <Row label="Noise"><Slider min={0} max={2} step={0.01} value={params.noiseAmt} onChange={(v) => setParams({ ...params, noiseAmt: v })} /></Row>
                </Section>

                <Section title="3D Camera">
                    <Row label="Orbit"><Slider min={-Math.PI} max={Math.PI} step={0.001} value={params.camOrbit} onChange={(v) => setParams({ ...params, camOrbit: v })} /></Row>
                    <Row label="Elevation"><Slider min={-0.9} max={0.9} step={0.001} value={params.camElev} onChange={(v) => setParams({ ...params, camElev: v })} /></Row>
                    <Row label="Distance"><Slider min={400} max={2200} step={1} value={params.camDist} onChange={(v) => setParams({ ...params, camDist: v })} /></Row>
                </Section>

                <Section title="3D Distortion">
                    <Row label="Amplitude"><Slider min={0} max={40} step={0.1} value={params.distortAmp} onChange={(v) => setParams({ ...params, distortAmp: v })} /></Row>
                    <Row label="Frequency"><Slider min={0} max={2} step={0.01} value={params.distortFreq} onChange={(v) => setParams({ ...params, distortFreq: v })} /></Row>
                    <Row label="Flow speed"><Slider min={-4} max={4} step={0.01} value={params.distortFlow} onChange={(v) => setParams({ ...params, distortFlow: v })} /></Row>
                    <Row label="Thickness"><Slider min={1} max={20} step={0.1} value={params.thickness} onChange={(v) => setParams({ ...params, thickness: v })} /></Row>
                </Section>

                <Section title="Layers">
                    <Toggle label="Bhupura (square wall)" value={params.showBhupura} onChange={(v) => setParams({ ...params, showBhupura: v })} />
                    <Toggle label="Circles" value={params.showCircles} onChange={(v) => setParams({ ...params, showCircles: v })} />
                    <Toggle label="Lotus" value={params.showLotus} onChange={(v) => setParams({ ...params, showLotus: v })} />
                    <Toggle label="Triangles" value={params.showTriangles} onChange={(v) => setParams({ ...params, showTriangles: v })} />
                </Section>

                <Section title="Lotus">
                    <Row label="Petals"><Slider min={4} max={24} step={1} value={params.petalCount} onChange={(v) => setParams({ ...params, petalCount: Math.round(v) })} /></Row>
                    <Row label="Radius"><Slider min={60} max={260} step={1} value={params.lotusR} onChange={(v) => setParams({ ...params, lotusR: v })} /></Row>
                    <Row label="Width"><Slider min={8} max={80} step={1} value={params.lotusW} onChange={(v) => setParams({ ...params, lotusW: v })} /></Row>
                </Section>

                <Section title="Circles">
                    <Row label="Inner R"><Slider min={40} max={200} step={1} value={params.r1} onChange={(v) => setParams({ ...params, r1: v })} /></Row>
                    <Row label="Outer R"><Slider min={120} max={320} step={1} value={params.r2} onChange={(v) => setParams({ ...params, r2: v })} /></Row>
                </Section>

                <Section title="Triangles">
                    <Row label="# Triangles"><Slider min={1} max={6} step={1} value={params.triCount} onChange={(v) => setParams({ ...params, triCount: Math.round(v) })} /></Row>
                    <Row label="Radius"><Slider min={60} max={240} step={1} value={params.triR} onChange={(v) => setParams({ ...params, triR: v })} /></Row>
                    <Row label="Width"><Slider min={8} max={80} step={1} value={params.triW} onChange={(v) => setParams({ ...params, triW: v })} /></Row>
                    <Row label="Skew"><Slider min={0} max={1} step={0.01} value={params.triSkew} onChange={(v) => setParams({ ...params, triSkew: v })} /></Row>
                    <Row label="Rotation"><Slider min={-Math.PI} max={Math.PI} step={0.001} value={params.triRot} onChange={(v) => setParams({ ...params, triRot: v })} /></Row>
                </Section>

                <Section title="Audio & I/O">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={enableMic} style={{ ...buttonStyle, borderRadius: 8, fontSize: 12 }}>Enable Mic</button>
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>Drives pulse & 3D warp</span>
                    </div>
                </Section>

                <div style={{ marginTop: 16, fontSize: 12, color: '#9ca3af' }}>
                    Tip: 3D warp follows angle+radius of the form. For meditative focus, lower flow; for wrathful presence, push amplitude and orbit slowly.
                </div>
            </div>
        </div>
    );
}



