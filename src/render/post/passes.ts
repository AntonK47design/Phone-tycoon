// Custom post passes: tilt-shift blur (separable) and vignette/grade.

import { Vector2 } from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export function createTiltShiftPass(horizontal: boolean): ShaderPass {
  return new ShaderPass({
    name: 'TiltShift',
    uniforms: {
      tDiffuse: { value: null },
      resolution: { value: new Vector2(1, 1) },
      direction: { value: horizontal ? new Vector2(1, 0) : new Vector2(0, 1) },
      focus: { value: 0.45 },
      range: { value: 0.22 },
      strength: { value: 0 },
    },
    vertexShader: vertex,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      uniform vec2 direction;
      uniform float focus;
      uniform float range;
      uniform float strength;
      varying vec2 vUv;
      void main() {
        float d = abs(vUv.y - focus);
        float amount = smoothstep(range, range + 0.35, d) * strength;
        if (amount < 0.01) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
        vec2 stepUv = direction / resolution * amount * 3.0;
        vec4 sum = texture2D(tDiffuse, vUv) * 0.2270270270;
        sum += texture2D(tDiffuse, vUv + stepUv * 1.3846153846) * 0.3162162162;
        sum += texture2D(tDiffuse, vUv - stepUv * 1.3846153846) * 0.3162162162;
        sum += texture2D(tDiffuse, vUv + stepUv * 3.2307692308) * 0.0702702703;
        sum += texture2D(tDiffuse, vUv - stepUv * 3.2307692308) * 0.0702702703;
        gl_FragColor = sum;
      }`,
  });
}

export function createGradePass(): ShaderPass {
  return new ShaderPass({
    name: 'Grade',
    uniforms: {
      tDiffuse: { value: null },
      vignette: { value: 0.35 },
      saturation: { value: 1.12 },
      night: { value: 0 },
    },
    vertexShader: vertex,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float vignette;
      uniform float saturation;
      uniform float night;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
        c.rgb = mix(vec3(l), c.rgb, saturation);
        // Gentle S-curve for contrast.
        c.rgb = mix(c.rgb, c.rgb * c.rgb * (3.0 - 2.0 * c.rgb), 0.35);
        vec2 p = vUv - 0.5;
        float v = smoothstep(0.85, 0.2, length(p * vec2(1.1, 1.0)));
        c.rgb *= mix(1.0 - vignette, 1.0, v);
        // "Night" tint for the overnight time-lapse.
        c.rgb = mix(c.rgb, c.rgb * vec3(0.35, 0.42, 0.75), night);
        gl_FragColor = c;
      }`,
  });
}
