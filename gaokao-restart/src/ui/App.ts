import type { GameApp } from '../app/createGame';
import type { Achievement, AdmissionResult, Allocation, FinalResult, GameState, Talent } from '../app/types';
import { LifeEngine } from '../engine/life';
import { recordFinalResult, setInheritedTalent } from '../engine/storage';
import { drawTalentCandidates, getTalentMap, hasTalentConflict } from '../engine/talents';
import {
  getUniversityCollectionStats,
  is211PlusUniversity,
  is985University,
  isDoubleFirstClassUniversity,
  universityGroupLabels,
} from '../engine/universities';

type Screen = 'home' | 'talents' | 'properties' | 'trajectory' | 'summary' | 'achievements' | 'universities';

const AUTO_RUN_INTERVAL_MS = 500;

interface UiState {
  screen: Screen;
  previousScreen: Screen | null;
  candidates: Talent[];
  inheritedCandidateId: number | null;
  selectedTalentIds: number[];
  allocation: Allocation;
  engine: LifeEngine | null;
  gameState: GameState | null;
  result: FinalResult | null;
  persistedResult: boolean;
  autoRunning: boolean;
  message: string | null;
}

interface AutoRunControls {
  start: () => void;
  stop: (message?: string) => void;
}

export function createApp(root: HTMLElement, game: GameApp): void {
  const state: UiState = {
    screen: 'home',
    previousScreen: null,
    candidates: [],
    inheritedCandidateId: null,
    selectedTalentIds: [],
    allocation: { INT: 5, STR: 5, MNY: 5, SPR: 5 },
    engine: null,
    gameState: null,
    result: null,
    persistedResult: false,
    autoRunning: false,
    message: null,
  };

  let autoRunTimer: ReturnType<typeof setTimeout> | null = null;

  const render = () => {
    root.innerHTML = renderScreen(state, game);
  };

  const stopAutoRun = (message?: string) => {
    if (autoRunTimer !== null) {
      clearTimeout(autoRunTimer);
      autoRunTimer = null;
    }
    state.autoRunning = false;
    if (message) state.message = message;
  };

  const scheduleAutoRun = () => {
    if (!state.autoRunning || autoRunTimer !== null) return;
    autoRunTimer = setTimeout(() => {
      autoRunTimer = null;
      if (!state.autoRunning) return;

      try {
        if (state.screen !== 'trajectory' || !state.gameState || state.gameState.isFinished) {
          stopAutoRun();
        } else {
          runOneRound(state, game);
          if (state.screen !== 'trajectory' || state.gameState?.isFinished) stopAutoRun();
        }
      } catch (error) {
        stopAutoRun(error instanceof Error ? error.message : '操作失败');
      }

      render();
      scheduleAutoRun();
    }, AUTO_RUN_INTERVAL_MS);
  };

  const startAutoRun = () => {
    if (!state.gameState || state.gameState.isFinished) return;
    state.autoRunning = true;
    scheduleAutoRun();
  };

  root.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (!action) return;

    try {
      const messageBeforeAction = state.message;
      if (state.autoRunning && action !== 'auto-run') stopAutoRun();
      handleAction(action, target, state, game, { start: startAutoRun, stop: stopAutoRun });
      if (state.message === messageBeforeAction) state.message = null;
    } catch (error) {
      stopAutoRun();
      state.message = error instanceof Error ? error.message : '操作失败';
    }
    render();
  });

  render();
}

function handleAction(
  action: string,
  target: HTMLElement,
  state: UiState,
  game: GameApp,
  autoRun: AutoRunControls,
): void {
  if (action === 'start') {
    const inheritedTalentId = game.save.inheritedTalentId;
    state.candidates = drawTalentCandidates(game.content, 10, inheritedTalentId, Date.now(), game.save.achievedIds);
    const inheritedCandidateId = state.candidates.some(item => item.id === inheritedTalentId) ? inheritedTalentId : null;
    state.inheritedCandidateId = inheritedCandidateId;
    state.selectedTalentIds = inheritedCandidateId !== null ? [inheritedCandidateId] : [];
    state.screen = 'talents';
    if (inheritedTalentId !== null && inheritedCandidateId === null) game.persist(setInheritedTalent(game.save, null));
    return;
  }

  if (action === 'view-achievements') {
    commitFinalResult(state, game);
    if (state.screen !== 'achievements') state.previousScreen = state.screen;
    state.screen = 'achievements';
    return;
  }

  if (action === 'view-universities') {
    commitFinalResult(state, game);
    if (state.screen !== 'universities') state.previousScreen = state.screen;
    state.screen = 'universities';
    return;
  }

  if (action === 'close-achievements') {
    state.screen = state.previousScreen && state.previousScreen !== 'achievements' ? state.previousScreen : 'home';
    state.previousScreen = null;
    return;
  }

  if (action === 'close-universities') {
    state.screen = state.previousScreen && state.previousScreen !== 'universities' ? state.previousScreen : 'home';
    state.previousScreen = null;
    return;
  }

  if (action === 'toggle-talent') {
    const id = Number(target.closest<HTMLElement>('[data-id]')?.dataset.id);
    toggleTalent(id, state, game);
    return;
  }

  if (action === 'to-properties') {
    if (state.selectedTalentIds.length !== 3) throw new Error('请选择 3 个天赋');
    state.screen = 'properties';
    return;
  }

  if (action === 'adjust-prop') {
    const prop = target.dataset.prop as keyof Allocation;
    const delta = Number(target.dataset.delta);
    adjustAllocation(prop, delta, state);
    return;
  }

  if (action === 'begin-run') {
    const engine = new LifeEngine(game.content);
    const gameState = engine.start(state.selectedTalentIds, state.allocation);
    if (game.save.inheritedTalentId !== null) game.persist(setInheritedTalent(game.save, null));
    state.engine = engine;
    state.gameState = gameState;
    state.result = null;
    state.persistedResult = false;
    state.autoRunning = false;
    state.screen = 'trajectory';
    return;
  }

  if (action === 'next-round') {
    runOneRound(state, game);
    return;
  }

  if (action === 'auto-run') {
    if (state.autoRunning) {
      autoRun.stop('已停止自动推进。');
    } else {
      autoRun.start();
    }
    return;
  }

  if (action === 'inherit') {
    commitFinalResult(state, game);
    const id = Number(target.closest<HTMLElement>('[data-id]')?.dataset.id);
    game.persist(setInheritedTalent(game.save, id));
    return;
  }

  if (action === 'clear-inherit') {
    commitFinalResult(state, game);
    game.persist(setInheritedTalent(game.save, null));
    return;
  }

  if (action === 'retake') {
    if (!state.engine) throw new Error('本局还未开始');
    if (state.persistedResult) throw new Error('本局结局已经确认，不能再复读');
    state.gameState = state.engine.retake();
    state.result = null;
    state.autoRunning = false;
    state.screen = 'trajectory';
    state.message = '你选择复读一年，保留当前属性，但心态下降、风险上升。';
    return;
  }

  if (action === 'restart') {
    commitFinalResult(state, game);
    state.screen = 'home';
    state.previousScreen = null;
    state.engine = null;
    state.gameState = null;
    state.result = null;
    state.inheritedCandidateId = null;
    state.persistedResult = false;
    state.autoRunning = false;
    return;
  }
}

function toggleTalent(id: number, state: UiState, game: GameApp): void {
  if (state.selectedTalentIds.includes(id)) {
    state.selectedTalentIds = state.selectedTalentIds.filter(item => item !== id);
    return;
  }
  if (state.selectedTalentIds.length >= 3) throw new Error('最多选择 3 个天赋');
  const talent = game.content.talents.find(item => item.id === id);
  if (!talent) throw new Error('天赋不存在');
  if (hasTalentConflict(talent, state.selectedTalentIds, getTalentMap(game.content))) {
    throw new Error('该天赋与已选天赋互斥');
  }
  state.selectedTalentIds.push(id);
}

function adjustAllocation(prop: keyof Allocation, delta: number, state: UiState): void {
  const current = state.allocation[prop];
  const remaining = remainingPoints(state.allocation);
  if (delta > 0 && remaining <= 0) return;
  if (delta < 0 && current <= 0) return;
  state.allocation = { ...state.allocation, [prop]: current + delta };
}

function runOneRound(state: UiState, game: GameApp): void {
  if (!state.engine) throw new Error('本局还未开始');
  if (state.gameState?.isFinished) return;
  const step = state.engine.next();
  state.gameState = step.state;
  if (step.ending && step.admission) {
    const result: FinalResult = { state: step.state, ending: step.ending, admission: step.admission };
    state.result = result;
    state.screen = 'summary';
    if (result.state.retakeUsed) commitFinalResult(state, game);
  }
}

function commitFinalResult(state: UiState, game: GameApp): void {
  if (!state.result || state.persistedResult) return;
  game.persist(recordFinalResult(game.save, state.result, game.content));
  state.persistedResult = true;
}

function renderScreen(state: UiState, game: GameApp): string {
  const message = state.message ? `<div class="message">${escapeHtml(state.message)}</div>` : '';
  const body = {
    home: renderHome(game),
    talents: renderTalents(state, game),
    properties: renderProperties(state),
    trajectory: renderTrajectory(state, game),
    summary: renderSummary(state, game),
    achievements: renderAchievements(game),
    universities: renderUniversities(game),
  }[state.screen];
  const topbarAction = state.screen === 'achievements'
    ? '<button class="ghost" data-action="close-achievements">返回</button>'
    : state.screen === 'universities'
      ? '<button class="ghost" data-action="close-universities">返回</button>'
      : '<button class="ghost" data-action="view-universities">院校</button><button class="ghost" data-action="view-achievements">成就</button>';

  return `
    <div class="shell screen-${state.screen}">
      <header class="topbar">
        <div class="topbar-copy">
          <h1>重回高三人生模拟</h1>
          <div class="topbar-stats" aria-label="存档进度">
            <span><strong>${game.save.times}</strong><em>次重开</em></span>
            <span><strong>${game.save.unlockedEndingIds.length}</strong><em>个结局</em></span>
            <span><strong>${game.save.unlockedUniversityCodes.length}</strong><em>所院校</em></span>
            <span><strong>${game.save.achievedIds.length}</strong><em>个成就</em></span>
          </div>
        </div>
        <div class="topbar-actions">
          ${topbarAction}
        </div>
      </header>
      ${message}
      ${body}
    </div>
  `;
}

function renderHome(game: GameApp): string {
  const inherited = game.save.inheritedTalentId
    ? game.content.talents.find(item => item.id === game.save.inheritedTalentId)
    : null;
  return `
    <section class="panel home-panel">
      <div class="home-copy">
        <span class="eyebrow">人生阶段</span>
        <h2>新一轮人生志愿表</h2>
        <p class="muted">从 3 岁到高考收官季推进，高三扩展为 10 个冲刺回合。</p>
      </div>
      <div class="home-stage-track" aria-label="人生阶段轨迹">
        <span><strong>童年</strong><em>3-6岁</em></span>
        <span><strong>小学</strong><em>7-12岁</em></span>
        <span><strong>初中</strong><em>13-15岁</em></span>
        <span><strong>高中</strong><em>16-18岁</em></span>
        <span><strong>高考</strong><em>18岁</em></span>
      </div>
      ${inherited ? `<p class="pill">继承天赋：${escapeHtml(inherited.name)}</p>` : ''}
      <div class="home-actions">
        <button data-action="view-universities">查看院校 ${game.save.unlockedUniversityCodes.length}/${game.content.universities.length}</button>
        <button data-action="view-achievements">查看成就 ${game.save.achievedIds.length}/${game.content.achievements.length}</button>
      </div>
      <button class="primary wide" data-action="start">开始重开</button>
    </section>
  `;
}

function renderAchievements(game: GameApp): string {
  const unlocked = new Set(game.save.achievedIds);
  const unlockedAchievements = game.content.achievements.filter(item => unlocked.has(item.id));
  const universityStats = getUniversityCollectionStats(game.content, game.save.unlockedUniversityCodes);
  const cards = unlockedAchievements.length
    ? unlockedAchievements.map(renderAchievementCard).join('')
    : '<div class="panel empty-state">还没有解锁成就，先完成一局看看。</div>';

  return `
    <section class="stack">
      <div class="panel">
        <div class="section-title">
          <div>
            <h2>成就</h2>
            <p class="muted">已解锁 ${unlockedAchievements.length}/${game.content.achievements.length}</p>
          </div>
          <button class="ghost" data-action="close-achievements">返回</button>
        </div>
        <div class="achievement-stats">
          <span><em>重开</em><strong>${game.save.times}</strong></span>
          <span><em>结局</em><strong>${game.save.unlockedEndingIds.length}</strong></span>
          <span><em>院校</em><strong>${universityStats.unlocked}</strong></span>
          <span><em>事件</em><strong>${game.save.seenEventIds.length}</strong></span>
          <span><em>天赋</em><strong>${game.save.seenTalentIds.length}</strong></span>
        </div>
      </div>
      <div class="achievement-grid">${cards}</div>
    </section>
  `;
}

function renderUniversities(game: GameApp): string {
  const unlockedCodes = new Set(game.save.unlockedUniversityCodes);
  const stats = getUniversityCollectionStats(game.content, game.save.unlockedUniversityCodes);
  const unlocked = game.content.universities.filter(item => unlockedCodes.has(item.code));
  const locked = game.content.universities.filter(item => !unlockedCodes.has(item.code));
  const cards = [...unlocked, ...locked].map(university => renderUniversityCard(university, unlockedCodes.has(university.code))).join('');

  return `
    <section class="stack">
      <div class="panel">
        <div class="section-title">
          <div>
            <h2>院校图鉴</h2>
            <p class="muted">已点亮 ${stats.unlocked}/${stats.total}</p>
          </div>
          <button class="ghost" data-action="close-universities">返回</button>
        </div>
        <div class="achievement-stats">
          <span><em>院校</em><strong>${stats.unlocked}</strong></span>
          <span><em>985</em><strong>${stats.unlocked985}</strong></span>
          <span><em>211+</em><strong>${stats.unlocked211Plus}</strong></span>
          <span><em>双一流</em><strong>${stats.unlockedDoubleFirstClass}</strong></span>
          <span><em>清北</em><strong>${stats.unlockedQingbei}/2</strong></span>
          <span><em>华五</em><strong>${stats.unlockedHuaWu}/5</strong></span>
          <span><em>C9</em><strong>${stats.unlockedC9}/9</strong></span>
        </div>
      </div>
      <div class="university-grid">${cards}</div>
    </section>
  `;
}

function renderUniversityCard(university: GameApp['content']['universities'][number], unlocked: boolean): string {
  const labels = universityLabels(university);
  return `
    <article class="card university-card ${unlocked ? 'unlocked' : 'locked'}">
      <div class="achievement-heading">
        <strong>${escapeHtml(university.name)}</strong>
        <span class="achievement-status">${unlocked ? '已点亮' : '未点亮'}</span>
      </div>
      <p>${escapeHtml(`${university.province} · ${university.city}`)}</p>
      <div class="university-tags">
        ${labels.map(label => `<span>${escapeHtml(label)}</span>`).join('')}
      </div>
    </article>
  `;
}

function universityLabels(university: GameApp['content']['universities'][number]): string[] {
  return [
    ...universityGroupLabels(university),
    ...(is985University(university) ? ['985'] : []),
    ...(university.tags.includes('211') ? ['211'] : []),
    ...(isDoubleFirstClassUniversity(university) ? ['双一流'] : []),
    ...(is211PlusUniversity(university) ? [] : [universityTierLabel(university.prestigeTier)]),
  ];
}

function renderAchievementCard(achievement: Achievement): string {
  return `
    <article class="card achievement-card unlocked">
      <div class="achievement-heading">
        <strong>${escapeHtml(achievement.name)}</strong>
        <span class="achievement-grade">${escapeHtml(achievementGradeName(achievement.grade))}</span>
      </div>
      <p>${escapeHtml(achievement.description)}</p>
      <span class="achievement-status">已解锁</span>
    </article>
  `;
}

function renderTalents(state: UiState, game: GameApp): string {
  const selected = new Set(state.selectedTalentIds);
  const cards = state.candidates.map(talent => {
    const active = selected.has(talent.id);
    const inherited = state.inheritedCandidateId === talent.id;
    const rarity = talent.rarity ?? 'common';
    const rarityName = talent.rarityName ?? talentRarityName(talent.grade);
    const categoryName = talent.categoryName ?? '天赋';
    return `
      <article class="card talent-card rarity-${rarity} ${active ? 'selected' : ''}" data-id="${talent.id}">
        <button data-action="toggle-talent">
          <span class="card-title">${escapeHtml(talent.name)}</span>
          <span class="talent-meta">
            <span class="rarity-badge">${escapeHtml(rarityName)}</span>
            <span class="category-badge">${escapeHtml(categoryName)}</span>
            ${inherited ? '<span class="pill">继承</span>' : ''}
          </span>
          <span class="description">${escapeHtml(talent.description)}</span>
          ${renderTalentTags(talent)}
        </button>
      </article>
    `;
  }).join('');

  return `
    <section class="stack talent-screen">
      <div class="section-title">
        <div>
          <h2>选择天赋</h2>
          <p class="muted">选择 3 个天赋，开启你的高三人生。</p>
        </div>
        <p class="selection-count">${state.selectedTalentIds.length}/3</p>
      </div>
      <div class="grid">${cards}</div>
      <button class="primary wide" data-action="to-properties" ${state.selectedTalentIds.length === 3 ? '' : 'disabled'}>确认天赋</button>
    </section>
  `;
}

function renderProperties(state: UiState): string {
  const rows = [
    ['INT', '学力'],
    ['STR', '精力'],
    ['MNY', '资源'],
    ['SPR', '心态'],
  ] as const;
  return `
    <section class="panel property-panel">
      <div class="section-title">
        <h2>分配属性</h2>
        <p>剩余 ${remainingPoints(state.allocation)}</p>
      </div>
      <div class="prop-list">
        ${rows.map(([prop, label]) => `
          <div class="prop-row">
            <span>${label}</span>
            <div class="stepper">
              <button data-action="adjust-prop" data-prop="${prop}" data-delta="-1">-</button>
              <strong>${state.allocation[prop]}</strong>
              <button data-action="adjust-prop" data-prop="${prop}" data-delta="1">+</button>
            </div>
          </div>
        `).join('')}
      </div>
      <button class="primary wide" data-action="begin-run" ${remainingPoints(state.allocation) === 0 ? '' : 'disabled'}>进入考场人生</button>
    </section>
  `;
}

function renderTrajectory(state: UiState, game: GameApp): string {
  const gameState = state.gameState;
  if (!gameState) return '';
  const latest = gameState.logs.at(-1);
  const retakeRounds = gameState.retakeUsed ? game.content.ages.filter(round => round.age >= 17).length : 0;
  const totalRounds = game.content.ages.length + retakeRounds;
  const isAutoRunning = state.autoRunning && !gameState.isFinished;
  return `
    <section class="stack">
      <div class="panel run-panel">
        <div class="section-title">
          <h2>${renderRoundLabel(gameState)}</h2>
          <p>${gameState.logs.length}/${totalRounds}</p>
        </div>
        ${renderStats(gameState)}
        <div class="actions">
          <button class="primary" data-action="next-round" ${gameState.isFinished || isAutoRunning ? 'disabled' : ''}>下一回合</button>
          <button data-action="auto-run" ${gameState.isFinished ? 'disabled' : ''}>${isAutoRunning ? '终止自动' : '自动跑完'}</button>
        </div>
      </div>
      <div class="log-list">
        ${latest ? renderLogItem(latest) : '<p class="muted">等待第一回合。</p>'}
        ${gameState.logs.slice(0, -1).reverse().map(renderLogItem).join('')}
      </div>
    </section>
  `;
}

function renderSummary(state: UiState, game: GameApp): string {
  if (!state.result) return '';
  const { ending } = state.result;
  const hidesScoreDetails = state.result.admission.scoreHidden === true;
  const canRetake = !hidesScoreDetails && !state.result.state.retakeUsed && !state.persistedResult;
  const talents = state.result.state.selectedTalentIds
    .map(id => game.content.talents.find(item => item.id === id))
    .filter((item): item is Talent => Boolean(item));
  return `
    <section class="stack">
      <div class="panel summary">
        <span class="tier">${escapeHtml(ending.tier)}</span>
        <h2>${escapeHtml(ending.name)}</h2>
        <p>${escapeHtml(ending.description)}</p>
        ${hidesScoreDetails ? '' : renderStats(state.result.state)}
      </div>
      ${renderRetakeFrom(state.result.state)}
      ${renderAdmission(state.result.admission)}
      ${renderSummaryLogs(state.result.state)}
      <div class="panel">
        <div class="section-title">
          <h2>继承天赋</h2>
          <button class="ghost" data-action="clear-inherit">清空</button>
        </div>
        <div class="inherit-list">
          ${talents.map(talent => `
            <button class="inherit ${game.save.inheritedTalentId === talent.id ? 'selected' : ''}" data-action="inherit" data-id="${talent.id}">
              ${escapeHtml(talent.name)}
            </button>
          `).join('')}
        </div>
      </div>
      ${canRetake ? '<button class="wide" data-action="retake">复读一年</button>' : ''}
      <button class="primary wide" data-action="restart">再来一局</button>
    </section>
  `;
}

function renderRetakeFrom(gameState: GameState): string {
  if (!gameState.retakeFrom) return '';
  const admittedUniversityName = gameState.retakeFrom.admittedUniversityName ?? '未录取到样本院校';
  return `
    <div class="panel retake-panel">
      <div class="section-title">
        <h2>首考结果</h2>
        <span class="pill">${escapeHtml(gameState.retakeFrom.endingName)}</span>
      </div>
      <div class="admission-facts">
        <span><em>首考分数</em><strong>${gameState.retakeFrom.finalScore}</strong></span>
        <span><em>首考院校</em><strong>${escapeHtml(admittedUniversityName)}</strong></span>
        <span><em>首考层级</em><strong>${escapeHtml(admissionTierName(gameState.retakeFrom.admissionTier))}</strong></span>
      </div>
    </div>
  `;
}

function renderSummaryLogs(gameState: GameState): string {
  return `
    <div class="panel">
      <div class="section-title">
        <h2>本局事件</h2>
        <p>${gameState.logs.length} 回合</p>
      </div>
      <div class="log-list summary-log">
        ${gameState.logs.slice().reverse().map(renderLogItem).join('')}
      </div>
    </div>
  `;
}

function renderAdmission(admission: AdmissionResult): string {
  if (admission.scoreHidden) {
    const admittedUniversityName = admission.admittedUniversity?.name ?? '已锁定录取资格';
    return `
      <div class="panel admission-panel">
        <div class="section-title">
          <div>
            <h2>保送录取</h2>
            <p class="muted">提前锁定录取资格</p>
          </div>
        </div>
        <div class="admission-school">
          <strong>${escapeHtml(admittedUniversityName)}</strong>
          <span>保送录取</span>
        </div>
        <div class="admission-facts">
          <span><em>层级</em><strong>${escapeHtml(admissionTierName(admission.admissionTier))}</strong></span>
        </div>
        <p class="admission-reason">${escapeHtml(admission.reason)}</p>
      </div>
    `;
  }

  const admitted = admission.admitted && admission.admittedLine && admission.admittedUniversity;
  const trackLabel = admission.subjectTrack === 'history' ? '历史组' : '物理组';
  const cooperationFact = admitted && admission.isSinoForeign
    ? '<span><em>类型</em><strong>中外合作</strong></span>'
    : '';
  const resourceFact = admitted && admission.isSinoForeign
    ? `<span><em>资源</em><strong>${escapeHtml(formatResourceFit(admission))}</strong></span>`
    : '';
  const reach = [
    admission.canReach985 ? '可达 985' : null,
    admission.canReach211 ? '可达 211' : null,
  ].filter(Boolean).join(' · ') || '未达样本 211/985';
  return `
    <div class="panel admission-panel">
      <div class="section-title">
        <div>
          <h2>高考录取</h2>
          <p class="muted">${trackLabel}</p>
        </div>
        <span class="score-badge">${admission.finalScore}</span>
      </div>
      ${admitted ? `
        <div class="admission-school">
          <strong>${escapeHtml(admission.admittedUniversity!.name)}</strong>
          <span>${escapeHtml(admission.admittedLine!.groupName)}</span>
        </div>
        <div class="admission-facts">
          <span><em>层级</em><strong>${escapeHtml(admissionTierName(admission.admissionTier))}</strong></span>
          <span><em>投档线</em><strong>${admission.admittedLine!.minScore}</strong></span>
          <span><em>超线</em><strong>+${admission.margin ?? 0}</strong></span>
          <span><em>策略</em><strong>${escapeHtml(admission.strategyLabel)}</strong></span>
          ${cooperationFact}
          ${resourceFact}
        </div>
      ` : `
        <div class="admission-school">
          <strong>${escapeHtml(admissionTierName(admission.admissionTier))}</strong>
          <span>${escapeHtml(reach)}</span>
        </div>
      `}
      <p class="admission-reason">${escapeHtml(admission.reason)}</p>
    </div>
  `;
}

function formatResourceFit(admission: AdmissionResult): string {
  const gap = admission.resourceGap ?? 0;
  if (gap >= 2) return '充足';
  if (gap >= 0) return '匹配';
  return `差 ${Math.abs(gap)}`;
}

function renderStats(state: GameState): string {
  const props = state.props;
  const stats: Array<[string, number, 'prop' | 'score']> = [
    ['学力', props.INT, 'prop'],
    ['精力', props.STR, 'prop'],
    ['资源', props.MNY, 'prop'],
    ['心态', props.SPR, 'prop'],
    ['志愿', props.VOL, 'prop'],
    ['风险', props.RSK, 'prop'],
    ['潜力', props.SCR, 'score'],
    ['最高', props.HSCR, 'score'],
    ['总评', props.SUM, 'score'],
  ];
  return `<div class="stats">${stats.map(([label, value, kind]) => `<span><em>${label}</em><strong>${formatNumber(value, kind)}</strong></span>`).join('')}</div>`;
}

function renderLogItem(log: GameState['logs'][number]): string {
  const branch = log.branchEvents.length
    ? `<p class="branch">连锁：${log.branchEvents.map(item => escapeHtml(item.text)).join(' / ')}</p>`
    : '';
  const talents = log.triggeredTalents.length
    ? `<p class="branch">天赋：${log.triggeredTalents.map(item => escapeHtml(item.name)).join(' / ')}</p>`
    : '';
  return `
    <article class="log-item">
      <strong>${escapeHtml(ageStageName(log.age))} · 第 ${log.round} 回合 · ${escapeHtml(log.roundName)}</strong>
      <p>${escapeHtml(log.event.text)}</p>
      ${talents}
      ${branch}
    </article>
  `;
}

function renderTalentTags(talent: Talent): string {
  const hidden = new Set([talent.rarityName ?? talentRarityName(talent.grade), talent.categoryName].filter((item): item is string => Boolean(item)));
  const tags = (talent.tags ?? []).filter(item => !hidden.has(item));
  return tags.length ? `<span class="tags">${tags.map(escapeHtml).join(' / ')}</span>` : '';
}

function talentRarityName(grade: number): string {
  return ['普通', '稀有', '史诗', '传说'][grade] ?? '普通';
}

function achievementGradeName(grade: number): string {
  return ['普通', '稀有', '史诗', '传说'][grade] ?? '普通';
}

function universityTierLabel(tier: GameApp['content']['universities'][number]['prestigeTier']): string {
  return {
    top: '顶尖',
    strong: '强校',
    solid: '稳健',
    regional: '区域',
    private: '民办',
  }[tier];
}

function renderRoundLabel(state: GameState): string {
  const current = state.currentRound;
  if (!current) return '3 岁 · 第 1 回合';
  return `${ageStageName(current.age)} · 第 ${current.round} 回合 · ${current.roundName}`;
}

function ageStageName(age: number): string {
  const gradeNames: Record<number, string> = {
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
    18: '高考收官季',
  };
  return gradeNames[age] ?? `${age} 岁`;
}

function remainingPoints(allocation: Allocation): number {
  return 20 - allocation.INT - allocation.STR - allocation.MNY - allocation.SPR;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] ?? char);
}

function formatNumber(value: string | number, kind: string = 'score'): string {
  if (typeof value !== 'number') return value;
  if (kind === 'prop') return String(Math.floor(value));
  return String(Math.round(value));
}

function admissionTierName(tier: AdmissionResult['admissionTier']): string {
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
