import { Buffer, VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { GreasedLineMesh } from '@babylonjs/core/Meshes/GreasedLine/greasedLineMesh';
import { GreasedLineBaseMesh } from '@babylonjs/core/Meshes/GreasedLine/greasedLineBaseMesh';

/**
 * `GreasedLineMesh.setPoints` in place.
 *
 * Babylon rebuilds a greased line from scratch on every `setPoints`: a new
 * vertex data applied to the mesh (positions, uvs, indices) and new GPU
 * buffers for the four line attributes, two of them created static so they
 * can only ever be replaced. Every one of those swaps notifies the geometry,
 * which marks the mesh's attributes dirty and rebuilds its vertex array
 * objects - so the next draw re-derives the material's defines (string work
 * and garbage) for a line that only moved. The effects move their ribbons
 * every few frames (joint.ts samples a tail every 40 ms): a wizard hunting
 * measured ~180 rebuilds a second (10-14), one of the main sources of the
 * ~30 MB/s of garbage whose collections stuttered the picture.
 *
 * With this, a line whose segments keep their lengths (same number of points
 * per segment - the common case: a tail of fixed size, a bolt of fixed
 * segments) writes its new data into the buffers it has; anything else
 * (a different point count) takes Babylon's own full path. The two direction
 * attributes are created updatable for that, the rest already are for an
 * `updatable` line (the effects create theirs updatable).
 */

type InPlaceState = {
  previousAndSide: Buffer;
  nextAndCounters: Buffer;
  shape: string;
};

/** The fields of a GreasedLineMesh this patch reaches (several are private in its typings). */
type LineInternals = {
  getVertexBuffer(kind: string): VertexBuffer | null;
  setVerticesBuffer(buffer: VertexBuffer): void;
  _scene: { getEngine(): ConstructorParameters<typeof Buffer>[0] };
  _points: number[][];
  _vertexPositions: Float32Array | number[];
  _uvs: Float32Array | number[];
  _previousAndSide: Float32Array;
  _nextAndCounters: Float32Array;
  _widths: number[];
  _colorPointers: number[];
  _updatable: boolean;
  _widthsBuffer?: Buffer;
  _colorPointersBuffer?: Buffer;
  _grlInPlace?: InPlaceState;
};

function shapeOf(line: LineInternals): string {
  return line._points.map(p => p.length).join(',');
}

function updateInPlace(line: LineInternals): boolean {
  const state = line._grlInPlace;
  if (!state || state.shape !== shapeOf(line)) return false;
  const positions = line.getVertexBuffer(VertexBuffer.PositionKind);
  const uvs = line.getVertexBuffer(VertexBuffer.UVKind);
  if (!positions?.isUpdatable() || (uvs && !uvs.isUpdatable())) return false;
  positions.update(line._vertexPositions);
  uvs?.update(line._uvs);
  state.previousAndSide.update(line._previousAndSide);
  state.nextAndCounters.update(line._nextAndCounters);
  if (line._updatable) {
    line._widthsBuffer?.update(line._widths);
    line._colorPointersBuffer?.update(line._colorPointers);
  }
  return true;
}

function createBuffers(this: LineInternals): unknown {
  if (updateInPlace(this)) return undefined;

  // Babylon's own GreasedLineMesh._createVertexBuffers, the direction buffers updatable.
  const vertexData = GreasedLineBaseMesh.prototype['_createVertexBuffers' as keyof GreasedLineBaseMesh] as unknown as (
    this: LineInternals
  ) => unknown;
  const result = vertexData.call(this);
  const engine = this._scene.getEngine();
  const previousAndSide = new Buffer(engine, this._previousAndSide, true, 4);
  this.setVerticesBuffer(previousAndSide.createVertexBuffer('grl_previousAndSide', 0, 4));
  const nextAndCounters = new Buffer(engine, this._nextAndCounters, true, 4);
  this.setVerticesBuffer(nextAndCounters.createVertexBuffer('grl_nextAndCounters', 0, 4));
  const widths = new Buffer(engine, this._widths, this._updatable, 1);
  this.setVerticesBuffer(widths.createVertexBuffer('grl_widths', 0, 1));
  this._widthsBuffer = widths;
  const colorPointers = new Buffer(engine, this._colorPointers, this._updatable, 1);
  this.setVerticesBuffer(colorPointers.createVertexBuffer('grl_colorPointers', 0, 1));
  this._colorPointersBuffer = colorPointers;
  this._grlInPlace = { previousAndSide, nextAndCounters, shape: shapeOf(this) };
  return result;
}

let installed = false;

/** Patches `GreasedLineMesh` once (idempotent). */
export function installGreasedLineInPlace(): void {
  if (installed) return;
  installed = true;
  (GreasedLineMesh.prototype as unknown as { _createVertexBuffers: typeof createBuffers })._createVertexBuffers = createBuffers;
}
