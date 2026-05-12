export type PhaseCode =
  | 'preschool'
  | 'primary'
  | 'middle'
  | 'senior1'
  | 'senior2'
  | 'senior3'
  | 'final';

export type SubjectTrack = 'history' | 'physics';

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
  subjectTrack?: SubjectTrack;
}

export interface WeightedRef {
  id: number;
  weight: number;
}

export interface AgeRound {
  step: number;
  age: number;
  round: number;
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

export type AdmissionTier = '985' | '211' | 'doubleFirstClass' | 'undergraduate' | 'college' | 'retake' | 'slide';
export type AdmissionStrategyLabel = '稳妥' | '均衡' | '冲刺' | '失误';

export interface AdmissionProfile {
  id: string;
  name: string;
  year: number;
  sourceProvince: string;
  subjectTrack: string;
  scoreScale: number;
  batch: string;
  default?: boolean;
}

export interface University {
  code: string;
  name: string;
  province: string;
  city: string;
  tags: string[];
  prestigeTier: 'top' | 'strong' | 'solid' | 'regional' | 'private';
}

export interface AdmissionLine {
  profileId: string;
  universityCode: string;
  universityName: string;
  groupCode: string;
  groupName: string;
  batch: string;
  minScore: number;
  minRank: number | null;
  subjectRequirement: string;
  sourceName: string;
  sourceUrl: string;
  sourcePublishedAt: string;
  lineType?: 'normal' | 'sinoForeign';
  resourceNeed?: number;
}

export interface ExamScoreResult {
  finalScore: number;
  potentialScore: number;
  variance: number;
  explanation: string;
}

export interface AdmissionResult {
  profileId: string;
  profileName: string;
  subjectTrack: SubjectTrack;
  subjectTrackName: string;
  finalScore: number;
  potentialScore: number;
  variance: number;
  scoreHidden?: boolean;
  canReach985: boolean;
  canReach211: boolean;
  bestReachable985?: AdmissionLine;
  bestReachable211?: AdmissionLine;
  lowestReachable985Margin?: number;
  admitted: boolean;
  admittedLine?: AdmissionLine;
  admittedUniversity?: University;
  admissionTier: AdmissionTier;
  margin?: number;
  strategyLabel: AdmissionStrategyLabel;
  strategyScore?: number;
  highScoreLowAdmission?: boolean;
  isSinoForeign?: boolean;
  resourceNeed?: number;
  resourceGap?: number;
  reason: string;
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
  admissionProfiles: AdmissionProfile[];
  universities: University[];
  admissionLines: AdmissionLine[];
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

export interface RetakeSnapshot {
  endingId: number;
  endingName: string;
  finalScore: number;
  admissionTier: AdmissionTier;
  admittedUniversityCode?: string;
  admittedUniversityName?: string;
  margin?: number;
  canReach985: boolean;
  canReach211: boolean;
  props: Props;
}

export interface GameState {
  props: Props;
  subjectTrack: SubjectTrack | null;
  selectedTalentIds: number[];
  triggeredTalentIds: number[];
  eventIds: number[];
  currentAttemptEventIds: number[];
  endingIds: number[];
  logs: RunLog[];
  stepIndex: number;
  currentRound: AgeRound | null;
  finalEnding: Ending | null;
  admissionResult: AdmissionResult | null;
  retakeUsed: boolean;
  retakeFrom: RetakeSnapshot | null;
  attempt: 1 | 2;
  isFinished: boolean;
}

export interface StepResult {
  state: GameState;
  log: RunLog;
  ending: Ending | null;
  admission: AdmissionResult | null;
}

export interface FinalResult {
  state: GameState;
  ending: Ending;
  admission: AdmissionResult;
}

export interface SaveData {
  times: number;
  inheritedTalentId: number | null;
  seenTalentIds: number[];
  seenEventIds: number[];
  unlockedEndingIds: number[];
  unlockedUniversityCodes: string[];
  achievedIds: number[];
}
