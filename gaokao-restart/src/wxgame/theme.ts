import type { Allocation, TalentRarity } from '../app/types';

export type PropKey = keyof Allocation;

export const theme = {
  ink: '#172033',
  title: '#111b2b',
  heroTitle: '#0f2235',
  subtle: '#687386',
  paper: '#fffdf8',
  paperStrong: '#ffffff',
  line: '#e5ded3',
  warm: '#f6efe4',
  sky: '#dff2ff',
  blue: '#3a86e8',
  blueDeep: '#153f63',
  blueMid: '#2e78b7',
  teal: '#2f7c80',
  gold: '#f6a623',
  purple: '#8758d8',
  green: '#45b37d',
  danger: '#d9480f',
  ghostBorder: 'rgba(157, 148, 134, 0.32)',
  shadow: 'rgba(40, 54, 78, 0.11)',
  shadowSoft: 'rgba(40, 54, 78, 0.08)',
} as const;

export const propRows: ReadonlyArray<{ key: PropKey; label: string; color: string }> = [
  { key: 'INT', label: '学力', color: theme.blue },
  { key: 'STR', label: '精力', color: theme.green },
  { key: 'MNY', label: '资源', color: theme.gold },
  { key: 'SPR', label: '心态', color: theme.teal },
];

export const rarityColors: Record<TalentRarity, { bg: string; fg: string; border: string }> = {
  common: { bg: '#f3f0e8', fg: '#514d46', border: '#d8d0c2' },
  rare: { bg: '#e5f1ff', fg: '#155996', border: '#5aa7ff' },
  epic: { bg: '#f0e8ff', fg: '#6840b6', border: '#a56cff' },
  legendary: { bg: '#fff1d8', fg: '#8a4d00', border: '#f0a23a' },
};
