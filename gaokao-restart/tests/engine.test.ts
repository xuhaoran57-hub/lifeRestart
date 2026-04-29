import { describe, expect, it } from 'vitest';
import { zhCnContent } from '../src/content/zh-cn';
import { LifeEngine } from '../src/engine/life';
import { drawTalentCandidates, getTalentRarityRates, validateTalentSelection } from '../src/engine/talents';

describe('LifeEngine', () => {
  it('runs a full 64-round game with a deterministic seed', () => {
    const engine = new LifeEngine(zhCnContent, 20260429);
    engine.start([21003, 21004, 21013], { INT: 6, STR: 5, MNY: 4, SPR: 5 });
    const result = engine.runToEnd();

    expect(result.state.logs).toHaveLength(64);
    expect(result.state.isFinished).toBe(true);
    expect(result.state.currentRound?.age).toBe(18);
    expect(result.state.currentRound?.round).toBe(4);
    expect(result.ending.id).toBeGreaterThan(0);
    expect(result.state.props.HSCR).toBeGreaterThanOrEqual(250);
  });

  it('rejects mutually exclusive talents', () => {
    expect(validateTalentSelection([21002, 21003, 21004], zhCnContent)).toBe('选择中存在互斥天赋');
  });

  it('adjusts talent rarity rates with achievement progress', () => {
    const allAchievements = zhCnContent.achievements.map(item => item.id);
    const halfAchievements = allAchievements.slice(0, allAchievements.length / 2);

    expect(getTalentRarityRates(zhCnContent, [])).toEqual({
      common: 70,
      rare: 20,
      epic: 8,
      legendary: 2,
    });
    expect(getTalentRarityRates(zhCnContent, halfAchievements)).toEqual({
      common: 65,
      rare: 22.5,
      epic: 9.5,
      legendary: 3,
    });
    expect(getTalentRarityRates(zhCnContent, allAchievements)).toEqual({
      common: 60,
      rare: 25,
      epic: 11,
      legendary: 4,
    });
  });

  it('draws talent candidates by rarity and keeps inherited talent first', () => {
    const candidates = drawTalentCandidates(zhCnContent, 10, 21013, 20260429);
    expect(candidates).toHaveLength(10);
    expect(candidates[0].id).toBe(21013);

    const rarityCounts = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (let seed = 0; seed < 1000; seed += 1) {
      for (const talent of drawTalentCandidates(zhCnContent, 10, null, 20260429 + seed)) {
        rarityCounts[talent.rarity ?? 'common'] += 1;
      }
    }

    expect(rarityCounts.common).toBeGreaterThan(6400);
    expect(rarityCounts.common).toBeLessThan(7400);
    expect(rarityCounts.rare).toBeGreaterThan(1600);
    expect(rarityCounts.rare).toBeLessThan(2400);
    expect(rarityCounts.epic).toBeGreaterThan(550);
    expect(rarityCounts.epic).toBeLessThan(1100);
    expect(rarityCounts.legendary).toBeGreaterThan(120);
    expect(rarityCounts.legendary).toBeLessThan(320);
  });
});
