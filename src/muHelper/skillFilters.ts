import type { SkillDefinition } from '../common/skillsDatabase';

/** `FilterByAttackSkills`: what an attack slot may hold. */
export function isAttackSkill(def: SkillDefinition): boolean {
  return (
    (def.type === 'DirectHit' ||
      def.type === 'AreaSkillAutomaticHits' ||
      def.type === 'AreaSkillExplicitTarget') &&
    (def.damage > 0 || def.damageType !== 'None')
  );
}

/** `FilterByBuffSkills`: what a buff slot may hold. */
export function isBuffSkill(def: SkillDefinition): boolean {
  return def.type === 'Buff' || def.type === 'Regeneration';
}
