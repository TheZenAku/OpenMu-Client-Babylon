import { makeAutoObservable, runInAction } from 'mobx';
import { EventBus } from '../libs/eventBus';
import { Store } from '../store';
import { mt } from './text';
import type { HuntActivity, HuntMapOption } from './huntMap';

export type { HuntActivity, HuntActivityKind, HuntMapMode, HuntMapOption, HuntMapReason } from './huntMap';
export { huntMapMode, withHuntMapMode } from './huntMap';

/**
 * MUIdle on the client: the HUNT/MANUAL switch, the idle settings the server
 * keeps per character, and the offline summary it reports on return.
 *
 * The server is the authority for all of it. HUNT is the MU Helper, whose
 * running state only ever changes on the server's `MuHelperStatusUpdate`; the
 * idle settings are validated and echoed by the server; the summary is the
 * server's own telemetry of the offline session - nothing here computes a
 * result.
 *
 * Wire format (see the server's `MUIdlePackets`): code 0xEE, a sub code and a
 * UTF-8 JSON payload, in C2 frames.
 */

const CODE = 0xee;

let resumeTimer: ReturnType<typeof setInterval> | null = null;
let mapReadyAt = 0;
EventBus.on('look.mapReady', () => {
  mapReadyAt = Date.now();
});
const SUB_STATE = 0x01;
const SUB_SUMMARY = 0x02;
const SUB_ACTIVITY = 0x03;
const SUB_SAVE_SETTINGS = 0x10;
const SUB_REQUEST_STATE = 0x11;
const SUB_LOCK_ITEM = 0x12;
const SUB_HUNT_MODE = 0x13;

export type IdleSettings = {
  autoTravel: boolean;
  autoMapSelection: boolean;
  preferredMap: number | null;
  autoSell: boolean;
  autoRepair: boolean;
  autoBuyPotions: boolean;
  keepHuntingAfterDeath: boolean;
  autoBuild: boolean;
  sellMaxItemLevel: number;
  lockedItems: string[];
};

export type OfflineSummary = {
  startedUtc: string;
  endedUtc: string | null;
  endReason: string | null;
  startLevel: number;
  endLevel: number;
  startMasterLevel: number;
  endMasterLevel: number;
  startMoney: number;
  endMoney: number;
  monstersKilled: number;
  experience: number;
  masterExperience: number;
  zenEarned: number;
  zenSpent: number;
  itemsCollected: number;
  itemsSold: number;
  repairs: number;
  potionsUsed: number;
  deaths: number;
  mapsVisited: string[];
};

export const DEFAULT_IDLE_SETTINGS: IdleSettings = {
  autoTravel: true,
  autoMapSelection: true,
  preferredMap: null,
  autoSell: true,
  autoRepair: true,
  autoBuyPotions: true,
  keepHuntingAfterDeath: true,
  autoBuild: false,
  sellMaxItemLevel: 4,
  lockedItems: [],
};

class MUIdleStore {
  /** The server's HUNT intent of the character (persisted per character). */
  huntIntent = false;
  /** The server's copy of the idle settings; null until it sent them. */
  settings: IdleSettings | null = null;
  /** A finished offline session waiting to be shown. */
  summary: OfflineSummary | null = null;
  /** Inventory slots of the items the player locked (never auto-sold), as the server mapped them. */
  lockedSlots: number[] = [];
  /** What the hunt is doing now; null until the server said. */
  activity: HuntActivity | null = null;
  /** The maps the hunt can be pinned to, with why not; empty until the server sent them. */
  maps: HuntMapOption[] = [];
  settingsOpen = false;

  constructor() {
    makeAutoObservable(this);
  }

  /** HUNT is the MU Helper running - as the server last said. */
  get hunting(): boolean {
    return Store.muHelper.active;
  }

  onPacket(subCode: number, json: string): void {
    let data: unknown;
    try {
      data = JSON.parse(json);
    } catch {
      console.warn('[muidle] malformed packet', subCode);
      return;
    }
    if (subCode === SUB_STATE) {
      const state = data as {
        hunt?: boolean;
        resume?: boolean;
        settings?: Partial<IdleSettings>;
        lockedSlots?: number[];
        activity?: HuntActivity;
        maps?: HuntMapOption[];
        ground?: { x: number; y: number } | null;
      };
      this.huntIntent = state.hunt === true;
      this.settings = { ...DEFAULT_IDLE_SETTINGS, ...(state.settings ?? {}) };
      this.lockedSlots = Array.isArray(state.lockedSlots) ? state.lockedSlots : [];
      if (Array.isArray(state.maps)) this.maps = state.maps;
      if (state.activity) this.activity = state.activity;
      if (state.resume) this.scheduleResume(state.ground ?? null);
    } else if (subCode === SUB_SUMMARY) {
      this.summary = data as OfflineSummary;
    } else if (subCode === SUB_ACTIVITY) {
      this.activity = data as HuntActivity;
    }
  }

  /**
   * The server asked to resume HUNT (the character was hunting when the
   * player left). The helper loop stops itself in a safezone, and until the
   * terrain of the map arrived every tile reads as one - so the start waits
   * for the map, then for the hero to stand outside the safezone.
   *
   * With a `ground` (the server warped the character to its pinned map) the
   * hero first walks there - on the new map, so after that map has loaded -
   * with the helper paused, which would otherwise fight in town on the way.
   */
  private scheduleResume(ground: { x: number; y: number } | null = null): void {
    if (resumeTimer) clearInterval(resumeTimer);
    const started = Date.now();
    let walkIssuedAt = 0;
    resumeTimer = setInterval(() => {
      const waited = Date.now() - started;
      const hero = Store.world?.playerEntity;
      if (ground) {
        if (mapReadyAt <= started || !hero) {
          if (waited > 30_000) ground = null;
          return;
        }
        const p = Store.playerData;
        const arrived = Math.abs(p.x - ground.x) <= 3 && Math.abs(p.y - ground.y) <= 3;
        if (!arrived && waited < 60_000) {
          if (Store.muHelper.active) Store.toggleMuHelper();
          // Re-issued now and then: a long route is walked in stretches.
          if (Date.now() - walkIssuedAt > 8_000) {
            walkIssuedAt = Date.now();
            const move = hero.playerMoveTo;
            move.point.x = ground.x;
            move.point.y = ground.y;
            move.handled = false;
            move.sendToServer = true;
          }
          return;
        }
        ground = null;
      }
      const ready = mapReadyAt > 0 && Date.now() - mapReadyAt > 1500;
      if (Store.muHelper.active || waited > 90_000) {
        clearInterval(resumeTimer!);
        resumeTimer = null;
        return;
      }
      if (!hero || (!ready && waited < 15_000)) return;
      if (hero.attributeSystem?.isAboveZero('inSafeZone')) {
        // Really in town (died, or warped home): HUNT waits for the player.
        if (waited > 20_000) {
          clearInterval(resumeTimer!);
          resumeTimer = null;
        }
        return;
      }
      clearInterval(resumeTimer!);
      resumeTimer = null;
      this.toggleHunt();
    }, 1000);
  }

  /** The HUNT/MANUAL button. */
  toggleHunt(): void {
    if (Store.isOffline) return;
    const hunting = Store.muHelper.active;
    if (!hunting && Store.world?.playerEntity?.attributeSystem?.isAboveZero('inSafeZone')) {
      Store.addNotification(mt('safeZone'), 'error');
      return;
    }
    // The server flips `muHelper.active` with its answer; the intent is
    // stored right away so a disconnect a second later still knows it.
    Store.toggleMuHelper();
    this.huntIntent = !hunting;
    this.send(SUB_HUNT_MODE, { hunt: !hunting });
  }

  requestState(): void {
    this.send(SUB_REQUEST_STATE, {});
  }

  saveSettings(settings: IdleSettings): void {
    this.send(SUB_SAVE_SETTINGS, settings);
    Store.addNotification(mt('saved'), 'info');
  }

  /** Locks/unlocks the item in an inventory slot; the server answers with the new state. */
  lockItem(slot: number, locked: boolean): void {
    this.send(SUB_LOCK_ITEM, { slot, locked });
  }

  isSlotLocked(slot: number): boolean {
    return this.lockedSlots.includes(slot);
  }

  dismissSummary(): void {
    this.summary = null;
  }

  openSettings(open = !this.settingsOpen): void {
    this.settingsOpen = open;
    if (open && !this.settings) this.requestState();
  }

  private send(subCode: number, payload: unknown): void {
    if (Store.isOffline) return;
    const body = new TextEncoder().encode(JSON.stringify(payload));
    const length = 5 + body.length;
    const bytes = new Uint8Array(length);
    bytes[0] = 0xc2;
    bytes[1] = length >> 8;
    bytes[2] = length & 0xff;
    bytes[3] = CODE;
    bytes[4] = subCode;
    bytes.set(body, 5);
    Store.sendToGS(new DataView(bytes.buffer));
  }
}

export const MUIdle = new MUIdleStore();

EventBus.on('muidlePacket', ({ subCode, json }) => {
  runInAction(() => MUIdle.onPacket(subCode, json));
});
