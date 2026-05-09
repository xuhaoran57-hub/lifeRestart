import { describe, expect, it } from 'vitest';
import { zhCnContent } from '../src/content/zh-cn';
import { isEventAvailable } from '../src/engine/events';
import { LifeEngine } from '../src/engine/life';
import { drawTalentCandidates, getTalentRarityRates, validateTalentSelection } from '../src/engine/talents';

describe('LifeEngine', () => {
  it('runs a full 70-round game with a deterministic seed', () => {
    const engine = new LifeEngine(zhCnContent, 20260429);
    engine.start([21003, 21004, 21013], { INT: 6, STR: 5, MNY: 4, SPR: 5 });
    const result = engine.runToEnd();

    expect(result.state.logs).toHaveLength(70);
    expect(result.state.isFinished).toBe(true);
    expect(result.state.currentRound?.age).toBe(18);
    expect(result.state.currentRound?.round).toBe(4);
    expect(result.ending.id).toBeGreaterThan(0);
    expect(result.state.props.HSCR).toBeGreaterThanOrEqual(250);
    expect(result.admission.finalScore).toBeGreaterThanOrEqual(250);
    expect(result.state.admissionResult?.finalScore).toBe(result.admission.finalScore);
  });

  it('extends senior 3 to 10 dedicated rounds', () => {
    const senior3Rounds = zhCnContent.ages.filter(item => item.age === 17);

    expect(senior3Rounds).toHaveLength(10);
    expect(senior3Rounds.map(item => item.round)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(senior3Rounds.every(round => round.eventPool.some(ref => ref.id >= 31801 && ref.id <= 31830))).toBe(true);
  });

  it('allows one retake from the senior 3 start while keeping punished end-state props', () => {
    const engine = new LifeEngine(zhCnContent, 20260430);
    engine.start([21003, 21004, 21013], { INT: 6, STR: 5, MNY: 4, SPR: 5 });
    const first = engine.runToEnd();
    const retakeOnlyEvent = zhCnContent.events.find(item => item.id === 31831);

    const retakeState = engine.retake();

    expect(retakeOnlyEvent).toBeDefined();
    expect(isEventAvailable(retakeOnlyEvent!, first.state)).toBe(false);
    expect(isEventAvailable(retakeOnlyEvent!, retakeState)).toBe(true);
    expect(retakeState.isFinished).toBe(false);
    expect(retakeState.retakeUsed).toBe(true);
    expect(retakeState.attempt).toBe(2);
    expect(retakeState.retakeFrom?.endingId).toBe(first.ending.id);
    expect(retakeState.retakeFrom?.admittedUniversityName).toBe(first.admission.admittedUniversity?.name);
    expect(retakeState.currentRound?.age).toBe(17);
    expect(retakeState.currentRound?.round).toBe(1);
    expect(retakeState.props.SPR).toBe(Math.max(0, first.state.props.SPR - 1));
    expect(retakeState.props.RSK).toBe(Math.min(90, first.state.props.RSK + 4));
    expect(retakeState.props.SCOREMOD).toBe(Math.min(70, first.state.props.SCOREMOD + 32));
    expect(first.state.props.SCR - retakeState.props.SCR).toBeLessThanOrEqual(20);

    const second = engine.runToEnd();
    expect(second.state.logs).toHaveLength(84);
    expect(() => engine.retake()).toThrow('本局已经复读过一次');
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

  it('keeps age 18 prep, exam, volunteer, and score events in their own rounds', () => {
    const eventMap = new Map(zhCnContent.events.map(item => [item.id, item]));
    for (const round of zhCnContent.ages.filter(item => item.age === 18)) {
      const hasPrepEvent = round.eventPool.some(ref => eventMap.get(ref.id)?.tags?.includes('考前'));
      const hasVolunteerEvent = round.eventPool.some(ref => eventMap.get(ref.id)?.tags?.includes('志愿'));
      const hasExamEvent = round.eventPool.some(ref => eventMap.get(ref.id)?.tags?.includes('高考'));
      const hasScoreEvent = round.eventPool.some(ref => eventMap.get(ref.id)?.tags?.includes('出分'));
      expect(hasPrepEvent).toBe(round.round === 1);
      expect(hasExamEvent).toBe(round.round === 2);
      expect(hasVolunteerEvent).toBe(round.round === 3);
      expect(hasScoreEvent).toBe(round.round === 4);
    }
  });

  it('does not include repeated placeholder event suffixes', () => {
    const texts = zhCnContent.events.map(item => item.text).join('\n');
    expect(texts).not.toContain('分数曲线却悄悄变了');
    expect(texts).not.toContain('记进了自己的小本子');
  });
});
