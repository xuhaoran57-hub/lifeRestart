import type { GameContent, Talent, TalentCategory, TalentRarity } from '../app/types';
import { evaluateCondition, type ConditionContext } from './condition';
import { Random, shuffle } from './random';

export type TalentRarityRates = Record<TalentRarity, number>;

const rarityOrder: TalentRarity[] = ['common', 'rare', 'epic', 'legendary'];
const categoryOrder: TalentCategory[] = ['family', 'aptitude', 'habit', 'relation', 'route', 'exam', 'volunteer'];
const rarityByGrade: TalentRarity[] = ['common', 'rare', 'epic', 'legendary'];

const baseRarityRates: TalentRarityRates = {
  common: 70,
  rare: 20,
  epic: 8,
  legendary: 2,
};

const fullAchievementRarityRates: TalentRarityRates = {
  common: 60,
  rare: 25,
  epic: 11,
  legendary: 4,
};

export function getTalentMap(content: GameContent): Map<number, Talent> {
  return new Map(content.talents.map(item => [item.id, item]));
}

export function hasTalentConflict(talent: Talent, selectedIds: number[], talentMap: Map<number, Talent>): boolean {
  if (talent.exclude?.some(id => selectedIds.includes(id))) return true;
  return selectedIds.some(id => talentMap.get(id)?.exclude?.includes(talent.id));
}

export function validateTalentSelection(ids: number[], content: GameContent): string | null {
  if (ids.length !== 3) return '请选择 3 个天赋';
  if (new Set(ids).size !== ids.length) return '天赋不能重复选择';
  const talentMap = getTalentMap(content);
  for (const id of ids) {
    if (!talentMap.has(id)) return `天赋 ${id} 不存在`;
    const others = ids.filter(item => item !== id);
    if (hasTalentConflict(talentMap.get(id)!, others, talentMap)) return '选择中存在互斥天赋';
  }
  return null;
}

export function drawTalentCandidates(
  content: GameContent,
  count = 10,
  inheritedTalentId: number | null = null,
  seed = Date.now(),
  achievedIds: number[] = [],
): Talent[] {
  const random = new Random(seed);
  const inherited = inheritedTalentId
    ? content.talents.find(item => item.id === inheritedTalentId) ?? null
    : null;
  const talentMap = getTalentMap(content);
  const availableTalents = content.talents.filter(item =>
    item.id !== inherited?.id
    && (!inherited || !hasTalentConflict(item, [inherited.id], talentMap))
  );
  const pools = buildRarityPools(availableTalents, random);
  const rates = getTalentRarityRates(content, achievedIds);
  const drawCount = Math.max(0, inherited ? count - 1 : count);
  const candidates: Talent[] = [];

  for (let index = 0; index < drawCount; index += 1) {
    const rarity = rollTalentRarity(rates, random);
    const picked = takeTalentByRarity(rarity, pools);
    if (picked) candidates.push(picked);
  }

  const result = inherited ? [inherited, ...candidates] : candidates;
  return improveCategoryDiversity(result, pools, inherited ? 1 : 0);
}

export function canTriggerTalent(talent: Talent, context: ConditionContext): boolean {
  return evaluateCondition(talent.condition, context);
}

export function getTalentRarityRates(content: GameContent, achievedIds: number[] = []): TalentRarityRates {
  const achievementIds = new Set(content.achievements.map(item => item.id));
  const unlockedCount = new Set(achievedIds.filter(id => achievementIds.has(id))).size;
  const progress = content.achievements.length > 0
    ? clamp(unlockedCount / content.achievements.length, 0, 1)
    : 0;

  return {
    common: lerp(baseRarityRates.common, fullAchievementRarityRates.common, progress),
    rare: lerp(baseRarityRates.rare, fullAchievementRarityRates.rare, progress),
    epic: lerp(baseRarityRates.epic, fullAchievementRarityRates.epic, progress),
    legendary: lerp(baseRarityRates.legendary, fullAchievementRarityRates.legendary, progress),
  };
}

export function rollTalentRarity(rates: TalentRarityRates, random: Random): TalentRarity {
  let cursor = random.next() * 100;
  for (const rarity of rarityOrder) {
    cursor -= rates[rarity];
    if (cursor <= 0) return rarity;
  }
  return 'legendary';
}

function buildRarityPools(talents: Talent[], random: Random): Record<TalentRarity, Talent[]> {
  return {
    common: shuffle(talents.filter(item => getTalentRarity(item) === 'common'), random),
    rare: shuffle(talents.filter(item => getTalentRarity(item) === 'rare'), random),
    epic: shuffle(talents.filter(item => getTalentRarity(item) === 'epic'), random),
    legendary: shuffle(talents.filter(item => getTalentRarity(item) === 'legendary'), random),
  };
}

function takeTalentByRarity(rarity: TalentRarity, pools: Record<TalentRarity, Talent[]>): Talent | null {
  for (const fallback of fallbackRarities(rarity)) {
    const picked = pools[fallback].pop();
    if (picked) return picked;
  }
  return null;
}

function fallbackRarities(rarity: TalentRarity): TalentRarity[] {
  const index = rarityOrder.indexOf(rarity);
  return [
    rarity,
    ...rarityOrder.slice(0, index).reverse(),
    ...rarityOrder.slice(index + 1),
  ];
}

function improveCategoryDiversity(
  candidates: Talent[],
  pools: Record<TalentRarity, Talent[]>,
  lockedCount: number,
): Talent[] {
  if (candidates.length < 4) return candidates;

  const result = [...candidates];
  const minCategoryCount = Math.min(4, result.length);
  for (const category of categoryOrder) {
    if (new Set(result.map(getTalentCategory)).size >= minCategoryCount) break;
    if (result.some(item => getTalentCategory(item) === category)) continue;

    const replaceIndex = findReplaceableDuplicateCategoryIndex(result, lockedCount);
    if (replaceIndex < 0) break;

    const replacement = takeTalentByCategory(category, getTalentRarity(result[replaceIndex]), pools);
    if (replacement) result[replaceIndex] = replacement;
  }
  return result;
}

function findReplaceableDuplicateCategoryIndex(candidates: Talent[], lockedCount: number): number {
  const counts = candidates.reduce<Record<string, number>>((result, talent) => {
    const category = getTalentCategory(talent);
    result[category] = (result[category] ?? 0) + 1;
    return result;
  }, {});

  for (let index = candidates.length - 1; index >= lockedCount; index -= 1) {
    if ((counts[getTalentCategory(candidates[index])] ?? 0) > 1) return index;
  }
  return -1;
}

function takeTalentByCategory(
  category: TalentCategory,
  preferredRarity: TalentRarity,
  pools: Record<TalentRarity, Talent[]>,
): Talent | null {
  for (const rarity of fallbackRarities(preferredRarity)) {
    const index = pools[rarity].findIndex(item => getTalentCategory(item) === category);
    if (index >= 0) return pools[rarity].splice(index, 1)[0];
  }
  return null;
}

function getTalentRarity(talent: Talent): TalentRarity {
  return talent.rarity ?? rarityByGrade[talent.grade] ?? 'common';
}

function getTalentCategory(talent: Talent): TalentCategory {
  return talent.category ?? 'aptitude';
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
