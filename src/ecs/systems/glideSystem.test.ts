import { afterEach, describe, expect, it } from 'vitest';
import type { Entity, World } from '../world';
import { GlideSystem, glideFrom, resetGlides } from './glideSystem';

const CENTRE = { x: 0.5, y: 0, z: 0.5 };

function character(x: number, z: number): Entity {
  return { transform: { pos: { x, y: 0, z }, rot: { x: 0, y: 0, z: 0 }, scale: 1, posOffset: CENTRE } } as unknown as Entity;
}

/** Moves the entity at once, as the ObjectMoved handler does, and starts the glide. */
function moveTo(entity: Entity, x: number, z: number): void {
  const pos = entity.transform!.pos;
  const from = { x: pos.x, y: pos.y, z: pos.z };
  pos.x = x;
  pos.z = z;
  glideFrom(entity, from);
}

describe('instant moves', () => {
  const system = GlideSystem({} as World);
  afterEach(resetGlides);

  it('slide over a few tiles and end on the entity\'s own offset', () => {
    const knight = character(10, 10);
    moveTo(knight, 12, 10);

    // Drawn where it stood, then sliding in.
    expect(knight.transform!.posOffset!.x).toBeCloseTo(CENTRE.x - 2);
    system.update!(0.09);
    const halfway = knight.transform!.posOffset!.x;
    expect(halfway).toBeGreaterThan(CENTRE.x - 2);
    expect(halfway).toBeLessThan(CENTRE.x);

    system.update!(0.2);
    expect(knight.transform!.posOffset).toBe(CENTRE);
  });

  it('stay a cut when far (a warp, a respawn)', () => {
    const wizard = character(10, 10);
    moveTo(wizard, 90, 120);
    expect(wizard.transform!.posOffset).toBe(CENTRE);
  });

  it('chain from where the entity is drawn', () => {
    const knight = character(10, 10);
    moveTo(knight, 11, 10);
    moveTo(knight, 12, 10);
    // Still drawn at 10: two tiles to slide now.
    expect(knight.transform!.posOffset!.x).toBeCloseTo(CENTRE.x - 2);
  });
});
