import type {
  AdmissionLine,
  AdmissionProfile,
  AdmissionResult,
  AdmissionStrategyLabel,
  AdmissionTier,
  Ending,
  ExamScoreResult,
  GameContent,
  GameState,
  Props,
  SubjectTrack,
  University,
} from '../app/types';
import { clamp } from './properties';
import { pickWeighted, Random } from './random';
import { subjectTrackName, subjectTrackProfileId } from './subjectTrack';

interface LineCandidate {
  line: AdmissionLine;
  university: University;
  margin: number;
}

const recommendedUniversityNames = [
  '北京大学',
  '清华大学',
  '中国科学技术大学',
  '复旦大学',
  '上海交通大学',
  '浙江大学',
  '南京大学',
];

export function calculateExamScore(props: Props, random: Random): ExamScoreResult {
  const potentialScore = props.SCR;
  const stabilityBonus = clamp(props.SPR * 0.8 - props.RSK * 0.12, -10, 10);
  const varianceRange = clamp(22 + props.RSK * 0.3 - props.SPR * 0.8, 10, 44);
  const variance = Math.round((random.next() * 2 - 1) * varianceRange);
  const breakthrough = rollBreakthroughBonus(props, potentialScore, random);
  const setback = breakthrough > 0 ? 0 : rollSetbackPenalty(props, potentialScore, random);
  const rawScore = Math.round(potentialScore + stabilityBonus + variance + breakthrough - setback);
  const bandCalibration = scoreBandCalibration(rawScore, props);
  const finalScore = clamp(rawScore + bandCalibration, 250, 750);
  const tailText = breakthrough > 0
    ? `，状态爆发 ${formatSigned(breakthrough)}`
    : setback > 0
      ? `，临场失常 ${formatSigned(-setback)}`
      : '';
  const calibrationText = bandCalibration !== 0 ? `，分段校准 ${formatSigned(bandCalibration)}` : '';

  return {
    finalScore,
    potentialScore,
    variance: variance + breakthrough - setback + bandCalibration,
    explanation: `以当前实力 ${potentialScore} 为基准，稳定性修正 ${formatSigned(stabilityBonus)}，临场波动 ${formatSigned(variance)}${tailText}${calibrationText}。`,
  };
}

function scoreBandCalibration(rawScore: number, props: Props): number {
  const elitePrepared = props.INT >= 9 && props.SCOREMOD >= 34 && props.RSK < 68;
  if (elitePrepared && rawScore >= 588 && rawScore < 602) return 14;
  if (rawScore >= 555 && rawScore < 602) return elitePrepared ? 7 : -8;
  if (rawScore >= 602 && rawScore < 640 && elitePrepared) return 4;
  return 0;
}

function rollBreakthroughBonus(props: Props, potentialScore: number, random: Random): number {
  const baseChance = potentialScore >= 575 ? (potentialScore - 575) / 560 : 0;
  const aptitudeChance =
    Math.max(0, props.INT - 8) * 0.016
    + Math.max(0, props.STR - 8) * 0.01
    + Math.max(0, props.SPR - 6) * 0.008
    + Math.max(0, props.HVOL - 55) * 0.001
    + Math.max(0, props.SCOREMOD - 15) * 0.0014;
  const riskPenalty = props.RSK >= 55 ? 0.02 : 0;
  const chance = clamp(baseChance + aptitudeChance - riskPenalty, 0, 0.22);
  if (random.next() >= chance) return 0;
  return Math.round(clamp(22 + random.next() * 42 + Math.max(0, potentialScore - 615) * 0.35, 18, 85));
}

function rollSetbackPenalty(props: Props, potentialScore: number, random: Random): number {
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

export function resolveAdmission(
  content: GameContent,
  state: GameState,
  exam: ExamScoreResult,
  random: Random,
): AdmissionResult {
  const profile = getProfileForTrack(content, state);
  const trackName = subjectTrackName(state.subjectTrack!);
  const universities = new Map(content.universities.map(item => [item.code, item]));
  const lines = content.admissionLines
    .filter(item => item.profileId === profile.id)
    .map(line => {
      const university = universities.get(line.universityCode);
      return university ? { line, university, margin: exam.finalScore - line.minScore } : null;
    })
    .filter((item): item is LineCandidate => Boolean(item));

  const reachable = lines.filter(item => item.margin >= 0 && isResourceEligibleLine(item.line, state.props.MNY));
  const reachable985 = reachable.filter(item => item.university.tags.includes('985'));
  const reachable211Plus = reachable.filter(isAtLeast211Candidate);
  const reachable211Only = reachable.filter(item => universityAdmissionTier(item.university) === '211');
  const bestReachable985 = pickBestReachable(reachable985)?.line;
  const bestReachable211 = pickBestReachable(reachable211Plus)?.line;
  const lowestReachable985 = pickLowestLine(reachable985);
  const lowestReachable211 = pickLowestLine(reachable211Plus);
  const lowestReachable985Margin = lowestReachable985 ? exam.finalScore - lowestReachable985.line.minScore : undefined;
  const strategyScore = state.props.HVOL - state.props.RSK * 0.35 + routeBonus(content, state);
  const slide = shouldSlide(content, state, strategyScore, reachable, reachable211Plus.length > 0, random);
  const picked = slide ? null : pickAdmittedLine(
    reachable,
    reachable985,
    reachable211Plus,
    reachable211Only,
    strategyScore,
    state.props.RSK,
    exam.finalScore,
    random,
  );
  const strategyLabel = labelStrategy(strategyScore, slide);
  const highScoreLowAdmission = isHighScoreLowAdmission(exam.finalScore, lowestReachable985, lowestReachable211, picked, slide);

  if (!picked) {
    const fallbackTier = resolveFallbackTier(exam.finalScore, reachable.length, slide);
    return {
      profileId: profile.id,
      profileName: profile.name,
      subjectTrack: state.subjectTrack!,
      subjectTrackName: trackName,
      finalScore: exam.finalScore,
      potentialScore: exam.potentialScore,
      variance: exam.variance,
      canReach985: reachable985.length > 0,
      canReach211: reachable211Plus.length > 0,
      ...(bestReachable985 ? { bestReachable985 } : {}),
      ...(bestReachable211 ? { bestReachable211 } : {}),
      ...(lowestReachable985Margin !== undefined ? { lowestReachable985Margin } : {}),
      admitted: false,
      admissionTier: fallbackTier,
      strategyLabel,
      strategyScore,
      highScoreLowAdmission,
      reason: slide
        ? '分数本可填报部分本科院校，但志愿信息不足且风险过高，本轮模拟判定为滑档。'
        : exam.finalScore >= 300
          ? '未达到当前本科普通批样本院校投档线，进入专科或后续批次选择。'
          : '未达到本科普通批样本院校投档线，本轮更接近复读或重新规划。',
    };
  }

  return {
    profileId: profile.id,
    profileName: profile.name,
    subjectTrack: state.subjectTrack!,
    subjectTrackName: trackName,
    finalScore: exam.finalScore,
    potentialScore: exam.potentialScore,
    variance: exam.variance,
    canReach985: reachable985.length > 0,
    canReach211: reachable211Plus.length > 0,
    ...(bestReachable985 ? { bestReachable985 } : {}),
    ...(bestReachable211 ? { bestReachable211 } : {}),
    ...(lowestReachable985Margin !== undefined ? { lowestReachable985Margin } : {}),
    admitted: true,
    admittedLine: picked.line,
    admittedUniversity: picked.university,
    admissionTier: universityAdmissionTier(picked.university),
    margin: picked.margin,
    strategyLabel,
    strategyScore,
    highScoreLowAdmission,
    ...(isSinoForeignLine(picked.line) ? {
      isSinoForeign: true,
      resourceNeed: lineResourceNeed(picked.line),
      resourceGap: resourceGap(picked.line, state.props.MNY),
    } : {}),
    reason: buildAdmissionReason(picked, strategyLabel, reachable985.length > 0, reachable211Plus.length > 0, state.props.MNY),
  };
}

export function resolveRecommendedAdmission(
  content: GameContent,
  state: GameState,
  ending: Ending,
  random: Random,
): AdmissionResult {
  const track = state.subjectTrack ?? 'physics';
  const profile = getProfileForSubjectTrack(content, track);
  const university = pickRecommendedUniversity(content, random);
  const admissionTier = universityAdmissionTier(university);

  return {
    profileId: profile.id,
    profileName: profile.name,
    subjectTrack: track,
    subjectTrackName: state.subjectTrack ? subjectTrackName(track) : '保送',
    finalScore: 0,
    potentialScore: state.props.SCR,
    variance: 0,
    scoreHidden: true,
    canReach985: admissionTier === '985',
    canReach211: ['985', '211'].includes(admissionTier),
    admitted: true,
    admittedUniversity: university,
    admissionTier,
    strategyLabel: '冲刺',
    highScoreLowAdmission: false,
    reason: `已通过${ending.name}路线提前锁定 ${university.name} 录取资格，后续流程直接结算。`,
  };
}

function getProfileForTrack(content: GameContent, state: GameState): AdmissionProfile {
  if (!state.subjectTrack) throw new Error('缺少分科结果，无法结算录取');
  return getProfileForSubjectTrack(content, state.subjectTrack);
}

function getProfileForSubjectTrack(content: GameContent, track: SubjectTrack): AdmissionProfile {
  const profileId = subjectTrackProfileId(track);
  const profile = content.admissionProfiles.find(item => item.id === profileId)
    ?? content.admissionProfiles.find(item => item.default)
    ?? content.admissionProfiles[0];
  if (!profile) throw new Error(`缺少录取档案 ${profileId}`);
  return profile;
}

function pickRecommendedUniversity(content: GameContent, random: Random): University {
  const preferred = recommendedUniversityNames
    .map(name => content.universities.find(item => item.name === name))
    .filter((item): item is University => Boolean(item));
  const top985 = content.universities.filter(item => item.prestigeTier === 'top' && item.tags.includes('985'));
  const candidates = preferred.length > 0
    ? preferred
    : top985.length > 0
      ? top985
      : content.universities;
  const picked = pickWeighted(candidates, recommendedUniversityWeight, random);
  if (!picked) throw new Error('缺少保送录取院校数据');
  return picked;
}

function recommendedUniversityWeight(university: University): number {
  const prestigeWeight = {
    top: 20,
    strong: 12,
    solid: 8,
    regional: 4,
    private: 1,
  }[university.prestigeTier];
  const tagWeight = university.tags.includes('985')
    ? 8
    : university.tags.includes('211')
      ? 5
      : university.tags.includes('doubleFirstClass')
        ? 3
        : 0;
  return prestigeWeight + tagWeight;
}

function pickBestReachable(candidates: LineCandidate[]): LineCandidate | null {
  return [...candidates].sort((a, b) => linePrestigeScore(b) - linePrestigeScore(a))[0] ?? null;
}

function pickLowestLine(candidates: LineCandidate[]): LineCandidate | null {
  return [...candidates].sort((a, b) => a.line.minScore - b.line.minScore || (a.line.minRank ?? Number.MAX_SAFE_INTEGER) - (b.line.minRank ?? Number.MAX_SAFE_INTEGER))[0] ?? null;
}

function pickAdmittedLine(
  reachable: LineCandidate[],
  reachable985: LineCandidate[],
  reachable211Plus: LineCandidate[],
  reachable211Only: LineCandidate[],
  strategyScore: number,
  risk: number,
  finalScore: number,
  random: Random,
): LineCandidate | null {
  if (reachable.length === 0) return null;
  const lowestReachable985 = pickLowestLine(reachable985);
  const lowestReachable211 = pickLowestLine(reachable211Only.length > 0 ? reachable211Only : reachable211Plus);
  const preferred211Pool = reachable211Only.length > 0 ? reachable211Only : reachable211Plus;
  const competitive211Pool = build211CompetitivePool(reachable, preferred211Pool, lowestReachable211);

  if (
    lowestReachable985
    && random.next() < commit985Chance(finalScore - lowestReachable985.line.minScore, strategyScore, risk)
  ) {
    return pickFromCandidatePool(reachable985, strategyScore, finalScore, random);
  }

  if (
    lowestReachable211
    && random.next() < commit211Chance(finalScore - lowestReachable211.line.minScore, strategyScore, risk)
  ) {
    const exploresPeerAlternatives = competitive211Pool.length > preferred211Pool.length
      && random.next() < peerAlternativeChance(strategyScore);
    return pickFromCandidatePool(
      exploresPeerAlternatives ? competitive211Pool : preferred211Pool,
      strategyScore,
      finalScore,
      random,
    );
  }

  if (preferred211Pool.length > 0) {
    return pickFromCandidatePool(competitive211Pool, strategyScore, finalScore, random);
  }

  return pickFromCandidatePool(reachable, strategyScore, finalScore, random);
}

function build211CompetitivePool(
  reachable: LineCandidate[],
  preferred211Pool: LineCandidate[],
  lowestReachable211: LineCandidate | null,
): LineCandidate[] {
  if (preferred211Pool.length === 0 || !lowestReachable211) return preferred211Pool;
  const lowest211Score = lowestReachable211.line.minScore;
  const alternatives = reachable.filter(candidate => is211PeerAlternative(candidate, lowest211Score));
  return [...preferred211Pool, ...alternatives];
}

function is211PeerAlternative(candidate: LineCandidate, lowest211Score: number): boolean {
  const tier = universityAdmissionTier(candidate.university);
  if (tier === '985' || tier === '211') return false;
  return candidate.line.minScore >= lowest211Score
    || candidate.university.tags.includes('doubleFirstClass')
    || candidate.university.prestigeTier === 'strong';
}

function peerAlternativeChance(strategyScore: number): number {
  if (strategyScore >= 65) return 0.18;
  if (strategyScore >= 35) return 0.12;
  return 0.08;
}

function pickFromCandidatePool(
  candidates: LineCandidate[],
  strategyScore: number,
  finalScore: number,
  random: Random,
): LineCandidate | null {
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

function commit985Chance(lowestMargin: number, strategyScore: number, risk: number): number {
  const base = lowestMargin >= 20 ? 0.8 : lowestMargin >= 8 ? 0.7 : 0.58;
  return clamp(base + commitChanceAdjustment(strategyScore, risk), 0.42, 0.92);
}

function commit211Chance(lowestMargin: number, strategyScore: number, risk: number): number {
  const base = lowestMargin >= 25 ? 0.9 : lowestMargin >= 10 ? 0.82 : 0.72;
  return clamp(base + commitChanceAdjustment(strategyScore, risk), 0.54, 0.96);
}

function commitChanceAdjustment(strategyScore: number, risk: number): number {
  let adjustment = 0;
  if (strategyScore >= 65) adjustment += 0.06;
  else if (strategyScore >= 35) adjustment += 0.02;
  else if (strategyScore < 20) adjustment -= 0.1;
  if (risk >= 80) adjustment -= 0.12;
  else if (risk >= 70) adjustment -= 0.06;
  return adjustment;
}

function highLineCommitChance(strategyScore: number): number {
  if (strategyScore >= 65) return 0.9;
  if (strategyScore >= 35) return 0.85;
  return 0.8;
}

function reasonableMarginLimit(strategyScore: number, finalScore: number): number {
  const baseLimit = strategyScore >= 65 ? 34 : strategyScore >= 35 ? 42 : 52;
  return finalScore >= 620 ? baseLimit + 12 : baseLimit;
}

function reasonableMarginCommitChance(strategyScore: number): number {
  if (strategyScore >= 65) return 0.96;
  if (strategyScore >= 35) return 0.94;
  return 0.9;
}

function targetAdmissionRank(strategyScore: number, finalScore: number): number {
  let target = strategyScore >= 65
    ? clamp(0.08 - (strategyScore - 65) * 0.006, 0.02, 0.08)
    : strategyScore >= 35
      ? clamp(0.2 - (strategyScore - 35) * 0.002, 0.1, 0.2)
      : clamp(0.36 - strategyScore * 0.0045, 0.16, 0.5);
  if (finalScore >= 650) target = Math.min(target, strategyScore >= 65 ? 0.025 : strategyScore >= 35 ? 0.045 : 0.065);
  else if (finalScore >= 620) target = Math.min(target, strategyScore >= 65 ? 0.06 : strategyScore >= 35 ? 0.12 : 0.18);
  return target;
}

function admissionChoiceWeight(
  candidate: LineCandidate & { rankPercentile: number },
  targetRank: number,
  strategyScore: number,
): number {
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

function marginPenalty(margin: number, strategyScore: number): number {
  const freeMargin = strategyScore >= 65 ? 24 : strategyScore >= 35 ? 30 : 36;
  const excess = margin - freeMargin;
  if (excess <= 0) return 1;
  if (excess <= 18) return 0.58;
  if (excess <= 42) return 0.22;
  if (excess <= 80) return 0.07;
  return 0.018;
}

function linePrestigeScore(candidate: LineCandidate): number {
  const tierWeight = {
    top: 5000,
    strong: 3800,
    solid: 2800,
    regional: 1600,
    private: 500,
  }[candidate.university.prestigeTier];
  const tagBonus = candidate.university.tags.includes('985')
    ? 1400
    : candidate.university.tags.includes('211')
      ? 900
      : candidate.university.tags.includes('doubleFirstClass')
        ? 650
        : 0;
  return tierWeight + tagBonus + candidate.line.minScore;
}

function admissionTierWeight(university: University, strategyScore: number): number {
  const tags = university.tags;
  if (tags.includes('985')) return strategyScore >= 65 ? 90 : strategyScore >= 35 ? 52 : 14;
  if (tags.includes('211')) return strategyScore >= 65 ? 86 : strategyScore >= 35 ? 62 : 22;
  if (tags.includes('doubleFirstClass')) return strategyScore >= 65 ? 36 : strategyScore >= 35 ? 24 : 6;
  return 0;
}

function isSinoForeignLine(line: AdmissionLine): boolean {
  return line.lineType === 'sinoForeign';
}

function lineResourceNeed(line: AdmissionLine): number {
  return isSinoForeignLine(line) ? line.resourceNeed ?? 6 : 0;
}

function isResourceEligibleLine(line: AdmissionLine, resourceLevel: number): boolean {
  return !isSinoForeignLine(line) || Math.floor(resourceLevel) >= lineResourceNeed(line);
}

function resourceGap(line: AdmissionLine, resourceLevel: number): number {
  return Math.floor(resourceLevel) - lineResourceNeed(line);
}

function shouldSlide(
  content: GameContent,
  state: GameState,
  strategyScore: number,
  reachable: LineCandidate[],
  hasReachable211Plus: boolean,
  random: Random,
): boolean {
  if (reachable.length === 0) return false;
  const route = routeSignal(content, state);
  let chance = 0.012;
  if (strategyScore < 10 && state.props.RSK >= 65) chance += 0.1;
  if (strategyScore < 0) chance += 0.08;
  if (strategyScore < 35) chance += 0.015;
  if (state.props.HVOL < 25) chance += 0.08;
  if (state.props.RSK >= 75) chance += 0.05;
  chance += route.risk * 0.045;
  chance -= route.steady * 0.035;
  if (state.retakeUsed) chance -= 0.04;
  if (hasReachable211Plus) chance = 0;
  chance = clamp(chance, 0, 0.45);
  return random.next() < chance;
}

function resolveFallbackTier(finalScore: number, reachableCount: number, slide: boolean): AdmissionTier {
  if (slide && reachableCount > 0) return 'slide';
  if (finalScore >= 300) return 'college';
  return 'retake';
}

function labelStrategy(strategyScore: number, slide: boolean): AdmissionStrategyLabel {
  if (slide) return '失误';
  if (strategyScore >= 65) return '冲刺';
  if (strategyScore >= 35) return '均衡';
  return '稳妥';
}

function universityAdmissionTier(university: University): AdmissionTier {
  if (university.tags.includes('985')) return '985';
  if (university.tags.includes('211')) return '211';
  if (university.tags.includes('doubleFirstClass')) return 'doubleFirstClass';
  return 'undergraduate';
}

function isAtLeast211Candidate(candidate: LineCandidate): boolean {
  return ['985', '211'].includes(universityAdmissionTier(candidate.university));
}

function routeBonus(content: GameContent, state: GameState): number {
  const talentBonus = state.selectedTalentIds
    .map(id => content.talents.find(item => item.id === id))
    .filter(Boolean)
    .reduce((sum, talent) => {
      if (talent?.category === 'volunteer') return sum + 8;
      if (talent?.category === 'route') return sum + 4;
      return sum;
    }, 0);
  const eventBonus = state.eventIds.some(id => [31027, 31708, 31720, 31732, 31838, 31839].includes(id)) ? 8 : 0;
  const retakeBonus = state.retakeUsed ? 5 : 0;
  return Math.min(22, talentBonus + eventBonus + retakeBonus);
}

function routeSignal(content: GameContent, state: GameState): { risk: number; steady: number } {
  const events = new Map(content.events.map(item => [item.id, item]));
  const talents = new Map(content.talents.map(item => [item.id, item]));
  const riskFlags = new Set(['志愿翻车', '专业误读', '提交惊险']);
  const steadyFlags = new Set(['志愿稳健', '章程避坑', '三角比较', '复读志愿稳健', '复读定位']);
  const riskTalentNames = new Set(['名校滤镜', '冲校上头']);
  const steadyTalentNames = new Set(['风险分层']);
  let risk = 0;
  let steady = 0;
  for (const id of state.eventIds) {
    const flag = events.get(id)?.flag;
    if (flag && riskFlags.has(flag)) risk += 1;
    if (flag && steadyFlags.has(flag)) steady += 1;
  }
  for (const id of state.selectedTalentIds) {
    const name = talents.get(id)?.name;
    if (name && riskTalentNames.has(name)) risk += 1;
    if (name && steadyTalentNames.has(name)) steady += 1;
  }
  return { risk, steady };
}

function isHighScoreLowAdmission(
  finalScore: number,
  lowestReachable985: LineCandidate | null,
  lowestReachable211: LineCandidate | null,
  picked: LineCandidate | null,
  slide: boolean,
): boolean {
  const hasComfortable985Score = Boolean(lowestReachable985 && finalScore >= lowestReachable985.line.minScore + 10);
  const hasComfortable211Score = Boolean(lowestReachable211 && finalScore >= lowestReachable211.line.minScore + 40);
  if (!picked) return slide && (hasComfortable985Score || hasComfortable211Score);
  const actualTier = universityAdmissionTier(picked.university);
  if (hasComfortable985Score) return actualTier !== '985';
  if (hasComfortable211Score) return !['985', '211'].includes(actualTier);
  return false;
}

function buildAdmissionReason(
  picked: LineCandidate,
  strategyLabel: AdmissionStrategyLabel,
  canReach985: boolean,
  canReach211: boolean,
  resourceLevel: number,
): string {
  const reach = canReach985 ? '分数已达到样本 985 院校线' : canReach211 ? '分数已达到样本 211 院校线' : '分数达到本科普通批样本院校线';
  const cooperationText = isSinoForeignLine(picked.line)
    ? `该专业组为中外合作办学，资源需求 ${lineResourceNeed(picked.line)}，当前资源 ${Math.floor(resourceLevel)}。`
    : '';
  return `${reach}；按${strategyLabel}策略，录取到 ${picked.university.name}，超该专业组投档线 ${picked.margin} 分。${cooperationText}`;
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${Math.round(value)}` : String(Math.round(value));
}
