import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'src', 'content', 'zh-cn');

function readJson(name) {
  return JSON.parse(readFileSync(join(contentDir, `${name}.json`), 'utf8'));
}

const content = {
  talents: readJson('talents'),
  events: readJson('events'),
  ages: readJson('ages'),
  endings: readJson('endings'),
  achievements: readJson('achievements'),
};

const rarityOrder = ['common', 'rare', 'epic', 'legendary'];
const rarityByGrade = ['common', 'rare', 'epic', 'legendary'];
const baseRarityRates = {
  common: 70,
  rare: 20,
  epic: 8,
  legendary: 2,
};

const phaseBase = {
  preschool: 245,
  primary: 305,
  middle: 360,
  senior1: 385,
  senior2: 410,
  senior3: 425,
  final: 450,
};

const eventEffectScale = {
  INT: 0.5,
  STR: 0.5,
  MNY: 0.5,
  SPR: 0.4,
  VOL: 0.5,
  RSK: 0.35,
  SCOREMOD: 0.65,
};

class Random {
  constructor(seed = Date.now()) {
    this.seed = seed >>> 0;
  }

  next() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  int(max) {
    return Math.floor(this.next() * max);
  }
}

function simulate(runs = 1000) {
  const random = new Random(20260429);
  const distribution = new Map();
  const tierDistribution = new Map();
  let errors = 0;
  let totalHSCR = 0;
  let totalINT = 0;
  let totalSTR = 0;
  let totalMNY = 0;
  let totalSPR = 0;
  let totalVOL = 0;
  let totalRSK = 0;
  let totalSCOREMOD = 0;
  const candidateRarityDistribution = new Map();
  const selectedRarityDistribution = new Map();
  let legendaryCandidateRuns = 0;

  for (let index = 0; index < runs; index += 1) {
    try {
      const result = runOne(random);
      distribution.set(result.ending.name, (distribution.get(result.ending.name) ?? 0) + 1);
      tierDistribution.set(result.ending.tier, (tierDistribution.get(result.ending.tier) ?? 0) + 1);
      totalHSCR += result.props.HSCR;
      totalINT += result.props.INT;
      totalSTR += result.props.STR;
      totalMNY += result.props.MNY;
      totalSPR += result.props.SPR;
      totalVOL += result.props.VOL;
      totalRSK += result.props.RSK;
      totalSCOREMOD += result.props.SCOREMOD;
      if (result.candidateTalents.some(talent => talentRarity(talent) === 'legendary')) legendaryCandidateRuns += 1;
      for (const talent of result.candidateTalents) addCount(candidateRarityDistribution, talentRarity(talent));
      for (const talent of result.selectedTalents) addCount(selectedRarityDistribution, talentRarity(talent));
    } catch {
      errors += 1;
    }
  }

  const completed = Math.max(1, runs - errors);
  console.log(`Runs: ${runs}`);
  console.log(`Errors: ${errors}`);
  console.log(`Average HSCR: ${(totalHSCR / completed).toFixed(1)}`);
  console.log(`Average INT/STR/MNY/SPR: ${(totalINT / completed).toFixed(1)}/${(totalSTR / completed).toFixed(1)}/${(totalMNY / completed).toFixed(1)}/${(totalSPR / completed).toFixed(1)}`);
  console.log(`Average VOL: ${(totalVOL / completed).toFixed(1)}`);
  console.log(`Average RSK: ${(totalRSK / completed).toFixed(1)}`);
  console.log(`Average SCOREMOD: ${(totalSCOREMOD / completed).toFixed(1)}`);
  console.log(`Runs with legendary candidate: ${legendaryCandidateRuns} (${(legendaryCandidateRuns / completed * 100).toFixed(1)}%)`);
  console.log('Candidate rarity distribution:');
  printRarityDistribution(candidateRarityDistribution, completed * 10);
  console.log('Selected rarity distribution:');
  printRarityDistribution(selectedRarityDistribution, completed * 3);
  console.log('Tier distribution:');
  for (const [tier, count] of [...tierDistribution.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
    console.log(`- ${tier}: ${count} (${(count / completed * 100).toFixed(1)}%)`);
  }
  console.log('Ending distribution:');
  for (const [name, count] of [...distribution.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`- ${name}: ${count} (${(count / completed * 100).toFixed(1)}%)`);
  }
}

function runOne(random) {
  const talentPick = pickTalents(random);
  const selectedTalentIds = talentPick.selectedTalents.map(talent => talent.id);
  const props = {
    AGE: 2,
    INT: 0,
    STR: 0,
    MNY: 0,
    SPR: 0,
    VOL: 0,
    RSK: 0,
    SCR: 0,
    HSCR: 0,
    HVOL: 0,
    SCOREMOD: 0,
    SUM: 0,
  };
  for (let point = 0; point < 20; point += 1) {
    props[['INT', 'STR', 'MNY', 'SPR'][random.int(4)]] += 1;
  }

  const talentMap = new Map(content.talents.map(item => [item.id, item]));
  const eventMap = new Map(content.events.map(item => [item.id, item]));
  const triggeredTalentIds = [];
  const eventIds = [];

  for (const id of selectedTalentIds) {
    const talent = talentMap.get(id);
    if (talent && !talent.condition) applyEffect(props, talent.effect);
  }

  for (const ageRound of content.ages) {
    props.AGE = ageRound.age;
    for (const id of selectedTalentIds) {
      const talent = talentMap.get(id);
      if (!talent?.condition || triggeredTalentIds.includes(id)) continue;
      if (ageRound.talentPool.length > 0 && !ageRound.talentPool.includes(id)) continue;
      if (evaluate(talent.condition, props, selectedTalentIds, eventIds)) {
        applyEffect(props, talent.effect);
        triggeredTalentIds.push(id);
      }
    }

    const candidates = ageRound.eventPool
      .map(ref => ({ ref, event: eventMap.get(ref.id) }))
      .filter(item => item.event)
      .filter(({ event }) => evaluate(event.include, props, selectedTalentIds, eventIds))
      .filter(({ event }) => !event.exclude || !evaluate(event.exclude, props, selectedTalentIds, eventIds));
    const unseen = candidates.filter(({ event }) => !eventIds.includes(event.id));
    const picked = pickWeighted(unseen.length ? unseen : candidates, item => item.ref.weight || item.event.weight || 1, random);
    if (!picked) throw new Error('no event');
    applyEffect(props, picked.event.effect, true);
    eventIds.push(picked.event.id);
    for (const branch of picked.event.branch ?? []) {
      if (!evaluate(branch.condition, props, selectedTalentIds, eventIds)) continue;
      const branchEvent = eventMap.get(branch.next);
      if (!branchEvent) continue;
      applyEffect(props, branchEvent.effect, true);
      eventIds.push(branchEvent.id);
    }
    refreshScore(props, ageRound.phase);
  }

  const ending = [...content.endings]
    .sort((a, b) => effectivePriority(b) - effectivePriority(a))
    .find(item => evaluate(item.condition, props, selectedTalentIds, eventIds))
    ?? content.endings.find(item => item.id === (props.HSCR >= 520 ? 41111 : 41007));
  if (!ending) throw new Error('no ending');
  props.SUM = Math.round(props.HSCR * 0.45 + (props.INT + props.STR + props.MNY + props.SPR) * 8 + props.HVOL * 0.8 + ending.scoreBonus);
  return { ending, props, candidateTalents: talentPick.candidateTalents, selectedTalents: talentPick.selectedTalents };
}

function pickTalents(random) {
  const candidateTalents = drawTalentCandidates(random, 10);
  const pool = rankTalentCandidates(candidateTalents, random);
  const selected = [];
  for (const talent of pool) {
    if (selected.length === 3) break;
    if (hasConflict(talent, selected.map(item => item.id))) continue;
    selected.push(talent);
  }
  if (selected.length !== 3) throw new Error('talent selection failed');
  return { candidateTalents, selectedTalents: selected };
}

function rankTalentCandidates(candidates, random) {
  return candidates
    .map(talent => ({ talent, score: talentSelectionScore(talent, random) }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.talent);
}

function talentSelectionScore(talent, random) {
  const rarityBonus = { common: 0, rare: 0.25, epic: 0.55, legendary: 0.9 }[talentRarity(talent)] ?? 0;
  const drawbackPenalty = talent.polarity === 'drawback' ? 1.4 : 0;
  return (talent.effectBudget ?? 0) + rarityBonus - drawbackPenalty + random.next() * 0.35;
}

function drawTalentCandidates(random, count) {
  const pools = {
    common: shuffle(content.talents.filter(item => talentRarity(item) === 'common'), random),
    rare: shuffle(content.talents.filter(item => talentRarity(item) === 'rare'), random),
    epic: shuffle(content.talents.filter(item => talentRarity(item) === 'epic'), random),
    legendary: shuffle(content.talents.filter(item => talentRarity(item) === 'legendary'), random),
  };
  const candidates = [];
  for (let index = 0; index < count; index += 1) {
    const picked = takeTalentByRarity(rollTalentRarity(random), pools);
    if (picked) candidates.push(picked);
  }
  return candidates;
}

function rollTalentRarity(random) {
  let cursor = random.next() * 100;
  for (const rarity of rarityOrder) {
    cursor -= baseRarityRates[rarity];
    if (cursor <= 0) return rarity;
  }
  return 'legendary';
}

function takeTalentByRarity(rarity, pools) {
  for (const fallback of fallbackRarities(rarity)) {
    const picked = pools[fallback].pop();
    if (picked) return picked;
  }
  return null;
}

function fallbackRarities(rarity) {
  const index = rarityOrder.indexOf(rarity);
  return [
    rarity,
    ...rarityOrder.slice(0, index).reverse(),
    ...rarityOrder.slice(index + 1),
  ];
}

function effectivePriority(ending) {
  return ending.priority - (ending.tier === 'X' ? 12 : 0);
}

function hasConflict(talent, selectedIds) {
  if (talent.exclude?.some(id => selectedIds.includes(id))) return true;
  return selectedIds.some(id => content.talents.find(item => item.id === id)?.exclude?.includes(talent.id));
}

function applyEffect(props, effect = {}, scaled = false) {
  for (const [key, value] of Object.entries(effect)) {
    props[key] = (props[key] ?? 0) + value * (scaled ? eventEffectScale[key] ?? 1 : 1);
    if (['INT', 'STR', 'MNY', 'SPR'].includes(key)) props[key] = clamp(props[key], 0, 10);
    if (['VOL', 'HVOL'].includes(key)) props[key] = clamp(props[key], 0, 85);
    if (key === 'RSK') props[key] = clamp(props[key], 0, 90);
    if (key === 'SCOREMOD') props[key] = clamp(props[key], -60, 70);
  }
}

function refreshScore(props, phase) {
  const base = phaseBase[phase];
  props.SCR = clamp(Math.round(base + props.INT * 8.5 + props.STR * 4.8 + props.MNY * 3 + props.SPR * 5.2 + props.VOL * 0.2 - props.RSK * 1.35 + props.SCOREMOD * 0.6), 250, 750);
  props.HSCR = Math.max(props.HSCR, props.SCR);
  props.HVOL = Math.max(props.HVOL, props.VOL);
}

function evaluate(condition, props, talentIds, eventIds) {
  if (!condition) return true;
  let expr = condition
    .replace(/TLT\?\[([0-9,]+)\]/g, (_, ids) => ids.split(',').some(id => talentIds.includes(Number(id))))
    .replace(/TLT!\[([0-9,]+)\]/g, (_, ids) => !ids.split(',').some(id => talentIds.includes(Number(id))))
    .replace(/EVT\?\[([0-9,]+)\]/g, (_, ids) => ids.split(',').some(id => eventIds.includes(Number(id))))
    .replace(/EVT!\[([0-9,]+)\]/g, (_, ids) => !ids.split(',').some(id => eventIds.includes(Number(id))))
    .replace(/([A-Z]+)\?\[([0-9,]+)\]/g, (_, key, ids) => ids.split(',').some(id => props[key] === Number(id)))
    .replace(/([A-Z]+)!\[([0-9,]+)\]/g, (_, key, ids) => !ids.split(',').some(id => props[key] === Number(id)));
  for (const key of Object.keys(props).sort((a, b) => b.length - a.length)) {
    expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(props[key]));
  }
  expr = expr.replace(/(?<![<>=!])=(?!=)/g, '===').replace(/&/g, '&&').replace(/\|/g, '||');
  if (!/^[0-9.\s<>=!&|()truefals-]+$/.test(expr)) throw new Error(`unsafe condition ${condition}`);
  return Boolean(Function(`"use strict"; return (${expr});`)());
}

function pickWeighted(items, weightOf, random) {
  const total = items.reduce((sum, item) => sum + Math.max(0, weightOf(item)), 0);
  if (total <= 0) return items[0] ?? null;
  let cursor = random.next() * total;
  for (const item of items) {
    cursor -= Math.max(0, weightOf(item));
    if (cursor <= 0) return item;
  }
  return items.at(-1) ?? null;
}

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = random.int(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function talentRarity(talent) {
  return talent.rarity || rarityByGrade[talent.grade] || 'common';
}

function addCount(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function printRarityDistribution(distribution, total) {
  for (const rarity of rarityOrder) {
    const count = distribution.get(rarity) ?? 0;
    console.log(`- ${rarity}: ${count} (${(count / Math.max(1, total) * 100).toFixed(1)}%)`);
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

simulate(Number(process.argv[2] ?? 1000));
