import type { Allocation, FinalResult, GameContent, Talent, TalentRarity } from '../app/types';
import { LifeEngine } from './life';
import { Random } from './random';
import { drawTalentCandidates, validateTalentSelection } from './talents';

export interface SimulationResult {
  runs: number;
  errors: number;
  endings: Record<string, number>;
  averageHSCR: number;
  averageVOL: number;
  averageRSK: number;
  samples: FinalResult[];
}

export function randomAllocation(random: Random): Allocation {
  const values: Allocation = { INT: 0, STR: 0, MNY: 0, SPR: 0 };
  const keys = Object.keys(values) as Array<keyof Allocation>;
  for (let index = 0; index < 20; index += 1) {
    values[keys[random.int(keys.length)]] += 1;
  }
  return values;
}

export function randomTalentSelection(content: GameContent, random: Random): number[] {
  const candidates = drawTalentCandidates(content, 10, null, random.int(0x7fffffff));
  const ranked = rankTalentCandidates(candidates, random);
  const selected: number[] = [];
  for (const talent of ranked) {
    const next = [...selected, talent.id];
    if (next.length <= 3 && isPartialSelectionValid(next, content)) {
      selected.push(talent.id);
    }
    if (selected.length === 3 && !validateTalentSelection(selected, content)) return selected;
  }
  const fallback: number[] = [];
  for (const talent of content.talents) {
    const next = [...fallback, talent.id];
    if (next.length <= 3 && isPartialSelectionValid(next, content)) fallback.push(talent.id);
    if (fallback.length === 3) return fallback;
  }
  throw new Error('没有足够的合法天赋组合');
}

export function simulate(content: GameContent, runs = 1000, seed = 20260429): SimulationResult {
  const random = new Random(seed);
  let errors = 0;
  let totalHSCR = 0;
  let totalVOL = 0;
  let totalRSK = 0;
  const endings: Record<string, number> = {};
  const samples: FinalResult[] = [];

  for (let index = 0; index < runs; index += 1) {
    try {
      const engine = new LifeEngine(content, random.int(0x7fffffff));
      engine.start(randomTalentSelection(content, random), randomAllocation(random));
      const result = engine.runToEnd();
      totalHSCR += result.state.props.HSCR;
      totalVOL += result.state.props.VOL;
      totalRSK += result.state.props.RSK;
      endings[result.ending.name] = (endings[result.ending.name] ?? 0) + 1;
      if (samples.length < 5) samples.push(result);
    } catch {
      errors += 1;
    }
  }

  const completed = Math.max(1, runs - errors);
  return {
    runs,
    errors,
    endings,
    averageHSCR: totalHSCR / completed,
    averageVOL: totalVOL / completed,
    averageRSK: totalRSK / completed,
    samples,
  };
}

function rankTalentCandidates(candidates: Talent[], random: Random): Talent[] {
  return candidates
    .map(talent => ({ talent, score: talentSelectionScore(talent, random) }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.talent);
}

function talentSelectionScore(talent: Talent, random: Random): number {
  const rarityBonus: Record<TalentRarity, number> = { common: 0, rare: 0.25, epic: 0.55, legendary: 0.9 };
  const rarity = talent.rarity ?? 'common';
  const drawbackPenalty = talent.polarity === 'drawback' ? 1.4 : 0;
  return (talent.effectBudget ?? 0) + rarityBonus[rarity] - drawbackPenalty + random.next() * 0.35;
}

function isPartialSelectionValid(ids: number[], content: GameContent): boolean {
  const map = new Map(content.talents.map(item => [item.id, item]));
  return ids.every(id => {
    const talent = map.get(id);
    if (!talent) return false;
    const others = ids.filter(item => item !== id);
    return !talent.exclude?.some(excluded => others.includes(excluded));
  });
}
