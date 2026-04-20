"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    ambientSet?: (rgb?: number[] | null, intensity?: number | null) => void;
  }
}

export function AmbientSmoke() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      premultipliedAlpha: true,
      antialias: false,
      alpha: true,
    });
    if (!gl) {
      canvas.style.display = "none";
      return;
    }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
    const fs = `
      precision mediump float;
      uniform vec2 uRes;
      uniform float uT;
      uniform vec3 uSmoke;
      uniform float uIntensity;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
        vec2 u = f*f*(3.-2.*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      float fbm(vec2 p){
        float v = 0., a = .5;
        for (int i=0; i<5; i++){ v += a*vnoise(p); p *= 2.02; a *= .5; }
        return v;
      }
      void main(){
        vec2 uv = gl_FragCoord.xy / uRes.xy;
        vec2 p = uv * vec2(uRes.x/uRes.y, 1.) * 2.;
        float t = uT * 0.11;
        float n1 = fbm(p*1.1 + vec2(t*1.2, -t*.7));
        float n2 = fbm(p*2.0 + vec2(-t*.9, t*.6) + n1*.6);
        float n3 = fbm(p*3.8 + vec2(t*.4, t*1.1) + n2*.4);
        float smoke = pow(smoothstep(.22, .95, n2*.6 + n1*.45 + n3*.25), 1.25);
        float vig = smoothstep(1.5, .1, distance(uv, vec2(.35, .4)));
        smoke *= vig;
        float warm = smoothstep(.45, 0., distance(uv, vec2(.28, .45))) * .25;
        vec3 col = uSmoke * smoke;
        col += vec3(1.0, .45, .15) * warm * smoke;
        float a = smoke * uIntensity;
        gl_FragColor = vec4(col * a, a * .8);
      }
    `;

    const mk = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
      }
      return s;
    };

    const prog = gl.createProgram()!;
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const locP = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(locP);
    gl.vertexAttribPointer(locP, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uT = gl.getUniformLocation(prog, "uT");
    const uSmoke = gl.getUniformLocation(prog, "uSmoke");
    const uIntensity = gl.getUniformLocation(prog, "uIntensity");

    let smokeCol: number[] = [0.66, 0.83, 0.63];
    let intensity = 1.0;
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(innerWidth * dpr);
      canvas.height = Math.floor(innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const start = performance.now();
    const frame = () => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uT, (performance.now() - start) / 1000);
      gl.uniform3f(uSmoke, smokeCol[0], smokeCol[1], smokeCol[2]);
      gl.uniform1f(uIntensity, intensity);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    if (reduced) frame();
    else raf = requestAnimationFrame(frame);

    window.ambientSet = (rgb, i) => {
      if (rgb) smokeCol = rgb;
      if (i != null) intensity = i;
    };

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
      delete window.ambientSet;
    };
  }, []);

  return <canvas id="ambient" ref={canvasRef} aria-hidden="true" />;
}
