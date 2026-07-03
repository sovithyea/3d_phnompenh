import * as THREE from 'three';

// Shared stylized landmark palette — flat lambert, silhouette over texture.
export const MAT = {
  glass: new THREE.MeshLambertMaterial({ color: '#8fb4d4' }),
  glassDark: new THREE.MeshLambertMaterial({ color: '#5d7f9e' }),
  white: new THREE.MeshLambertMaterial({ color: '#ece7db' }),
  cream: new THREE.MeshLambertMaterial({ color: '#e3d9bd' }),
  gold: new THREE.MeshLambertMaterial({ color: '#c9a227' }),
  goldDark: new THREE.MeshLambertMaterial({ color: '#a9852b' }),
  laterite: new THREE.MeshLambertMaterial({ color: '#6b3a2a' }),
  concrete: new THREE.MeshLambertMaterial({ color: '#b5ad9d' }),
  pavement: new THREE.MeshLambertMaterial({ color: '#d8d2c0' }),
  green: new THREE.MeshLambertMaterial({ color: '#5a7a4a' }),
  treeGreen: new THREE.MeshLambertMaterial({ color: '#3f5f38' }),
  steel: new THREE.MeshLambertMaterial({ color: '#9aa2a8' }),
  craneYellow: new THREE.MeshLambertMaterial({ color: '#d8a13a' }),
};
