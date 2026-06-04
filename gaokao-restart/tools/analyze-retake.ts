import { zhCnContent } from '../src/content/zh-cn';
import { LifeEngine, remainingRetakesForState } from '../src/engine/life';
import { Random } from '../src/engine/random';
import { drawTalentCandidates, validateTalentSelection } from '../src/engine/talents';
import type { Allocation, GameContent, Talent, TalentRarity } from '../src/app/types';

interface RunRecord {
  firstScore: number;
  finalScore: number;
  delta: number;
  retakeCount: number;
  retakeAttempted: boolean;
  firstTier: string;
  finalTier: string;
  firstScoreHidden: boolean;
  finalScoreHidden: boolean;
}

const runs = Number(process.argv[2] ?? 10000);
const seed = Number(process.argv[3] ?? 20260603);
const random = new Random(seed);
const records: RunRecord[] = [];
let errors = 0;
let retakeBlocked = 0;

for (let index = 0; index < runs; index += 1) {
  try {
    const engine = new LifeEngine(zhCnContent, random.int(0x7fffffff));
    engine.start(randomTalentSelection(zhCnContent, random), randomAllocation(random));
    const first = engine.runToEnd();
    let final = first;
    let retakeAttempted = false;

    while (remainingRetakesForState(final.state) > 0 && !final.admission.scoreHidden) {
      retakeAttempted = true;
      try {
        engine.retake();
      } catch {
        retakeBlocked += 1;
        break;
      }
      final = engine.runToEnd();
    }

    records.push({
      firstScore: first.admission.finalScore,
      finalScore: final.admission.finalScore,
      delta: final.admission.finalScore - first.admission.finalScore,
      retakeCount: final.state.retakeCount,
      retakeAttempted,
      firstTier: first.admission.admissionTier,
      finalTier: final.admission.admissionTier,
      firstScoreHidden: Boolean(first.admission.scoreHidden),
      finalScoreHidden: Boolean(final.admission.scoreHidden),
    });
  } catch {
    errors += 1;
  }
}

const completed = records.length;
const visible = records.filter(item => !item.firstScoreHidden && !item.finalScoreHidden);
const retaken = records.filter(item => item.retakeAttempted);
const retakenVisible = records.filter(item => item.retakeAttempted && !item.firstScoreHidden && !item.finalScoreHidden);
const firstHidden = records.filter(item => item.firstScoreHidden);
const finalHidden = records.filter(item => item.finalScoreHidden);

console.log(`Runs: ${runs}`);
console.log(`Completed: ${completed}`);
console.log(`Errors: ${errors}`);
console.log(`Retake blocked: ${retakeBlocked}`);
console.log(`First score hidden / recommended: ${firstHidden.length} ${pct(firstHidden.length, completed)}`);
console.log(`Final score hidden / recommended: ${finalHidden.length} ${pct(finalHidden.length, completed)}`);
console.log(`Retake attempted: ${retaken.length} ${pct(retaken.length, completed)}`);
console.log(`Average first score: ${avg(visible.map(item => item.firstScore)).toFixed(1)}`);
console.log(`Average final-after-retake score: ${avg(visible.map(item => item.finalScore)).toFixed(1)}`);
console.log(`Average delta all visible: ${avg(visible.map(item => item.delta)).toFixed(1)}`);
console.log(`Average delta retaken with visible scores: ${avg(retakenVisible.map(item => item.delta)).toFixed(1)}`);
console.log(`Median delta retaken with visible scores: ${percentile(retakenVisible.map(item => item.delta), 0.5).toFixed(0)}`);
console.log(`Retake improved with visible scores: ${retakenVisible.filter(item => item.delta > 0).length} ${pct(retakenVisible.filter(item => item.delta > 0).length, retakenVisible.length)}`);
console.log(`Retake unchanged with visible scores: ${retakenVisible.filter(item => item.delta === 0).length} ${pct(retakenVisible.filter(item => item.delta === 0).length, retakenVisible.length)}`);
console.log(`Retake lower with visible scores: ${retakenVisible.filter(item => item.delta < 0).length} ${pct(retakenVisible.filter(item => item.delta < 0).length, retakenVisible.length)}`);
printBuckets('First score distribution', visible.map(item => item.firstScore), scoreBucket, ['<450', '450-499', '500-549', '550-579', '580-609', '610-649', '650+']);
printBuckets('Final score distribution after forced retake', visible.map(item => item.finalScore), scoreBucket, ['<450', '450-499', '500-549', '550-579', '580-609', '610-649', '650+']);
printNumeric('First score summary', visible.map(item => item.firstScore));
printNumeric('Final score summary after forced retake', visible.map(item => item.finalScore));
printBuckets('Retake score delta distribution with visible scores', retakenVisible.map(item => item.delta), deltaBucket, ['<=-31', '-30~-16', '-15~-1', '0', '1~15', '16~30', '31~50', '51+']);
printNumeric('Retake delta summary with visible scores', retakenVisible.map(item => item.delta));
printBuckets('First tier distribution', records.map(item => item.firstTier), item => item, ['retake', 'college', 'slide', 'undergraduate', 'doubleFirstClass', '211', '985']);
printBuckets('Final tier distribution after retake', records.map(item => item.finalTier), item => item, ['retake', 'college', 'slide', 'undergraduate', 'doubleFirstClass', '211', '985']);
printBuckets('Retake count distribution', records.map(item => String(item.retakeCount)), item => item, ['0', '1', '2', '3']);

function randomAllocation(random: Random): Allocation {
  const values: Allocation = { INT: 0, STR: 0, MNY: 0, SPR: 0 };
  const keys = Object.keys(values) as Array<keyof Allocation>;
  for (let index = 0; index < 20; index += 1) values[keys[random.int(keys.length)]] += 1;
  return values;
}

function randomTalentSelection(content: GameContent, random: Random): number[] {
  const candidates = drawTalentCandidates(content, 10, null, random.int(0x7fffffff));
  const ranked = rankTalentCandidates(candidates, random);
  const selected: number[] = [];
  for (const talent of ranked) {
    const next = [...selected, talent.id];
    if (next.length <= 3 && isPartialSelectionValid(next, content)) selected.push(talent.id);
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

function scoreBucket(score: number): string {
  if (score < 450) return '<450';
  if (score < 500) return '450-499';
  if (score < 550) return '500-549';
  if (score < 580) return '550-579';
  if (score < 610) return '580-609';
  if (score < 650) return '610-649';
  return '650+';
}

function deltaBucket(delta: number): string {
  if (delta <= -31) return '<=-31';
  if (delta <= -16) return '-30~-16';
  if (delta <= -1) return '-15~-1';
  if (delta === 0) return '0';
  if (delta <= 15) return '1~15';
  if (delta <= 30) return '16~30';
  if (delta <= 50) return '31~50';
  return '51+';
}

function avg(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentile(values: number[], ratio: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.round((sorted.length - 1) * ratio)];
}

function pct(count: number, total: number): string {
  return `(${(count / Math.max(1, total) * 100).toFixed(1)}%)`;
}

function printBuckets<T>(label: string, values: T[], bucketOf: (value: T) => string, order: string[]): void {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(bucketOf(value), (counts.get(bucketOf(value)) ?? 0) + 1);
  console.log(`${label}:`);
  for (const bucket of order) console.log(`- ${bucket}: ${counts.get(bucket) ?? 0} ${pct(counts.get(bucket) ?? 0, values.length)}`);
}

function printNumeric(label: string, values: number[]): void {
  console.log(
    `${label}: min ${percentile(values, 0).toFixed(0)}, p25 ${percentile(values, 0.25).toFixed(0)}, median ${percentile(values, 0.5).toFixed(0)}, p75 ${percentile(values, 0.75).toFixed(0)}, max ${percentile(values, 1).toFixed(0)}, avg ${avg(values).toFixed(1)}`,
  );
}
