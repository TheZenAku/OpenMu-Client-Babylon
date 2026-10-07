import { makeAutoObservable, runInAction } from 'mobx';
import { EventBus } from '../libs/eventBus';
import { Store } from '../store';
import { mt } from './text';
import { type HuntActivity, type HuntMapOption } from './huntMap';
import { parseMixPreview, type MixPreview } from './mixOdds';

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
const SUB_MIX_PREVIEW = 0x04;
const SUB_SAVE_SETTINGS = 0x10;
const SUB_REQUEST_STATE = 0x11;
const SUB_LOCK_ITEM = 0x12;
const SUB_HUNT_MODE = 0x13;
const SUB_RESET = 0x14;
const SUB_REQUEST_MIX_PREVIEW = 0x15;

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
  /** HUNT enters an event when it opens and the character is ready for it (ticket, level, zen). */
  eventsFirst: boolean;
  /** The events (`bloodCastle`, `devilSquare`, `chaosCastle`) the player took out of that. */
  eventOptOut: string[];
  /** HUNT goes to a live world boss of the character's level. */
  bossesFirst: boolean;
  /** HUNT on AUTO prefers the monsters that drop the missing item of the class quest. */
  questItemsFirst: boolean;
  /** HUNT accepts the class quests at their giver (paying the start fee) and hands them in. */
  questsAuto: boolean;
  /** Auto build preset (Elf "support", MG "energy", DL "raven"); null for the class default. */
  buildPreset: string | null;
};

/** Why the character cannot join an event now, as the server judged it. */
export type EventReason = 'level' | 'ticket' | 'zen' | 'master' | 'equipment';

/** The season and the character's next reset, as the server computed them. */
export type ProgressionInfo = {
  season: number;
  week: number;
  /** The most resets allowed this week; null without a limit. */
  resetCap: number | null;
  nextRaiseUtc: string | null;
  resetsPerWeek: number;
  resets: number;
  level: number;
  requiredLevel: number | null;
  requiredZen: number | null;
  levelAfterReset: number | null;
  canReset: boolean;
  reason: 'disabled' | 'level' | 'cap' | 'zen' | null;
  /** The catch-up and newcomer experience bonus the server gives, as fractions (0.1 = +10 %). */
  bonus: { catchUp: number; newcomer: number; total: number } | null;
};

/** The class quest line as the server sees it (read-only; see QUEST_AUTOMATION.md). */
export type QuestInfo = {
  finished: boolean;
  name?: string;
  active?: boolean;
  minLevel?: number;
  canAccept?: boolean;
  /** Everything it needs is there: hand it in at the giver. */
  done?: boolean;
  /** Zen the giver takes to start the quest. */
  startZen?: number;
  /** What HUNT does about the quest (server-judged). */
  automation?: 'off' | 'manual' | 'handIn' | 'collecting' | 'level' | 'zen' | 'accept';
  giver?: { name: string; map: string | null; x: number; y: number } | null;
  items?: { name: string; have: number; need: number; minMonsterLevel: number | null; maxMonsterLevel: number | null; monster: string | null }[];
  kills?: { monster: string; have: number; need: number }[];
};

/** One daily contract and how far it is (the server counts and pays). */
export type ContractInfo = {
  kind: 'kills' | 'mapKills' | 'huntMinutes';
  target: number;
  progress: number;
  mapName: string | null;
  rewardZen: number;
  rewarded: boolean;
};

/** A world boss: alive now (where) or when it comes next. */
export type WorldBossInfo = {
  name: string;
  map: string;
  minimumLevel: number;
  rewardZen: number;
  alive: boolean;
  x: number | null;
  y: number | null;
  nextSpawnUtc: string | null;
};

/** An event MUIdle can join for the character: enrolled (not opted out) and ready or why not. */
export type EventInfo = {
  key: string;
  enrolled: boolean;
  ready: boolean;
  reason: EventReason | null;
  /** The equipped item the event refuses, when that is the reason. */
  item?: string | null;
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
  /** What each map earned (servers before the per-map breakdown do not send it). */
  mapRates?: MapRate[];
};

/** What one map earned during the offline session. */
export type MapRate = {
  map: string;
  minutes: number;
  experience: number;
  zen: number;
  kills: number;
  deaths: number;
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
  eventsFirst: true,
  eventOptOut: [],
  bossesFirst: true,
  questItemsFirst: true,
  questsAuto: false,
  buildPreset: null,
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
  /** The events HUNT can join, as the server judged them for this character. */
  events: EventInfo[] = [];
  /** The world bosses of the server. */
  bosses: WorldBossInfo[] = [];
  /** The season and the next reset; null until the server sent them. */
  progression: ProgressionInfo | null = null;
  /** Today's daily contracts (UTC day). */
  contracts: ContractInfo[] = [];
  /** The class quest line; null until the server sent it. */
  quest: QuestInfo | null = null;
  /** The odds of the mix in the Chaos Machine, as the server last reported them. */
  mixPreview: MixPreview | null = null;
  progressionOpen = false;
  settingsOpen = false;
  eventsOpen = false;

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
        events?: EventInfo[];
        bosses?: WorldBossInfo[];
        progression?: ProgressionInfo;
        contracts?: { day: string; contracts: ContractInfo[] };
        quest?: QuestInfo | null;
        ground?: { x: number; y: number } | null;
      };
      this.huntIntent = state.hunt === true;
      this.settings = { ...DEFAULT_IDLE_SETTINGS, ...(state.settings ?? {}) };
      this.lockedSlots = Array.isArray(state.lockedSlots) ? state.lockedSlots : [];
      if (Array.isArray(state.maps)) this.maps = state.maps;
      if (Array.isArray(state.events)) this.events = state.events;
      if (Array.isArray(state.bosses)) this.bosses = state.bosses;
      if (state.progression) this.progression = state.progression;
      if (state.contracts && Array.isArray(state.contracts.contracts)) this.contracts = state.contracts.contracts;
      if (state.activity) this.activity = state.activity;
      if (state.quest !== undefined) this.quest = state.quest;
      if (state.resume) this.scheduleResume(state.ground ?? null);
    } else if (subCode === SUB_SUMMARY) {
      this.summary = data as OfflineSummary;
    } else if (subCode === SUB_ACTIVITY) {
      this.activity = data as HuntActivity;
    } else if (subCode === SUB_MIX_PREVIEW) {
      this.mixPreview = parseMixPreview(data);
    }
  }

  /**
   * The server asked to resume HUNT (the character was hunting when the
   * player left). The helper loop stops itself in a safezone, and until the
   * terrain of the map arrived every tile reads as one - so the start waits
   * for the map, then for the hero to stand outside the safezone.
   *
   * With a `ground` (the server warped the character to its pinned map) the
   * hero first walks there, with the helper paused, which would otherwise
   * fight in town on the way.
   */
  private scheduleResume(ground: { x: number; y: number } | null = null): void {
    if (resumeTimer) clearInterval(resumeTimer);
    const started = Date.now();
    let walkIssuedAt = 0;
    resumeTimer = setInterval(() => {
      const waited = Date.now() - started;
      const hero = Store.world?.playerEntity;
      if (ground) {
        // The state comes after the map entry, so the map may have loaded before it; a walk sent
        // before the terrain is there goes nowhere and is simply sent again below.
        if (mapReadyAt === 0 || !hero) {
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
      // The server takes the hunt out of town - a warp to a pinned map, else a walk to a hunting
      // ground of this map - and HUNT starts on arrival (the helper does not run in a safezone).
      this.huntIntent = true;
      this.send(SUB_HUNT_MODE, { hunt: true });
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

  openProgression(open = !this.progressionOpen): void {
    this.progressionOpen = open;
    if (open) this.requestState();
  }

  /** Asks the server to reset the character; its reset feature checks and does everything. */
  requestReset(): void {
    this.send(SUB_RESET, {});
    this.progressionOpen = false;
  }

  /** Asks the server for the odds of a mix of the items in the Chaos Machine (`mixType`: the picked recipe). */
  requestMixPreview(mixType: number): void {
    this.send(SUB_REQUEST_MIX_PREVIEW, { mixType });
  }

  openEvents(open = !this.eventsOpen): void {
    this.eventsOpen = open;
    if (open) this.requestState();
  }

  /** Takes an event in or out of the automatic entry, and saves. */
  setEventEnrolled(key: string, enrolled: boolean): void {
    const current = this.settings ?? DEFAULT_IDLE_SETTINGS;
    const optOut = current.eventOptOut.filter(k => k !== key);
    if (!enrolled) optOut.push(key);
    this.saveSettings({ ...current, eventOptOut: optOut });
  }

  setQuestsAuto(on: boolean): void {
    this.saveSettings({ ...(this.settings ?? DEFAULT_IDLE_SETTINGS), questsAuto: on });
  }

  setQuestItemsFirst(on: boolean): void {
    this.saveSettings({ ...(this.settings ?? DEFAULT_IDLE_SETTINGS), questItemsFirst: on });
  }

  setBossesFirst(on: boolean): void {
    this.saveSettings({ ...(this.settings ?? DEFAULT_IDLE_SETTINGS), bossesFirst: on });
  }

  setEventsFirst(on: boolean): void {
    this.saveSettings({ ...(this.settings ?? DEFAULT_IDLE_SETTINGS), eventsFirst: on });
  }

  openSettings(open = !this.settingsOpen): void {
    this.settingsOpen = open;
    // Every time: the map choices are judged by the server for the character as it is now - its
    // level, zen and equipment (new wings open Icarus) - not as it was at login.
    if (open) this.requestState();
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
