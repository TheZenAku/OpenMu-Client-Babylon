/**
 * The public ranking: the top 100 characters by resets, then level, then
 * master level, from OpenMU's own tables. Read with the account role, which
 * sees the `data` schema only: the level/resets/master level attributes are
 * found by their fixed ids (OpenMU's `Stats`), the class by its id, whose
 * second group is the class number (`00000040-0004-...` = Dark Knight).
 * Answered from a one-minute cache - it is a board, not a live feed.
 */

const LEVEL = '560931ad-0901-4342-b7f4-fd2e2fcc0563';
const RESETS = '89a891a7-f9f9-4ab5-af36-12056e53a5f7';
const MASTER_LEVEL = '70cd8c10-391a-4c51-9aa4-a854600e3a9f';

export const RANKING_SIZE = 100;
const CACHE_MS = 60_000;

/** Class lines, by the first class number of each (evolutions follow it). */
export const CLASS_LINES: Readonly<Record<string, readonly [number, number]>> = {
  wizard: [0, 3],
  knight: [4, 7],
  elf: [8, 11],
  gladiator: [12, 15],
  lord: [16, 19],
  summoner: [20, 23],
  fighter: [24, 27],
};

export type RankingEntry = {
  rank: number;
  name: string;
  classNumber: number;
  level: number;
  resets: number;
  masterLevel: number;
};

/** The class number in an OpenMU character class id, or -1. */
export function classNumberOf(id: string): number {
  const match = /^00000040-([0-9a-f]{4})-/i.exec(id);
  return match ? parseInt(match[1], 16) : -1;
}

/** Ranks rows (already ordered) within one class line, or all when none is given. */
export function rank(rows: Omit<RankingEntry, 'rank'>[], line?: string): RankingEntry[] {
  const range = line ? CLASS_LINES[line] : undefined;
  return rows
    .filter(r => !range || (r.classNumber >= range[0] && r.classNumber <= range[1]))
    .slice(0, RANKING_SIZE)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>;

let cache: { at: number; rows: Omit<RankingEntry, 'rank'>[] } | null = null;

/** All characters, best first (resets, level, master level, name). */
async function load(sql: Sql): Promise<Omit<RankingEntry, 'rank'>[]> {
  const rows = await sql`
    SELECT c."Name" AS name, c."CharacterClassId"::text AS class_id,
           COALESCE(lv."Value", 0) AS level, COALESCE(rs."Value", 0) AS resets, COALESCE(ml."Value", 0) AS master_level
    FROM data."Character" c
    LEFT JOIN data."StatAttribute" lv ON lv."CharacterId" = c."Id" AND lv."DefinitionId" = ${LEVEL}::uuid
    LEFT JOIN data."StatAttribute" rs ON rs."CharacterId" = c."Id" AND rs."DefinitionId" = ${RESETS}::uuid
    LEFT JOIN data."StatAttribute" ml ON ml."CharacterId" = c."Id" AND ml."DefinitionId" = ${MASTER_LEVEL}::uuid
    ORDER BY resets DESC, level DESC, master_level DESC, c."Name"`;
  return rows.map(r => ({
    name: String(r.name),
    classNumber: classNumberOf(String(r.class_id)),
    level: Number(r.level),
    resets: Number(r.resets),
    masterLevel: Number(r.master_level),
  }));
}

/** The ranking, from the cache when it is fresh. */
export async function ranking(sql: Sql, line?: string, now = Date.now()): Promise<{ updated: number; entries: RankingEntry[] }> {
  if (!cache || now - cache.at > CACHE_MS) cache = { at: now, rows: await load(sql) };
  return { updated: cache.at, entries: rank(cache.rows, line) };
}
