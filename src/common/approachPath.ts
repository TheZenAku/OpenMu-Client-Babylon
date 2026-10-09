/**
 * Where a walk toward something the hero means to act on has to end.
 *
 * Both approaches - the swing's and the cast's - aim their walk at the
 * target's own cell and rely on the caller stopping once it is in reach.
 * That cell must never survive into the path that is actually walked: it is
 * the array `NetworkSystem` turns into a WalkRequest *and* the array
 * `MoveAlongPathSystem` steps the hero along, so leaving it in place walks
 * the server onto the target (and the next ObjectMoved correction snaps the
 * hero there), and lets a frame that catches up on a long stall carry the
 * hero the whole remaining way in one go.
 */

/**
 * How far along `path` the hero still has to walk to reach `stop`.
 *
 * `stop` is the last step the server has been sent (`pathfinding.sentThrough`),
 * and this is the budget the walk is clamped to: a frame that catches up on a
 * long stall must not carry the hero past the end of the chunk the server is
 * walking, or the next request starts from a tile the server has not reached.
 * A `stop` already consumed off the front of the array is zero - hold here
 * until the next chunk goes out.
 */
export function distanceAlongPath(
  pos: { x: number; z: number },
  path: { x: number; y: number }[],
  stop: { x: number; y: number }
): number {
  const end = path.indexOf(stop);
  if (end < 0) return 0;

  let total = 0;
  let fromX = pos.x;
  let fromY = pos.z;

  for (let i = 0; i <= end; i++) {
    const dx = path[i].x - fromX;
    const dy = path[i].y - fromY;
    total += Math.sqrt(dx * dx + dy * dy);
    fromX = path[i].x;
    fromY = path[i].y;
  }

  return total;
}

/** Cut `path` at the first cell already within `range` tiles of (x, y). */
export function truncatePathWithinRange(
  path: { x: number; y: number }[],
  x: number,
  y: number,
  range: number
): void {
  const rangeSq = range * range;
  for (let i = 0; i < path.length; i++) {
    const dx = x - path[i].x;
    const dy = y - path[i].y;
    if (dx * dx + dy * dy <= rangeSq) {
      path.length = i + 1;
      return;
    }
  }
}

/**
 * How far (in tiles, either axis) the target may move from the cell an approach walk was aimed at
 * before the walk is planned again. Inside that the hero keeps the walk he has, and once it is used
 * up (the target stepped aside) the empty path asks for a new one.
 */
const APPROACH_RETARGET_TILES = 2;

/**
 * Whether an approach toward (x, y) needs a new walk.
 *
 * Re-planning on every throttle tick (0.4 s) sent the server a WalkRequest about every tile. When a
 * few of them reach it together after a stall (a Wi-Fi hiccup, a busy host), three inside the
 * speedhack check's 2 s window read as the hero covering those tiles at once
 * (SpeedHackDetectPlugIn): the walk is refused, the server snaps him back, and the warnings add up
 * to a ban. A walk still headed where the target stands is left to NetworkSystem, which hands the
 * server the rest in 15-step chunks, like a click on the ground.
 */
export function approachNeedsWalk(
  pathfinding: { to: { x: number; y: number }; path: unknown[] | null; calculated: boolean },
  x: number,
  y: number
): boolean {
  if (!pathfinding.calculated || !pathfinding.path || pathfinding.path.length === 0) return true;
  const moved = Math.max(Math.abs(~~x - pathfinding.to.x), Math.abs(~~y - pathfinding.to.y));
  return moved >= APPROACH_RETARGET_TILES;
}
