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
  admissionProfiles: readJson('admissions/profiles'),
  universities: readJson('admissions/universities'),
  admissionLines: readJson('admissions/admission-lines'),
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
  INT: 0.42,
  STR: 0.42,
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
  let totalFinalScore = 0;
  let canReach985 = 0;
  let canReach211 = 0;
  let admitted985 = 0;
  let admitted211 = 0;
  let slideCount = 0;
  let highScoreLowAdmissionCount = 0;
  let lowVolunteerHighRiskCount = 0;
  const candidateRarityDistribution = new Map();
  const selectedRarityDistribution = new Map();
  const admissionDistribution = new Map();
  const scoreBuckets = new Map();
  const capCounts = { INT: 0, STR: 0, SPR: 0, VOL: 0 };
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
      totalFinalScore += result.admission.finalScore;
      addCount(scoreBuckets, scoreBucket(result.admission.finalScore));
      if (result.props.INT >= 10) capCounts.INT += 1;
      if (result.props.STR >= 10) capCounts.STR += 1;
      if (result.props.SPR >= 10) capCounts.SPR += 1;
      if (result.props.VOL >= 85) capCounts.VOL += 1;
      if (result.props.HVOL < 25 && result.props.RSK >= 65) lowVolunteerHighRiskCount += 1;
      if (result.admission.canReach985) canReach985 += 1;
      if (result.admission.canReach211) canReach211 += 1;
      if (result.admission.admissionTier === '985') admitted985 += 1;
      if (result.admission.admissionTier === '211') admitted211 += 1;
      if (result.admission.admissionTier === 'slide') slideCount += 1;
      if (result.admission.highScoreLowAdmission) highScoreLowAdmissionCount += 1;
      if (result.admission.admittedUniversity) {
        addCount(admissionDistribution, result.admission.admittedUniversity.name);
      } else {
        addCount(admissionDistribution, result.admission.admissionTier);
      }
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
  console.log(`Average final score: ${(totalFinalScore / completed).toFixed(1)}`);
  console.log(`985 reachable: ${canReach985} (${(canReach985 / completed * 100).toFixed(1)}%)`);
  console.log(`211 reachable: ${canReach211} (${(canReach211 / completed * 100).toFixed(1)}%)`);
  console.log(`985 admitted: ${admitted985} (${(admitted985 / completed * 100).toFixed(1)}%)`);
  console.log(`211 admitted: ${admitted211} (${(admitted211 / completed * 100).toFixed(1)}%)`);
  console.log(`Slide: ${slideCount} (${(slideCount / completed * 100).toFixed(1)}%)`);
  console.log(`High score low admission: ${highScoreLowAdmissionCount} (${(highScoreLowAdmissionCount / completed * 100).toFixed(1)}%)`);
  console.log(`Low volunteer high risk: ${lowVolunteerHighRiskCount} (${(lowVolunteerHighRiskCount / completed * 100).toFixed(1)}%)`);
  printEndingCoverage(distribution);
  printConcentration('Ending concentration', distribution, completed, [1, 3, 5]);
  printConcentration('Admission concentration', admissionDistribution, completed, [1, 2, 5]);
  console.log('Score buckets:');
  for (const bucket of ['<420', '420-499', '500-549', '550-579', '580-609', '610-639', '640+']) {
    const count = scoreBuckets.get(bucket) ?? 0;
    console.log(`- ${bucket}: ${count} (${(count / completed * 100).toFixed(1)}%)`);
  }
  console.log('Cap rate:');
  for (const prop of ['INT', 'STR', 'SPR', 'VOL']) {
    console.log(`- ${prop}: ${capCounts[prop]} (${(capCounts[prop] / completed * 100).toFixed(1)}%)`);
  }
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
  console.log('Admission distribution:');
  for (const [name, count] of [...admissionDistribution.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
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

  const exam = calculateExamScore(props, random);
  const admission = resolveAdmission(props, selectedTalentIds, eventIds, exam, random);
  const ending = [...content.endings]
    .sort((a, b) => effectivePriority(b) - effectivePriority(a))
    .find(item => evaluate(item.condition, props, selectedTalentIds, eventIds, admission))
    ?? content.endings.find(item => item.id === (props.HSCR >= 520 ? 41111 : 41007));
  if (!ending) throw new Error('no ending');
  props.SUM = Math.round(props.HSCR * 0.45 + (props.INT + props.STR + props.MNY + props.SPR) * 8 + props.HVOL * 0.8 + ending.scoreBonus);
  return { ending, props, admission, candidateTalents: talentPick.candidateTalents, selectedTalents: talentPick.selectedTalents };
}

function calculateExamScore(props, random) {
  const potentialScore = props.SCR;
  const stabilityBonus = clamp(props.SPR * 0.8 - props.RSK * 0.12, -10, 10);
  const varianceRange = clamp(18 + props.RSK * 0.22 - props.SPR * 1.1, 6, 35);
  const variance = Math.round((random.next() * 2 - 1) * varianceRange);
  const finalScore = clamp(Math.round(potentialScore + stabilityBonus + variance), 250, 750);
  return { finalScore, potentialScore, variance };
}

function resolveAdmission(props, selectedTalentIds, eventIds, exam, random) {
  const profile = content.admissionProfiles.find(item => item.default) ?? content.admissionProfiles[0];
  const universities = new Map(content.universities.map(item => [item.code, item]));
  const lines = content.admissionLines
    .filter(line => line.profileId === profile.id)
    .map(line => ({ line, university: universities.get(line.universityCode), margin: exam.finalScore - line.minScore }))
    .filter(item => item.university);
  const reachable = lines.filter(item => item.margin >= 0);
  const reachable985 = reachable.filter(item => item.university.tags.includes('985'));
  const reachable211 = reachable.filter(item => item.university.tags.includes('211'));
  const strategyScore = props.HVOL - props.RSK * 0.35 + routeBonus(selectedTalentIds, eventIds);
  const slide = shouldSlide(props, selectedTalentIds, eventIds, strategyScore, reachable, random);
  const picked = slide ? null : pickAdmittedLine(reachable, strategyScore, random);
  const highScoreLowAdmission = isHighScoreLowAdmission(reachable985.length > 0, reachable211.length > 0, picked);

  if (!picked) {
    return {
      finalScore: exam.finalScore,
      canReach985: reachable985.length > 0,
      canReach211: reachable211.length > 0,
      admitted: false,
      admissionTier: slide ? 'slide' : exam.finalScore >= 300 ? 'college' : 'retake',
      strategyScore,
      highScoreLowAdmission: slide && (reachable985.length > 0 || reachable211.length > 0),
    };
  }

  return {
    finalScore: exam.finalScore,
    canReach985: reachable985.length > 0,
    canReach211: reachable211.length > 0,
    admitted: true,
    admittedLine: picked.line,
    admittedUniversity: picked.university,
    admissionTier: universityAdmissionTier(picked.university),
    margin: picked.margin,
    strategyScore,
    highScoreLowAdmission,
  };
}

function pickAdmittedLine(reachable, strategyScore, random) {
  if (reachable.length === 0) return null;
  const targetMargin = strategyScore >= 65 ? 8 : strategyScore >= 35 ? 24 : 58;
  const minMargin = strategyScore >= 65 ? 0 : strategyScore >= 35 ? 6 : 26;
  const maxMargin = strategyScore >= 65 ? 36 : strategyScore >= 35 ? 78 : 150;
  const preferred = reachable.filter(item => item.margin >= minMargin && item.margin <= maxMargin);
  const pool = preferred.length ? preferred : reachable;
  return pickWeighted(pool, item => admissionChoiceWeight(item, targetMargin, strategyScore), random);
}

function admissionChoiceWeight(candidate, targetMargin, strategyScore) {
  const marginFit = Math.max(6, 95 - Math.abs(candidate.margin - targetMargin) * 2.4);
  const prestige = linePrestigeScore(candidate) / 160;
  const prestigeWeight = strategyScore >= 65 ? 1 : strategyScore >= 35 ? 0.65 : 0.28;
  const safetyBonus = strategyScore < 35 ? Math.min(candidate.margin, 90) * 0.42 : 0;
  return Math.max(1, marginFit + prestige * prestigeWeight + safetyBonus);
}

function linePrestigeScore(candidate) {
  const tierWeight = { top: 5000, strong: 3800, solid: 2800, regional: 1600, private: 500 }[candidate.university.prestigeTier];
  const tagBonus = candidate.university.tags.includes('985')
    ? 1400
    : candidate.university.tags.includes('211')
      ? 900
      : candidate.university.tags.includes('doubleFirstClass')
        ? 650
        : 0;
  return tierWeight + tagBonus + candidate.line.minScore;
}

function routeBonus(selectedTalentIds, eventIds) {
  const talentBonus = selectedTalentIds
    .map(id => content.talents.find(item => item.id === id))
    .reduce((sum, talent) => {
      if (talent?.category === 'volunteer') return sum + 8;
      if (talent?.category === 'route') return sum + 4;
      return sum;
    }, 0);
  const eventBonus = eventIds.some(id => [31027, 31708, 31720, 31732].includes(id)) ? 8 : 0;
  return Math.min(18, talentBonus + eventBonus);
}

function routeSignal(selectedTalentIds, eventIds) {
  const riskFlags = new Set(['志愿翻车', '专业误读', '提交惊险']);
  const steadyFlags = new Set(['志愿稳健', '章程避坑', '三角比较']);
  const riskTalentNames = new Set(['名校滤镜', '冲校上头']);
  const steadyTalentNames = new Set(['风险分层']);
  let risk = 0;
  let steady = 0;
  for (const id of eventIds) {
    const flag = content.events.find(item => item.id === id)?.flag;
    if (flag && riskFlags.has(flag)) risk += 1;
    if (flag && steadyFlags.has(flag)) steady += 1;
  }
  for (const id of selectedTalentIds) {
    const name = content.talents.find(item => item.id === id)?.name;
    if (name && riskTalentNames.has(name)) risk += 1;
    if (name && steadyTalentNames.has(name)) steady += 1;
  }
  return { risk, steady };
}

function shouldSlide(props, selectedTalentIds, eventIds, strategyScore, reachable, random) {
  if (reachable.length === 0) return false;
  const route = routeSignal(selectedTalentIds, eventIds);
  let chance = 0;
  if (strategyScore < 10 && props.RSK >= 65) chance += 0.1;
  if (strategyScore < 0) chance += 0.08;
  if (props.HVOL < 25) chance += 0.08;
  if (props.RSK >= 75) chance += 0.05;
  chance += route.risk * 0.045;
  chance -= route.steady * 0.035;
  chance = clamp(chance, 0, 0.45);
  return random.next() < chance;
}

function isHighScoreLowAdmission(canReach985, canReach211, picked) {
  if (!picked) return canReach985 || canReach211;
  const actualTier = universityAdmissionTier(picked.university);
  if (canReach985) return actualTier !== '985';
  if (canReach211) return !['985', '211'].includes(actualTier);
  return false;
}

function universityAdmissionTier(university) {
  if (university.tags.includes('985')) return '985';
  if (university.tags.includes('211')) return '211';
  if (university.tags.includes('doubleFirstClass')) return 'doubleFirstClass';
  return 'undergraduate';
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

function evaluate(condition, props, talentIds, eventIds, admission = null) {
  if (!condition) return true;
  const admissionProps = {
    ADMSCORE: admission?.finalScore ?? 0,
    MARGIN: admission?.margin ?? 0,
    SLIDE: admission?.admissionTier === 'slide' ? 1 : 0,
  };
  let expr = condition
    .replace(/TLT\?\[([0-9,]+)\]/g, (_, ids) => ids.split(',').some(id => talentIds.includes(Number(id))))
    .replace(/TLT!\[([0-9,]+)\]/g, (_, ids) => !ids.split(',').some(id => talentIds.includes(Number(id))))
    .replace(/EVT\?\[([0-9,]+)\]/g, (_, ids) => ids.split(',').some(id => eventIds.includes(Number(id))))
    .replace(/EVT!\[([0-9,]+)\]/g, (_, ids) => !ids.split(',').some(id => eventIds.includes(Number(id))))
    .replace(/ADM\?\[([A-Za-z0-9_,]+)\]/g, (_, ids) => ids.split(',').some(id => hasAdmissionTier(admission, id)))
    .replace(/ADM!\[([A-Za-z0-9_,]+)\]/g, (_, ids) => !ids.split(',').some(id => hasAdmissionTier(admission, id)))
    .replace(/SCHOOL\?\[([0-9,]+)\]/g, (_, ids) => ids.split(',').some(id => admission?.admittedUniversity?.code === String(id)))
    .replace(/SCHOOL!\[([0-9,]+)\]/g, (_, ids) => !ids.split(',').some(id => admission?.admittedUniversity?.code === String(id)))
    .replace(/([A-Z]+)\?\[([0-9,]+)\]/g, (_, key, ids) => ids.split(',').some(id => props[key] === Number(id)))
    .replace(/([A-Z]+)!\[([0-9,]+)\]/g, (_, key, ids) => !ids.split(',').some(id => props[key] === Number(id)));
  for (const key of Object.keys({ ...props, ...admissionProps }).sort((a, b) => b.length - a.length)) {
    expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(admissionProps[key] ?? props[key]));
  }
  expr = expr.replace(/(?<![<>=!])=(?!=)/g, '===').replace(/&/g, '&&').replace(/\|/g, '||');
  if (!/^[0-9.\s<>=!&|()truefals-]+$/.test(expr)) throw new Error(`unsafe condition ${condition}`);
  return Boolean(Function(`"use strict"; return (${expr});`)());
}

function hasAdmissionTier(admission, tier) {
  if (!admission?.admitted) return false;
  if (tier === '985') return admission.admissionTier === '985';
  if (tier === '211') return ['985', '211'].includes(admission.admissionTier);
  if (tier === 'doubleFirstClass') return ['985', '211', 'doubleFirstClass'].includes(admission.admissionTier);
  return admission.admissionTier === tier;
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

function printEndingCoverage(distribution) {
  const observedNames = new Set(distribution.keys());
  const missing = content.endings.filter(ending => !observedNames.has(ending.name));
  console.log(`Ending coverage: ${content.endings.length - missing.length}/${content.endings.length}`);
  console.log('Missing endings by tier:');
  const tiers = [...new Set(content.endings.map(ending => ending.tier))].sort();
  for (const tier of tiers) {
    const names = missing.filter(ending => ending.tier === tier).map(ending => ending.name);
    console.log(`- ${tier}: ${names.length ? names.join('、') : 'None'}`);
  }
}

function printConcentration(label, distribution, total, topSizes) {
  const sorted = [...distribution.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`${label}:`);
  for (const size of topSizes) {
    const count = sorted.slice(0, size).reduce((sum, item) => sum + item[1], 0);
    console.log(`- Top ${size}: ${count} (${(count / Math.max(1, total) * 100).toFixed(1)}%)`);
  }
}

function scoreBucket(score) {
  if (score < 420) return '<420';
  if (score < 500) return '420-499';
  if (score < 550) return '500-549';
  if (score < 580) return '550-579';
  if (score < 610) return '580-609';
  if (score < 640) return '610-639';
  return '640+';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

simulate(Number(process.argv[2] ?? 1000));
