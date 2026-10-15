import type { IVector3Like } from '@babylonjs/core';
import type { Entity, ISystemFactory } from '../world';

/**
 * MUIdle: an instant move of a few tiles (`ObjectMoved`, C1 15) is drawn as a quick glide. OpenMU puts a
 * knight on its target for a weapon skill (Falling Slash, Lunge, Uppercut, Cyclone, Slash, Crescent Moon
 * Slash: `MovesToTarget`) and pushes the target away (`MovesTarget`); snapped, both read as a teleport on
 * every combo (owner, 10-15). The position is the server's at once - pathing, targeting and the name tag
 * use it - and only the drawing slides in from where the entity stood, through a render-only
 * `posOffset` on top of the entity's own (characters are centred on their tile with one).
 */

/** How long the slide takes. */
const GLIDE_SECONDS = 0.18;

/** Farther than this is a real teleport (a warp, the Teleport skill, a respawn): it stays a cut. */
export const GLIDE_MAX_TILES = 4;

type Glide = {
  /** The entity's own offset, back in place when the glide ends. */
  base: IVector3Like | undefined;
  dx: number;
  dy: number;
  dz: number;
  elapsed: number;
  offset: { x: number; y: number; z: number };
};

const glides = new Map<Entity, Glide>();

/** How far the drawing of the entity is from its position now (0 without a glide). */
function displacement(glide: Glide | undefined): { x: number; y: number; z: number } {
  if (!glide) return { x: 0, y: 0, z: 0 };
  const base = glide.base;
  return {
    x: glide.offset.x - (base?.x ?? 0),
    y: glide.offset.y - (base?.y ?? 0),
    z: glide.offset.z - (base?.z ?? 0),
  };
}

/**
 * The entity moved from `from` to its current `transform.pos` at once: draw it sliding over unless the
 * jump is too far (then any running glide ends - a cut stays a cut).
 */
export function glideFrom(entity: Entity, from: IVector3Like): void {
  const transform = entity.transform;
  if (!transform) return;
  const running = glides.get(entity);
  const drawn = displacement(running);
  const dx = from.x + drawn.x - transform.pos.x;
  const dy = from.y + drawn.y - transform.pos.y;
  const dz = from.z + drawn.z - transform.pos.z;
  const base = running ? running.base : transform.posOffset;
  if (Math.hypot(dx, dz) > GLIDE_MAX_TILES || Math.hypot(dx, dz) < 0.05) {
    if (running) {
      transform.posOffset = base;
      glides.delete(entity);
    }
    return;
  }

  const offset = { x: (base?.x ?? 0) + dx, y: (base?.y ?? 0) + dy, z: (base?.z ?? 0) + dz };
  glides.set(entity, { base, dx, dy, dz, elapsed: 0, offset });
  transform.posOffset = offset;
}

/** Eases each glide out (fast, then settling) and gives the entity its own offset back at the end. */
export const GlideSystem: ISystemFactory = () => ({
  update: dt => {
    for (const [entity, glide] of glides) {
      glide.elapsed += dt;
      const transform = entity.transform;
      const t = glide.elapsed / GLIDE_SECONDS;
      if (!transform || t >= 1 || transform.posOffset !== glide.offset) {
        // Ended - or someone else took the offset over meanwhile (theirs wins).
        if (transform && transform.posOffset === glide.offset) transform.posOffset = glide.base;
        glides.delete(entity);
        continue;
      }

      const left = (1 - t) * (1 - t);
      glide.offset.x = (glide.base?.x ?? 0) + glide.dx * left;
      glide.offset.y = (glide.base?.y ?? 0) + glide.dy * left;
      glide.offset.z = (glide.base?.z ?? 0) + glide.dz * left;
    }
  },
});

/** Test seam: drops every glide (a world reset). */
export function resetGlides(): void {
  glides.clear();
}
