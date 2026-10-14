import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { CreateGreasedLine } from '@babylonjs/core/Meshes/Builders/greasedLineBuilder';
import { GreasedLineMeshMaterialType } from '@babylonjs/core/Materials/GreasedLine/greasedLineMaterialInterfaces';
import type { GreasedLineMesh } from '@babylonjs/core/Meshes/GreasedLine/greasedLineMesh';
import '@babylonjs/core/Materials/GreasedLine/greasedLineSimpleMaterial';
import { installGreasedLineInPlace } from './greasedLineInPlace';

/**
 * A line which keeps its point count moves inside the buffers it has (no new
 * buffers, no dirty attributes for the material to re-derive); a line which
 * changes it is rebuilt as Babylon does.
 */
describe('installGreasedLineInPlace', () => {
  let engine: NullEngine;
  let scene: Scene;

  beforeEach(() => {
    installGreasedLineInPlace();
    engine = new NullEngine();
    scene = new Scene(engine);
  });

  afterEach(() => {
    engine.dispose();
  });

  function line(points: number[][]): GreasedLineMesh {
    return CreateGreasedLine(
      'line',
      { points, updatable: true },
      { width: 0.1, materialType: GreasedLineMeshMaterialType.MATERIAL_TYPE_SIMPLE },
      scene
    ) as GreasedLineMesh;
  }

  it('moves a line of the same shape inside its buffers', () => {
    const mesh = line([[0, 0, 0, 1, 0, 0, 2, 0, 0]]);
    const positions = mesh.getVertexBuffer(VertexBuffer.PositionKind);
    const previous = mesh.getVertexBuffer('grl_previousAndSide');

    mesh.setPoints([[0, 1, 0, 1, 1, 0, 2, 3, 0]]);

    expect(mesh.getVertexBuffer(VertexBuffer.PositionKind)).toBe(positions);
    expect(mesh.getVertexBuffer('grl_previousAndSide')).toBe(previous);
    const data = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    expect(Array.from(data.slice(12, 15))).toEqual([2, 3, 0]);
  });

  it('rebuilds a line whose point count changed', () => {
    const mesh = line([[0, 0, 0, 1, 0, 0, 2, 0, 0]]);
    const positions = mesh.getVertexBuffer(VertexBuffer.PositionKind);

    mesh.setPoints([[0, 0, 0, 1, 0, 0]]);

    expect(mesh.getVertexBuffer(VertexBuffer.PositionKind)).not.toBe(positions);
    expect(mesh.getTotalVertices()).toBe(4);
  });
});
