import type { GameApp } from '../app/createGame';
import type { AdmissionResult, Allocation, FinalResult, GameState, Talent } from '../app/types';
import { LifeEngine } from '../engine/life';
import { recordFinalResult, setInheritedTalent } from '../engine/storage';
import { drawTalentCandidates, getTalentMap, hasTalentConflict } from '../engine/talents';

type Screen = 'home' | 'talents' | 'properties' | 'trajectory' | 'summary';

interface UiState {
  screen: Screen;
  candidates: Talent[];
  inheritedCandidateId: number | null;
  selectedTalentIds: number[];
  allocation: Allocation;
  engine: LifeEngine | null;
  gameState: GameState | null;
  result: FinalResult | null;
  persistedResult: boolean;
  message: string | null;
}

export function createApp(root: HTMLElement, game: GameApp): void {
  const state: UiState = {
    screen: 'home',
    candidates: [],
    inheritedCandidateId: null,
    selectedTalentIds: [],
    allocation: { INT: 5, STR: 5, MNY: 5, SPR: 5 },
    engine: null,
    gameState: null,
    result: null,
    persistedResult: false,
    message: null,
  };

  const render = () => {
    root.innerHTML = renderScreen(state, game);
  };

  root.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (!action) return;

    try {
      handleAction(action, target, state, game);
      state.message = null;
    } catch (error) {
      state.message = error instanceof Error ? error.message : '操作失败';
    }
    render();
  });

  render();
}

function handleAction(action: string, target: HTMLElement, state: UiState, game: GameApp): void {
  if (action === 'start') {
    const inheritedTalentId = game.save.inheritedTalentId;
    state.candidates = drawTalentCandidates(game.content, 10, inheritedTalentId, Date.now(), game.save.achievedIds);
    state.inheritedCandidateId = state.candidates.some(item => item.id === inheritedTalentId) ? inheritedTalentId : null;
    state.selectedTalentIds = [];
    state.screen = 'talents';
    if (inheritedTalentId !== null) game.persist(setInheritedTalent(game.save, null));
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
    state.engine = engine;
    state.gameState = gameState;
    state.result = null;
    state.persistedResult = false;
    state.screen = 'trajectory';
    return;
  }

  if (action === 'next-round') {
    runOneRound(state, game);
    return;
  }

  if (action === 'auto-run') {
    while (!state.gameState?.isFinished) runOneRound(state, game);
    return;
  }

  if (action === 'inherit') {
    const id = Number(target.closest<HTMLElement>('[data-id]')?.dataset.id);
    game.persist(setInheritedTalent(game.save, id));
    return;
  }

  if (action === 'clear-inherit') {
    game.persist(setInheritedTalent(game.save, null));
    return;
  }

  if (action === 'restart') {
    state.screen = 'home';
    state.engine = null;
    state.gameState = null;
    state.result = null;
    state.inheritedCandidateId = null;
    state.persistedResult = false;
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
  const step = state.engine.next();
  state.gameState = step.state;
  if (step.ending && step.admission) {
    const result: FinalResult = { state: step.state, ending: step.ending, admission: step.admission };
    state.result = result;
    state.screen = 'summary';
    if (!state.persistedResult) {
      game.persist(recordFinalResult(game.save, result, game.content));
      state.persistedResult = true;
    }
  }
}

function renderScreen(state: UiState, game: GameApp): string {
  const message = state.message ? `<div class="message">${escapeHtml(state.message)}</div>` : '';
  const body = {
    home: renderHome(game),
    talents: renderTalents(state, game),
    properties: renderProperties(state),
    trajectory: renderTrajectory(state),
    summary: renderSummary(state, game),
  }[state.screen];

  return `
    <div class="shell">
      <header class="topbar">
        <div>
          <h1>高考重开模拟器</h1>
          <p>${game.save.times} 次重开 · ${game.save.unlockedEndingIds.length} 个结局</p>
        </div>
        <button class="ghost" data-action="restart">首页</button>
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
      <div>
        <h2>新一轮人生志愿表</h2>
        <p class="muted">从 3 岁到 18 岁，每年 4 回合。</p>
      </div>
      ${inherited ? `<p class="pill">继承天赋：${escapeHtml(inherited.name)}</p>` : ''}
      <button class="primary wide" data-action="start">开始重开</button>
    </section>
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
    <section class="stack">
      <div class="section-title">
        <h2>选择天赋</h2>
        <p>${state.selectedTalentIds.length}/3</p>
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
    <section class="panel">
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

function renderTrajectory(state: UiState): string {
  const gameState = state.gameState;
  if (!gameState) return '';
  const latest = gameState.logs.at(-1);
  return `
    <section class="stack">
      <div class="panel">
        <div class="section-title">
          <h2>${renderRoundLabel(gameState)}</h2>
          <p>${gameState.stepIndex}/64</p>
        </div>
        ${renderStats(gameState)}
        <div class="actions">
          <button class="primary" data-action="next-round" ${gameState.isFinished ? 'disabled' : ''}>下一回合</button>
          <button data-action="auto-run" ${gameState.isFinished ? 'disabled' : ''}>自动跑完</button>
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
  const talents = state.result.state.selectedTalentIds
    .map(id => game.content.talents.find(item => item.id === id))
    .filter((item): item is Talent => Boolean(item));
  const inheritable = talents.filter(item => item.inheritAllowed !== false);
  return `
    <section class="stack">
      <div class="panel summary">
        <span class="tier">${escapeHtml(ending.tier)}</span>
        <h2>${escapeHtml(ending.name)}</h2>
        <p>${escapeHtml(ending.description)}</p>
        ${renderStats(state.result.state)}
      </div>
      ${renderAdmission(state.result.admission)}
      ${renderSummaryLogs(state.result.state)}
      <div class="panel">
        <div class="section-title">
          <h2>继承天赋</h2>
          <button class="ghost" data-action="clear-inherit">清空</button>
        </div>
        <div class="inherit-list">
          ${inheritable.map(talent => `
            <button class="inherit ${game.save.inheritedTalentId === talent.id ? 'selected' : ''}" data-action="inherit" data-id="${talent.id}">
              ${escapeHtml(talent.name)}
            </button>
          `).join('')}
        </div>
      </div>
      <button class="primary wide" data-action="restart">再来一局</button>
    </section>
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
  const admitted = admission.admitted && admission.admittedLine && admission.admittedUniversity;
  const reach = [
    admission.canReach985 ? '可达 985' : null,
    admission.canReach211 ? '可达 211' : null,
  ].filter(Boolean).join(' · ') || '未达样本 211/985';
  return `
    <div class="panel admission-panel">
      <div class="section-title">
        <div>
          <h2>高考录取</h2>
          <p class="muted">${escapeHtml(admission.profileName)}</p>
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
        </div>
      ` : `
        <div class="admission-school">
          <strong>${escapeHtml(admissionTierName(admission.admissionTier))}</strong>
          <span>${escapeHtml(reach)}</span>
        </div>
      `}
      <p class="admission-reason">${escapeHtml(admission.reason)}</p>
      <p class="muted source-note">投档线来源：广西招生考试院，本模拟不是志愿填报建议。</p>
    </div>
  `;
}

function renderStats(state: GameState): string {
  const props = state.props;
  const stats = [
    ['学力', props.INT],
    ['精力', props.STR],
    ['资源', props.MNY],
    ['心态', props.SPR],
    ['志愿', props.VOL],
    ['风险', props.RSK],
    ['潜力', props.SCR],
    ['最高', props.HSCR],
    ['总评', props.SUM],
  ];
  return `<div class="stats">${stats.map(([label, value]) => `<span><em>${label}</em><strong>${formatNumber(value)}</strong></span>`).join('')}</div>`;
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
      <strong>${log.age} 岁 · 第 ${log.round} 回合 · ${escapeHtml(log.roundName)}</strong>
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

function renderRoundLabel(state: GameState): string {
  const current = state.currentRound;
  if (!current) return '3 岁 · 第 1 回合';
  return `${current.age} 岁 · 第 ${current.round} 回合 · ${current.roundName}`;
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

function formatNumber(value: string | number): string {
  return typeof value === 'number' ? String(Math.round(value)) : value;
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
