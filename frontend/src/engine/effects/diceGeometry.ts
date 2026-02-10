/**
 * diceGeometry.ts — Procedural polyhedron geometry generators for d4–d20 dice.
 * Pure Three.js BufferGeometry, no React or Rapier dependencies.
 * Each die type provides geometry + face-normal/value mappings for result reading.
 */

import {
  BufferGeometry,
  Float32BufferAttribute,
  BoxGeometry,
  TetrahedronGeometry,
  OctahedronGeometry,
  IcosahedronGeometry,
  DodecahedronGeometry,
  Vector3,
} from 'three';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20';

export interface DieGeometryData {
  geometry: BufferGeometry;
  /** One normal per logical face (unit-length, in local space before rotation). */
  faceNormals: [number, number, number][];
  /** faceValues[i] = the number shown when face i is the top face.
   *  For d4: value when face i is the BOTTOM face (apex-vertex convention). */
  faceValues: number[];
  /** Bounding sphere radius for collision sizing. */
  boundingRadius: number;
}

const DIE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'] as const;

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const _cache = new Map<string, DieGeometryData>();

export function getDieGeometry(type: DieType, size = 0.7): DieGeometryData {
  const key = `${type}_${size}`;
  let data = _cache.get(key);
  if (!data) {
    data = GENERATORS[type](size);
    _cache.set(key, data);
  }
  return data;
}

export function disposeDieGeometries(): void {
  for (const data of _cache.values()) {
    data.geometry.dispose();
  }
  _cache.clear();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const _v0 = new Vector3();
const _v1 = new Vector3();
const _normal = new Vector3();

function triNormal(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
): [number, number, number] {
  _v0.set(bx - ax, by - ay, bz - az);
  _v1.set(cx - ax, cy - ay, cz - az);
  _normal.crossVectors(_v0, _v1).normalize();
  return [_normal.x, _normal.y, _normal.z];
}

/** Extract face normals from a non-indexed BufferGeometry (3 verts per triangle). */
function extractTriangleNormals(geo: BufferGeometry): [number, number, number][] {
  const pos = geo.getAttribute('position');
  const normals: [number, number, number][] = [];
  for (let i = 0; i < pos.count; i += 3) {
    normals.push(triNormal(
      pos.getX(i), pos.getY(i), pos.getZ(i),
      pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1),
      pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2),
    ));
  }
  return normals;
}

/** Group triangle normals into logical faces by clustering similar normals (epsilon). */
function clusterNormals(
  normals: [number, number, number][],
  eps = 0.01,
): { normal: [number, number, number]; triIndices: number[] }[] {
  const clusters: { normal: [number, number, number]; triIndices: number[] }[] = [];
  for (let i = 0; i < normals.length; i++) {
    const [nx, ny, nz] = normals[i];
    let found = false;
    for (const c of clusters) {
      const dx = c.normal[0] - nx;
      const dy = c.normal[1] - ny;
      const dz = c.normal[2] - nz;
      if (dx * dx + dy * dy + dz * dz < eps * eps) {
        c.triIndices.push(i);
        found = true;
        break;
      }
    }
    if (!found) {
      clusters.push({ normal: [nx, ny, nz], triIndices: [i] });
    }
  }
  return clusters;
}

function boundingRadius(geo: BufferGeometry): number {
  geo.computeBoundingSphere();
  return geo.boundingSphere?.radius ?? 1;
}

// ---------------------------------------------------------------------------
// D4 — Tetrahedron
// ---------------------------------------------------------------------------

function createD4(size: number): DieGeometryData {
  const geo = new TetrahedronGeometry(size, 0);
  if (geo.index) geo.toNonIndexed();
  geo.computeVertexNormals();

  const normals = extractTriangleNormals(geo);

  // Standard d4: when a face is on the bottom, the apex vertex (not touching ground)
  // shows the result. We assign values 1–4 to the 4 faces as "bottom face → apex value".
  // Convention: opposite-vertex values. We just assign 1,2,3,4 to the 4 faces.
  const faceValues = [1, 2, 3, 4];

  return {
    geometry: geo,
    faceNormals: normals,
    faceValues,
    boundingRadius: boundingRadius(geo),
  };
}

// ---------------------------------------------------------------------------
// D6 — Cube
// ---------------------------------------------------------------------------

function createD6(size: number): DieGeometryData {
  const geo = new BoxGeometry(size, size, size);
  if (geo.index) geo.toNonIndexed();
  geo.computeVertexNormals();

  // BoxGeometry face order (2 triangles each): +X, -X, +Y, -Y, +Z, -Z
  // Standard d6: opposite faces sum to 7
  const faceNormals: [number, number, number][] = [
    [1, 0, 0],   // +X
    [-1, 0, 0],  // -X
    [0, 1, 0],   // +Y
    [0, -1, 0],  // -Y
    [0, 0, 1],   // +Z
    [0, 0, -1],  // -Z
  ];

  // Assign values so opposite faces sum to 7:
  // +X=2, -X=5, +Y=1, -Y=6, +Z=3, -Z=4
  const faceValues = [2, 5, 1, 6, 3, 4];

  return {
    geometry: geo,
    faceNormals,
    faceValues,
    boundingRadius: boundingRadius(geo),
  };
}

// ---------------------------------------------------------------------------
// D8 — Octahedron
// ---------------------------------------------------------------------------

function createD8(size: number): DieGeometryData {
  const geo = new OctahedronGeometry(size, 0);
  if (geo.index) geo.toNonIndexed();
  geo.computeVertexNormals();

  const normals = extractTriangleNormals(geo);
  // 8 triangular faces. Opposite faces sum to 9.
  // Assign values 1–8, pairing opposites:
  // Face i's opposite is the face whose normal is -normal[i].
  // We assign greedily ensuring sum=9.
  const faceValues = assignOppositeValues(normals, 8, 9);

  return {
    geometry: geo,
    faceNormals: normals,
    faceValues,
    boundingRadius: boundingRadius(geo),
  };
}

// ---------------------------------------------------------------------------
// D10 — Pentagonal Trapezohedron (custom geometry)
// ---------------------------------------------------------------------------

function createD10(size: number): DieGeometryData {
  // 12 vertices: top pole, bottom pole, upper ring (5), lower ring (5)
  const h = size * 0.85;   // pole height
  const rUpper = size * 0.95;
  const rLower = size * 0.95;
  const upperY = size * 0.35;
  const lowerY = -size * 0.35;

  const verts: [number, number, number][] = [];

  // 0: top pole
  verts.push([0, h, 0]);
  // 1: bottom pole
  verts.push([0, -h, 0]);

  // 2–6: upper ring
  for (let i = 0; i < 5; i++) {
    const angle = (i * 2 * Math.PI) / 5;
    verts.push([Math.cos(angle) * rUpper, upperY, Math.sin(angle) * rUpper]);
  }

  // 7–11: lower ring (offset by 36 degrees)
  for (let i = 0; i < 5; i++) {
    const angle = ((i * 2 + 1) * Math.PI) / 5;
    verts.push([Math.cos(angle) * rLower, lowerY, Math.sin(angle) * rLower]);
  }

  // 10 kite faces, each split into 2 triangles
  // Upper kites: top pole + upper[i] + lower[i] + upper[i+1]
  // Lower kites: bottom pole + lower[i] + upper[i+1] + lower[i+1]
  const positions: number[] = [];

  // Helper to push a triangle
  const pushTri = (a: number, b: number, c: number) => {
    positions.push(
      verts[a][0], verts[a][1], verts[a][2],
      verts[b][0], verts[b][1], verts[b][2],
      verts[c][0], verts[c][1], verts[c][2],
    );
  };

  const faceNormals: [number, number, number][] = [];

  for (let i = 0; i < 5; i++) {
    const u0 = 2 + i;             // upper[i]
    const u1 = 2 + ((i + 1) % 5); // upper[i+1]
    const l0 = 7 + i;             // lower[i]
    const l1 = 7 + ((i + 1) % 5); // lower[i+1]

    // Upper kite: top(0), u0, l0, u1 → 2 triangles
    pushTri(0, u0, l0);
    pushTri(0, l0, u1);
    // Compute kite normal from first triangle
    const n1 = triNormal(
      verts[0][0], verts[0][1], verts[0][2],
      verts[u0][0], verts[u0][1], verts[u0][2],
      verts[l0][0], verts[l0][1], verts[l0][2],
    );
    faceNormals.push(n1);

    // Lower kite: bottom(1), l0, u1, l1 → 2 triangles
    pushTri(1, l0, u1);
    pushTri(1, u1, l1);
    const n2 = triNormal(
      verts[1][0], verts[1][1], verts[1][2],
      verts[l0][0], verts[l0][1], verts[l0][2],
      verts[u1][0], verts[u1][1], verts[u1][2],
    );
    faceNormals.push(n2);
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();

  // d10 values: 0–9 (or 1–10). We use 0–9 for standard d10.
  // Opposite kites sum to 9: (0,9), (1,8), (2,7), (3,6), (4,5)
  const faceValues = assignOppositeValues(faceNormals, 10, 9, 0);

  return {
    geometry: geo,
    faceNormals,
    faceValues,
    boundingRadius: boundingRadius(geo),
  };
}

// ---------------------------------------------------------------------------
// D12 — Dodecahedron
// ---------------------------------------------------------------------------

function createD12(size: number): DieGeometryData {
  const geo = new DodecahedronGeometry(size, 0);
  if (geo.index) geo.toNonIndexed();
  geo.computeVertexNormals();

  const triNormals = extractTriangleNormals(geo);
  // Dodecahedron: 12 pentagonal faces, each tessellated into 3 triangles = 36 triangles
  const clusters = clusterNormals(triNormals, 0.05);

  const faceNormals = clusters.map(c => c.normal);
  // Opposite faces sum to 13
  const faceValues = assignOppositeValues(faceNormals, 12, 13);

  return {
    geometry: geo,
    faceNormals,
    faceValues,
    boundingRadius: boundingRadius(geo),
  };
}

// ---------------------------------------------------------------------------
// D20 — Icosahedron
// ---------------------------------------------------------------------------

function createD20(size: number): DieGeometryData {
  const geo = new IcosahedronGeometry(size, 0);
  if (geo.index) geo.toNonIndexed();
  geo.computeVertexNormals();

  const normals = extractTriangleNormals(geo);
  // 20 triangular faces. Opposite faces sum to 21.
  const faceValues = assignOppositeValues(normals, 20, 21);

  return {
    geometry: geo,
    faceNormals: normals,
    faceValues,
    boundingRadius: boundingRadius(geo),
  };
}

// ---------------------------------------------------------------------------
// Opposite-value assignment utility
// ---------------------------------------------------------------------------

/**
 * Assign face values 1..numFaces (or startVal..startVal+numFaces-1) such that
 * opposite faces (most anti-parallel normals) sum to `oppositeSum`.
 */
function assignOppositeValues(
  normals: [number, number, number][],
  _numFaces: number,
  oppositeSum: number,
  startVal = 1,
): number[] {
  const values = new Array<number>(normals.length).fill(0);
  const assigned = new Set<number>();
  const usedValues = new Set<number>();

  // Find opposite pairs by most anti-parallel normals
  const pairs: [number, number][] = [];
  for (let i = 0; i < normals.length; i++) {
    if (assigned.has(i)) continue;
    let bestJ = -1;
    let bestDot = 2;
    for (let j = i + 1; j < normals.length; j++) {
      if (assigned.has(j)) continue;
      const dot =
        normals[i][0] * normals[j][0] +
        normals[i][1] * normals[j][1] +
        normals[i][2] * normals[j][2];
      if (dot < bestDot) {
        bestDot = dot;
        bestJ = j;
      }
    }
    if (bestJ >= 0) {
      pairs.push([i, bestJ]);
      assigned.add(i);
      assigned.add(bestJ);
    }
  }

  // Assign values to pairs
  let nextLow = startVal;
  for (const [a, b] of pairs) {
    // Find next unused low value
    while (usedValues.has(nextLow)) nextLow++;
    // For d10 with startVal=0: pairs should sum to oppositeSum (9): 0+9, 1+8, ...
    const low = nextLow;
    const high = startVal === 0 ? oppositeSum - low : oppositeSum - low;
    values[a] = low;
    values[b] = high;
    usedValues.add(low);
    usedValues.add(high);
    nextLow++;
  }

  return values;
}

// ---------------------------------------------------------------------------
// Generator map
// ---------------------------------------------------------------------------

const GENERATORS: Record<DieType, (size: number) => DieGeometryData> = {
  d4: createD4,
  d6: createD6,
  d8: createD8,
  d10: createD10,
  d12: createD12,
  d20: createD20,
};

export { DIE_TYPES };
