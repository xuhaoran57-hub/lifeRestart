import type { CorePropCode, PhaseCode, Props } from '../app/types';

const phaseBase: Record<PhaseCode, number> = {
  preschool: 245,
  primary: 305,
  middle: 360,
  senior1: 385,
  senior2: 410,
  senior3: 425,
  final: 432,
};

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
      + props.SCOREMOD * 0.6,
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
