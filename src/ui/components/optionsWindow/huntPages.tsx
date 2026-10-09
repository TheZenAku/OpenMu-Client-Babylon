import { useState, type ReactNode } from 'react';
import { observable, runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { MuSpriteFrame } from '../muSprite';
import { SkillIcon } from '../skillIcon';
import { uiClick } from '../../../libs/sfx';
import { t } from '../../../i18n';
import { Store } from '../../../store';
import {
  MUIdle,
  DEFAULT_IDLE_SETTINGS,
  huntMapMode,
  withHuntMapMode,
  type HuntMapMode,
  type IdleSettings,
} from '../../../muidle/state';
import { mt, type MUIdleTextKey } from '../../../muidle/text';
import { buildPresets, mapReasonText } from '../../../muidle/settingsLabels';
import { Performance, type PerformanceMode } from '../../../muidle/performance';
import {
  MuHelperState,
  cloneConfig,
  saveMuHelperConfig,
  toggleMuHelperWindow,
} from '../../../muHelper/state';
import {
  MAX_EXTRA_ITEM_CHARS,
  MAX_EXTRA_ITEMS,
  MAX_HUNTING_RANGE,
  MAX_OBTAINING_RANGE,
  type DarkRavenMode,
  type MuHelperConfig,
} from '../../../muHelper/config';
import { isAttackSkill, isBuffSkill } from '../../../muHelper/skillFilters';
import { skillDefinition, type SkillDefinition } from '../../../common/skillsDatabase';
import { skillDisplayName } from '../../../common/skillNames';
import { BaseClass, getBaseClass } from '../../../common/characterStats';
import { itemDisplayName } from '../../../common/itemTooltip';
import { Checkbox, FitText, OptionsButton, Slider, Stepper } from './controls';
import { CONTROL_WIDTH } from './rows';

/**
 * The MU Helper tab of the options window (HUNT v2): the idle settings and the MU Helper configuration
 * of the character in one place - both live on the server, so the pages edit a draft which goes out on
 * Save (or when the window closes). The classic MU Helper window stays for its manual skill slots.
 */

export type HuntPageKind = 'huntGeneral' | 'huntSkills' | 'huntPickup';

/** What the pages changed and did not send yet. */
export const HuntDraft = observable(
  { idle: null as IdleSettings | null, helper: null as MuHelperConfig | null },
  { idle: observable.ref, helper: observable.ref }
);

const idleNow = (): IdleSettings => HuntDraft.idle ?? MUIdle.settings ?? DEFAULT_IDLE_SETTINGS;
const helperNow = (): MuHelperConfig => HuntDraft.helper ?? MuHelperState.config;

function setIdle(patch: Partial<IdleSettings>): void {
  runInAction(() => {
    HuntDraft.idle = { ...idleNow(), ...patch };
  });
}

function editHelper(fn: (draft: MuHelperConfig) => void): void {
  runInAction(() => {
    const next = cloneConfig(helperNow());
    fn(next);
    HuntDraft.helper = next;
  });
}

export function huntDraftDirty(): boolean {
  return HuntDraft.idle !== null || HuntDraft.helper !== null;
}

/**
 * Sends the draft: the MU Helper configuration first, then the idle settings - the server restarts a
 * running hunt on those, which then reads the new configuration.
 */
export function saveHuntDraft(): void {
  const { idle, helper } = HuntDraft;
  if (!idle && !helper) return;
  if (helper) saveMuHelperConfig(helper);
  const settings = idle ?? MUIdle.settings;
  if (settings && !Store.isOffline) {
    MUIdle.saveSettings(settings);
    runInAction(() => {
      MUIdle.settings = settings;
    });
  }
  runInAction(() => {
    HuntDraft.idle = null;
    HuntDraft.helper = null;
  });
}

type HelpFn = (title: string, body: string) => void;

const Row = ({
  label,
  help,
  onHelp,
  onClick,
  indent,
  inert,
  children,
}: {
  label: string;
  help: string;
  onHelp: HelpFn;
  onClick?: () => void;
  indent?: boolean;
  inert?: boolean;
  children?: ReactNode;
}) => (
  <div
    className={[
      'options-row',
      indent && 'is-indented',
      inert && 'is-inert',
      onClick && !inert && 'is-clickable',
    ]
      .filter(Boolean)
      .join(' ')}
    data-no-drag="true"
    onPointerEnter={() => onHelp(label, help)}
    onClick={onClick && !inert ? uiClick(onClick) : undefined}
  >
    <MuSpriteFrame
      file="newui_option_point.OZT"
      width={10}
      height={10}
      className="options-row-bullet"
    />
    <span className="options-row-label">{label}</span>
    <div className="options-row-control" style={{ width: CONTROL_WIDTH }}>
      {children}
    </div>
  </div>
);

const Toggle = (props: {
  label: string;
  help: string;
  onHelp: HelpFn;
  value: boolean;
  onChange: (value: boolean) => void;
  indent?: boolean;
  inert?: boolean;
}) => (
  <Row {...props} onClick={() => props.onChange(!props.value)}>
    <Checkbox checked={props.value} />
  </Row>
);

const Choice = (props: {
  label: string;
  help: string;
  onHelp: HelpFn;
  index: number;
  options: string[];
  onChange: (index: number) => void;
  indent?: boolean;
  inert?: boolean;
}) => (
  <Row {...props}>
    <Stepper
      value={Math.max(0, props.index)}
      min={0}
      max={Math.max(0, props.options.length - 1)}
      text={props.options[Math.max(0, props.index)] ?? ''}
      disabled={!!props.inert}
      width={CONTROL_WIDTH}
      onChange={props.onChange}
    />
  </Row>
);

const Range = (props: {
  label: string;
  help: string;
  onHelp: HelpFn;
  value: number;
  min: number;
  max: number;
  text: string;
  onChange: (value: number) => void;
  indent?: boolean;
  inert?: boolean;
}) => (
  <Row {...props}>
    <Slider
      value={Math.min(Math.max(props.min, props.value), props.max)}
      min={props.min}
      max={props.max}
      disabled={!!props.inert}
      onChange={props.onChange}
    />
    <FitText align="left" className="options-value" style={{ marginLeft: 10, flex: 1 }}>
      {props.text}
    </FitText>
  </Row>
);

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="options-group">
    <div className="options-section">
      <span>{title}</span>
    </div>
    {children}
  </div>
);

/** A percentage threshold in steps of ten, as the MU Helper stores it. */
const Percent = (props: {
  label: string;
  help: string;
  onHelp: HelpFn;
  value: number;
  onChange: (value: number) => void;
  indent?: boolean;
  inert?: boolean;
}) => (
  <Range
    {...props}
    value={Math.round(props.value / 10)}
    min={1}
    max={9}
    text={mt('opt.percentHp', { percent: props.value })}
    onChange={value => props.onChange(value * 10)}
  />
);

const PERFORMANCE_MODES: PerformanceMode[] = ['full', 'reduced', 'minimum', 'auto'];

/** First backpack slot: 0..11 are the equipped items, which are never sold anyway. */
const FIRST_BACKPACK_SLOT = 12;

const LockedItems = observer(({ onHelp }: { onHelp: HelpFn }) => {
  const items = Store.playerData.items
    .map((item, slot) => ({ item, slot }))
    .filter(({ item, slot }) => item && slot >= FIRST_BACKPACK_SLOT);
  if (!items.length) return null;
  return (
    <>
      {items.map(({ item, slot }) => {
        const locked = MUIdle.isSlotLocked(slot);
        return (
          <Toggle
            key={slot}
            indent
            label={`${locked ? '🔒' : '🔓'} ${itemDisplayName(item!)}`}
            help={mt('opt.lock.help')}
            onHelp={onHelp}
            value={locked}
            onChange={value => MUIdle.lockItem(slot, value)}
          />
        );
      })}
    </>
  );
});

/** Caça: switch, map, travel, priorities, merchant, character. */
export const HuntGeneralPage = observer(({ onHelp }: { onHelp: HelpFn }) => {
  const idle = idleNow();
  const helper = helperNow();
  const current = huntMapMode(idle);

  const modes: HuntMapMode[] = ['auto', 'manual', ...MUIdle.maps.filter(m => m.available).map(m => m.number)];
  if (typeof current === 'number' && !modes.includes(current)) modes.push(current);
  const modeLabel = (mode: HuntMapMode) => {
    if (mode === 'auto') return mt('huntMap.auto');
    if (mode === 'manual') return mt('huntMap.manual');
    const map = MUIdle.maps.find(m => m.number === mode);
    if (!map) return `#${mode}`;
    return map.available ? map.name : `${map.name} - ${mapReasonText(map)}`;
  };

  const presets = buildPresets(Store.playerData.charClass);
  const presetIndex = Math.max(0, presets.findIndex(p => p.value === (idle.buildPreset ?? null)));

  return (
    <>
      <Section title={mt('opt.section.hunt')}>
        <Toggle
          label={mt('opt.huntSwitch')}
          help={mt('opt.huntSwitch.help')}
          onHelp={onHelp}
          value={MUIdle.hunting}
          onChange={() => MUIdle.toggleHunt()}
        />
        <Choice
          label={mt('huntMap')}
          help={mt('opt.huntMap.help')}
          onHelp={onHelp}
          index={modes.indexOf(current)}
          options={modes.map(modeLabel)}
          onChange={index => setIdle(withHuntMapMode(idleNow(), modes[index]))}
        />
        <Range
          label={t('muHelper.huntRange')}
          help={mt('opt.huntRange.help')}
          onHelp={onHelp}
          value={helper.huntingRange}
          min={1}
          max={MAX_HUNTING_RANGE}
          text={`${helper.huntingRange}`}
          onChange={value => editHelper(d => (d.huntingRange = value))}
        />
        <Toggle
          label={mt('autoTravel')}
          help={mt('opt.autoTravel.help')}
          onHelp={onHelp}
          value={idle.autoTravel}
          onChange={value => setIdle({ autoTravel: value })}
        />
        <Toggle
          label={mt('keepHuntingAfterDeath')}
          help={mt('opt.keepHunting.help')}
          onHelp={onHelp}
          value={idle.keepHuntingAfterDeath}
          onChange={value => setIdle({ keepHuntingAfterDeath: value })}
        />
      </Section>

      <Section title={mt('opt.section.priorities')}>
        <Toggle
          label={mt('eventsFirst')}
          help={mt('eventsFirst')}
          onHelp={onHelp}
          value={idle.eventsFirst}
          onChange={value => setIdle({ eventsFirst: value })}
        />
        <Toggle
          label={mt('bossesFirst')}
          help={mt('bossesFirst')}
          onHelp={onHelp}
          value={idle.bossesFirst}
          onChange={value => setIdle({ bossesFirst: value })}
        />
        <Toggle
          label={mt('questItemsFirst')}
          help={mt('questItemsFirst')}
          onHelp={onHelp}
          value={idle.questItemsFirst}
          onChange={value => setIdle({ questItemsFirst: value })}
        />
        <Toggle
          label={mt('questsAuto')}
          help={mt('questsAuto')}
          onHelp={onHelp}
          value={idle.questsAuto}
          onChange={value => setIdle({ questsAuto: value })}
        />
      </Section>

      <Section title={mt('opt.section.merchant')}>
        <Toggle
          label={mt('autoSell')}
          help={mt('alwaysKept')}
          onHelp={onHelp}
          value={idle.autoSell}
          onChange={value => setIdle({ autoSell: value })}
        />
        <Range
          label={mt('sellMaxItemLevel', { level: idle.sellMaxItemLevel })}
          help={mt('alwaysKept')}
          onHelp={onHelp}
          indent
          inert={!idle.autoSell}
          value={idle.sellMaxItemLevel}
          min={0}
          max={9}
          text={`+${idle.sellMaxItemLevel}`}
          onChange={value => setIdle({ sellMaxItemLevel: value })}
        />
        <Toggle
          label={mt('autoRepair')}
          help={mt('autoRepair')}
          onHelp={onHelp}
          value={idle.autoRepair}
          onChange={value => setIdle({ autoRepair: value })}
        />
        <Toggle
          label={mt('autoBuyPotions')}
          help={mt('autoBuyPotions')}
          onHelp={onHelp}
          value={idle.autoBuyPotions}
          onChange={value => setIdle({ autoBuyPotions: value })}
        />
      </Section>

      <Section title={mt('lockedItems')}>
        <LockedItems onHelp={onHelp} />
      </Section>

      <Section title={mt('opt.section.character')}>
        <Toggle
          label={mt('autoBuild')}
          help={mt('autoBuild')}
          onHelp={onHelp}
          value={idle.autoBuild}
          onChange={value => setIdle({ autoBuild: value })}
        />
        {presets.length > 0 && (
          <Choice
            label={mt('buildPreset')}
            help={mt('autoBuild')}
            onHelp={onHelp}
            indent
            inert={!idle.autoBuild}
            index={presetIndex}
            options={presets.map(p => mt(p.label))}
            onChange={index => setIdle({ buildPreset: presets[index].value })}
          />
        )}
        <Choice
          label={mt('performance')}
          help={mt('opt.performance.help')}
          onHelp={onHelp}
          index={PERFORMANCE_MODES.indexOf(Performance.mode)}
          options={PERFORMANCE_MODES.map(mode => mt(`perf.${mode}` as MUIdleTextKey))}
          onChange={index => Performance.setMode(PERFORMANCE_MODES[index])}
        />
      </Section>
    </>
  );
});

function learnedSkills(filter: (def: SkillDefinition) => boolean): SkillDefinition[] {
  const seen = new Set<number>();
  const result: SkillDefinition[] = [];
  for (const skill of Store.skills) {
    const def = skillDefinition(skill.number);
    if (!def || !filter(def) || seen.has(def.num)) continue;
    seen.add(def.num);
    result.push(def);
  }
  return result;
}

const skillName = (def: SkillDefinition) => skillDisplayName(def.num) ?? def.name;

/** Skills: automatic skills and combo, the player's order, buffs, potions and healing. */
export const HuntSkillsPage = observer(({ onHelp }: { onHelp: HelpFn }) => {
  const idle = idleNow();
  const helper = helperNow();
  const baseClass = getBaseClass(Store.playerData.charClass);
  const knight = baseClass === BaseClass.Knight;
  const elf = baseClass === BaseClass.Elf;
  const summoner = baseClass === BaseClass.Summoner;
  const darkLord = baseClass === BaseClass.DarkLord;
  const partyClass = baseClass === BaseClass.Wizard || elf;

  const attacks = learnedSkills(isAttackSkill);
  const buffs = learnedSkills(isBuffSkill);
  const custom = idle.skillOrder.length > 0;
  const strongestFirst = attacks.slice().sort((a, b) => b.damage - a.damage);
  const ordered = custom
    ? [
        ...idle.skillOrder.flatMap(num => attacks.filter(def => def.num === num)),
        ...strongestFirst.filter(def => !idle.skillOrder.includes(def.num)),
      ]
    : strongestFirst;

  const move = (index: number, delta: number) => {
    const list = ordered.map(def => def.num);
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    setIdle({ skillOrder: list });
  };

  return (
    <>
      <Section title={mt('opt.section.attack')}>
        <Toggle
          label={mt('opt.autoSkills')}
          help={mt('opt.autoSkills.help')}
          onHelp={onHelp}
          value={idle.autoSkills}
          onChange={value => setIdle({ autoSkills: value })}
        />
        {knight && (
          <Toggle
            label={mt('opt.autoCombo')}
            help={mt('opt.autoCombo.help')}
            onHelp={onHelp}
            value={idle.autoCombo}
            onChange={value => setIdle({ autoCombo: value })}
          />
        )}
        {idle.autoSkills ? (
          <>
            <Toggle
              label={mt('opt.customOrder')}
              help={mt('opt.customOrder.help')}
              onHelp={onHelp}
              inert={attacks.length === 0}
              value={custom}
              onChange={value =>
                setIdle({ skillOrder: value ? strongestFirst.map(def => def.num) : [] })
              }
            />
            {attacks.length === 0 && (
              <div className="options-empty hunt-note">{mt('opt.noAttackSkills')}</div>
            )}
            {custom &&
              ordered.map((def, i) => (
                <div
                  key={def.num}
                  className="options-row is-indented hunt-skill-row"
                  data-no-drag="true"
                  onPointerEnter={() => onHelp(skillName(def), mt('opt.skill.help'))}
                >
                  <span className="hunt-skill-rank">{i + 1}.</span>
                  <div className="hunt-skill-icon">
                    <SkillIcon number={def.num} />
                  </div>
                  <span className="options-row-label">{skillName(def)}</span>
                  <button
                    type="button"
                    className="hunt-skill-move"
                    title={mt('opt.moveUp')}
                    disabled={i === 0}
                    onClick={uiClick(() => move(i, -1))}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="hunt-skill-move"
                    title={mt('opt.moveDown')}
                    disabled={i === ordered.length - 1}
                    onClick={uiClick(() => move(i, 1))}
                  >
                    ▼
                  </button>
                </div>
              ))}
          </>
        ) : (
          <div className="options-empty hunt-note">{mt('opt.manualSkills')}</div>
        )}
      </Section>

      <Section title={mt('opt.section.buffs')}>
        {idle.autoSkills ? (
          <Row label={mt('opt.autoBuffs')} help={mt('opt.autoBuffs.help')} onHelp={onHelp}>
            <FitText align="left" className="options-value" style={{ width: '100%' }}>
              {buffs.length ? buffs.map(skillName).join(', ') : mt('opt.noBuffs')}
            </FitText>
          </Row>
        ) : (
          <div className="options-empty hunt-note">{mt('opt.manualSkills')}</div>
        )}
        {partyClass && (
          <Toggle
            label={t('muHelper.supportParty')}
            help={t('muHelper.supportParty')}
            onHelp={onHelp}
            value={helper.supportParty}
            onChange={value => editHelper(d => (d.supportParty = value))}
          />
        )}
      </Section>

      <Section title={mt('opt.section.recovery')}>
        <Toggle
          label={t('muHelper.potion')}
          help={t('muHelper.potion')}
          onHelp={onHelp}
          value={helper.useHealPotion}
          onChange={value => editHelper(d => (d.useHealPotion = value))}
        />
        <Percent
          label=""
          help={t('muHelper.potion')}
          onHelp={onHelp}
          indent
          inert={!helper.useHealPotion}
          value={helper.potionThreshold}
          onChange={value => editHelper(d => (d.potionThreshold = value))}
        />
        {elf && (
          <>
            <Toggle
              label={t('muHelper.autoHeal')}
              help={t('muHelper.autoHeal')}
              onHelp={onHelp}
              value={helper.autoHeal}
              onChange={value => editHelper(d => (d.autoHeal = value))}
            />
            <Percent
              label=""
              help={t('muHelper.autoHeal')}
              onHelp={onHelp}
              indent
              inert={!helper.autoHeal}
              value={helper.healThreshold}
              onChange={value => editHelper(d => (d.healThreshold = value))}
            />
            <Toggle
              label={t('muHelper.partyHeal')}
              help={t('muHelper.partyHeal')}
              onHelp={onHelp}
              value={helper.autoHealParty}
              onChange={value => editHelper(d => (d.autoHealParty = value))}
            />
            <Percent
              label=""
              help={t('muHelper.partyHeal')}
              onHelp={onHelp}
              indent
              inert={!helper.autoHealParty}
              value={helper.healPartyThreshold}
              onChange={value => editHelper(d => (d.healPartyThreshold = value))}
            />
          </>
        )}
        {summoner && (
          <Toggle
            label={t('muHelper.drainLife')}
            help={t('muHelper.drainLife')}
            onHelp={onHelp}
            value={helper.useDrainLife}
            onChange={value => editHelper(d => (d.useDrainLife = value))}
          />
        )}
        {darkLord && (
          <>
            <Toggle
              label={t('muHelper.useRaven')}
              help={t('muHelper.useRaven')}
              onHelp={onHelp}
              value={helper.useDarkRaven}
              onChange={value => editHelper(d => (d.useDarkRaven = value))}
            />
            <Choice
              label=""
              help={t('muHelper.useRaven')}
              onHelp={onHelp}
              indent
              inert={!helper.useDarkRaven}
              index={helper.darkRavenMode}
              options={[t('muHelper.ravenCease'), t('muHelper.ravenAuto'), t('muHelper.ravenTogether')]}
              onChange={index => editHelper(d => (d.darkRavenMode = index as DarkRavenMode))}
            />
          </>
        )}
      </Section>

      <Section title={mt('opt.section.manual')}>
        <Row label={mt('opt.classicHelper')} help={mt('opt.classicHelper.help')} onHelp={onHelp}>
          <OptionsButton
            label={mt('opt.open')}
            width={96}
            onClick={() => toggleMuHelperWindow(true)}
            style={{ left: 0, top: -5 }}
          />
        </Row>
      </Section>
    </>
  );
});

/** Coleta: pickup range and filters, field repair, extra items. */
export const HuntPickupPage = observer(({ onHelp }: { onHelp: HelpFn }) => {
  const helper = helperNow();
  const [itemName, setItemName] = useState('');

  const pick = (label: string, value: boolean, set: (d: MuHelperConfig, v: boolean) => void, indent = false) => (
    <Toggle
      key={label}
      label={label}
      help={label}
      onHelp={onHelp}
      indent={indent}
      inert={indent && !helper.pickSelectedItems}
      value={value}
      onChange={v => editHelper(d => set(d, v))}
    />
  );

  const addItem = () => {
    const name = itemName.trim().slice(0, MAX_EXTRA_ITEM_CHARS);
    if (!name) return;
    editHelper(d => {
      if (d.extraItems.length < MAX_EXTRA_ITEMS && !d.extraItems.includes(name)) d.extraItems.push(name);
    });
    setItemName('');
  };

  return (
    <>
      <Section title={mt('opt.section.pickup')}>
        <Range
          label={t('muHelper.obtainRange')}
          help={t('muHelper.obtainRange')}
          onHelp={onHelp}
          value={helper.obtainRange}
          min={1}
          max={MAX_OBTAINING_RANGE}
          text={`${helper.obtainRange}`}
          onChange={value => editHelper(d => (d.obtainRange = value))}
        />
        {pick(t('muHelper.pickAll'), helper.pickAllItems, (d, v) => (d.pickAllItems = v))}
        {pick(t('muHelper.pickSelected'), helper.pickSelectedItems, (d, v) => (d.pickSelectedItems = v))}
        {pick(t('muHelper.pickZen'), helper.pickZen, (d, v) => (d.pickZen = v), true)}
        {pick(t('muHelper.pickJewel'), helper.pickJewel, (d, v) => (d.pickJewel = v), true)}
        {pick(t('muHelper.pickExcellent'), helper.pickExcellent, (d, v) => (d.pickExcellent = v), true)}
        {pick(t('muHelper.pickAncient'), helper.pickAncient, (d, v) => (d.pickAncient = v), true)}
        {pick(t('muHelper.repair'), helper.repairItem, (d, v) => (d.repairItem = v))}
      </Section>

      <Section title={mt('opt.section.extra')}>
        {pick(t('muHelper.pickExtra'), helper.pickExtraItems, (d, v) => (d.pickExtraItems = v))}
        <div className="options-row is-indented hunt-extra-add" data-no-drag="true">
          <input
            className="hunt-extra-input"
            type="text"
            maxLength={MAX_EXTRA_ITEM_CHARS}
            placeholder={t('muHelper.itemName')}
            value={itemName}
            onKeyDown={event => {
              event.stopPropagation();
              if (event.key === 'Enter') addItem();
            }}
            onChange={event => setItemName(event.target.value)}
          />
          <button type="button" className="hunt-extra-button" onClick={uiClick(addItem)}>
            {t('muHelper.addItem')}
          </button>
        </div>
        {helper.extraItems.map((name, i) => (
          <div key={`${name}-${i}`} className="options-row is-indented hunt-extra-row" data-no-drag="true">
            <span className="options-row-label">{name}</span>
            <button
              type="button"
              className="hunt-extra-button"
              onClick={uiClick(() => editHelper(d => void d.extraItems.splice(i, 1)))}
            >
              {t('muHelper.removeItem')}
            </button>
          </div>
        ))}
      </Section>
    </>
  );
});

export const HUNT_PAGES: Record<HuntPageKind, (props: { onHelp: HelpFn }) => ReactNode> = {
  huntGeneral: props => <HuntGeneralPage {...props} />,
  huntSkills: props => <HuntSkillsPage {...props} />,
  huntPickup: props => <HuntPickupPage {...props} />,
};
