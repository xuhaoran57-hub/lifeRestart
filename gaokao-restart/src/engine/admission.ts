import type {
  AdmissionLine,
  AdmissionProfile,
  AdmissionResult,
  AdmissionStrategyLabel,
  AdmissionTier,
  ExamScoreResult,
  GameContent,
  GameState,
  Props,
  University,
} from '../app/types';
import { clamp } from './properties';
import { Random } from './random';

interface LineCandidate {
  line: AdmissionLine;
  university: University;
  margin: number;
}

export function calculateExamScore(props: Props, random: Random): ExamScoreResult {
  const potentialScore = props.SCR;
  const stabilityBonus = clamp(props.SPR * 0.8 - props.RSK * 0.12, -10, 10);
  const varianceRange = clamp(18 + props.RSK * 0.22 - props.SPR * 1.1, 6, 35);
  const variance = Math.round((random.next() * 2 - 1) * varianceRange);
  const finalScore = clamp(Math.round(potentialScore + stabilityBonus + variance), 250, 750);

  return {
    finalScore,
    potentialScore,
    variance,
    explanation: `以当前实力 ${potentialScore} 为基准，稳定性修正 ${formatSigned(stabilityBonus)}，临场波动 ${formatSigned(variance)}。`,
  };
}

export function resolveAdmission(content: GameContent, state: GameState, exam: ExamScoreResult): AdmissionResult {
  const profile = getDefaultProfile(content);
  const universities = new Map(content.universities.map(item => [item.code, item]));
  const lines = content.admissionLines
    .filter(item => item.profileId === profile.id)
    .map(line => {
      const university = universities.get(line.universityCode);
      return university ? { line, university, margin: exam.finalScore - line.minScore } : null;
    })
    .filter((item): item is LineCandidate => Boolean(item));

  const reachable = lines.filter(item => item.margin >= 0);
  const reachable985 = reachable.filter(item => item.university.tags.includes('985'));
  const reachable211 = reachable.filter(item => item.university.tags.includes('211'));
  const bestReachable985 = pickBestReachable(reachable985)?.line;
  const bestReachable211 = pickBestReachable(reachable211)?.line;
  const strategyScore = state.props.HVOL - state.props.RSK * 0.35 + routeBonus(content, state);
  const slide = shouldSlide(state, strategyScore, reachable);
  const picked = slide ? null : pickAdmittedLine(reachable, strategyScore);
  const strategyLabel = labelStrategy(strategyScore, slide);

  if (!picked) {
    const fallbackTier = resolveFallbackTier(exam.finalScore, reachable.length, slide);
    return {
      profileId: profile.id,
      profileName: profile.name,
      finalScore: exam.finalScore,
      potentialScore: exam.potentialScore,
      variance: exam.variance,
      canReach985: reachable985.length > 0,
      canReach211: reachable211.length > 0,
      ...(bestReachable985 ? { bestReachable985 } : {}),
      ...(bestReachable211 ? { bestReachable211 } : {}),
      admitted: false,
      admissionTier: fallbackTier,
      strategyLabel,
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
    finalScore: exam.finalScore,
    potentialScore: exam.potentialScore,
    variance: exam.variance,
    canReach985: reachable985.length > 0,
    canReach211: reachable211.length > 0,
    ...(bestReachable985 ? { bestReachable985 } : {}),
    ...(bestReachable211 ? { bestReachable211 } : {}),
    admitted: true,
    admittedLine: picked.line,
    admittedUniversity: picked.university,
    admissionTier: universityAdmissionTier(picked.university),
    margin: picked.margin,
    strategyLabel,
    reason: buildAdmissionReason(picked, profile, strategyLabel, reachable985.length > 0, reachable211.length > 0),
  };
}

function getDefaultProfile(content: GameContent): AdmissionProfile {
  const profile = content.admissionProfiles.find(item => item.default) ?? content.admissionProfiles[0];
  if (!profile) throw new Error('缺少录取档案');
  return profile;
}

function pickBestReachable(candidates: LineCandidate[]): LineCandidate | null {
  return [...candidates].sort((a, b) => linePrestigeScore(b) - linePrestigeScore(a))[0] ?? null;
}

function pickAdmittedLine(reachable: LineCandidate[], strategyScore: number): LineCandidate | null {
  if (reachable.length === 0) return null;

  const targetMargin = strategyScore >= 65 ? 8 : strategyScore >= 35 ? 22 : 48;
  const minMargin = strategyScore >= 65 ? 0 : strategyScore >= 35 ? 8 : 28;
  const maxMargin = strategyScore >= 65 ? 24 : strategyScore >= 35 ? 42 : 90;
  const preferred = reachable.filter(item => item.margin >= minMargin && item.margin <= maxMargin);
  const pool = preferred.length ? preferred : reachable;

  return [...pool].sort((a, b) => admissionChoiceScore(b, targetMargin) - admissionChoiceScore(a, targetMargin))[0] ?? null;
}

function admissionChoiceScore(candidate: LineCandidate, targetMargin: number): number {
  return linePrestigeScore(candidate) - Math.abs(candidate.margin - targetMargin) * 3;
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

function shouldSlide(state: GameState, strategyScore: number, reachable: LineCandidate[]): boolean {
  if (reachable.length === 0) return false;
  return strategyScore < 10 && state.props.RSK >= 65 && state.props.HVOL < 25;
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

function routeBonus(content: GameContent, state: GameState): number {
  const talentBonus = state.selectedTalentIds
    .map(id => content.talents.find(item => item.id === id))
    .filter(Boolean)
    .reduce((sum, talent) => {
      if (talent?.category === 'volunteer') return sum + 8;
      if (talent?.category === 'route') return sum + 4;
      return sum;
    }, 0);
  const eventBonus = state.eventIds.some(id => [31027, 31708, 31720, 31732].includes(id)) ? 8 : 0;
  return Math.min(18, talentBonus + eventBonus);
}

function buildAdmissionReason(
  picked: LineCandidate,
  profile: AdmissionProfile,
  strategyLabel: AdmissionStrategyLabel,
  canReach985: boolean,
  canReach211: boolean,
): string {
  const reach = canReach985 ? '分数已达到样本 985 院校线' : canReach211 ? '分数已达到样本 211 院校线' : '分数达到本科普通批样本院校线';
  return `${reach}；按${strategyLabel}策略，录取到 ${picked.university.name}，超该专业组投档线 ${picked.margin} 分。数据口径：${profile.name} ${profile.batch}。`;
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${Math.round(value)}` : String(Math.round(value));
}
