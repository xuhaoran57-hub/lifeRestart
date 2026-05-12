import type { Achievement, FinalResult, GameContent, SaveData } from '../app/types';
import { evaluateCondition } from './condition';
import { getUniversityCollectionStats } from './universities';

export const STORAGE_KEY = 'gaokao-restart.save.v1';

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const emptySave: SaveData = {
  times: 0,
  inheritedTalentId: null,
  seenTalentIds: [],
  seenEventIds: [],
  unlockedEndingIds: [],
  unlockedUniversityCodes: [],
  achievedIds: [],
};

export function createEmptySave(): SaveData {
  return cloneSave(emptySave);
}

export function loadSave(storage = getDefaultStorage()): SaveData {
  if (!storage) return createEmptySave();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createEmptySave();
    return normalizeSave(JSON.parse(raw));
  } catch {
    return createEmptySave();
  }
}

export function saveData(save: SaveData, storage = getDefaultStorage()): void {
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(normalizeSave(save)));
}

export function recordFinalResult(save: SaveData, result: FinalResult, content: GameContent): SaveData {
  const next = normalizeSave(save);
  next.times += 1;
  next.seenTalentIds = unique([...next.seenTalentIds, ...result.state.selectedTalentIds, ...result.state.triggeredTalentIds]);
  next.seenEventIds = unique([...next.seenEventIds, ...result.state.eventIds]);
  next.unlockedEndingIds = unique([...next.unlockedEndingIds, result.ending.id]);
  next.unlockedUniversityCodes = uniqueStrings([
    ...next.unlockedUniversityCodes,
    ...admittedUniversityCodes(result),
  ]);
  next.achievedIds = unique([...next.achievedIds, ...findUnlockedAchievements(next, result, content).map(item => item.id)]);
  return next;
}

export function setInheritedTalent(save: SaveData, talentId: number | null): SaveData {
  return normalizeSave({ ...save, inheritedTalentId: talentId });
}

function findUnlockedAchievements(save: SaveData, result: FinalResult, content: GameContent): Achievement[] {
  const universityStats = getUniversityCollectionStats(content, save.unlockedUniversityCodes);
  const props = {
    ...result.state.props,
    CEND: save.unlockedEndingIds.length,
    CEVT: save.seenEventIds.length,
    CTLT: save.seenTalentIds.length,
    TMS: save.times,
    CSCH: universityStats.unlocked,
    C985: universityStats.unlocked985,
    C211: universityStats.unlocked211Plus,
    CDFC: universityStats.unlockedDoubleFirstClass,
    CQB: universityStats.unlockedQingbei,
    CHW: universityStats.unlockedHuaWu,
    CC9: universityStats.unlockedC9,
  };
  const context = {
    props,
    talentIds: new Set(save.seenTalentIds),
    eventIds: new Set(save.seenEventIds),
    endingIds: new Set(save.unlockedEndingIds),
  };
  return content.achievements.filter(item => !save.achievedIds.includes(item.id) && evaluateCondition(item.condition, context));
}

function normalizeSave(value: Partial<SaveData>): SaveData {
  return {
    times: Number.isFinite(value.times) ? Number(value.times) : 0,
    inheritedTalentId: typeof value.inheritedTalentId === 'number' ? value.inheritedTalentId : null,
    seenTalentIds: uniqueNumbers(value.seenTalentIds),
    seenEventIds: uniqueNumbers(value.seenEventIds),
    unlockedEndingIds: uniqueNumbers(value.unlockedEndingIds),
    unlockedUniversityCodes: uniqueStrings(value.unlockedUniversityCodes),
    achievedIds: uniqueNumbers(value.achievedIds),
  };
}

function admittedUniversityCodes(result: FinalResult): string[] {
  return [
    result.state.retakeFrom?.admittedUniversityCode,
    result.admission.admittedUniversity?.code,
  ].filter((code): code is string => typeof code === 'string' && code.length > 0);
}

function uniqueNumbers(values: unknown): number[] {
  return Array.isArray(values) ? unique(values.filter((item): item is number => typeof item === 'number')) : [];
}

function uniqueStrings(values: unknown): string[] {
  return Array.isArray(values)
    ? [...new Set(values.filter((item): item is string => typeof item === 'string'))].sort((a, b) => a.localeCompare(b))
    : [];
}

function unique(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function cloneSave(save: SaveData): SaveData {
  return {
    ...save,
    seenTalentIds: [...save.seenTalentIds],
    seenEventIds: [...save.seenEventIds],
    unlockedEndingIds: [...save.unlockedEndingIds],
    unlockedUniversityCodes: [...save.unlockedUniversityCodes],
    achievedIds: [...save.achievedIds],
  };
}

function getDefaultStorage(): SaveStorage | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}
