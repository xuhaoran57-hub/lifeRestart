import type { AdmissionResult, TalentRarity, University } from '../app/types';

export type Screen = 'home' | 'talents' | 'properties' | 'trajectory' | 'summary' | 'achievements' | 'universities';

export function talentRarityName(grade: number): TalentRarity {
  return (['common', 'rare', 'epic', 'legendary'] as TalentRarity[])[grade] ?? 'common';
}

export function talentRarityLabel(rarity: TalentRarity): string {
  return {
    common: '普通',
    rare: '稀有',
    epic: '史诗',
    legendary: '传说',
  }[rarity];
}

export function achievementGradeName(grade: number): string {
  return ['普通', '稀有', '史诗', '传说'][grade] ?? '普通';
}

export function universityTierLabel(tier: University['prestigeTier']): string {
  return {
    top: '顶尖',
    strong: '强校',
    solid: '稳健',
    regional: '区域',
    private: '民办',
  }[tier];
}

export function admissionTierName(tier: AdmissionResult['admissionTier']): string {
  return {
    '985': '985',
    '211': '211',
    doubleFirstClass: '双一流',
    undergraduate: '本科',
    college: '专科/后续批次',
    retake: '复读/再规划',
    slide: '滑档',
  }[tier];
}

export function ageStageName(age: number): string {
  const names: Record<number, string> = {
    6: '一年级',
    7: '二年级',
    8: '三年级',
    9: '四年级',
    10: '五年级',
    11: '六年级',
    12: '七年级',
    13: '八年级',
    14: '九年级',
    15: '高一',
    16: '高二',
    17: '高三',
    18: '高考收官',
  };
  return names[age] ?? `${age} 岁`;
}

export function screenName(screen: Screen): string {
  return {
    home: '首页',
    talents: '天赋',
    properties: '属性',
    trajectory: '轨迹',
    summary: '结局',
    achievements: '成就',
    universities: '院校',
  }[screen];
}
