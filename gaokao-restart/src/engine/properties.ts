import type { CorePropCode, PhaseCode, Props } from '../app/types';

const initialPhaseBase = 245;
const phaseOrder: PhaseCode[] = ['preschool', 'primary', 'middle', 'senior1', 'senior2', 'senior3', 'final'];
const phaseBaseGain: Record<PhaseCode, number> = {
  preschool: 0,
  primary: 58,
  middle: 52,
  senior1: 22,
  senior2: 22,
  senior3: 14,
  final: 6,
};

const phaseBase = phaseOrder.reduce<Record<PhaseCode, number>>((result, phase, index) => {
  const previousBase = index === 0 ? initialPhaseBase : result[phaseOrder[index - 1]];
  result[phase] = previousBase + phaseBaseGain[phase];
  return result;
}, {} as Record<PhaseCode, number>);

const limits: Partial<Record<CorePropCode, [number, number]>> = {
  AGE: [0, 18],
  INT: [0, 10],
  STR: [0, 10],
  MNY: [0, 10],
  SPR: [0, 10],
  VOL: [0, 85],
  RSK: [0, 90],
  SCR: [250, 750],
  HSCR: [0, 750],
  HVOL: [0, 85],
  SCOREMOD: [-60, 70],
  BASEMOD: [-60, 80],
};

export function createInitialProps(): Props {
  return {
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
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function applyPropDelta(props: Props, prop: CorePropCode, delta: number): void {
  props[prop] = (props[prop] ?? 0) + delta;
  const limit = limits[prop];
  if (limit) props[prop] = clamp(props[prop], limit[0], limit[1]);
}

export function refreshScore(props: Props, phase: PhaseCode): void {
  const score = Math.round(
    phaseBase[phase]
      + props.INT * 8.5
      + props.STR * 4.8
      + props.MNY * 3
      + props.SPR * 5.2
      + props.VOL * 0.2
      - props.RSK * 1.35
      + props.SCOREMOD * 0.6
      + (props.BASEMOD ?? 0),
  );
  props.SCR = clamp(score, 250, 750);
  props.HSCR = Math.max(props.HSCR, props.SCR);
  props.HVOL = Math.max(props.HVOL, props.VOL);
}

export function calculateSummaryScore(props: Props, endingBonus: number): number {
  return Math.round(
    props.HSCR * 0.45
      + (props.INT + props.STR + props.MNY + props.SPR) * 8
      + props.HVOL * 0.8
      + endingBonus,
  );
}
