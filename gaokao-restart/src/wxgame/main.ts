import { createGame, type GameApp } from '../app/createGame';
import type {
  Achievement,
  AdmissionResult,
  Allocation,
  FinalResult,
  GameState,
  RunLog,
  Talent,
  TalentRarity,
} from '../app/types';
import { LifeEngine } from '../engine/life';
import { recordFinalResult, setInheritedTalent } from '../engine/storage';
import { drawTalentCandidates, getTalentMap, hasTalentConflict } from '../engine/talents';
import { createWxSaveStorage } from './storage';

type Screen = 'home' | 'talents' | 'properties' | 'trajectory' | 'summary' | 'achievements';
type PropKey = keyof Allocation;

type Action =
  | { type: 'start' }
  | { type: 'viewAchievements' }
  | { type: 'closeAchievements' }
  | { type: 'toggleTalent'; talentId: number }
  | { type: 'toProperties' }
  | { type: 'backToTalents' }
  | { type: 'adjustProp'; prop: PropKey; delta: number }
  | { type: 'beginRun' }
  | { type: 'nextRound' }
  | { type: 'autoRun' }
  | { type: 'retake' }
  | { type: 'inherit'; talentId: number }
  | { type: 'clearInherit' }
  | { type: 'restart' }
  | { type: 'requestRestart' }
  | { type: 'cancelRestart' }
  | { type: 'confirmRestart' };

interface Button {
  action: Action;
  x: number;
  y: number;
  width: number;
  height: number;
  disabled?: boolean;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UiState {
  screen: Screen;
  previousScreen: Screen | null;
  candidates: Talent[];
  selectedTalentIds: number[];
  inheritedCandidateId: number | null;
  allocation: Allocation;
  engine: LifeEngine | null;
  gameState: GameState | null;
  result: FinalResult | null;
  persistedResult: boolean;
  confirmingRestart: boolean;
  message: string | null;
}

const propRows: Array<{ key: PropKey; label: string; color: string }> = [
  { key: 'INT', label: '学力', color: '#1971c2' },
  { key: 'STR', label: '精力', color: '#2f9e44' },
  { key: 'MNY', label: '资源', color: '#f08c00' },
  { key: 'SPR', label: '心态', color: '#d9480f' },
];

const rarityColors: Record<TalentRarity, { bg: string; fg: string; border: string }> = {
  common: { bg: '#f8f9fa', fg: '#495057', border: '#ced4da' },
  rare: { bg: '#e7f5ff', fg: '#1864ab', border: '#74c0fc' },
  epic: { bg: '#f3f0ff', fg: '#5f3dc4', border: '#b197fc' },
  legendary: { bg: '#fff4e6', fg: '#d9480f', border: '#ffa94d' },
};

class WxGameApp {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly game: GameApp;
  private readonly state: UiState = {
    screen: 'home',
    previousScreen: null,
    candidates: [],
    selectedTalentIds: [],
    inheritedCandidateId: null,
    allocation: { INT: 5, STR: 5, MNY: 5, SPR: 5 },
    engine: null,
    gameState: null,
    result: null,
    persistedResult: false,
    confirmingRestart: false,
    message: null,
  };

  private buttons: Button[] = [];
  private width = 375;
  private height = 667;
  private pixelRatio = 1;
  private safeTop = 0;
  private safeBottom = 0;
  private scrollY = 0;
  private maxScrollY = 0;
  private activeScrollScreen: Screen = 'home';
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartScrollY = 0;
  private isTouchScrolling = false;
  private isTouchMoved = false;
  private currentOffsetY = 0;
  private currentButtonViewport: Rect | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly wxApi: WxMiniGameAPI | undefined,
  ) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context is unavailable');
    this.ctx = context;
    this.game = createGame({ storage: createWxSaveStorage(wxApi) });
    this.resize();
    this.bindInput();
    this.bindShare();
  }

  start(): void {
    this.render();
  }

  private resize(): void {
    const systemInfo = this.wxApi?.getSystemInfoSync();
    this.width = (systemInfo?.windowWidth ?? this.canvas.clientWidth) || 375;
    this.height = (systemInfo?.windowHeight ?? this.canvas.clientHeight) || 667;
    this.pixelRatio = systemInfo?.pixelRatio ?? globalThis.devicePixelRatio ?? 1;
    this.safeTop = systemInfo?.safeArea?.top ? Math.max(0, systemInfo.safeArea.top - 4) : 0;
    this.safeBottom = systemInfo?.safeArea?.bottom
      ? Math.max(0, this.height - systemInfo.safeArea.bottom)
      : 0;

    this.canvas.width = Math.floor(this.width * this.pixelRatio);
    this.canvas.height = Math.floor(this.height * this.pixelRatio);
    if (this.canvas.style) {
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.canvas.style.display = 'block';
    }
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.ctx.textBaseline = 'alphabetic';
  }

  private bindInput(): void {
    if (this.wxApi) {
      this.wxApi.onTouchStart(event => {
        const touch = this.getTouch(event);
        if (touch) this.handleTouchStart(touch.clientX, touch.clientY);
      });
      this.wxApi.onTouchMove(event => {
        const touch = this.getTouch(event);
        if (touch) this.handleTouchMove(touch.clientX, touch.clientY);
      });
      this.wxApi.onTouchEnd(event => {
        const touch = this.getTouch(event);
        if (touch) this.handleTouchEnd(touch.clientX, touch.clientY);
      });
      return;
    }

    this.canvas.addEventListener('pointerdown', event => this.handleTouchStart(event.clientX, event.clientY));
    this.canvas.addEventListener('pointermove', event => this.handleTouchMove(event.clientX, event.clientY));
    this.canvas.addEventListener('pointerup', event => this.handleTouchEnd(event.clientX, event.clientY));
  }

  private bindShare(): void {
    this.wxApi?.showShareMenu?.({ withShareTicket: true });
    this.wxApi?.onShareAppMessage?.(() => ({ title: '重回高三人生模拟' }));
  }

  private getTouch(event: WxTouchEvent): WxTouchPoint | null {
    return event.touches?.[0] ?? event.changedTouches?.[0] ?? null;
  }

  private handleTouchStart(x: number, y: number): void {
    this.touchStartX = x;
    this.touchStartY = y;
    this.touchStartScrollY = this.scrollY;
    this.isTouchMoved = false;
    this.isTouchScrolling = this.pointInRect(x, y, this.contentViewport());
  }

  private handleTouchMove(x: number, y: number): void {
    if (!this.isTouchScrolling) return;
    const deltaY = this.touchStartY - y;
    if (Math.abs(deltaY) > 4 || Math.abs(this.touchStartX - x) > 4) this.isTouchMoved = true;
    if (this.maxScrollY <= 0) return;
    this.scrollY = this.clamp(this.touchStartScrollY + deltaY, 0, this.maxScrollY);
    this.render();
  }

  private handleTouchEnd(x: number, y: number): void {
    if (!this.isTouchMoved) this.handlePointer(x, y);
    this.isTouchScrolling = false;
    this.isTouchMoved = false;
  }

  private handlePointer(x: number, y: number): void {
    const button = this.buttons.find(item =>
      !item.disabled
      && x >= item.x
      && x <= item.x + item.width
      && y >= item.y
      && y <= item.y + item.height,
    );
    if (!button) return;

    try {
      this.state.message = null;
      this.handleAction(button.action);
    } catch (error) {
      this.state.message = error instanceof Error ? error.message : '操作失败';
      this.wxApi?.showToast?.({ title: this.state.message.slice(0, 12), icon: 'none' });
    }
    this.render();
  }

  private handleAction(action: Action): void {
    if (action.type !== 'requestRestart' && action.type !== 'cancelRestart' && action.type !== 'confirmRestart') {
      this.state.confirmingRestart = false;
    }

    if (action.type === 'start') {
      this.prepareTalentScreen();
      return;
    }

    if (action.type === 'viewAchievements') {
      this.commitFinalResult();
      if (this.state.screen !== 'achievements') this.state.previousScreen = this.state.screen;
      this.switchScreen('achievements');
      return;
    }

    if (action.type === 'closeAchievements') {
      const target = this.state.previousScreen && this.state.previousScreen !== 'achievements'
        ? this.state.previousScreen
        : 'home';
      this.state.previousScreen = null;
      this.switchScreen(target);
      return;
    }

    if (action.type === 'toggleTalent') {
      this.toggleTalent(action.talentId);
      return;
    }

    if (action.type === 'toProperties') {
      if (this.state.selectedTalentIds.length !== 3) throw new Error('请选择 3 个天赋');
      this.switchScreen('properties');
      return;
    }

    if (action.type === 'backToTalents') {
      this.switchScreen('talents');
      return;
    }

    if (action.type === 'adjustProp') {
      this.adjustAllocation(action.prop, action.delta);
      return;
    }

    if (action.type === 'beginRun') {
      if (this.remainingPoints() !== 0) throw new Error('属性点需要全部分配完');
      const engine = new LifeEngine(this.game.content);
      const gameState = engine.start(this.state.selectedTalentIds, this.state.allocation);
      if (this.game.save.inheritedTalentId !== null) this.game.persist(setInheritedTalent(this.game.save, null));
      this.state.engine = engine;
      this.state.gameState = gameState;
      this.state.result = null;
      this.state.persistedResult = false;
      this.switchScreen('trajectory');
      return;
    }

    if (action.type === 'nextRound') {
      this.runOneRound();
      return;
    }

    if (action.type === 'autoRun') {
      while (!this.state.gameState?.isFinished) this.runOneRound();
      return;
    }

    if (action.type === 'retake') {
      if (!this.state.engine) throw new Error('本局还未开始');
      if (this.state.persistedResult) throw new Error('本局结局已经确认，不能再复读');
      this.state.gameState = this.state.engine.retake();
      this.state.result = null;
      this.state.message = '已选择复读一年，心态下降，风险上升。';
      this.switchScreen('trajectory');
      return;
    }

    if (action.type === 'inherit') {
      this.commitFinalResult();
      this.game.persist(setInheritedTalent(this.game.save, action.talentId));
      this.state.message = '已继承该天赋，下局会优先出现。';
      return;
    }

    if (action.type === 'clearInherit') {
      this.commitFinalResult();
      this.game.persist(setInheritedTalent(this.game.save, null));
      this.state.message = '已清空继承天赋。';
      return;
    }

    if (action.type === 'requestRestart') {
      this.state.confirmingRestart = true;
      this.state.message = '确认看完结局后，再点“确认重开”。';
      return;
    }

    if (action.type === 'cancelRestart') {
      this.state.confirmingRestart = false;
      this.state.message = null;
      return;
    }

    if (action.type === 'confirmRestart') {
      this.restartToHome();
      return;
    }

    if (action.type === 'restart') {
      this.restartToHome();
    }
  }

  private restartToHome(): void {
    this.commitFinalResult();
    this.state.screen = 'home';
    this.state.previousScreen = null;
    this.state.candidates = [];
    this.state.selectedTalentIds = [];
    this.state.inheritedCandidateId = null;
    this.state.allocation = { INT: 5, STR: 5, MNY: 5, SPR: 5 };
    this.state.engine = null;
    this.state.gameState = null;
    this.state.result = null;
    this.state.persistedResult = false;
    this.state.confirmingRestart = false;
    this.resetScroll('home');
  }

  private prepareTalentScreen(): void {
    const inheritedTalentId = this.game.save.inheritedTalentId;
    const candidates = drawTalentCandidates(this.game.content, 10, inheritedTalentId, Date.now(), this.game.save.achievedIds);
    const inheritedCandidateId = candidates.some(item => item.id === inheritedTalentId) ? inheritedTalentId : null;
    this.state.candidates = candidates;
    this.state.inheritedCandidateId = inheritedCandidateId;
    this.state.selectedTalentIds = inheritedCandidateId !== null ? [inheritedCandidateId] : [];
    if (inheritedTalentId !== null && inheritedCandidateId === null) this.game.persist(setInheritedTalent(this.game.save, null));
    this.switchScreen('talents');
  }

  private toggleTalent(talentId: number): void {
    if (this.state.selectedTalentIds.includes(talentId)) {
      this.state.selectedTalentIds = this.state.selectedTalentIds.filter(id => id !== talentId);
      return;
    }
    if (this.state.selectedTalentIds.length >= 3) throw new Error('最多选择 3 个天赋');
    const talent = this.game.content.talents.find(item => item.id === talentId);
    if (!talent) throw new Error('天赋不存在');
    if (hasTalentConflict(talent, this.state.selectedTalentIds, getTalentMap(this.game.content))) {
      throw new Error('该天赋与已选天赋互斥');
    }
    this.state.selectedTalentIds.push(talentId);
  }

  private adjustAllocation(prop: PropKey, delta: number): void {
    const current = this.state.allocation[prop];
    if (delta > 0 && this.remainingPoints() <= 0) return;
    if (delta < 0 && current <= 0) return;
    this.state.allocation = { ...this.state.allocation, [prop]: current + delta };
  }

  private runOneRound(): void {
    const engine = this.state.engine;
    if (!engine) throw new Error('本局还未开始');
    if (this.state.gameState?.isFinished) return;
    const step = engine.next();
    this.state.gameState = step.state;
    if (step.ending && step.admission) {
      this.state.result = { state: step.state, ending: step.ending, admission: step.admission };
      this.switchScreen('summary');
      if (step.state.retakeUsed) this.commitFinalResult();
    }
  }

  private commitFinalResult(): void {
    if (!this.state.result || this.state.persistedResult) return;
    this.game.persist(recordFinalResult(this.game.save, this.state.result, this.game.content));
    this.state.persistedResult = true;
  }

  private switchScreen(screen: Screen): void {
    this.state.screen = screen;
    this.state.confirmingRestart = false;
    this.resetScroll(screen);
  }

  private resetScroll(screen: Screen): void {
    this.activeScrollScreen = screen;
    this.scrollY = 0;
    this.maxScrollY = 0;
  }

  private render(): void {
    if (this.activeScrollScreen !== this.state.screen) this.resetScroll(this.state.screen);
    this.buttons = [];
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.fillStyle = '#edf3ea';
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.drawHeader();

    const viewport = this.contentViewport();
    this.scrollY = this.clamp(this.scrollY, 0, this.maxScrollY);
    const contentHeight = this.drawScrollableContent(viewport);
    this.maxScrollY = Math.max(0, contentHeight - viewport.height);
    if (this.scrollY > this.maxScrollY) {
      this.scrollY = this.maxScrollY;
      this.render();
      return;
    }

    this.drawFooter();
  }

  private drawHeader(): void {
    const top = Math.max(10, this.safeTop + 7);
    this.ctx.fillStyle = '#edf3ea';
    this.ctx.fillRect(0, 0, this.width, this.headerHeight());
    this.ctx.fillStyle = '#ffffff';
    this.roundRect(12, top - 2, this.width - 24, 68, 8);
    this.ctx.fill();
    this.ctx.strokeStyle = '#dfe7dd';
    this.ctx.stroke();
    this.setFont(21, 800);
    this.ctx.fillStyle = '#172033';
    this.ctx.fillText(this.fitText('重回高三人生模拟', this.width - 128), 24, top + 22);
    this.setFont(11, 500);
    this.ctx.fillStyle = '#687386';
    this.ctx.fillText(`${screenName(this.state.screen)} · ${this.game.save.times} 次重开 · ${this.game.save.unlockedEndingIds.length} 结局 · ${this.game.save.achievedIds.length} 成就`, 24, top + 43);

    this.ctx.fillStyle = '#2f9e44';
    this.ctx.fillRect(24, top + 55, 46, 3);
    this.ctx.fillStyle = '#f08c00';
    this.ctx.fillRect(70, top + 55, 46, 3);
    this.ctx.fillStyle = '#1971c2';
    this.ctx.fillRect(116, top + 55, 46, 3);

    const action = this.state.screen === 'achievements'
      ? { type: 'closeAchievements' as const }
      : { type: 'viewAchievements' as const };
    const label = this.state.screen === 'achievements' ? '返回' : '成就';
    this.drawButton(action, label, this.width - 90, top + 14, 64, 34, 'secondary');
  }

  private drawScrollableContent(viewport: Rect): number {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
    this.ctx.clip();
    this.currentOffsetY = -this.scrollY;
    this.currentButtonViewport = viewport;
    this.ctx.translate(0, -this.scrollY);

    let cursor = viewport.y + 4;
    if (this.state.screen === 'home') cursor = this.drawHome(cursor);
    else if (this.state.screen === 'talents') cursor = this.drawTalents(cursor);
    else if (this.state.screen === 'properties') cursor = this.drawProperties(cursor);
    else if (this.state.screen === 'trajectory') cursor = this.drawTrajectory(cursor);
    else if (this.state.screen === 'summary') cursor = this.drawSummary(cursor);
    else cursor = this.drawAchievements(cursor);

    this.ctx.restore();
    this.currentOffsetY = 0;
    this.currentButtonViewport = null;
    return cursor - viewport.y + 12;
  }

  private drawHome(y: number): number {
    y = this.drawPanel(y, () => {
      let cursor = y + 26;
      this.drawSectionTitle('新一轮人生志愿表', '从 3 岁到高考收官季推进，高三扩展为 10 个冲刺回合。', 36, cursor);
      cursor += 58;
      cursor = this.drawStageTrack(cursor);
      cursor += 18;
      cursor = this.drawFactRow(cursor, '内容数据', `${this.game.content.talents.length} 天赋 / ${this.game.content.events.length} 事件`);
      cursor = this.drawFactRow(cursor, '结局进度', `${this.game.save.unlockedEndingIds.length}/${this.game.content.endings.length}`);
      cursor = this.drawFactRow(cursor, '成就进度', `${this.game.save.achievedIds.length}/${this.game.content.achievements.length}`);
      if (this.game.save.inheritedTalentId !== null) {
        const inherited = this.game.content.talents.find(item => item.id === this.game.save.inheritedTalentId);
        cursor = this.drawFactRow(cursor, '继承天赋', inherited?.name ?? '已设置');
      }
      this.drawButton(
        { type: 'viewAchievements' },
        `查看成就 ${this.game.save.achievedIds.length}/${this.game.content.achievements.length}`,
        36,
        cursor + 2,
        this.width - 72,
        38,
        'secondary',
      );
      cursor += 50;
      if (this.state.message) cursor = this.drawMessage(cursor + 10, this.state.message);
      return cursor + 8;
    });
    return y + 16;
  }

  private drawAchievements(y: number): number {
    const unlockedIds = new Set(this.game.save.achievedIds);
    const unlocked = this.game.content.achievements.filter(item => unlockedIds.has(item.id));
    y = this.drawPanel(y, () => {
      let cursor = y + 26;
      this.drawSectionTitle('成就', `已解锁 ${unlocked.length}/${this.game.content.achievements.length}`, 36, cursor);
      cursor += 58;
      const stats = [
        ['重开', this.game.save.times],
        ['结局', this.game.save.unlockedEndingIds.length],
        ['事件', this.game.save.seenEventIds.length],
        ['天赋', this.game.save.seenTalentIds.length],
      ] as const;
      cursor = this.drawMiniStats(cursor, stats);
      return cursor + 6;
    });

    if (unlocked.length === 0) {
      y = this.drawPanel(y, () => {
        let cursor = y + 28;
        this.setFont(14, 500);
        this.ctx.fillStyle = '#687386';
        cursor = this.drawWrappedText('还没有解锁成就，先完成一局看看。', 36, cursor, this.width - 72, 22, 3);
        return cursor + 8;
      });
      return y;
    }

    for (const achievement of unlocked) y = this.drawAchievementCard(y, achievement);
    return y;
  }

  private drawTalents(y: number): number {
    y = this.drawSectionHeader(y, '选择天赋', `${this.state.selectedTalentIds.length}/3`);
    const selected = new Set(this.state.selectedTalentIds);
    const gap = 8;
    const cardWidth = (this.width - 40 - gap) / 2;
    const cardHeight = this.talentCardHeight();
    this.state.candidates.forEach((talent, index) => {
      const active = selected.has(talent.id);
      const inherited = this.state.inheritedCandidateId === talent.id;
      const cardX = 16 + (index % 2) * (cardWidth + gap);
      const cardY = y + Math.floor(index / 2) * (cardHeight + gap);
      this.drawTalentCard(cardX, cardY, cardWidth, talent, active, inherited);
    });
    const rows = Math.ceil(this.state.candidates.length / 2);
    y += rows * cardHeight + Math.max(0, rows - 1) * gap + 10;
    if (this.state.message) y = this.drawMessage(y, this.state.message);
    return y;
  }

  private drawProperties(y: number): number {
    y = this.drawSectionHeader(y, '分配属性', `剩余 ${this.remainingPoints()}`);
    for (const row of propRows) {
      y = this.drawPropRow(y, row.key, row.label, row.color);
    }
    y = this.drawPanel(y + 8, () => {
      let cursor = y + 26;
      this.drawSectionTitle('初始分配', '这些属性会影响事件触发、分数波动和志愿结果。', 36, cursor);
      cursor += 62;
      this.setFont(14, 400);
      this.ctx.fillStyle = '#495057';
      return this.drawWrappedText('把 20 点分配到四项基础属性上，之后会影响事件触发、分数波动和志愿结果。', 36, cursor, this.width - 72, 23, 3) + 8;
    });
    if (this.state.message) y = this.drawMessage(y + 4, this.state.message);
    return y;
  }

  private drawTrajectory(y: number): number {
    const gameState = this.state.gameState;
    if (!gameState) return y;
    const totalRounds = this.totalRounds(gameState);
    y = this.drawSectionHeader(y, '人生轨迹', `${gameState.logs.length}/${totalRounds}`);
    y = this.drawStatsPanel(y, gameState);

    if (this.state.message) y = this.drawMessage(y + 4, this.state.message);
    y += 8;

    if (gameState.logs.length === 0) {
      y = this.drawPanel(y, () => {
        let cursor = y + 28;
        this.setFont(15, 500);
        this.ctx.fillStyle = '#495057';
        cursor = this.drawWrappedText('点击“下一回合”开始推进。', 36, cursor, this.width - 72, 24, 2);
        return cursor + 10;
      });
      return y;
    }

    return this.drawVirtualLogList(y, gameState.logs);
  }

  private drawSummary(y: number): number {
    const result = this.state.result;
    if (!result) return y;
    y = this.drawPanel(y, () => {
      let cursor = y + 26;
      this.drawPill(result.ending.tier, 36, cursor - 18, '#fff4e6', '#d9480f');
      cursor += 16;
      this.setFont(22, 800);
      this.ctx.fillStyle = '#172033';
      cursor = this.drawWrappedText(result.ending.name, 36, cursor, this.width - 72, 29, 2);
      this.setFont(15, 400);
      this.ctx.fillStyle = '#343a40';
      cursor = this.drawWrappedText(result.ending.description, 36, cursor + 8, this.width - 72, 24, 5);
      return cursor + 10;
    });

    y = this.drawRetakeFromPanel(y + 10, result.state);
    y = this.drawAdmissionPanel(y + 10, result.admission);
    if (!result.admission.scoreHidden) y = this.drawStatsPanel(y + 10, result.state);
    y = this.drawInheritancePanel(y + 10, result);
    y = this.drawSectionHeader(y + 6, '本局事件', `${result.state.logs.length} 回合`);
    y = this.drawVirtualLogList(y, result.state.logs);
    if (this.state.message) y = this.drawMessage(y + 4, this.state.message);
    return y;
  }

  private drawFooter(): void {
    const buttonHeight = 46;
    const footerY = this.height - this.footerHeight() + 9;
    this.ctx.fillStyle = '#f6f7f9';
    this.ctx.fillRect(0, footerY - 10, this.width, this.footerHeight());
    this.ctx.strokeStyle = '#e9ecef';
    this.ctx.beginPath();
    this.ctx.moveTo(0, footerY - 10);
    this.ctx.lineTo(this.width, footerY - 10);
    this.ctx.stroke();

    this.currentOffsetY = 0;
    this.currentButtonViewport = null;

    if (this.state.screen === 'home') {
      this.drawButton({ type: 'start' }, '开始重开', 20, footerY, this.width - 40, buttonHeight, 'primary');
      return;
    }

    if (this.state.screen === 'talents') {
      this.drawButton(
        { type: 'toProperties' },
        '确认天赋',
        20,
        footerY,
        this.width - 40,
        buttonHeight,
        'primary',
        this.state.selectedTalentIds.length !== 3,
      );
      return;
    }

    if (this.state.screen === 'properties') {
      this.drawButton({ type: 'backToTalents' }, '返回天赋', 20, footerY, 100, buttonHeight, 'secondary');
      this.drawButton(
        { type: 'beginRun' },
        '进入考场人生',
        132,
        footerY,
        this.width - 152,
        buttonHeight,
        'primary',
        this.remainingPoints() !== 0,
      );
      return;
    }

    if (this.state.screen === 'trajectory') {
      const gap = 10;
      const buttonWidth = (this.width - 40 - gap) / 2;
      this.drawButton({ type: 'nextRound' }, '下一回合', 20, footerY, buttonWidth, buttonHeight, 'primary', Boolean(this.state.gameState?.isFinished));
      this.drawButton({ type: 'autoRun' }, '跑完', 20 + buttonWidth + gap, footerY, buttonWidth, buttonHeight, 'secondary', Boolean(this.state.gameState?.isFinished));
      return;
    }

    if (this.state.screen === 'achievements') {
      this.drawButton({ type: 'closeAchievements' }, '返回', 20, footerY, this.width - 40, buttonHeight, 'primary');
      return;
    }

    if (this.state.confirmingRestart) {
      const gap = 10;
      const leftWidth = Math.round((this.width - 40 - gap) * 0.58);
      const rightWidth = this.width - 40 - gap - leftWidth;
      this.drawButton({ type: 'cancelRestart' }, '继续看结局', 20, footerY, leftWidth, buttonHeight, 'primary');
      this.drawButton({ type: 'confirmRestart' }, '确认重开', 20 + leftWidth + gap, footerY, rightWidth, buttonHeight, 'danger');
      return;
    }

    const canRetake = Boolean(
      this.state.result
      && !this.state.result.admission.scoreHidden
      && !this.state.result.state.retakeUsed
      && !this.state.persistedResult,
    );
    if (canRetake) {
      const gap = 10;
      const leftWidth = Math.round((this.width - 40 - gap) * 0.58);
      const rightWidth = this.width - 40 - gap - leftWidth;
      this.drawButton({ type: 'retake' }, '复读一年', 20, footerY, leftWidth, buttonHeight, 'primary');
      this.drawButton({ type: 'requestRestart' }, '看完后重开', 20 + leftWidth + gap, footerY, rightWidth, buttonHeight, 'secondary');
    } else {
      this.drawButton({ type: 'requestRestart' }, '看完后重开', 20, footerY, this.width - 40, buttonHeight, 'secondary');
    }
  }

  private drawTalentCard(x: number, y: number, width: number, talent: Talent, active: boolean, inherited: boolean): void {
    const rarity = talent.rarity ?? talentRarityName(talent.grade);
    const colors = rarityColors[rarity];
    const height = this.talentCardHeight();

    this.ctx.fillStyle = active ? '#e7f5ff' : '#ffffff';
    this.roundRect(x, y, width, height, 8);
    this.ctx.fill();
    this.ctx.strokeStyle = active ? '#1971c2' : colors.border;
    this.ctx.lineWidth = active ? 2 : 1;
    this.ctx.stroke();
    this.ctx.lineWidth = 1;

    const rarityLabel = talent.rarityName ?? talentRarityLabel(rarity);
    const rarityWidth = this.miniPillWidth(rarityLabel);
    this.drawMiniPill(rarityLabel, x + width - 10 - rarityWidth, y + 7, colors.bg, colors.fg);

    this.setFont(14, 800);
    this.ctx.fillStyle = '#172033';
    const titleSuffix = inherited ? ' · 继承' : '';
    this.ctx.fillText(this.fitText(`${talent.name}${titleSuffix}`, width - rarityWidth - 28), x + 10, y + 21);

    if (active) {
      this.ctx.fillStyle = '#1971c2';
      this.ctx.beginPath();
      this.ctx.arc(x + width - 18, y + height - 17, 10, 0, Math.PI * 2);
      this.ctx.fill();
      this.setFont(13, 800);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText('✓', x + width - 22, y + height - 12);
    }

    this.setFont(12, 400);
    this.ctx.fillStyle = '#495057';
    this.drawWrappedText(talent.description, x + 10, y + 43, width - (active ? 44 : 20), 15, 2);

    this.registerButton({ type: 'toggleTalent', talentId: talent.id }, x, y, width, height);
  }

  private drawPropRow(y: number, prop: PropKey, label: string, color: string): number {
    const x = 20;
    const width = this.width - 40;
    const height = 74;
    this.ctx.fillStyle = '#ffffff';
    this.roundRect(x, y, width, height, 8);
    this.ctx.fill();
    this.ctx.strokeStyle = '#e9ecef';
    this.ctx.stroke();

    this.ctx.fillStyle = color;
    this.roundRect(x + 14, y + 18, 4, 38, 2);
    this.ctx.fill();
    this.setFont(17, 800);
    this.ctx.fillStyle = '#172033';
    this.ctx.fillText(label, x + 30, y + 30);
    this.setFont(13, 500);
    this.ctx.fillStyle = '#687386';
    this.ctx.fillText(prop, x + 30, y + 52);

    const value = this.state.allocation[prop];
    const buttonSize = 38;
    const plusX = x + width - 54;
    const valueX = plusX - 52;
    const minusX = valueX - 52;
    this.drawButton({ type: 'adjustProp', prop, delta: -1 }, '-', minusX, y + 18, buttonSize, buttonSize, 'secondary', value <= 0);
    this.setFont(20, 800);
    this.ctx.fillStyle = '#172033';
    this.ctx.fillText(String(value), valueX + 17 - this.ctx.measureText(String(value)).width / 2, y + 44);
    this.drawButton({ type: 'adjustProp', prop, delta: 1 }, '+', plusX, y + 18, buttonSize, buttonSize, 'secondary', this.remainingPoints() <= 0);
    return y + height + 10;
  }

  private drawStageTrack(y: number): number {
    const stages = [
      ['童年', '3-6岁'],
      ['小学', '7-12岁'],
      ['初中', '13-15岁'],
      ['高中', '16-18岁'],
      ['高考', '18岁'],
    ] as const;
    const x = 36;
    const width = this.width - 72;
    const gap = 6;
    const cellWidth = (width - gap * (stages.length - 1)) / stages.length;
    stages.forEach(([title, meta], index) => {
      const cellX = x + index * (cellWidth + gap);
      this.ctx.fillStyle = '#f1f6ef';
      this.roundRect(cellX, y, cellWidth, 50, 8);
      this.ctx.fill();
      this.ctx.strokeStyle = '#d8e5d5';
      this.ctx.stroke();
      this.ctx.fillStyle = '#2f9e44';
      this.ctx.beginPath();
      this.ctx.arc(cellX + cellWidth / 2, y + 11, 3, 0, Math.PI * 2);
      this.ctx.fill();
      this.setFont(12, 800);
      this.ctx.fillStyle = '#172033';
      const titleWidth = this.ctx.measureText(title).width;
      this.ctx.fillText(title, cellX + (cellWidth - titleWidth) / 2, y + 29);
      this.setFont(10, 500);
      this.ctx.fillStyle = '#687386';
      const metaWidth = this.ctx.measureText(meta).width;
      this.ctx.fillText(meta, cellX + (cellWidth - metaWidth) / 2, y + 43);
    });
    return y + 50;
  }

  private drawMiniStats(y: number, stats: ReadonlyArray<readonly [string, number]>): number {
    const gap = 8;
    const cellWidth = (this.width - 72 - gap * (stats.length - 1)) / stats.length;
    stats.forEach(([label, value], index) => {
      const cellX = 36 + index * (cellWidth + gap);
      this.ctx.fillStyle = '#f1f3f5';
      this.roundRect(cellX, y, cellWidth, 48, 6);
      this.ctx.fill();
      this.setFont(12, 500);
      this.ctx.fillStyle = '#687386';
      this.ctx.fillText(label, cellX + 9, y + 17);
      this.setFont(16, 800);
      this.ctx.fillStyle = '#172033';
      this.ctx.fillText(String(value), cellX + 9, y + 38);
    });
    return y + 58;
  }

  private drawAchievementCard(y: number, achievement: Achievement): number {
    return this.drawPanel(y, () => {
      let cursor = y + 24;
      const grade = achievementGradeName(achievement.grade);
      const gradeWidth = this.miniPillWidth(grade);
      this.setFont(16, 800);
      this.ctx.fillStyle = '#172033';
      this.ctx.fillText(this.fitText(achievement.name, this.width - 92 - gradeWidth), 36, cursor);
      this.drawMiniPill(grade, this.width - 36 - gradeWidth, cursor - 15, '#e7f5ff', '#1864ab');
      this.setFont(13, 400);
      this.ctx.fillStyle = '#495057';
      cursor = this.drawWrappedText(achievement.description, 36, cursor + 24, this.width - 72, 19, 3);
      this.setFont(12, 700);
      this.ctx.fillStyle = '#2f9e44';
      this.ctx.fillText('已解锁', 36, cursor + 8);
      return cursor + 14;
    });
  }

  private drawStatsPanel(y: number, gameState: GameState): number {
    return this.drawPanel(y, () => {
      let cursor = y + 26;
      this.drawSectionTitle('当前属性', gameState.currentRound ? `${gameState.currentRound.phaseName} · 第 ${gameState.currentRound.round} 回合` : '尚未推进', 36, cursor);
      cursor += 58;
      const stats = [
        ['学力', gameState.props.INT],
        ['精力', gameState.props.STR],
        ['资源', gameState.props.MNY],
        ['心态', gameState.props.SPR],
        ['志愿', gameState.props.VOL],
        ['风险', gameState.props.RSK],
        ['潜力', gameState.props.SCR],
        ['最高', gameState.props.HSCR],
        ['总评', gameState.props.SUM],
      ] as const;
      const columns = this.width < 360 ? 3 : 4;
      const gap = 8;
      const cellWidth = (this.width - 72 - gap * (columns - 1)) / columns;
      const cellHeight = 44;
      stats.forEach(([label, value], index) => {
        const cellX = 36 + (index % columns) * (cellWidth + gap);
        const cellY = cursor + Math.floor(index / columns) * (cellHeight + gap);
        this.ctx.fillStyle = '#f1f3f5';
        this.roundRect(cellX, cellY, cellWidth, cellHeight, 6);
        this.ctx.fill();
        this.setFont(12, 500);
        this.ctx.fillStyle = '#687386';
        this.ctx.fillText(label, cellX + 9, cellY + 16);
        this.setFont(16, 800);
        this.ctx.fillStyle = '#172033';
        this.ctx.fillText(String(Math.round(value)), cellX + 9, cellY + 35);
      });
      const rows = Math.ceil(stats.length / columns);
      return cursor + rows * (cellHeight + gap) + 2;
    });
  }

  private drawRetakeFromPanel(y: number, gameState: GameState): number {
    if (!gameState.retakeFrom) return y;
    return this.drawPanel(y, () => {
      let cursor = y + 26;
      this.drawSectionTitle('首考结果', gameState.retakeFrom!.endingName, 36, cursor);
      cursor += 58;
      cursor = this.drawFactRow(cursor, '首考分数', String(gameState.retakeFrom!.finalScore));
      cursor = this.drawFactRow(cursor, '首考院校', gameState.retakeFrom!.admittedUniversityName ?? '未录取到样本院校');
      cursor = this.drawFactRow(cursor, '首考层级', admissionTierName(gameState.retakeFrom!.admissionTier));
      return cursor + 4;
    });
  }

  private drawAdmissionPanel(y: number, admission: AdmissionResult): number {
    return this.drawPanel(y, () => {
      let cursor = y + 26;
      if (admission.scoreHidden) {
        this.drawSectionTitle('保送录取', '提前锁定录取资格', 36, cursor);
        cursor += 58;
        cursor = this.drawFactRow(cursor, '录取院校', admission.admittedUniversity?.name ?? '已锁定录取资格');
        cursor = this.drawFactRow(cursor, '录取层级', admissionTierName(admission.admissionTier));
        this.setFont(14, 400);
        this.ctx.fillStyle = '#343a40';
        cursor = this.drawWrappedText(admission.reason, 36, cursor + 8, this.width - 72, 22, 6);
        return cursor + 4;
      }

      this.drawSectionTitle('高考录取', `${admission.subjectTrackName} · ${admission.strategyLabel}`, 36, cursor);
      this.drawScoreBadge(String(admission.finalScore), this.width - 98, cursor - 12);
      cursor += 58;
      cursor = this.drawFactRow(cursor, '录取层级', admissionTierName(admission.admissionTier));
      cursor = this.drawFactRow(cursor, '录取院校', admission.admittedUniversity?.name ?? '未录取到样本院校');
      if (admission.admittedLine) cursor = this.drawFactRow(cursor, '投档线', String(admission.admittedLine.minScore));
      if (admission.margin !== undefined) cursor = this.drawFactRow(cursor, '超线', `+${admission.margin}`);
      this.setFont(14, 400);
      this.ctx.fillStyle = '#343a40';
      cursor = this.drawWrappedText(admission.reason, 36, cursor + 8, this.width - 72, 22, 6);
      return cursor + 4;
    });
  }

  private drawInheritancePanel(y: number, result: FinalResult): number {
    const talents = result.state.selectedTalentIds
      .map(id => this.game.content.talents.find(item => item.id === id))
      .filter((item): item is Talent => Boolean(item));

    return this.drawPanel(y, () => {
      let cursor = y + 26;
      this.drawSectionTitle('继承天赋', '选择一个天赋，下局优先出现。', 36, cursor);
      cursor += 58;
      if (talents.length === 0) {
        this.setFont(14, 400);
        this.ctx.fillStyle = '#687386';
        cursor = this.drawWrappedText('本局没有可继承天赋。', 36, cursor, this.width - 72, 22, 2);
        return cursor + 6;
      }
      const gap = 8;
      const buttonWidth = (this.width - 72 - gap) / 2;
      talents.forEach((talent, index) => {
        const buttonX = 36 + (index % 2) * (buttonWidth + gap);
        const buttonY = cursor + Math.floor(index / 2) * 46;
        const active = this.game.save.inheritedTalentId === talent.id;
        this.drawButton({ type: 'inherit', talentId: talent.id }, talent.name, buttonX, buttonY, buttonWidth, 38, active ? 'primary' : 'secondary');
      });
      cursor += Math.ceil(talents.length / 2) * 46;
      this.drawButton({ type: 'clearInherit' }, '清空继承', 36, cursor + 4, this.width - 72, 38, 'secondary');
      return cursor + 52;
    });
  }

  private drawVirtualLogList(y: number, logs: RunLog[]): number {
    const items = [...logs].reverse();
    const cardHeight = this.logCardHeight();
    const gap = 8;
    const viewport = this.currentButtonViewport;
    let cursor = y;

    for (const log of items) {
      const screenRect = {
        x: 20,
        y: cursor + this.currentOffsetY,
        width: this.width - 40,
        height: cardHeight,
      };
      if (!viewport || this.rectIntersects(screenRect, viewport)) {
        this.drawFixedLogCard(cursor, log, cardHeight);
      }
      cursor += cardHeight + gap;
    }

    return cursor;
  }

  private drawFixedLogCard(y: number, log: RunLog, height: number): void {
    const x = 20;
    const width = this.width - 40;
    this.ctx.fillStyle = '#ffffff';
    this.roundRect(x, y, width, height, 8);
    this.ctx.fill();
    this.ctx.strokeStyle = '#e9ecef';
    this.ctx.stroke();

    let cursor = y + 21;
    this.setFont(13, 800);
    this.ctx.fillStyle = '#172033';
    this.ctx.fillText(this.fitText(`${ageStageName(log.age)} · 第 ${log.round} 回合 · ${log.roundName}`, width - 28), x + 14, cursor);

    cursor += 23;
    this.setFont(13, 400);
    this.ctx.fillStyle = '#343a40';
    cursor = this.drawWrappedText(log.event.text, x + 14, cursor, width - 28, 18, 2);

    if (log.triggeredTalents.length > 0) {
      this.setFont(12, 600);
      this.ctx.fillStyle = '#1971c2';
      cursor = this.drawWrappedText(`天赋：${log.triggeredTalents.map(item => item.name).join(' / ')}`, x + 14, cursor + 2, width - 28, 16, 1);
    }

    if (log.branchEvents.length > 0 && cursor < y + height - 12) {
      this.setFont(12, 600);
      this.ctx.fillStyle = '#2f9e44';
      this.drawWrappedText(`连锁：${log.branchEvents.map(item => item.text).join(' / ')}`, x + 14, cursor + 1, width - 28, 16, 1);
    }
  }

  private drawSectionHeader(y: number, title: string, meta: string): number {
    this.setFont(19, 800);
    this.ctx.fillStyle = '#172033';
    this.ctx.fillText(title, 20, y + 22);
    this.setFont(13, 600);
    this.ctx.fillStyle = '#687386';
    const metaWidth = this.ctx.measureText(meta).width;
    this.ctx.fillText(meta, this.width - 20 - metaWidth, y + 22);
    return y + 36;
  }

  private drawPanel(y: number, renderContent: () => number): number {
    const x = 20;
    const width = this.width - 40;
    const startY = y;
    const contentEnd = renderContent();
    const height = Math.max(68, contentEnd - startY + 18);

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-over';
    this.ctx.fillStyle = '#ffffff';
    this.roundRect(x, startY, width, height, 8);
    this.ctx.fill();
    this.ctx.strokeStyle = '#e9ecef';
    this.ctx.stroke();
    this.ctx.restore();

    return startY + height + 10;
  }

  private drawSectionTitle(title: string, subtitle: string, x: number, y: number): void {
    this.setFont(18, 800);
    this.ctx.fillStyle = '#172033';
    this.ctx.fillText(title, x, y);
    this.setFont(13, 500);
    this.ctx.fillStyle = '#687386';
    this.drawWrappedText(subtitle, x, y + 22, this.width - x * 2, 19, 2);
  }

  private drawFactRow(y: number, label: string, value: string): number {
    this.setFont(13, 600);
    this.ctx.fillStyle = '#687386';
    this.ctx.fillText(label, 36, y);
    this.setFont(15, 800);
    this.ctx.fillStyle = '#172033';
    this.drawWrappedText(value, 116, y, this.width - 152, 21, 2);
    return y + 34;
  }

  private drawMessage(y: number, message: string): number {
    const x = 20;
    const width = this.width - 40;
    this.ctx.fillStyle = '#fff5f5';
    this.roundRect(x, y, width, 54, 8);
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffc9c9';
    this.ctx.stroke();
    this.setFont(14, 600);
    this.ctx.fillStyle = '#c92a2a';
    this.drawWrappedText(message, x + 14, y + 23, width - 28, 20, 2);
    return y + 64;
  }

  private drawButton(
    action: Action,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    variant: 'primary' | 'secondary' | 'danger',
    disabled = false,
  ): void {
    const bg = disabled
      ? '#e9ecef'
      : variant === 'primary'
        ? '#1971c2'
        : variant === 'danger'
          ? '#fff5f5'
          : '#ffffff';
    const fg = disabled
      ? '#adb5bd'
      : variant === 'primary'
        ? '#ffffff'
        : variant === 'danger'
          ? '#c92a2a'
          : '#172033';
    const border = disabled
      ? '#dee2e6'
      : variant === 'primary'
        ? '#1971c2'
        : variant === 'danger'
          ? '#ffc9c9'
          : '#ced4da';

    this.ctx.fillStyle = bg;
    this.roundRect(x, y, width, height, 8);
    this.ctx.fill();
    this.ctx.strokeStyle = border;
    this.ctx.stroke();
    this.setFont(width < 58 ? 19 : 15, 800);
    this.ctx.fillStyle = fg;
    const displayLabel = this.fitText(label, Math.max(20, width - 18));
    const textWidth = this.ctx.measureText(displayLabel).width;
    this.ctx.fillText(displayLabel, x + (width - textWidth) / 2, y + height / 2 + 6);
    this.registerButton(action, x, y, width, height, disabled);
  }

  private registerButton(action: Action, x: number, y: number, width: number, height: number, disabled = false): void {
    const screenY = y + this.currentOffsetY;
    const rect = { x, y: screenY, width, height };
    if (this.currentButtonViewport && !this.rectIntersects(rect, this.currentButtonViewport)) return;
    this.buttons.push({ action, x, y: screenY, width, height, disabled });
  }

  private drawMiniPill(label: string, x: number, y: number, bg: string, fg: string): number {
    this.setFont(10, 700);
    const width = this.miniPillWidth(label);
    this.ctx.fillStyle = bg;
    this.roundRect(x, y, width, 18, 9);
    this.ctx.fill();
    this.ctx.fillStyle = fg;
    this.ctx.fillText(label, x + 7, y + 13);
    return width;
  }

  private miniPillWidth(label: string): number {
    this.setFont(10, 700);
    return this.ctx.measureText(label).width + 14;
  }

  private drawPill(label: string, x: number, y: number, bg: string, fg: string): void {
    this.setFont(12, 700);
    const width = this.ctx.measureText(label).width + 18;
    this.ctx.fillStyle = bg;
    this.roundRect(x, y, width, 24, 12);
    this.ctx.fill();
    this.ctx.fillStyle = fg;
    this.ctx.fillText(label, x + 9, y + 16);
  }

  private drawScoreBadge(score: string, x: number, y: number): void {
    this.ctx.fillStyle = '#1971c2';
    this.roundRect(x, y, 62, 40, 8);
    this.ctx.fill();
    this.setFont(20, 800);
    this.ctx.fillStyle = '#ffffff';
    const width = this.ctx.measureText(score).width;
    this.ctx.fillText(score, x + (62 - width) / 2, y + 27);
  }

  private drawWrappedText(text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): number {
    const lines = this.wrapText(text, maxWidth, maxLines);
    for (const line of lines) {
      this.ctx.fillText(line, x, y);
      y += lineHeight;
    }
    return y;
  }

  private wrapText(text: string, maxWidth: number, maxLines: number): string[] {
    const chars = Array.from(String(text));
    const lines: string[] = [];
    let line = '';
    let truncated = false;

    for (const char of chars) {
      const next = `${line}${char}`;
      if (this.ctx.measureText(next).width > maxWidth && line.length > 0) {
        lines.push(line);
        line = char;
        if (lines.length >= maxLines) {
          truncated = true;
          break;
        }
      } else {
        line = next;
      }
    }
    if (!truncated && line && lines.length < maxLines) lines.push(line);
    if (truncated && lines.length > 0) lines[lines.length - 1] = this.fitText(`${lines[lines.length - 1]}...`, maxWidth);
    return lines;
  }

  private fitText(text: string, maxWidth: number): string {
    if (this.ctx.measureText(text).width <= maxWidth) return text;
    const chars = Array.from(text);
    while (chars.length > 1 && this.ctx.measureText(`${chars.join('')}...`).width > maxWidth) chars.pop();
    return `${chars.join('')}...`;
  }

  private roundRect(x: number, y: number, width: number, height: number, radius: number): void {
    const r = Math.min(radius, width / 2, height / 2);
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + width - r, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    this.ctx.lineTo(x + width, y + height - r);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    this.ctx.lineTo(x + r, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
  }

  private setFont(size: number, weight = 400): void {
    this.ctx.font = `${weight} ${size}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  }

  private remainingPoints(): number {
    const allocation = this.state.allocation;
    return 20 - allocation.INT - allocation.STR - allocation.MNY - allocation.SPR;
  }

  private totalRounds(gameState: GameState): number {
    const retakeRounds = gameState.retakeUsed ? this.game.content.ages.filter(round => round.age >= 17).length : 0;
    return this.game.content.ages.length + retakeRounds;
  }

  private talentCardHeight(): number {
    return this.height <= 640 ? 76 : 80;
  }

  private logCardHeight(): number {
    return this.height <= 640 ? 98 : 106;
  }

  private headerHeight(): number {
    return Math.max(82, this.safeTop + 74);
  }

  private footerHeight(): number {
    return 72 + this.safeBottom;
  }

  private contentViewport(): Rect {
    const y = this.headerHeight();
    return { x: 0, y, width: this.width, height: this.height - y - this.footerHeight() };
  }

  private pointInRect(x: number, y: number, rect: Rect): boolean {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
  }

  private rectIntersects(a: Rect, b: Rect): boolean {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}

function talentRarityName(grade: number): TalentRarity {
  return (['common', 'rare', 'epic', 'legendary'] as TalentRarity[])[grade] ?? 'common';
}

function talentRarityLabel(rarity: TalentRarity): string {
  return {
    common: '普通',
    rare: '稀有',
    epic: '史诗',
    legendary: '传说',
  }[rarity];
}

function achievementGradeName(grade: number): string {
  return ['普通', '稀有', '史诗', '传说'][grade] ?? '普通';
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

function ageStageName(age: number): string {
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

function screenName(screen: Screen): string {
  return {
    home: '首页',
    talents: '天赋',
    properties: '属性',
    trajectory: '轨迹',
    summary: '结局',
    achievements: '成就',
  }[screen];
}

function createRuntimeCanvas(wxApi: WxMiniGameAPI | undefined): HTMLCanvasElement {
  if (wxApi) return wxApi.createCanvas();
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    document.body.style.margin = '0';
    document.body.append(canvas);
    return canvas;
  }
  throw new Error('No canvas runtime is available');
}

function getWxApi(): WxMiniGameAPI | undefined {
  return typeof wx === 'undefined' ? undefined : wx;
}

const wxApi = getWxApi();
new WxGameApp(createRuntimeCanvas(wxApi), wxApi).start();
