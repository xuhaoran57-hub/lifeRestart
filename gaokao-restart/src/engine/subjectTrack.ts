import type { GameState, SubjectTrack } from '../app/types';
import type { Random } from './random';

export const HISTORY_LOCK_TALENT_ID = 21801;
export const PHYSICS_LOCK_TALENT_ID = 21802;

export function subjectTrackName(track: SubjectTrack): string {
  return track === 'history' ? '历史类' : '物理类';
}

export function subjectTrackProfileId(track: SubjectTrack): string {
  return track === 'history' ? 'ah-2025-history' : 'ah-2025-physics';
}

export function forcedSubjectTrackFromTalents(state: GameState): SubjectTrack | null {
  if (state.selectedTalentIds.includes(HISTORY_LOCK_TALENT_ID)) return 'history';
  if (state.selectedTalentIds.includes(PHYSICS_LOCK_TALENT_ID)) return 'physics';
  return null;
}

export function resolveSubjectTrack(state: GameState, random: Random): SubjectTrack {
  const forcedTrack = forcedSubjectTrackFromTalents(state);
  if (forcedTrack) return forcedTrack;

  const scienceEventBonus = state.eventIds.some(id => [31011, 31013, 31017].includes(id)) ? 1.4 : 0;
  const humanitiesEventBonus = state.eventIds.some(id => [31731, 31732, 31735].includes(id)) ? 0.9 : 0;
  const riskPenalty = state.props.RSK * 0.04;
  const jitter = (random.next() - 0.5) * 2.6;
  const scorePhysics = state.props.INT * 0.85 + state.props.STR * 0.25 + state.props.MNY * 0.2 + scienceEventBonus - riskPenalty + jitter;
  const scoreHistory = state.props.SPR * 0.85 + state.props.VOL * 0.06 + state.props.INT * 0.45 + humanitiesEventBonus - jitter;

  return scorePhysics > scoreHistory ? 'physics' : 'history';
}
