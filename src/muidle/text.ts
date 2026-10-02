import { i18n } from '../i18n';

/**
 * MUIdle's own strings. Kept out of the game's catalogue (`i18n/recipes.ts`)
 * on purpose: a key there must be translated into every shipped language,
 * these are English and Portuguese only and fall back to English.
 */
const EN = {
  hunt: 'HUNT',
  manual: 'MANUAL',
  huntHint: 'Auto hunting - keeps going on the server when you leave',
  manualHint: 'You control the character',
  safeZone: 'Leave the safe zone to start HUNT',
  idleSettings: 'Idle Settings',
  helperSettings: 'Skills, potions & loot filters…',
  autoTravel: 'Auto travel (walk to hunting grounds)',
  autoMapSelection: 'Automatic map selection (warp by level)',
  keepHuntingAfterDeath: 'Keep hunting after death',
  autoSell: 'Auto sell junk at merchants',
  autoRepair: 'Auto repair at merchants',
  autoBuyPotions: 'Auto buy potions',
  sellMaxItemLevel: 'Junk = plain weapons/armor up to +{level}',
  alwaysKept: 'Never sold: equipped, excellent, ancient, socket, wings, jewels, locked items',
  save: 'Save',
  close: 'Close',
  saved: 'Idle settings saved',
  offlineProgress: 'OFFLINE PROGRESS',
  offlineTime: 'Time offline',
  monsters: 'Monsters defeated',
  experience: 'Experience',
  levels: 'Levels gained',
  masterExperience: 'Master experience',
  zenEarned: 'Zen earned',
  zenSpent: 'Zen spent',
  itemsCollected: 'Items collected',
  itemsSold: 'Items sold',
  repairs: 'Repairs',
  potions: 'Potions used',
  deaths: 'Deaths',
  maps: 'Maps visited',
  endReason: 'Ended',
  'reason.returned': 'you returned',
  'reason.died': 'the character died',
  'reason.allowance': 'offline time limit reached',
  'reason.interrupted': 'server interrupted',
  'reason.zen': 'out of zen',
  ok: 'OK',
  lock: 'Lock item',
  unlock: 'Unlock item',
  cp: 'CP',
} as const;

export type MUIdleTextKey = keyof typeof EN;

const PT: Partial<Record<MUIdleTextKey, string>> = {
  hunt: 'CAÇAR',
  manual: 'MANUAL',
  huntHint: 'Caça automática - continua no servidor quando você sai',
  manualHint: 'Você controla o personagem',
  safeZone: 'Saia da zona segura para iniciar a caça',
  idleSettings: 'Configurações Idle',
  helperSettings: 'Skills, poções e filtros de loot…',
  autoTravel: 'Viagem automática (ir até áreas de caça)',
  autoMapSelection: 'Seleção automática de mapa (warp por nível)',
  keepHuntingAfterDeath: 'Continuar caçando após morrer',
  autoSell: 'Vender lixo automaticamente',
  autoRepair: 'Reparar automaticamente no NPC',
  autoBuyPotions: 'Comprar poções automaticamente',
  sellMaxItemLevel: 'Lixo = armas/armaduras comuns até +{level}',
  alwaysKept: 'Nunca vendidos: equipados, excellent, ancient, socket, asas, joias, itens travados',
  save: 'Salvar',
  close: 'Fechar',
  saved: 'Configurações idle salvas',
  offlineProgress: 'PROGRESSO OFFLINE',
  offlineTime: 'Tempo offline',
  monsters: 'Monstros derrotados',
  experience: 'Experiência',
  levels: 'Níveis obtidos',
  masterExperience: 'Master XP',
  zenEarned: 'Zen ganho',
  zenSpent: 'Zen gasto',
  itemsCollected: 'Itens coletados',
  itemsSold: 'Itens vendidos',
  repairs: 'Reparos',
  potions: 'Poções usadas',
  deaths: 'Mortes',
  maps: 'Mapas visitados',
  endReason: 'Encerrado',
  'reason.returned': 'você voltou',
  'reason.died': 'o personagem morreu',
  'reason.allowance': 'limite de tempo offline',
  'reason.interrupted': 'servidor interrompido',
  'reason.zen': 'sem zen',
  ok: 'OK',
  lock: 'Travar item',
  unlock: 'Destravar item',
};

export function mt(key: MUIdleTextKey, params?: Record<string, string | number>): string {
  const table = i18n.language === 'pt' ? PT : EN;
  let text: string = table[key] ?? EN[key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(`{${name}}`, String(value));
    }
  }
  return text;
}
