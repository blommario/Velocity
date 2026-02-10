import { BufferGeometry, Float32BufferAttribute } from 'three';

/**
 * Generate a BufferGeometry from a 2D heightmap array.
 *
 * Vertex layout: rows × cols vertices, (rows-1)×(cols-1)×2 triangles.
 * Normals are smooth-shaded (face normals averaged per vertex).
 *
 * @param heights - 2D array [row][col], Y values. row=Z, col=X.
 * @param sizeX   - Total width in world units
 * @param sizeZ   - Total depth in world units
 */
export function createHeightmapGeometry(
  heights: number[][],
  sizeX: number,
  sizeZ: number,
): BufferGeometry {
  const rows = heights.length;
  const cols = heights[0].length;
  const vertexCount = rows * cols;

  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  const stepX = sizeX / (cols - 1);
  const stepZ = sizeZ / (rows - 1);
  const halfX = sizeX / 2;
  const halfZ = sizeZ / 2;

  // Fill positions and UVs
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      positions[idx * 3] = c * stepX - halfX;
      positions[idx * 3 + 1] = heights[r][c];
      positions[idx * 3 + 2] = r * stepZ - halfZ;
      uvs[idx * 2] = c / (cols - 1);
      uvs[idx * 2 + 1] = r / (rows - 1);
    }
  }

  // Build index buffer (two triangles per quad)
  const quadCount = (rows - 1) * (cols - 1);
  const indices = new Uint32Array(quadCount * 6);
  let ii = 0;

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const tl = r * cols + c;
      const tr = tl + 1;
      const bl = (r + 1) * cols + c;
      const br = bl + 1;
      indices[ii++] = tl;
      indices[ii++] = bl;
      indices[ii++] = tr;
      indices[ii++] = tr;
      indices[ii++] = bl;
      indices[ii++] = br;
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(Array.from(indices));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  return geo;
}
