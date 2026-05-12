import type { GameContent, University } from '../app/types';

export interface UniversityCollectionStats {
  total: number;
  unlocked: number;
  unlocked985: number;
  unlocked211Plus: number;
  unlockedDoubleFirstClass: number;
  unlockedQingbei: number;
  unlockedHuaWu: number;
  unlockedC9: number;
}

const qingbeiSchools = ['北京大学', '清华大学'] as const;
const huaWuSchools = ['复旦大学', '上海交通大学', '浙江大学', '南京大学', '中国科学技术大学'] as const;
const c9Schools = [
  '北京大学',
  '清华大学',
  '复旦大学',
  '上海交通大学',
  '浙江大学',
  '南京大学',
  '中国科学技术大学',
  '西安交通大学',
  '哈尔滨工业大学',
] as const;

export function getUniversityCollectionStats(content: GameContent, unlockedCodes: string[]): UniversityCollectionStats {
  const unlocked = getUnlockedUniversities(content, unlockedCodes);
  return {
    total: content.universities.length,
    unlocked: unlocked.length,
    unlocked985: unlocked.filter(is985University).length,
    unlocked211Plus: unlocked.filter(is211PlusUniversity).length,
    unlockedDoubleFirstClass: unlocked.filter(isDoubleFirstClassUniversity).length,
    unlockedQingbei: countGroup(unlocked, qingbeiSchools),
    unlockedHuaWu: countGroup(unlocked, huaWuSchools),
    unlockedC9: countGroup(unlocked, c9Schools),
  };
}

export function getUnlockedUniversities(content: GameContent, unlockedCodes: string[]): University[] {
  const codes = new Set(unlockedCodes);
  return content.universities.filter(university => codes.has(university.code));
}

export function is985University(university: University): boolean {
  return university.tags.includes('985');
}

export function is211PlusUniversity(university: University): boolean {
  return university.tags.includes('985') || university.tags.includes('211');
}

export function isDoubleFirstClassUniversity(university: University): boolean {
  return university.tags.includes('doubleFirstClass');
}

export function universityGroupLabels(university: University): string[] {
  const labels: string[] = [];
  if (canonicalGroupName(university.name, qingbeiSchools)) labels.push('清北');
  if (canonicalGroupName(university.name, huaWuSchools)) labels.push('华五');
  if (canonicalGroupName(university.name, c9Schools)) labels.push('C9');
  return labels;
}

function countGroup(universities: University[], schools: readonly string[]): number {
  return new Set(universities
    .map(university => canonicalGroupName(university.name, schools))
    .filter((name): name is string => Boolean(name))).size;
}

function canonicalGroupName(name: string, schools: readonly string[]): string | null {
  return schools.find(school => name === school || name.startsWith(school)) ?? null;
}
