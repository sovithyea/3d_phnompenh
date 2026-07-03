import * as THREE from 'three';

// Single shared material for all city tiles — one shader program, vertex
// colors carry per-building variation. At night, a window grid derived from
// world position is lit on wall faces (aWindow attribute: seed + wall flag,
// baked in buildTileGeometry).
export const nightUniform = { value: 0 };

export function createCityMaterial(): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = nightUniform;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec2 aWindow;
varying vec3 vCityWorldPos;
varying vec2 vAWindow;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vCityWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
vAWindow = aWindow;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uNight;
varying vec3 vCityWorldPos;
varying vec2 vAWindow;
float cityHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}`,
      )
      .replace(
        '#include <dithering_fragment>',
        `if (uNight > 0.001 && vAWindow.y > 0.5) {
  float floorY = vCityWorldPos.y / 3.2;
  float cellX = (vCityWorldPos.x + vCityWorldPos.z) / 2.6;
  float lit = step(cityHash(vec2(floor(floorY), floor(cellX)) + vAWindow.x * 91.7), 0.35);
  float pane = step(0.25, fract(floorY)) * step(fract(floorY), 0.8)
             * step(0.2, fract(cellX)) * step(fract(cellX), 0.85);
  gl_FragColor.rgb += vec3(1.0, 0.82, 0.5) * (lit * pane * uNight);
}
#include <dithering_fragment>`,
      );
  };

  return mat;
}
