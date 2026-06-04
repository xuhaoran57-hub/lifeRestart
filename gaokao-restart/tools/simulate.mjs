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

const initialPhaseBase = 240;
const phaseOrder = ['preschool', 'primary', 'middle', 'senior1', 'senior2', 'senior3', 'final'];
const phaseBaseGain = {
  preschool: 0,
  primary: 37,
  middle: 31,
  senior1: 15,
  senior2: 10,
  senior3: 5,
  final: 2,
};
const phaseBase = phaseOrder.reduce((result, phase, index) => {
  const previousBase = index === 0 ? initialPhaseBase : result[phaseOrder[index - 1]];
  result[phase] = previousBase + phaseBaseGain[phase];
  return result;
}, {});

const positiveEventEffectScale = {
  INT: 0.3,
  STR: 0.4,
  MNY: 0.55,
  SPR: 0.6,
  VOL: 0.75,
  RSK: 0.25,
  SCOREMOD: 0.9,
};
const negativeEventEffectScale = {
  INT: 0.3,
  STR: 0.36,
  MNY: 0.5,
  SPR: 0.45,
  VOL: 0.55,
  RSK: 0.85,
  SCOREMOD: 0.75,
};
const senior3PositiveEventEffectScale = {
  INT: 0.55,
  STR: 0.65,
  MNY: 0.55,
  SPR: 0.9,
  VOL: 1.15,
  RSK: 0.55,
  SCOREMOD: 0.95,
};
const senior3NegativeEventEffectScale = {
  INT: 0.45,
  STR: 0.52,
  MNY: 0.5,
  SPR: 0.7,
  VOL: 0.85,
  RSK: 0.85,
  SCOREMOD: 0.75,
};
const historyLockTalentId = 21801;
const physicsLockTalentId = 21802;
const subjectTrackEventIds = {
  forcedPhysics: 32001,
  forcedHistory: 32002,
  physics: 32003,
  history: 32004,
};
const keyVolunteerEventFlags = new Set([
  '志愿稳健',
  '章程避坑',
  '三角比较',
  '志愿预案',
  '保专业',
  '复读志愿稳健',
  '复读定位',
]);

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

function simulate(runs = 1000, options = {}) {
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
  let totalBASEMOD = 0;
  let totalFinalScore = 0;
  let canReach985 = 0;
  let canReach211 = 0;
  let admitted985 = 0;
  let admitted211 = 0;
  let slideCount = 0;
  let highScoreLowAdmissionCount = 0;
  let sinoForeignAdmissionCount = 0;
  let highResourceRuns = 0;
  let highResourceSinoForeignCount = 0;
  let lowResourceRuns = 0;
  let lowResourceSinoForeignCount = 0;
  let lowVolunteerHighRiskCount = 0;
  const candidateRarityDistribution = new Map();
  const selectedRarityDistribution = new Map();
  const admissionDistribution = new Map();
  const admittedSchoolCodes = new Set();
  const subjectTrackDistribution = new Map();
  const subjectTrackAdmission = {
    history: { runs: 0, canReach985: 0, canReach211: 0, admitted985: 0, admitted211: 0, slide: 0, totalFinalScore: 0 },
    physics: { runs: 0, canReach985: 0, canReach211: 0, admitted985: 0, admitted211: 0, slide: 0, totalFinalScore: 0 },
  };
  const scoreBuckets = new Map();
  const finalScoreValues = [];
  const propertyNames = ['INT', 'STR', 'MNY', 'SPR', 'VOL', 'RSK', 'SCOREMOD', 'BASEMOD'];
  const propertyBuckets = Object.fromEntries(propertyNames.map(prop => [prop, new Map()]));
  const propertyValues = Object.fromEntries(propertyNames.map(prop => [prop, []]));
  const admittedLineScoreBuckets = new Map();
  const admittedLineScoreValues = [];
  const marginBuckets = new Map();
  const marginValues = [];
  let highLineReachableRuns = 0;
  let highLineAdmittedRuns = 0;
  const capCounts = { INT: 0, STR: 0, SPR: 0, VOL: 0 };
  const nearCapCounts = { INT: 0, STR: 0 };
  const belowInitialCounts = { INT: 0, STR: 0 };
  let legendaryCandidateRuns = 0;

  if (options.fixedAllocation) {
    const { INT, STR, MNY, SPR } = options.fixedAllocation;
    console.log(`Initial allocation: fixed INT/STR/MNY/SPR ${INT}/${STR}/${MNY}/${SPR}`);
  }

  for (let index = 0; index < runs; index += 1) {
    try {
      const result = runOne(random, options);
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
      totalBASEMOD += result.props.BASEMOD;
      totalFinalScore += result.admission.finalScore;
      addCount(subjectTrackDistribution, result.subjectTrack);
      const trackStats = subjectTrackAdmission[result.subjectTrack];
      trackStats.runs += 1;
      trackStats.totalFinalScore += result.admission.finalScore;
      finalScoreValues.push(result.admission.finalScore);
      addCount(scoreBuckets, scoreBucket(result.admission.finalScore));
      for (const prop of propertyNames) {
        const value = result.props[prop] ?? 0;
        propertyValues[prop].push(value);
        addCount(propertyBuckets[prop], propertyBucket(prop, value));
      }
      if (result.props.INT >= 10) capCounts.INT += 1;
      if (result.props.STR >= 10) capCounts.STR += 1;
      if (result.props.INT >= 9) nearCapCounts.INT += 1;
      if (result.props.STR >= 9) nearCapCounts.STR += 1;
      if (options.fixedAllocation && result.props.INT < options.fixedAllocation.INT) belowInitialCounts.INT += 1;
      if (options.fixedAllocation && result.props.STR < options.fixedAllocation.STR) belowInitialCounts.STR += 1;
      if (result.props.SPR >= 10) capCounts.SPR += 1;
      if (result.props.VOL >= 85) capCounts.VOL += 1;
      if (result.props.HVOL < 25 && result.props.RSK >= 65) lowVolunteerHighRiskCount += 1;
      if (result.admission.canReach985) canReach985 += 1;
      if (result.admission.canReach985) trackStats.canReach985 += 1;
      if (result.admission.canReach211) {
        canReach211 += 1;
        trackStats.canReach211 += 1;
      }
      if (result.admission.admissionTier === '985') {
        admitted985 += 1;
        trackStats.admitted985 += 1;
      }
      if (result.admission.admissionTier === '211') {
        admitted211 += 1;
        trackStats.admitted211 += 1;
      }
      if (result.admission.admissionTier === 'slide') {
        slideCount += 1;
        trackStats.slide += 1;
      }
      if (result.admission.highScoreLowAdmission) highScoreLowAdmissionCount += 1;
      if (result.props.MNY >= 7) {
        highResourceRuns += 1;
        if (result.admission.isSinoForeign) highResourceSinoForeignCount += 1;
      }
      if (result.props.MNY <= 4) {
        lowResourceRuns += 1;
        if (result.admission.isSinoForeign) lowResourceSinoForeignCount += 1;
      }
      if (result.admission.isSinoForeign) sinoForeignAdmissionCount += 1;
      if (result.admission.admittedUniversity) {
        addCount(admissionDistribution, result.admission.admittedUniversity.name);
        admittedSchoolCodes.add(result.admission.admittedUniversity.code);
      } else {
        addCount(admissionDistribution, result.admission.admissionTier);
      }
      if ((result.admission.highestReachableLineScore ?? 0) >= 650) highLineReachableRuns += 1;
      if (result.admission.admittedLine) {
        const lineScore = result.admission.admittedLine.minScore;
        if (lineScore >= 650) highLineAdmittedRuns += 1;
        admittedLineScoreValues.push(lineScore);
        marginValues.push(result.admission.margin);
        addCount(admittedLineScoreBuckets, admissionLineScoreBucket(lineScore));
        addCount(marginBuckets, admissionMarginBucket(result.admission.margin));
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
  console.log(`Average BASEMOD: ${(totalBASEMOD / completed).toFixed(1)}`);
  console.log(`Average final score: ${(totalFinalScore / completed).toFixed(1)}`);
  console.log(`985 reachable: ${canReach985} (${(canReach985 / completed * 100).toFixed(1)}%)`);
  console.log(`211 reachable: ${canReach211} (${(canReach211 / completed * 100).toFixed(1)}%)`);
  console.log(`985 admitted: ${admitted985} (${(admitted985 / completed * 100).toFixed(1)}%)`);
  console.log(`211 admitted: ${admitted211} (${(admitted211 / completed * 100).toFixed(1)}%)`);
  console.log(`Slide: ${slideCount} (${(slideCount / completed * 100).toFixed(1)}%)`);
  console.log(`High score low admission: ${highScoreLowAdmissionCount} (${(highScoreLowAdmissionCount / completed * 100).toFixed(1)}%)`);
  console.log(`Sino-foreign cooperation admitted: ${sinoForeignAdmissionCount} (${(sinoForeignAdmissionCount / completed * 100).toFixed(1)}%)`);
  console.log(`Sino-foreign by resource: MNY>=7 ${highResourceSinoForeignCount}/${highResourceRuns} (${(highResourceSinoForeignCount / Math.max(1, highResourceRuns) * 100).toFixed(1)}%), MNY<=4 ${lowResourceSinoForeignCount}/${lowResourceRuns} (${(lowResourceSinoForeignCount / Math.max(1, lowResourceRuns) * 100).toFixed(1)}%)`);
  console.log(`Low volunteer high risk: ${lowVolunteerHighRiskCount} (${(lowVolunteerHighRiskCount / completed * 100).toFixed(1)}%)`);
  console.log('Subject track distribution:');
  for (const track of ['history', 'physics']) {
    const count = subjectTrackDistribution.get(track) ?? 0;
    console.log(`- ${track}: ${count} (${(count / completed * 100).toFixed(1)}%)`);
  }
  console.log('Subject track admission:');
  for (const track of ['history', 'physics']) {
    const item = subjectTrackAdmission[track];
    const denominator = Math.max(1, item.runs);
    console.log(`- ${track}: avgScore ${(item.totalFinalScore / denominator).toFixed(1)}, 985 reachable ${(item.canReach985 / denominator * 100).toFixed(1)}%, 211 reachable ${(item.canReach211 / denominator * 100).toFixed(1)}%, 985 admitted ${(item.admitted985 / denominator * 100).toFixed(1)}%, 211 admitted ${(item.admitted211 / denominator * 100).toFixed(1)}%, slide ${(item.slide / denominator * 100).toFixed(1)}%`);
  }
  printEndingCoverage(distribution);
  printConcentration('Ending concentration', distribution, completed, [1, 3, 5]);
  printConcentration('Admission concentration', admissionDistribution, completed, [1, 2, 5]);
  console.log('Score buckets:');
  for (const bucket of ['<450', '450-499', '500-549', '550-579', '580-609', '610-649', '650+']) {
    const count = scoreBuckets.get(bucket) ?? 0;
    console.log(`- ${bucket}: ${count} (${(count / completed * 100).toFixed(1)}%)`);
  }
  printNumericSummary('Final score summary', finalScoreValues, 0);
  console.log('Property buckets:');
  for (const prop of propertyNames) {
    printNumericSummary(`- ${prop} summary`, propertyValues[prop], ['VOL', 'RSK', 'SCOREMOD', 'BASEMOD'].includes(prop) ? 0 : 1);
    printBucketDistribution(`  ${prop}`, propertyBuckets[prop], propertyBucketOrder(prop), completed);
  }
  console.log(`Admitted line score samples: ${admittedLineScoreValues.length} (${(admittedLineScoreValues.length / completed * 100).toFixed(1)}% of runs)`);
  console.log(`Admitted school coverage: ${admittedSchoolCodes.size}/${content.universities.length} (${(admittedSchoolCodes.size / Math.max(1, content.universities.length) * 100).toFixed(1)}%)`);
  console.log(`650+ line reachable runs: ${highLineReachableRuns} (${(highLineReachableRuns / completed * 100).toFixed(1)}%)`);
  console.log(`650+ line admitted runs: ${highLineAdmittedRuns} (${(highLineAdmittedRuns / completed * 100).toFixed(1)}%)`);
  printNumericSummary('Admitted line score summary', admittedLineScoreValues, 0);
  printBucketDistribution('Admitted line score buckets', admittedLineScoreBuckets, ['<500', '500-529', '530-549', '550-569', '570-589', '590-609', '610-629', '630-649', '650+'], admittedLineScoreValues.length);
  printNumericSummary('Admission margin summary', marginValues, 0);
  printBucketDistribution('Admission margin buckets', marginBuckets, ['<0', '0-5', '6-15', '16-30', '31-60', '61-100', '100+'], marginValues.length);
  console.log('Cap rate:');
  for (const prop of ['INT', 'STR', 'SPR', 'VOL']) {
    console.log(`- ${prop}: ${capCounts[prop]} (${(capCounts[prop] / completed * 100).toFixed(1)}%)`);
  }
  console.log('Near cap rate:');
  for (const prop of ['INT', 'STR']) {
    console.log(`- ${prop}>=9: ${nearCapCounts[prop]} (${(nearCapCounts[prop] / completed * 100).toFixed(1)}%)`);
  }
  if (options.fixedAllocation) {
    console.log('Below initial rate:');
    for (const prop of ['INT', 'STR']) {
      console.log(`- ${prop}: ${belowInitialCounts[prop]} (${(belowInitialCounts[prop] / completed * 100).toFixed(1)}%)`);
    }
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

function runOne(random, options = {}) {
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
    BASEMOD: 0,
    SUM: 0,
    ATTEMPT: 1,
    RETAKE: 0,
  };
  if (options.fixedAllocation) {
    Object.assign(props, options.fixedAllocation);
  } else {
    for (let point = 0; point < 20; point += 1) {
      props[['INT', 'STR', 'MNY', 'SPR'][random.int(4)]] += 1;
    }
  }

  const talentMap = new Map(content.talents.map(item => [item.id, item]));
  const eventMap = new Map(content.events.map(item => [item.id, item]));
  const triggeredTalentIds = [];
  const eventIds = [];
  let subjectTrack = null;

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
      .filter(({ event }) => !event.noRandom)
      .filter(({ event }) => !event.subjectTrack || event.subjectTrack === subjectTrack)
      .filter(({ event }) => evaluate(event.include, props, selectedTalentIds, eventIds, null, subjectTrack))
      .filter(({ event }) => !event.exclude || !evaluate(event.exclude, props, selectedTalentIds, eventIds, null, subjectTrack));
    const unseen = candidates.filter(({ event }) => !eventIds.includes(event.id));
    const picked = pickWeighted(unseen.length ? unseen : candidates, item => eventPickWeight(item.ref, item.event, props), random);
    if (!picked) throw new Error('no event');
    applyEffect(props, picked.event.effect, true, ageRound.phase, picked.event);
    eventIds.push(picked.event.id);
    for (const branch of picked.event.branch ?? []) {
      if (!evaluate(branch.condition, props, selectedTalentIds, eventIds, null, subjectTrack)) continue;
      const branchEvent = eventMap.get(branch.next);
      if (!branchEvent) continue;
      applyEffect(props, branchEvent.effect, true, ageRound.phase, branchEvent);
      eventIds.push(branchEvent.id);
    }
    if (!subjectTrack && ageRound.age === 15 && ageRound.round === 2) {
      const forcedTrack = forcedSubjectTrack(selectedTalentIds);
      subjectTrack = forcedTrack ?? resolveSubjectTrack(props, selectedTalentIds, eventIds, random);
      const eventId = forcedTrack === 'physics'
        ? subjectTrackEventIds.forcedPhysics
        : forcedTrack === 'history'
          ? subjectTrackEventIds.forcedHistory
          : subjectTrack === 'physics'
            ? subjectTrackEventIds.physics
            : subjectTrackEventIds.history;
      const trackEvent = eventMap.get(eventId);
      if (!trackEvent) throw new Error(`missing subject track event ${eventId}`);
      applyEffect(props, trackEvent.effect, true, ageRound.phase, trackEvent);
      eventIds.push(trackEvent.id);
    }
    refreshScore(props, ageRound.phase);
  }

  const exam = calculateExamScore(props, random);
  if (!subjectTrack) throw new Error('missing subject track');
  const admission = resolveAdmission(props, selectedTalentIds, eventIds, subjectTrack, exam, random);
  const ending = [...content.endings]
    .sort((a, b) => effectivePriority(b) - effectivePriority(a))
    .find(item => evaluate(item.condition, props, selectedTalentIds, eventIds, admission, subjectTrack))
    ?? content.endings.find(item => item.id === (props.HSCR >= 520 ? 41111 : 41007));
  if (!ending) throw new Error('no ending');
  props.SUM = Math.round(props.HSCR * 0.45 + (props.INT + props.STR + props.MNY + props.SPR) * 8 + props.HVOL * 0.8 + ending.scoreBonus);
  return { ending, props, subjectTrack, admission, candidateTalents: talentPick.candidateTalents, selectedTalents: talentPick.selectedTalents };
}

function calculateExamScore(props, random) {
  const potentialScore = props.SCR;
  const stabilityBonus = clamp(props.SPR * 0.8 - props.RSK * 0.12, -10, 10);
  const varianceRange = clamp(22 + props.RSK * 0.3 - props.SPR * 0.8, 10, 44);
  const variance = Math.round((random.next() * 2 - 1) * varianceRange);
  const breakthrough = rollBreakthroughBonus(props, potentialScore, random);
  const setback = breakthrough > 0 ? 0 : rollSetbackPenalty(props, potentialScore, random);
  const rawScore = Math.round(potentialScore + stabilityBonus + variance + breakthrough - setback);
  const bandCalibration = scoreBandCalibration(rawScore, props);
  const finalScore = clamp(rawScore + bandCalibration, 250, 750);
  return { finalScore, potentialScore, variance: variance + breakthrough - setback + bandCalibration };
}

function scoreBandCalibration(rawScore, props) {
  const elitePrepared = props.INT >= 9 && props.SCOREMOD >= 35 && props.RSK < 60;
  if (rawScore >= 635 && elitePrepared) return 12;
  if (rawScore >= 615 && elitePrepared) return 7;
  if (rawScore >= 602 && elitePrepared) return 3;
  if (rawScore >= 555 && rawScore < 602) return elitePrepared ? 2 : -8;
  return 0;
}

function rollBreakthroughBonus(props, potentialScore, random) {
  const topPrepared = potentialScore >= 540 && props.INT >= 9 && props.SCOREMOD >= 30 && props.RSK < 65;
  const baseChance = potentialScore >= 540 ? (potentialScore - 540) / 360 : 0;
  const aptitudeChance =
    Math.max(0, props.INT - 8) * 0.018
    + Math.max(0, props.STR - 8) * 0.012
    + Math.max(0, props.SPR - 6) * 0.01
    + Math.max(0, props.HVOL - 55) * 0.001
    + Math.max(0, props.SCOREMOD - 15) * 0.0016;
  const topPreparedChance = topPrepared ? 0.12 + Math.max(0, potentialScore - 570) * 0.001 : 0;
  const riskPenalty = props.RSK >= 55 ? 0.02 : 0;
  const chance = clamp(baseChance + aptitudeChance + topPreparedChance - riskPenalty, 0, topPrepared ? 0.34 : 0.2);
  if (random.next() >= chance) return 0;
  const baseBonus = topPrepared ? 34 + random.next() * 54 : 22 + random.next() * 42;
  const potentialBonus = Math.max(0, potentialScore - 585) * (topPrepared ? 0.43 : 0.35);
  return Math.round(clamp(baseBonus + potentialBonus, 18, topPrepared ? 106 : 85));
}

function rollSetbackPenalty(props, potentialScore, random) {
  const chance = clamp(
    Math.max(0, props.RSK - 45) * 0.006
      + Math.max(0, 5 - props.SPR) * 0.018
      + Math.max(0, 520 - potentialScore) * 0.0006,
    0,
    0.18,
  );
  if (random.next() >= chance) return 0;
  return Math.round(clamp(20 + random.next() * 45 + Math.max(0, props.RSK - 65) * 0.4, 18, 75));
}

function forcedSubjectTrack(selectedTalentIds) {
  if (selectedTalentIds.includes(historyLockTalentId)) return 'history';
  if (selectedTalentIds.includes(physicsLockTalentId)) return 'physics';
  return null;
}

function resolveSubjectTrack(props, selectedTalentIds, eventIds, random) {
  const forced = forcedSubjectTrack(selectedTalentIds);
  if (forced) return forced;
  const scienceEventBonus = eventIds.some(id => [31011, 31013, 31017].includes(id)) ? 1.4 : 0;
  const humanitiesEventBonus = eventIds.some(id => [31731, 31732, 31735].includes(id)) ? 0.9 : 0;
  const riskPenalty = props.RSK * 0.04;
  const jitter = (random.next() - 0.5) * 2.6;
  const scorePhysics = props.INT * 0.85 + props.STR * 0.25 + props.MNY * 0.2 + scienceEventBonus - riskPenalty + jitter;
  const scoreHistory = props.SPR * 0.85 + props.VOL * 0.06 + props.INT * 0.45 + humanitiesEventBonus - jitter;
  return scorePhysics > scoreHistory ? 'physics' : 'history';
}

function resolveAdmission(props, selectedTalentIds, eventIds, subjectTrack, exam, random) {
  const profileId = subjectTrack === 'history' ? 'ah-2025-history' : 'ah-2025-physics';
  const profile = content.admissionProfiles.find(item => item.id === profileId);
  if (!profile) throw new Error(`missing profile ${profileId}`);
  const universities = new Map(content.universities.map(item => [item.code, item]));
  const lines = content.admissionLines
    .filter(line => line.profileId === profile.id)
    .map(line => ({ line, university: universities.get(line.universityCode), margin: exam.finalScore - line.minScore }))
    .filter(item => item.university);
  const reachable = lines.filter(item => item.margin >= 0 && isResourceEligibleLine(item.line, props.MNY));
  const reachable985 = reachable.filter(item => item.university.tags.includes('985'));
  const reachable211Plus = reachable.filter(isAtLeast211Candidate);
  const reachable211Only = reachable.filter(item => universityAdmissionTier(item.university) === '211');
  const lowestReachable985 = pickLowestLine(reachable985);
  const lowestReachable211 = pickLowestLine(reachable211Plus);
  const lowestReachable985Margin = lowestReachable985 ? exam.finalScore - lowestReachable985.line.minScore : undefined;
  const highestReachableLineScore = reachable.reduce((max, item) => Math.max(max, item.line.minScore), 0);
  const strategyScore = props.HVOL - props.RSK * 0.35 + routeBonus(selectedTalentIds, eventIds);
  const slide = shouldSlide(props, selectedTalentIds, eventIds, strategyScore, reachable, reachable211Plus.length > 0, random);
  const picked = slide ? null : pickAdmittedLine(reachable, reachable985, reachable211Plus, reachable211Only, strategyScore, props.RSK, exam.finalScore, random);
  const highScoreLowAdmission = isHighScoreLowAdmission(exam.finalScore, lowestReachable985, lowestReachable211, picked, slide);

  if (!picked) {
    return {
      profileId: profile.id,
      profileName: profile.name,
      subjectTrack,
      finalScore: exam.finalScore,
      canReach985: reachable985.length > 0,
      canReach211: reachable211Plus.length > 0,
      lowestReachable985Margin,
      highestReachableLineScore,
      admitted: false,
      admissionTier: slide ? 'slide' : exam.finalScore >= 300 ? 'college' : 'retake',
      strategyScore,
      highScoreLowAdmission: slide && (reachable985.length > 0 || reachable211Plus.length > 0),
    };
  }

  return {
    profileId: profile.id,
    profileName: profile.name,
    subjectTrack,
    finalScore: exam.finalScore,
    canReach985: reachable985.length > 0,
    canReach211: reachable211Plus.length > 0,
    lowestReachable985Margin,
    highestReachableLineScore,
    admitted: true,
    admittedLine: picked.line,
    admittedUniversity: picked.university,
    admissionTier: universityAdmissionTier(picked.university),
    margin: picked.margin,
    strategyScore,
    highScoreLowAdmission,
    ...(isSinoForeignLine(picked.line) ? {
      isSinoForeign: true,
      resourceNeed: lineResourceNeed(picked.line),
      resourceGap: resourceGap(picked.line, props.MNY),
    } : {}),
  };
}

function pickAdmittedLine(reachable, reachable985, reachable211Plus, reachable211Only, strategyScore, risk, finalScore, random) {
  if (reachable.length === 0) return null;
  const lowestReachable985 = pickLowestLine(reachable985);
  const lowestReachable211 = pickLowestLine(reachable211Only.length > 0 ? reachable211Only : reachable211Plus);

  if (lowestReachable985 && random.next() < commit985Chance(finalScore - lowestReachable985.line.minScore, strategyScore, risk)) {
    return pickFromCandidatePool(reachable985, strategyScore, finalScore, random);
  }

  if (lowestReachable211 && random.next() < commit211Chance(finalScore - lowestReachable211.line.minScore, strategyScore, risk)) {
    return pickFromCandidatePool(reachable211Only.length > 0 ? reachable211Only : reachable211Plus, strategyScore, finalScore, random);
  }

  if (reachable211Only.length > 0) {
    return pickFromCandidatePool(reachable211Only, strategyScore, finalScore, random);
  }

  return pickFromCandidatePool(reachable, strategyScore, finalScore, random);
}

function pickFromCandidatePool(candidates, strategyScore, finalScore, random) {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) =>
    b.line.minScore - a.line.minScore || linePrestigeScore(b) - linePrestigeScore(a),
  );
  const denominator = Math.max(1, sorted.length - 1);
  const ranked = sorted.map((item, index) => ({ ...item, rankPercentile: index / denominator }));
  const targetRank = targetAdmissionRank(strategyScore, finalScore);
  const highLineCandidates = ranked.filter(item => item.line.minScore >= 650);
  if (highLineCandidates.length > 0 && random.next() < highLineCommitChance(strategyScore)) {
    return pickWeighted(highLineCandidates, item => admissionChoiceWeight(item, targetRank, strategyScore), random);
  }
  const reasonableCandidates = ranked.filter(item => item.margin <= reasonableMarginLimit(strategyScore, finalScore));
  if (reasonableCandidates.length > 0 && random.next() < reasonableMarginCommitChance(strategyScore)) {
    return pickWeighted(reasonableCandidates, item => admissionChoiceWeight(item, targetRank, strategyScore), random);
  }
  return pickWeighted(ranked, item => admissionChoiceWeight(item, targetRank, strategyScore), random);
}

function commit985Chance(lowestMargin, strategyScore, risk) {
  const base = lowestMargin >= 20 ? 0.8 : lowestMargin >= 8 ? 0.7 : 0.58;
  return clamp(base + commitChanceAdjustment(strategyScore, risk), 0.42, 0.92);
}

function commit211Chance(lowestMargin, strategyScore, risk) {
  const base = lowestMargin >= 25 ? 0.9 : lowestMargin >= 10 ? 0.82 : 0.72;
  return clamp(base + commitChanceAdjustment(strategyScore, risk), 0.54, 0.96);
}

function commitChanceAdjustment(strategyScore, risk) {
  let adjustment = 0;
  if (strategyScore >= 65) adjustment += 0.06;
  else if (strategyScore >= 35) adjustment += 0.02;
  else if (strategyScore < 20) adjustment -= 0.1;
  if (risk >= 80) adjustment -= 0.12;
  else if (risk >= 70) adjustment -= 0.06;
  return adjustment;
}

function highLineCommitChance(strategyScore) {
  if (strategyScore >= 65) return 0.9;
  if (strategyScore >= 35) return 0.85;
  return 0.8;
}

function reasonableMarginLimit(strategyScore, finalScore) {
  const baseLimit = strategyScore >= 65 ? 34 : strategyScore >= 35 ? 42 : 52;
  return finalScore >= 620 ? baseLimit + 12 : baseLimit;
}

function reasonableMarginCommitChance(strategyScore) {
  if (strategyScore >= 65) return 0.96;
  if (strategyScore >= 35) return 0.94;
  return 0.9;
}

function pickLowestLine(candidates) {
  return [...candidates].sort((a, b) => a.line.minScore - b.line.minScore || (a.line.minRank ?? Number.MAX_SAFE_INTEGER) - (b.line.minRank ?? Number.MAX_SAFE_INTEGER))[0] ?? null;
}

function targetAdmissionRank(strategyScore, finalScore) {
  let target = strategyScore >= 65
    ? clamp(0.08 - (strategyScore - 65) * 0.006, 0.02, 0.08)
    : strategyScore >= 35
      ? clamp(0.2 - (strategyScore - 35) * 0.002, 0.1, 0.2)
      : clamp(0.36 - strategyScore * 0.0045, 0.16, 0.5);
  if (finalScore >= 650) target = Math.min(target, strategyScore >= 65 ? 0.025 : strategyScore >= 35 ? 0.045 : 0.065);
  else if (finalScore >= 620) target = Math.min(target, strategyScore >= 65 ? 0.06 : strategyScore >= 35 ? 0.12 : 0.18);
  return target;
}

function admissionChoiceWeight(candidate, targetRank, strategyScore) {
  const spread = strategyScore >= 65 ? 0.12 : strategyScore >= 35 ? 0.24 : 0.3;
  const rankFit = Math.max(0, 1 - Math.abs(candidate.rankPercentile - targetRank) / spread);
  const targetMargin = strategyScore >= 65 ? 8 : strategyScore >= 35 ? 12 : 16;
  const marginFit = Math.max(0, 1 - Math.abs(candidate.margin - targetMargin) / 95);
  const prestige = linePrestigeScore(candidate) / 7000;
  const prestigeWeight = strategyScore >= 65 ? 36 : strategyScore >= 35 ? 22 : 8;
  const tierBonus = admissionTierWeight(candidate.university, strategyScore);
  const baseWeight = 2 + rankFit * rankFit * 145 + marginFit * 42 + prestige * prestigeWeight + tierBonus;
  return Math.max(0.2, baseWeight * marginPenalty(candidate.margin, strategyScore));
}

function marginPenalty(margin, strategyScore) {
  const freeMargin = strategyScore >= 65 ? 24 : strategyScore >= 35 ? 30 : 36;
  const excess = margin - freeMargin;
  if (excess <= 0) return 1;
  if (excess <= 18) return 0.58;
  if (excess <= 42) return 0.22;
  if (excess <= 80) return 0.07;
  return 0.018;
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

function admissionTierWeight(university, strategyScore) {
  const tags = university.tags;
  if (tags.includes('985')) return strategyScore >= 65 ? 90 : strategyScore >= 35 ? 52 : 14;
  if (tags.includes('211')) return strategyScore >= 65 ? 86 : strategyScore >= 35 ? 62 : 22;
  if (tags.includes('doubleFirstClass')) return strategyScore >= 65 ? 36 : strategyScore >= 35 ? 24 : 6;
  return 0;
}

function isSinoForeignLine(line) {
  return line.lineType === 'sinoForeign';
}

function lineResourceNeed(line) {
  return isSinoForeignLine(line) ? line.resourceNeed ?? 6 : 0;
}

function isResourceEligibleLine(line, resourceLevel) {
  return !isSinoForeignLine(line) || Math.floor(resourceLevel) >= lineResourceNeed(line);
}

function resourceGap(line, resourceLevel) {
  return Math.floor(resourceLevel) - lineResourceNeed(line);
}

function routeBonus(selectedTalentIds, eventIds) {
  const talentBonus = selectedTalentIds
    .map(id => content.talents.find(item => item.id === id))
    .reduce((sum, talent) => {
      if (talent?.category === 'volunteer') return sum + 8;
      if (talent?.category === 'route') return sum + 4;
      return sum;
    }, 0);
  const eventBonus = eventIds.some(id => [31027, 31708, 31720, 31732, 31838, 31839].includes(id)) ? 8 : 0;
  return Math.min(22, talentBonus + eventBonus);
}

function routeSignal(selectedTalentIds, eventIds) {
  const riskFlags = new Set(['志愿翻车', '专业误读', '提交惊险']);
  const steadyFlags = new Set(['志愿稳健', '章程避坑', '三角比较', '复读志愿稳健', '复读定位']);
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

function shouldSlide(props, selectedTalentIds, eventIds, strategyScore, reachable, hasReachable211Plus, random) {
  if (reachable.length === 0) return false;
  const route = routeSignal(selectedTalentIds, eventIds);
  let chance = 0.012;
  if (strategyScore < 10 && props.RSK >= 65) chance += 0.1;
  if (strategyScore < 0) chance += 0.08;
  if (strategyScore < 35) chance += 0.015;
  if (props.HVOL < 25) chance += 0.08;
  if (props.RSK >= 75) chance += 0.05;
  chance += route.risk * 0.045;
  chance -= route.steady * 0.035;
  if (hasReachable211Plus) chance = 0;
  chance = clamp(chance, 0, 0.45);
  return random.next() < chance;
}

function isHighScoreLowAdmission(finalScore, lowestReachable985, lowestReachable211, picked, slide) {
  const hasComfortable985Score = Boolean(lowestReachable985 && finalScore >= lowestReachable985.line.minScore + 10);
  const hasComfortable211Score = Boolean(lowestReachable211 && finalScore >= lowestReachable211.line.minScore + 40);
  if (!picked) return slide && (hasComfortable985Score || hasComfortable211Score);
  const actualTier = universityAdmissionTier(picked.university);
  if (hasComfortable985Score) return actualTier !== '985';
  if (hasComfortable211Score) return !['985', '211'].includes(actualTier);
  return false;
}

function universityAdmissionTier(university) {
  if (university.tags.includes('985')) return '985';
  if (university.tags.includes('211')) return '211';
  if (university.tags.includes('doubleFirstClass')) return 'doubleFirstClass';
  return 'undergraduate';
}

function isAtLeast211Candidate(candidate) {
  return ['985', '211'].includes(universityAdmissionTier(candidate.university));
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

function applyEffect(props, effect = {}, scaled = false, phase = null, event = null) {
  for (const [key, value] of Object.entries(effect)) {
    const delta = scaled ? scaledEventDelta(key, value, props[key] ?? 0, phase, event) : value;
    props[key] = (props[key] ?? 0) + delta;
    if (['INT', 'STR', 'MNY', 'SPR'].includes(key)) props[key] = clamp(props[key], 0, 10);
    if (['VOL', 'HVOL'].includes(key)) props[key] = clamp(props[key], 0, 85);
    if (key === 'RSK') props[key] = clamp(props[key], 0, 90);
    if (key === 'SCOREMOD') props[key] = clamp(props[key], -60, 70);
    if (key === 'BASEMOD') props[key] = clamp(props[key], -60, 80);
  }
}

function eventPickWeight(ref, event, props) {
  const baseWeight = ref.weight || event.weight || 1;
  const intDelta = event.effect?.INT ?? 0;
  const strDelta = event.effect?.STR ?? 0;
  const hasGrowth = intDelta > 0 || strDelta > 0;
  const hasSetback = intDelta < 0 || strDelta < 0;
  let multiplier = 1;

  if (hasGrowth) {
    multiplier *= 0.8;
    if (props.INT >= 8 && intDelta > 0) multiplier *= 0.75;
    if (props.STR >= 8 && strDelta > 0) multiplier *= 0.75;
  }

  if (hasSetback) {
    multiplier *= 1.1;
    if (props.INT >= 7 && intDelta < 0) multiplier *= 1.05;
    if (props.STR >= 7 && strDelta < 0) multiplier *= 1.05;
  }

  return Math.max(1, baseWeight * multiplier);
}

function scaledEventDelta(prop, delta, current, phase = null, event = null) {
  const positiveScale = phase === 'senior3' ? senior3PositiveEventEffectScale : positiveEventEffectScale;
  const negativeScale = phase === 'senior3' ? senior3NegativeEventEffectScale : negativeEventEffectScale;
  const scale = delta >= 0 ? positiveScale[prop] ?? 1 : negativeScale[prop] ?? 1;
  return delta * scale * positiveEventSoftCap(prop, delta, current) * positiveVolunteerEventScale(prop, delta, event);
}

function positiveEventSoftCap(prop, delta, current) {
  if (delta <= 0) return 1;
  if (prop !== 'INT' && prop !== 'STR') return 1;
  if (current >= 9) return 0.45;
  if (current >= 8) return 0.65;
  if (current >= 7) return 0.85;
  return 1;
}

function positiveVolunteerEventScale(prop, delta, event) {
  if (prop !== 'VOL' || delta <= 0) return 1;
  if (event?.flag && keyVolunteerEventFlags.has(event.flag)) return 1;
  if (event?.tags?.includes('志愿')) return 0.85;
  return 0.7;
}

function refreshScore(props, phase) {
  const base = phaseBase[phase];
  props.SCR = clamp(Math.round(base + props.INT * 8.5 + props.STR * 4.8 + props.MNY * 3 + props.SPR * 5.2 + props.VOL * 0.2 - props.RSK * 1.35 + props.SCOREMOD * 0.6 + (props.BASEMOD ?? 0)), 250, 750);
  props.HSCR = Math.max(props.HSCR, props.SCR);
  props.HVOL = Math.max(props.HVOL, props.VOL);
}

function evaluate(condition, props, talentIds, eventIds, admission = null, subjectTrack = null) {
  if (!condition) return true;
  const admissionProps = {
    ADMSCORE: admission?.finalScore ?? 0,
    ADMITTED: admission?.admitted ? 1 : 0,
    MARGIN: admission?.margin ?? 0,
    LOWEST985MARGIN: admission?.lowestReachable985Margin ?? 0,
    SLIDE: admission?.admissionTier === 'slide' ? 1 : 0,
    COOP: admission?.isSinoForeign ? 1 : 0,
    RESOURCE_NEED: admission?.resourceNeed ?? 0,
    RESOURCE_GAP: admission?.resourceGap ?? 0,
    TIER_RANK: admission ? admissionTierRank(admission.admissionTier) : -1,
    PREV_SCORE: 0,
    SCORE_DELTA: 0,
    PREV_TIER_RANK: -1,
    TIER_DELTA: 0,
    PREV_MARGIN: 0,
    PREV_CAN_REACH_985: 0,
    PREV_CAN_REACH_211: 0,
    SAME_SCHOOL: 0,
    SAME_ENDING: 0,
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
    .replace(/TRACK\?\[([A-Za-z0-9_,]+)\]/g, (_, ids) => ids.split(',').some(id => subjectTrack === id))
    .replace(/TRACK!\[([A-Za-z0-9_,]+)\]/g, (_, ids) => !ids.split(',').some(id => subjectTrack === id))
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
  if (tier === 'sinoForeign') return admission.isSinoForeign === true;
  if (tier === '985') return admission.admissionTier === '985';
  if (tier === '211') return ['985', '211'].includes(admission.admissionTier);
  if (tier === 'doubleFirstClass') return ['985', '211', 'doubleFirstClass'].includes(admission.admissionTier);
  return admission.admissionTier === tier;
}

function admissionTierRank(tier) {
  return {
    slide: -1,
    retake: -1,
    college: 0,
    undergraduate: 1,
    doubleFirstClass: 2,
    '211': 3,
    '985': 4,
  }[tier] ?? -1;
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
  if (score < 450) return '<450';
  if (score < 500) return '450-499';
  if (score < 550) return '500-549';
  if (score < 580) return '550-579';
  if (score < 610) return '580-609';
  if (score < 650) return '610-649';
  return '650+';
}

function propertyBucket(prop, value) {
  if (['INT', 'STR', 'MNY', 'SPR'].includes(prop)) {
    if (value < 4) return '0-3';
    if (value < 6) return '4-5';
    if (value < 8) return '6-7';
    if (value < 9) return '8';
    if (value < 10) return '9';
    return '10';
  }
  if (prop === 'VOL') {
    if (value < 25) return '<25';
    if (value < 45) return '25-44';
    if (value < 65) return '45-64';
    if (value < 85) return '65-84';
    return '85';
  }
  if (prop === 'RSK') {
    if (value < 25) return '<25';
    if (value < 45) return '25-44';
    if (value < 65) return '45-64';
    if (value < 80) return '65-79';
    return '80+';
  }
  if (value < 0) return '<0';
  if (value < 10) return '0-9';
  if (value < 20) return '10-19';
  if (value < 30) return '20-29';
  return '30+';
}

function propertyBucketOrder(prop) {
  if (['INT', 'STR', 'MNY', 'SPR'].includes(prop)) return ['0-3', '4-5', '6-7', '8', '9', '10'];
  if (prop === 'VOL') return ['<25', '25-44', '45-64', '65-84', '85'];
  if (prop === 'RSK') return ['<25', '25-44', '45-64', '65-79', '80+'];
  return ['<0', '0-9', '10-19', '20-29', '30+'];
}

function admissionLineScoreBucket(score) {
  if (score < 500) return '<500';
  if (score < 530) return '500-529';
  if (score < 550) return '530-549';
  if (score < 570) return '550-569';
  if (score < 590) return '570-589';
  if (score < 610) return '590-609';
  if (score < 630) return '610-629';
  if (score < 650) return '630-649';
  return '650+';
}

function admissionMarginBucket(margin) {
  if (margin < 0) return '<0';
  if (margin <= 5) return '0-5';
  if (margin <= 15) return '6-15';
  if (margin <= 30) return '16-30';
  if (margin <= 60) return '31-60';
  if (margin <= 100) return '61-100';
  return '100+';
}

function printBucketDistribution(label, distribution, buckets, total) {
  console.log(`${label}:`);
  const denominator = Math.max(1, total);
  for (const bucket of buckets) {
    const count = distribution.get(bucket) ?? 0;
    console.log(`- ${bucket}: ${count} (${(count / denominator * 100).toFixed(1)}%)`);
  }
}

function printNumericSummary(label, values, digits = 1) {
  if (values.length === 0) {
    console.log(`${label}: no data`);
    return;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const format = value => value.toFixed(digits);
  console.log(`${label}: min ${format(sorted[0])}, p25 ${format(percentile(sorted, 0.25))}, median ${format(percentile(sorted, 0.5))}, p75 ${format(percentile(sorted, 0.75))}, max ${format(sorted.at(-1))}, avg ${format(avg)}`);
}

function percentile(sorted, ratio) {
  if (sorted.length === 0) return 0;
  const index = Math.round((sorted.length - 1) * ratio);
  return sorted[index];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const { runs, options } = parseArgs(process.argv.slice(2));
simulate(runs, options);

function parseArgs(args) {
  let runs = 1000;
  const options = {};
  for (const arg of args) {
    if (/^\d+$/.test(arg)) {
      runs = Number(arg);
      continue;
    }
    if (arg === '--fixed-5') {
      options.fixedAllocation = { INT: 5, STR: 5, MNY: 5, SPR: 5 };
      continue;
    }
    const fixedMatch = arg.match(/^--fixed-allocation=(\d+),(\d+),(\d+),(\d+)$/);
    if (fixedMatch) {
      const [, INT, STR, MNY, SPR] = fixedMatch;
      options.fixedAllocation = {
        INT: Number(INT),
        STR: Number(STR),
        MNY: Number(MNY),
        SPR: Number(SPR),
      };
    }
  }
  return { runs, options };
}
