export type PhaseCode =
  | 'preschool'
  | 'primary'
  | 'middle'
  | 'senior1'
  | 'senior2'
  | 'senior3'
  | 'final';

export type PropCode =
  | 'AGE'
  | 'INT'
  | 'STR'
  | 'MNY'
  | 'SPR'
  | 'VOL'
  | 'RSK'
  | 'SCR'
  | 'HSCR'
  | 'HVOL'
  | 'SCOREMOD'
  | 'SUM'
  | 'CEND'
  | 'CEVT'
  | 'CTLT'
  | 'TMS';

export type CorePropCode = Exclude<PropCode, 'CEND' | 'CEVT' | 'CTLT' | 'TMS'>;

export type Effect = Partial<Record<CorePropCode, number>>;

export type TalentRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type TalentCategory = 'family' | 'aptitude' | 'habit' | 'relation' | 'route' | 'exam' | 'volunteer';

export interface Talent {
  id: number;
  name: string;
  grade: number;
  rarity?: TalentRarity;
  rarityName?: string;
  category?: TalentCategory;
  categoryName?: string;
  effectBudget?: number;
  polarity?: 'benefit' | 'drawback';
  description: string;
  effect?: Effect;
  condition?: string;
  pointsBonus?: number;
  exclude?: number[];
  inheritAllowed?: boolean;
  tags?: string[];
}

export interface Branch {
  condition: string;
  next: number;
}

export interface GameEvent {
  id: number;
  stage: string;
  phase: PhaseCode;
  text: string;
  postText?: string;
  effect?: Effect;
  include?: string;
  exclude?: string;
  branch?: Branch[];
  noRandom?: boolean;
  weight?: number;
  flag?: string;
  tags?: string[];
  grade?: number;
}

export interface WeightedRef {
  id: number;
  weight: number;
}

export interface AgeRound {
  step: number;
  age: number;
  round: 1 | 2 | 3 | 4;
  roundName: string;
  phase: PhaseCode;
  phaseName: string;
  eventPool: WeightedRef[];
  talentPool: number[];
  scoreFormulaTag?: string;
  note?: string;
}

export interface Ending {
  id: number;
  name: string;
  tier: string;
  description: string;
  condition: string;
  priority: number;
  scoreBonus: number;
  tags?: string[];
}

export interface Achievement {
  id: number;
  name: string;
  description: string;
  grade: number;
  condition: string;
  timing: 'summary' | string;
}

export interface CharacterPreset {
  id: number;
  name: string;
  description: string;
  unlockCondition: string;
  init: Allocation & Partial<Record<'VOL' | 'RSK', number>>;
  talents: number[];
}

export interface GameContent {
  talents: Talent[];
  events: GameEvent[];
  ages: AgeRound[];
  endings: Ending[];
  achievements: Achievement[];
  characters: CharacterPreset[];
}

export interface Allocation {
  INT: number;
  STR: number;
  MNY: number;
  SPR: number;
}

export type Props = Record<CorePropCode, number>;

export interface RunLog {
  step: number;
  age: number;
  round: number;
  roundName: string;
  phaseName: string;
  event: GameEvent;
  branchEvents: GameEvent[];
  triggeredTalents: Talent[];
  props: Props;
}

export interface GameState {
  props: Props;
  selectedTalentIds: number[];
  triggeredTalentIds: number[];
  eventIds: number[];
  endingIds: number[];
  logs: RunLog[];
  stepIndex: number;
  currentRound: AgeRound | null;
  finalEnding: Ending | null;
  isFinished: boolean;
}

export interface StepResult {
  state: GameState;
  log: RunLog;
  ending: Ending | null;
}

export interface FinalResult {
  state: GameState;
  ending: Ending;
}

export interface SaveData {
  times: number;
  inheritedTalentId: number | null;
  seenTalentIds: number[];
  seenEventIds: number[];
  unlockedEndingIds: number[];
  achievedIds: number[];
}
