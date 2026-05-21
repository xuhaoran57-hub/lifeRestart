import type {
  Achievement,
  AdmissionResult,
  Allocation,
  FinalResult,
  GameContent,
  GameState,
  RunLog,
  SaveData,
  Talent,
  TalentRarity,
  University,
} from '../app/types';
import { LifeEngine } from '../engine/life';
import { loadSave, recordFinalResult, saveData, setInheritedTalent } from '../engine/storage';
import { drawTalentCandidates, getTalentMap, hasTalentConflict } from '../engine/talents';
import {
  getUniversityCollectionStats,
  is211PlusUniversity,
  is985University,
  isDoubleFirstClassUniversity,
  universityGroupLabels,
} from '../engine/universities';
import { createWxContentLoader, type WxContentLoader } from './contentLoader';
import { createWxSaveStorage } from './storage';

type Screen = 'home' | 'talents' | 'properties' | 'trajectory' | 'summary' | 'achievements' | 'universities';
type PropKey = keyof Allocation;

const AUTO_RUN_INTERVAL_MS = 500;
const HOME_CONTENT_PRELOAD_DELAY_MS = 1200;
const ADMISSION_LINES_PRELOAD_DELAY_MS = 1500;

type Action =
  | { type: 'start' }
  | { type: 'viewAchievements' }
  | { type: 'closeAchievements' }
  | { type: 'viewUniversities' }
  | { type: 'closeUniversities' }
  | { type: 'toggleTalent'; talentId: number }
  | { type: 'toProperties' }
  | { type: 'backToTalents' }
  | { type: 'adjustProp'; prop: PropKey; delta: number }
  | { type: 'beginRun' }
  | { type: 'nextRound' }
  | { type: 'autoRun' }
  | { type: 'retake' }
  | { type: 'shareResult' }
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

interface LogLayoutItem {
  log: RunLog;
  offsetY: number;
  height: number;
}

interface LogLayoutCache {
  logs: RunLog[];
  width: number;
  length: number;
  firstLog: RunLog | null;
  lastLog: RunLog | null;
  items: LogLayoutItem[];
  totalHeight: number;
}

interface WxGameModel {
  content: GameContent;
  save: SaveData;
  persist(save: SaveData): void;
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
  retakeLocked: boolean;
  autoRunning: boolean;
  confirmingRestart: boolean;
  message: string | null;
}

const theme = {
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

const propRows: Array<{ key: PropKey; label: string; color: string }> = [
  { key: 'INT', label: '学力', color: theme.blue },
  { key: 'STR', label: '精力', color: theme.green },
  { key: 'MNY', label: '资源', color: theme.gold },
  { key: 'SPR', label: '心态', color: theme.teal },
];

const rarityColors: Record<TalentRarity, { bg: string; fg: string; border: string }> = {
  common: { bg: '#f3f0e8', fg: '#514d46', border: '#d8d0c2' },
  rare: { bg: '#e5f1ff', fg: '#155996', border: '#5aa7ff' },
  epic: { bg: '#f0e8ff', fg: '#6840b6', border: '#a56cff' },
  legendary: { bg: '#fff1d8', fg: '#8a4d00', border: '#f0a23a' },
};

class WxGameApp {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly contentLoader: WxContentLoader;
  private readonly game: WxGameModel;
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
    retakeLocked: false,
    autoRunning: false,
    confirmingRestart: false,
    message: null,
  };

  private buttons: Button[] = [];
  private autoRunTimer: ReturnType<typeof setTimeout> | null = null;
  private lifecycleRenderTimer: ReturnType<typeof setTimeout> | null = null;
  private isAppVisible = true;
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
  private logLayoutCache: LogLayoutCache | null = null;
  private renderFrameHandle: number | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly wxApi: WxMiniGameAPI | undefined,
  ) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context is unavailable');
    this.ctx = context;
    const storage = createWxSaveStorage(wxApi);
    this.contentLoader = createWxContentLoader(wxApi);
    this.game = {
      content: this.contentLoader.content,
      save: loadSave(storage),
      persist(nextSave) {
        this.save = nextSave;
        saveData(nextSave, storage);
      },
    };
    this.resize();
    this.bindInput();
    this.bindShare();
    this.bindLifecycle();
  }

  start(): void {
    this.render();
    this.preloadHomeContent();
  }

  private preloadHomeContent(): void {
    setTimeout(() => {
      if (!this.isAppVisible || this.state.screen !== 'home') return;
      void this.contentLoader.loadTalentContent()
        .then(() => {
          if (this.isAppVisible && this.state.screen === 'home') this.requestRender();
        })
        .catch(() => {
          // Loading errors are surfaced when the player opens a content-dependent screen.
        });
    }, HOME_CONTENT_PRELOAD_DELAY_MS);
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
    this.wxApi?.onShareAppMessage?.(() => ({ title: this.resultShareTitle() }));
  }

  private bindLifecycle(): void {
    this.wxApi?.onHide?.(() => {
      this.isAppVisible = false;
      this.stopAutoRun();
      this.clearLifecycleRenderTimer();
      this.resetTouchState();
    });

    this.wxApi?.onShow?.(() => {
      this.isAppVisible = true;
      this.resetTouchState();
      this.renderAfterLifecycleRestore();
    });
  }

  private renderAfterLifecycleRestore(): void {
    if (!this.isAppVisible) return;
    this.resize();
    this.render();
    this.clearLifecycleRenderTimer();
    this.lifecycleRenderTimer = setTimeout(() => {
      this.lifecycleRenderTimer = null;
      if (!this.isAppVisible) return;
      this.resize();
      this.render();
    }, 80);
  }

  private clearLifecycleRenderTimer(): void {
    if (this.lifecycleRenderTimer === null) return;
    clearTimeout(this.lifecycleRenderTimer);
    this.lifecycleRenderTimer = null;
  }

  private resetTouchState(): void {
    this.isTouchScrolling = false;
    this.isTouchMoved = false;
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
    this.requestRender();
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

    void this.runAction(button.action);
  }

  private async runAction(action: Action): Promise<void> {
    try {
      this.state.message = null;
      await this.handleAction(action);
    } catch (error) {
      this.state.message = error instanceof Error ? error.message : '操作失败';
      this.wxApi?.showToast?.({ title: this.state.message.slice(0, 12), icon: 'none' });
    }
    this.render();
  }

  private async handleAction(action: Action): Promise<void> {
    if (this.state.autoRunning && action.type !== 'autoRun') this.stopAutoRun();

    if (action.type !== 'requestRestart' && action.type !== 'cancelRestart' && action.type !== 'confirmRestart') {
      this.state.confirmingRestart = false;
    }

    if (action.type === 'start') {
      await this.ensureTalentContent();
      this.prepareTalentScreen();
      return;
    }

    if (action.type === 'viewAchievements') {
      await this.ensureTalentContent();
      this.commitFinalResult({ lockRetake: false });
      if (this.state.screen !== 'achievements') this.state.previousScreen = this.state.screen;
      this.switchScreen('achievements');
      return;
    }

    if (action.type === 'viewUniversities') {
      await this.ensureAdmissionBasics();
      this.commitFinalResult({ lockRetake: false });
      if (this.state.screen !== 'universities') this.state.previousScreen = this.state.screen;
      this.switchScreen('universities');
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

    if (action.type === 'closeUniversities') {
      const target = this.state.previousScreen && this.state.previousScreen !== 'universities'
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
      await this.ensureRunContent();
      const engine = new LifeEngine(this.game.content);
      const gameState = engine.start(this.state.selectedTalentIds, this.state.allocation);
      if (this.game.save.inheritedTalentId !== null) this.game.persist(setInheritedTalent(this.game.save, null));
      this.state.engine = engine;
      this.state.gameState = gameState;
      this.state.result = null;
      this.state.persistedResult = false;
      this.state.retakeLocked = false;
      this.state.autoRunning = false;
      this.switchScreen('trajectory');
      this.preloadAdmissionLines();
      return;
    }

    if (action.type === 'nextRound') {
      await this.runOneRound();
      return;
    }

    if (action.type === 'autoRun') {
      if (this.state.autoRunning) {
        this.stopAutoRun('已停止自动推进。');
      } else {
        this.startAutoRun();
      }
      return;
    }

    if (action.type === 'retake') {
      if (!this.state.engine) throw new Error('本局还未开始');
      if (this.state.retakeLocked) throw new Error('本局结局已经确认，不能再复读');
      this.state.gameState = this.state.engine.retake();
      this.state.result = null;
      this.state.persistedResult = false;
      this.state.retakeLocked = false;
      this.state.autoRunning = false;
      this.state.message = '已选择复读一年，心态下降，风险上升。';
      this.switchScreen('trajectory');
      return;
    }

    if (action.type === 'shareResult') {
      this.shareCurrentResult();
      return;
    }

    if (action.type === 'inherit') {
      this.commitFinalResult({ lockRetake: false });
      this.game.persist(setInheritedTalent(this.game.save, action.talentId));
      this.state.message = '已继承该天赋，下局会优先出现。';
      return;
    }

    if (action.type === 'clearInherit') {
      this.commitFinalResult({ lockRetake: false });
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

  private async ensureTalentContent(): Promise<void> {
    await this.loadContent(
      this.contentLoader.hasTalentContent(),
      '正在加载天赋',
      () => this.contentLoader.loadTalentContent(),
    );
  }

  private async ensureAdmissionBasics(): Promise<void> {
    await this.loadContent(
      this.contentLoader.hasAdmissionBasics(),
      '正在加载院校',
      () => this.contentLoader.loadAdmissionBasics(),
    );
  }

  private async ensureRunContent(): Promise<void> {
    await this.loadContent(
      this.contentLoader.hasSimulationContent() && this.contentLoader.hasAdmissionBasics(),
      '正在加载人生事件',
      async () => {
        await Promise.all([
          this.contentLoader.loadSimulationContent(),
          this.contentLoader.loadAdmissionBasics(),
        ]);
      },
    );
  }

  private async ensureAdmissionLines(): Promise<void> {
    await this.loadContent(
      this.contentLoader.hasAdmissionLines(),
      '正在加载录取线',
      () => this.contentLoader.loadAdmissionLines(),
    );
  }

  private preloadAdmissionLines(): void {
    setTimeout(() => {
      if (!this.isAppVisible || !this.state.engine) return;
      void this.contentLoader.loadAdmissionLines().catch(() => {
        // The final round will surface the error if the preload did not finish.
      });
    }, ADMISSION_LINES_PRELOAD_DELAY_MS);
  }

  private async loadContent(isLoaded: boolean, message: string, load: () => Promise<void>): Promise<void> {
    if (isLoaded) return;
    this.state.message = message;
    this.render();
    await load();
    if (this.state.message === message) this.state.message = null;
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
    this.state.retakeLocked = false;
    this.state.autoRunning = false;
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

  private startAutoRun(): void {
    if (!this.state.gameState || this.state.gameState.isFinished) return;
    this.state.autoRunning = true;
    this.scheduleAutoRun();
  }

  private stopAutoRun(message?: string): void {
    if (this.autoRunTimer !== null) {
      clearTimeout(this.autoRunTimer);
      this.autoRunTimer = null;
    }
    this.state.autoRunning = false;
    if (message) this.state.message = message;
  }

  private scheduleAutoRun(): void {
    if (!this.state.autoRunning || this.autoRunTimer !== null) return;
    this.autoRunTimer = setTimeout(() => {
      void this.advanceAutoRun();
    }, AUTO_RUN_INTERVAL_MS);
  }

  private async advanceAutoRun(): Promise<void> {
    this.autoRunTimer = null;
    if (!this.state.autoRunning) return;

    try {
      if (this.state.screen !== 'trajectory' || !this.state.gameState || this.state.gameState.isFinished) {
        this.stopAutoRun();
      } else {
        await this.runOneRound();
        if (this.state.screen !== 'trajectory' || this.state.gameState?.isFinished) this.stopAutoRun();
      }
    } catch (error) {
      this.stopAutoRun(error instanceof Error ? error.message : '操作失败');
    }

    this.render();
    this.scheduleAutoRun();
  }

  private async runOneRound(): Promise<void> {
    const engine = this.state.engine;
    if (!engine) throw new Error('本局还未开始');
    if (this.state.gameState?.isFinished) return;
    const nextRound = this.game.content.ages[this.state.gameState.stepIndex];
    if (nextRound?.age === 18 && nextRound.round === 4) await this.ensureAdmissionLines();
    const step = engine.next();
    this.state.gameState = step.state;
    if (step.ending && step.admission) {
      this.state.result = { state: step.state, ending: step.ending, admission: step.admission };
      this.state.persistedResult = false;
      this.state.retakeLocked = false;
      this.switchScreen('summary');
      if (step.state.retakeUsed) this.commitFinalResult();
    }
  }

  private commitFinalResult(options: { lockRetake?: boolean } = {}): void {
    if (!this.state.result) return;
    if (!this.state.persistedResult) {
      this.game.persist(recordFinalResult(this.game.save, this.state.result, this.game.content));
      this.state.persistedResult = true;
    }
    if (options.lockRetake ?? true) this.state.retakeLocked = true;
  }

  private shareCurrentResult(): void {
    if (!this.state.result) throw new Error('还没有结局可分享');
    this.commitFinalResult({ lockRetake: false });
    const title = this.resultShareTitle(this.state.result);
    if (this.wxApi?.shareAppMessage) {
      this.wxApi.shareAppMessage({ title });
      return;
    }
    this.state.message = title;
  }

  private resultShareTitle(result: FinalResult | null = this.state.result): string {
    if (!result) return '重回高三人生模拟';
    const universityName = result.admission.admittedUniversity?.name
      ?? result.admission.admittedLine?.universityName
      ?? '大学';
    return `这次重开我考上了${universityName}，你也来试试吧`;
  }

  private switchScreen(screen: Screen): void {
    if (screen !== 'trajectory') this.stopAutoRun();
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
    this.renderFrameHandle = null;
    if (this.activeScrollScreen !== this.state.screen) this.resetScroll(this.state.screen);
    this.buttons = [];
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.drawBackground();

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

  private requestRender(): void {
    if (this.renderFrameHandle !== null) return;
    let handle = 0;
    handle = requestNextFrame(() => {
      if (this.renderFrameHandle !== handle) return;
      this.render();
    });
    this.renderFrameHandle = handle;
  }

  private drawBackground(): void {
    const bg = this.ctx.createLinearGradient(0, 0, 0, this.height);
    bg.addColorStop(0, 'rgba(214, 235, 250, 0.72)');
    bg.addColorStop(0.34, 'rgba(255, 250, 240, 0.94)');
    bg.addColorStop(1, theme.warm);
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(47, 124, 128, 0.04)';
    this.ctx.lineWidth = 1;
    for (let x = 0.5; x < this.width; x += 32) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawHeader(): void {
    const top = Math.max(10, this.safeTop + 7);
    const compact = this.state.screen === 'talents';
    const cardHeight = compact ? 58 : Math.max(96, this.headerHeight() - top - 10);
    const outerX = 20;
    const outerWidth = this.width - 40;
    const innerX = 36;
    const innerWidth = this.width - 72;
    const compactButtonWidth = 64;
    const compactButtonX = outerX + outerWidth - 14 - compactButtonWidth;
    this.drawHeroHeaderCard(outerX, top - 2, outerWidth, cardHeight, compact);

    this.setFont(compact ? 19 : 26, 800);
    this.ctx.fillStyle = theme.heroTitle;
    this.ctx.fillText(
      this.fitText('重回高三人生模拟', compact ? compactButtonX - innerX - 10 : innerWidth),
      innerX,
      top + (compact ? 24 : 27),
    );

    if (compact) {
      this.setFont(11, 600);
      this.ctx.fillStyle = theme.subtle;
      this.ctx.fillText(this.fitText(this.talentHeaderMeta(), compactButtonX - innerX - 10), innerX, top + 43);
      const action = this.headerPrimaryAction();
      const label = this.headerPrimaryLabel();
      this.drawButton(action, label, compactButtonX, top + 14, compactButtonWidth, 34, 'secondary');
    } else {
      this.drawHeaderStats(top + 46);
      if (this.state.screen === 'achievements' || this.state.screen === 'universities') {
        this.drawButton(this.headerPrimaryAction(), '返回', innerX, top + 104, innerWidth, 38, 'secondary');
      } else {
        const gap = 8;
        const buttonWidth = (innerWidth - gap) / 2;
        this.drawButton({ type: 'viewUniversities' }, '院校', innerX, top + 104, buttonWidth, 38, 'secondary');
        this.drawButton({ type: 'viewAchievements' }, '成就', innerX + buttonWidth + gap, top + 104, buttonWidth, 38, 'secondary');
      }
    }
  }

  private headerPrimaryAction(): Action {
    if (this.state.screen === 'achievements') return { type: 'closeAchievements' };
    if (this.state.screen === 'universities') return { type: 'closeUniversities' };
    return { type: 'viewAchievements' };
  }

  private headerPrimaryLabel(): string {
    if (this.state.screen === 'achievements' || this.state.screen === 'universities') return '返回';
    return '成就';
  }

  private drawHeroHeaderCard(x: number, y: number, width: number, height: number, compact: boolean): void {
    const bg = this.ctx.createLinearGradient(x, y, x + width, y + height);
    bg.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
    bg.addColorStop(0.56, compact ? 'rgba(255, 252, 246, 0.94)' : 'rgba(255, 255, 255, 0.72)');
    bg.addColorStop(1, compact ? 'rgba(255, 250, 241, 0.94)' : 'rgba(223, 242, 255, 0.42)');

    this.ctx.save();
    this.ctx.shadowColor = theme.shadow;
    this.ctx.shadowBlur = compact ? 12 : 22;
    this.ctx.shadowOffsetY = compact ? 5 : 10;
    this.ctx.fillStyle = bg;
    this.roundRect(x, y, width, height, 8);
    this.ctx.fill();
    this.ctx.shadowColor = 'transparent';
    this.ctx.strokeStyle = 'rgba(110, 139, 160, 0.22)';
    this.ctx.stroke();
    this.ctx.restore();

    if (compact) return;

    this.ctx.save();
    this.ctx.globalAlpha = 0.9;
    this.ctx.fillStyle = 'rgba(47, 124, 128, 0.18)';
    this.ctx.beginPath();
    this.ctx.moveTo(x + width - 174, y + height - 12);
    this.ctx.lineTo(x + width - 22, y + height - 12);
    this.ctx.lineTo(x + width - 42, y + height - 34);
    this.ctx.lineTo(x + width - 136, y + height - 34);
    this.ctx.closePath();
    this.ctx.fill();

    const windowX = x + width - 148;
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    for (let index = 0; index < 4; index += 1) {
      this.ctx.fillRect(windowX + index * 22, y + height - 29, 12, 10);
    }

    this.ctx.fillStyle = 'rgba(58, 134, 232, 0.24)';
    this.ctx.beginPath();
    this.ctx.moveTo(x + width - 74, y + 22);
    this.ctx.lineTo(x + width - 18, y + 8);
    this.ctx.lineTo(x + width - 41, y + 47);
    this.ctx.lineTo(x + width - 52, y + 31);
    this.ctx.lineTo(x + width - 78, y + 42);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawHeaderStats(y: number): void {
    const stats = [
      [String(this.game.save.times), '次重开'],
      [String(this.game.save.unlockedEndingIds.length), '个结局'],
      [String(this.game.save.unlockedUniversityCodes.length), '所院校'],
      [String(this.game.save.achievedIds.length), '个成就'],
    ] as const;
    const x = 36;
    const gap = 6;
    const maxWidth = this.width - 72;
    const chipWidth = (maxWidth - gap * (stats.length - 1)) / stats.length;

    stats.forEach(([value, label], index) => {
      const chipX = x + index * (chipWidth + gap);
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
      this.roundRect(chipX, y, chipWidth, 48, 8);
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.86)';
      this.ctx.stroke();
      this.setFont(15, 800);
      this.ctx.fillStyle = theme.teal;
      const valueText = this.fitText(value, chipWidth - 12);
      const valueWidth = this.ctx.measureText(valueText).width;
      this.ctx.fillText(valueText, chipX + (chipWidth - valueWidth) / 2, y + 19);
      this.setFont(10, 700);
      this.ctx.fillStyle = '#405064';
      const labelText = this.fitText(label, chipWidth - 10);
      const labelWidth = this.ctx.measureText(labelText).width;
      this.ctx.fillText(labelText, chipX + (chipWidth - labelWidth) / 2, y + 36);
    });
  }

  private talentHeaderMeta(): string {
    const inherited = this.inheritedCandidateTalent();
    if (!inherited) return `${screenName(this.state.screen)} · ${this.state.selectedTalentIds.length}/3`;
    return `继承 ${inherited.name} · ${this.state.selectedTalentIds.length}/3`;
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
    else if (this.state.screen === 'achievements') cursor = this.drawAchievements(cursor);
    else cursor = this.drawUniversities(cursor);

    this.ctx.restore();
    this.currentOffsetY = 0;
    this.currentButtonViewport = null;
    return cursor - viewport.y + 12;
  }

  private drawHome(y: number): number {
    const inherited = this.savedInheritedTalent();
    y = this.drawPanel(y, () => {
      let cursor = y + 30;
      const pillWidth = this.drawMiniPill('人生阶段', 36, cursor - 15, '#fff2d0', '#9a5b00');
      this.setFont(19, 800);
      this.ctx.fillStyle = theme.title;
      this.ctx.fillText(this.fitText('新一轮人生志愿表', this.width - 82 - pillWidth), 36 + pillWidth + 10, cursor);
      cursor += 28;
      this.setFont(13, 500);
      this.ctx.fillStyle = theme.subtle;
      cursor = this.drawWrappedText('从童年到高考收官季，重新填一份人生志愿。', 36, cursor, this.width - 72, 19, 2);
      cursor += 14;
      cursor = this.drawStageTrack(cursor);
      cursor += inherited ? 14 : 22;
      if (inherited) {
        cursor = this.drawInheritedTalentBanner(cursor, inherited, '继承天赋');
        cursor += 2;
      }
      const gap = 8;
      const buttonWidth = (this.width - 72 - gap) / 2;
      this.drawButton(
        { type: 'viewUniversities' },
        `院校 ${this.game.save.unlockedUniversityCodes.length}/${this.contentLoader.summary.universities}`,
        36,
        cursor + 6,
        buttonWidth,
        40,
        'secondary',
      );
      this.drawButton(
        { type: 'viewAchievements' },
        `成就 ${this.game.save.achievedIds.length}/${this.contentLoader.summary.achievements}`,
        36 + buttonWidth + gap,
        cursor + 6,
        buttonWidth,
        40,
        'secondary',
      );
      cursor += 58;
      if (this.state.message) cursor = this.drawMessage(cursor + 10, this.state.message);
      return cursor + 14;
    });
    return y + 16;
  }

  private drawAchievements(y: number): number {
    const unlockedIds = new Set(this.game.save.achievedIds);
    const unlocked = this.game.content.achievements.filter(item => unlockedIds.has(item.id));
    const universityStats = getUniversityCollectionStats(this.game.content, this.game.save.unlockedUniversityCodes);
    y = this.drawPanel(y, () => {
      let cursor = y + 26;
      this.drawSectionTitle('成就', `已解锁 ${unlocked.length}/${this.game.content.achievements.length}`, 36, cursor);
      cursor += 58;
      const stats = [
        ['重开', this.game.save.times],
        ['结局', this.game.save.unlockedEndingIds.length],
        ['院校', universityStats.unlocked],
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
        this.ctx.fillStyle = theme.subtle;
        cursor = this.drawWrappedText('还没有解锁成就，先完成一局看看。', 36, cursor, this.width - 72, 22, 3);
        return cursor + 8;
      });
      return y;
    }

    for (const achievement of unlocked) y = this.drawAchievementCard(y, achievement);
    return y;
  }

  private drawUniversities(y: number): number {
    const unlockedCodes = new Set(this.game.save.unlockedUniversityCodes);
    const stats = getUniversityCollectionStats(this.game.content, this.game.save.unlockedUniversityCodes);
    const unlocked = this.game.content.universities.filter(item => unlockedCodes.has(item.code));

    y = this.drawPanel(y, () => {
      let cursor = y + 26;
      this.drawSectionTitle('院校图鉴', `已点亮 ${stats.unlocked}/${stats.total}`, 36, cursor);
      cursor += 58;
      cursor = this.drawMiniStats(cursor, [
        ['院校', stats.unlocked],
        ['985', stats.unlocked985],
        ['211+', stats.unlocked211Plus],
        ['双一流', stats.unlockedDoubleFirstClass],
      ]);
      cursor = this.drawMiniStats(cursor + 4, [
        ['清北', stats.unlockedQingbei],
        ['华五', stats.unlockedHuaWu],
        ['C9', stats.unlockedC9],
      ]);
      return cursor + 6;
    });

    if (unlocked.length === 0) {
      y = this.drawPanel(y, () => {
        let cursor = y + 28;
        this.setFont(14, 500);
        this.ctx.fillStyle = theme.subtle;
        cursor = this.drawWrappedText('还没有点亮院校，完成录取后会出现在这里。', 36, cursor, this.width - 72, 22, 3);
        return cursor + 8;
      });
      return y;
    }

    return this.drawVirtualUniversityList(y, unlocked, unlockedCodes);
  }

  private drawTalents(y: number): number {
    y = this.drawSectionHeader(y, '选择天赋', `${this.state.selectedTalentIds.length}/3`);
    const inherited = this.inheritedCandidateTalent();
    if (inherited) y = this.drawInheritedTalentBanner(y, inherited, '已继承');
    const selected = new Set(this.state.selectedTalentIds);
    const gap = 8;
    const cardWidth = (this.width - 40 - gap) / 2;
    const cardHeight = this.talentCardHeight();
    this.state.candidates.forEach((talent, index) => {
      const active = selected.has(talent.id);
      const inherited = this.state.inheritedCandidateId === talent.id;
      const cardX = 20 + (index % 2) * (cardWidth + gap);
      const cardY = y + Math.floor(index / 2) * (cardHeight + gap);
      this.drawTalentCard(cardX, cardY, cardWidth, talent, active, inherited);
    });
    const rows = Math.ceil(this.state.candidates.length / 2);
    y += rows * cardHeight + Math.max(0, rows - 1) * gap + 10;
    if (this.state.message) y = this.drawMessage(y, this.state.message);
    return y;
  }

  private drawInheritedTalentBanner(y: number, talent: Talent, label: string): number {
    const x = 20;
    const width = this.width - 40;
    const height = 44;
    this.ctx.fillStyle = '#f4fffb';
    this.roundRect(x, y, width, height, 8);
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(47, 124, 128, 0.42)';
    this.ctx.stroke();
    this.drawMiniPill(label, x + 12, y + 13, '#f3ecdf', '#665335');
    this.setFont(14, 800);
    this.ctx.fillStyle = theme.teal;
    this.ctx.fillText(this.fitText(talent.name, width - 116), x + 94, y + 28);
    return y + height + 10;
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
      this.ctx.fillStyle = '#5d5a54';
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
        this.ctx.fillStyle = '#5d5a54';
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
      this.drawMiniPill(`等级 ${result.ending.tier}`, 36, cursor - 12, '#f3ecdf', '#665335');
      cursor += 30;
      this.setFont(22, 800);
      this.ctx.fillStyle = theme.title;
      cursor = this.drawWrappedText(result.ending.name, 36, cursor, this.width - 72, 29, 2);
      this.setFont(15, 400);
      this.ctx.fillStyle = '#5d5a54';
      cursor = this.drawWrappedText(result.ending.description, 36, cursor + 8, this.width - 72, 24, 5);
      return cursor + 10;
    });

    y = this.drawAdmissionPanel(y + 10, result.admission);
    y = this.drawRetakeFromPanel(y + 10, result.state);
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
    const bg = this.ctx.createLinearGradient(0, footerY - 10, 0, this.height);
    bg.addColorStop(0, 'rgba(255, 253, 248, 0.88)');
    bg.addColorStop(1, 'rgba(246, 239, 228, 0.98)');
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, footerY - 10, this.width, this.footerHeight());
    this.ctx.strokeStyle = theme.line;
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
      const isAutoRunning = this.state.autoRunning && !this.state.gameState?.isFinished;
      this.drawButton(
        { type: 'nextRound' },
        '下一回合',
        20,
        footerY,
        buttonWidth,
        buttonHeight,
        'primary',
        Boolean(this.state.gameState?.isFinished || isAutoRunning),
      );
      this.drawButton(
        { type: 'autoRun' },
        isAutoRunning ? '终止' : '跑完',
        20 + buttonWidth + gap,
        footerY,
        buttonWidth,
        buttonHeight,
        isAutoRunning ? 'danger' : 'secondary',
        Boolean(this.state.gameState?.isFinished),
      );
      return;
    }

    if (this.state.screen === 'achievements') {
      this.drawButton({ type: 'closeAchievements' }, '返回', 20, footerY, this.width - 40, buttonHeight, 'primary');
      return;
    }

    if (this.state.screen === 'universities') {
      this.drawButton({ type: 'closeUniversities' }, '返回', 20, footerY, this.width - 40, buttonHeight, 'primary');
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

    this.drawButton({ type: 'requestRestart' }, '看完后重开', 20, footerY, this.width - 40, buttonHeight, 'secondary');
  }

  private drawTalentCard(x: number, y: number, width: number, talent: Talent, active: boolean, inherited: boolean): void {
    const rarity = talent.rarity ?? talentRarityName(talent.grade);
    const colors = rarityColors[rarity];
    const height = this.talentCardHeight();

    const bg = this.ctx.createLinearGradient(x, y, x, y + height);
    if (active) {
      bg.addColorStop(0, '#f4fffb');
      bg.addColorStop(1, '#e8f6f3');
    } else {
      bg.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
      bg.addColorStop(1, 'rgba(255, 253, 248, 0.92)');
    }

    this.ctx.save();
    this.ctx.shadowColor = active ? 'rgba(47, 124, 128, 0.14)' : theme.shadowSoft;
    this.ctx.shadowBlur = active ? 16 : 10;
    this.ctx.shadowOffsetY = active ? 6 : 4;
    this.ctx.fillStyle = bg;
    this.roundRect(x, y, width, height, 8);
    this.ctx.fill();
    this.ctx.shadowColor = 'transparent';
    this.ctx.strokeStyle = active ? theme.teal : colors.border;
    this.ctx.lineWidth = active ? 2 : 1;
    this.ctx.stroke();
    this.ctx.lineWidth = 1;
    this.ctx.restore();

    const rarityLabel = talent.rarityName ?? talentRarityLabel(rarity);
    const rarityWidth = this.miniPillWidth(rarityLabel);
    this.drawMiniPill(rarityLabel, x + width - 10 - rarityWidth, y + 7, colors.bg, colors.fg);

    this.setFont(14, 800);
    this.ctx.fillStyle = theme.title;
    this.ctx.fillText(this.fitText(talent.name, width - rarityWidth - 28), x + 10, y + 21);

    this.setFont(10, 700);
    const categoryLabel = this.fitText(talent.categoryName ?? '天赋', Math.max(36, width - 24));
    let metaX = x + 10;
    const categoryWidth = this.drawMiniPill(categoryLabel, metaX, y + 32, '#eef4f1', '#4d625b');
    metaX += categoryWidth + 5;
    if (inherited && metaX + 42 < x + width - 8) this.drawMiniPill('继承', metaX, y + 32, '#f3ecdf', '#665335');

    if (active) {
      this.ctx.fillStyle = theme.teal;
      this.ctx.beginPath();
      this.ctx.arc(x + width - 18, y + height - 17, 10, 0, Math.PI * 2);
      this.ctx.fill();
      this.setFont(13, 800);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText('✓', x + width - 22, y + height - 12);
    }

    this.setFont(12, 400);
    this.ctx.fillStyle = '#5d5a54';
    this.drawWrappedText(talent.description, x + 10, y + 63, width - (active ? 44 : 20), 16, 2);

    this.registerButton({ type: 'toggleTalent', talentId: talent.id }, x, y, width, height);
  }

  private drawPropRow(y: number, prop: PropKey, label: string, color: string): number {
    const x = 20;
    const width = this.width - 40;
    const height = 74;
    this.ctx.fillStyle = theme.paper;
    this.roundRect(x, y, width, height, 8);
    this.ctx.fill();
    this.ctx.strokeStyle = '#ece6dc';
    this.ctx.stroke();

    this.ctx.fillStyle = color;
    this.roundRect(x + 14, y + 18, 4, 38, 2);
    this.ctx.fill();
    this.setFont(17, 800);
    this.ctx.fillStyle = theme.title;
    this.ctx.fillText(label, x + 30, y + 30);
    this.setFont(13, 500);
    this.ctx.fillStyle = theme.subtle;
    this.ctx.fillText(prop, x + 30, y + 52);

    const value = this.state.allocation[prop];
    const buttonSize = 38;
    const plusX = x + width - 54;
    const valueX = plusX - 52;
    const minusX = valueX - 52;
    this.drawButton({ type: 'adjustProp', prop, delta: -1 }, '-', minusX, y + 18, buttonSize, buttonSize, 'secondary', value <= 0);
    this.setFont(20, 800);
    this.ctx.fillStyle = theme.ink;
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
      const cellBg = this.ctx.createLinearGradient(cellX, y, cellX, y + 50);
      cellBg.addColorStop(0, '#ffffff');
      cellBg.addColorStop(1, '#f7fbff');
      this.ctx.fillStyle = cellBg;
      this.roundRect(cellX, y, cellWidth, 50, 8);
      this.ctx.fill();
      this.ctx.strokeStyle = '#e5edf5';
      this.ctx.stroke();
      this.ctx.fillStyle = '#edf7ff';
      this.ctx.beginPath();
      this.ctx.arc(cellX + cellWidth / 2, y + 12, 9, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = theme.blue;
      this.ctx.beginPath();
      this.ctx.arc(cellX + cellWidth / 2, y + 12, 3, 0, Math.PI * 2);
      this.ctx.fill();
      this.setFont(12, 800);
      this.ctx.fillStyle = theme.ink;
      const titleWidth = this.ctx.measureText(title).width;
      this.ctx.fillText(title, cellX + (cellWidth - titleWidth) / 2, y + 31);
      this.setFont(10, 500);
      this.ctx.fillStyle = theme.subtle;
      const metaWidth = this.ctx.measureText(meta).width;
      this.ctx.fillText(meta, cellX + (cellWidth - metaWidth) / 2, y + 44);
    });
    return y + 50;
  }

  private drawMiniStats(y: number, stats: ReadonlyArray<readonly [string, number]>): number {
    const gap = 8;
    const cellWidth = (this.width - 72 - gap * (stats.length - 1)) / stats.length;
    stats.forEach(([label, value], index) => {
      const cellX = 36 + index * (cellWidth + gap);
      this.ctx.fillStyle = theme.paperStrong;
      this.roundRect(cellX, y, cellWidth, 48, 6);
      this.ctx.fill();
      this.ctx.strokeStyle = '#e7edf4';
      this.ctx.stroke();
      this.setFont(12, 500);
      this.ctx.fillStyle = theme.subtle;
      this.ctx.fillText(label, cellX + 9, y + 17);
      this.setFont(16, 800);
      this.ctx.fillStyle = theme.ink;
      this.ctx.fillText(String(value), cellX + 9, y + 38);
      const accent = this.ctx.createLinearGradient(cellX + 8, y + 45, cellX + cellWidth - 8, y + 45);
      accent.addColorStop(0, theme.blue);
      accent.addColorStop(1, theme.green);
      this.ctx.fillStyle = accent;
      this.roundRect(cellX + 8, y + 44, cellWidth - 16, 4, 2);
      this.ctx.fill();
    });
    return y + 58;
  }

  private drawAchievementCard(y: number, achievement: Achievement): number {
    return this.drawPanel(y, () => {
      let cursor = y + 24;
      const grade = achievementGradeName(achievement.grade);
      const gradeWidth = this.miniPillWidth(grade);
      this.setFont(16, 800);
      this.ctx.fillStyle = theme.ink;
      this.ctx.fillText(this.fitText(achievement.name, this.width - 92 - gradeWidth), 36, cursor);
      this.drawMiniPill(grade, this.width - 36 - gradeWidth, cursor - 15, '#ece3cf', '#5c4c2d');
      this.setFont(13, 400);
      this.ctx.fillStyle = '#5d5a54';
      cursor = this.drawWrappedText(achievement.description, 36, cursor + 24, this.width - 72, 19, 3);
      this.setFont(12, 700);
      this.ctx.fillStyle = theme.teal;
      this.ctx.fillText('已解锁', 36, cursor + 8);
      return cursor + 14;
    });
  }

  private drawVirtualUniversityList(y: number, universities: University[], unlockedCodes: Set<string>): number {
    const cardHeight = this.universityCardHeight();
    const gap = 8;
    const viewport = this.currentButtonViewport;
    let cursor = y;

    for (const university of universities) {
      const screenRect = {
        x: 20,
        y: cursor + this.currentOffsetY,
        width: this.width - 40,
        height: cardHeight,
      };
      if (!viewport || this.rectIntersects(screenRect, viewport)) {
        this.drawUniversityCard(cursor, university, unlockedCodes.has(university.code), cardHeight);
      }
      cursor += cardHeight + gap;
    }

    return cursor;
  }

  private drawUniversityCard(y: number, university: University, unlocked: boolean, height: number): void {
    const x = 20;
    const width = this.width - 40;
    this.ctx.save();
    this.ctx.shadowColor = unlocked ? 'rgba(47, 124, 128, 0.13)' : theme.shadowSoft;
    this.ctx.shadowBlur = 14;
    this.ctx.shadowOffsetY = 5;
    this.ctx.fillStyle = unlocked ? 'rgba(244, 255, 251, 0.94)' : 'rgba(255, 255, 255, 0.82)';
    this.roundRect(x, y, width, height, 8);
    this.ctx.fill();
    this.ctx.shadowColor = 'transparent';
    this.ctx.strokeStyle = unlocked ? 'rgba(47, 124, 128, 0.42)' : theme.line;
    this.ctx.stroke();
    this.ctx.restore();

    let cursor = y + 25;
    const status = unlocked ? '已点亮' : '未点亮';
    const statusWidth = this.miniPillWidth(status);
    this.setFont(16, 800);
    this.ctx.fillStyle = unlocked ? theme.ink : '#6b7280';
    this.ctx.fillText(this.fitText(university.name, width - 48 - statusWidth), x + 16, cursor);
    this.drawMiniPill(status, x + width - 16 - statusWidth, cursor - 16, unlocked ? '#e5f8f3' : '#f0ede7', unlocked ? theme.teal : theme.subtle);

    cursor += 24;
    this.setFont(12, 500);
    this.ctx.fillStyle = theme.subtle;
    this.ctx.fillText(this.fitText(`${university.province} · ${university.city}`, width - 32), x + 16, cursor);

    const labels = this.universityLabels(university);
    let tagX = x + 16;
    let tagY = cursor + 16;
    for (const label of labels.slice(0, 5)) {
      const tagWidth = this.miniPillWidth(label);
      if (tagX + tagWidth > x + width - 16) {
        tagX = x + 16;
        tagY += 22;
      }
      if (tagY > y + height - 18) break;
      this.drawMiniPill(label, tagX, tagY, unlocked ? '#eef7ff' : '#f5f2ec', unlocked ? theme.blueDeep : theme.subtle);
      tagX += tagWidth + 6;
    }
  }

  private universityLabels(university: University): string[] {
    return [
      ...universityGroupLabels(university),
      ...(is985University(university) ? ['985'] : []),
      ...(university.tags.includes('211') ? ['211'] : []),
      ...(isDoubleFirstClassUniversity(university) ? ['双一流'] : []),
      ...(is211PlusUniversity(university) ? [] : [universityTierLabel(university.prestigeTier)]),
    ];
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
        ['总评', gameState.props.SUM],
      ] as const;
      const columns = this.width < 360 ? 3 : 4;
      const gap = 8;
      const cellWidth = (this.width - 72 - gap * (columns - 1)) / columns;
      const cellHeight = 44;
      stats.forEach(([label, value], index) => {
        const cellX = 36 + (index % columns) * (cellWidth + gap);
        const cellY = cursor + Math.floor(index / columns) * (cellHeight + gap);
        this.ctx.fillStyle = theme.paperStrong;
        this.roundRect(cellX, cellY, cellWidth, cellHeight, 6);
        this.ctx.fill();
        this.ctx.strokeStyle = '#e7edf4';
        this.ctx.stroke();
        this.setFont(12, 500);
        this.ctx.fillStyle = theme.subtle;
        this.ctx.fillText(label, cellX + 9, cellY + 16);
        this.setFont(16, 800);
        this.ctx.fillStyle = theme.ink;
        const displayValue = index < 6 ? Math.floor(value) : Math.round(value);
        this.ctx.fillText(String(displayValue), cellX + 9, cellY + 35);
        const accent = this.ctx.createLinearGradient(cellX + 8, cellY + 41, cellX + cellWidth - 8, cellY + 41);
        accent.addColorStop(0, theme.blue);
        accent.addColorStop(1, theme.green);
        this.ctx.fillStyle = accent;
        this.roundRect(cellX + 8, cellY + 40, cellWidth - 16, 4, 2);
        this.ctx.fill();
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
        this.ctx.fillStyle = '#5d5a54';
        cursor = this.drawWrappedText(admission.reason, 36, cursor + 8, this.width - 72, 22, 6);
        this.drawButton({ type: 'shareResult' }, '分享录取结果', 36, cursor + 10, this.width - 72, 42, 'primary');
        cursor += 62;
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
      this.ctx.fillStyle = '#5d5a54';
      cursor = this.drawWrappedText(admission.reason, 36, cursor + 8, this.width - 72, 22, 6);
      const canRetake = this.canRetakeCurrentResult();
      if (canRetake) {
        const gap = 8;
        const buttonWidth = (this.width - 72 - gap) / 2;
        this.drawButton({ type: 'shareResult' }, '分享录取', 36, cursor + 10, buttonWidth, 42, 'primary');
        this.drawButton({ type: 'retake' }, '复读一年', 36 + buttonWidth + gap, cursor + 10, buttonWidth, 42, 'secondary');
        cursor += 62;
        return cursor + 4;
      }
      this.drawButton({ type: 'shareResult' }, '分享录取结果', 36, cursor + 10, this.width - 72, 42, 'primary');
      cursor += 62;
      return cursor + 4;
    });
  }

  private canRetakeCurrentResult(): boolean {
    return Boolean(
      this.state.result
      && !this.state.result.admission.scoreHidden
      && !this.state.result.state.retakeUsed
      && !this.state.retakeLocked,
    );
  }

  private drawInheritancePanel(y: number, result: FinalResult): number {
    const talents = result.state.selectedTalentIds
      .map(id => this.game.content.talents.find(item => item.id === id))
      .filter((item): item is Talent => item !== undefined && item.inheritAllowed !== false);
    const inherited = this.savedInheritedTalent();

    return this.drawPanel(y, () => {
      let cursor = y + 26;
      this.drawSectionTitle('继承天赋', inherited ? `当前：${inherited.name}` : '选择一个天赋，下局优先出现。', 36, cursor);
      cursor += 58;
      if (talents.length === 0) {
        this.setFont(14, 400);
        this.ctx.fillStyle = theme.subtle;
        cursor = this.drawWrappedText('本局没有可继承天赋。', 36, cursor, this.width - 72, 22, 2);
        if (inherited) {
          this.drawButton({ type: 'clearInherit' }, '清空继承', 36, cursor + 8, this.width - 72, 38, 'secondary');
          return cursor + 54;
        }
        return cursor + 6;
      }
      const gap = 8;
      const buttonWidth = (this.width - 72 - gap) / 2;
      talents.forEach((talent, index) => {
        const buttonX = 36 + (index % 2) * (buttonWidth + gap);
        const buttonY = cursor + Math.floor(index / 2) * 46;
        const active = this.game.save.inheritedTalentId === talent.id;
        this.drawButton(
          { type: 'inherit', talentId: talent.id },
          active ? `已选 ${talent.name}` : talent.name,
          buttonX,
          buttonY,
          buttonWidth,
          38,
          active ? 'primary' : 'secondary',
        );
      });
      cursor += Math.ceil(talents.length / 2) * 46;
      this.drawButton({ type: 'clearInherit' }, '清空继承', 36, cursor + 4, this.width - 72, 38, 'secondary');
      return cursor + 52;
    });
  }

  private drawVirtualLogList(y: number, logs: RunLog[]): number {
    const layout = this.getLogListLayout(logs);
    const viewport = this.currentButtonViewport;
    const visibleTop = viewport ? viewport.y - this.currentOffsetY - y : Number.NEGATIVE_INFINITY;
    const visibleBottom = viewport ? viewport.y + viewport.height - this.currentOffsetY - y : Number.POSITIVE_INFINITY;

    for (const item of layout.items) {
      if (item.offsetY + item.height < visibleTop) continue;
      if (item.offsetY > visibleBottom) break;
      const cursor = y + item.offsetY;
      const screenRect = {
        x: 20,
        y: cursor + this.currentOffsetY,
        width: this.width - 40,
        height: item.height,
      };
      if (!viewport || this.rectIntersects(screenRect, viewport)) {
        this.drawFixedLogCard(cursor, item.log, item.height);
      }
    }

    return y + layout.totalHeight;
  }

  private getLogListLayout(logs: RunLog[]): LogLayoutCache {
    const firstLog = logs[0] ?? null;
    const lastLog = logs.at(-1) ?? null;
    const cached = this.logLayoutCache;
    if (
      cached
      && cached.logs === logs
      && cached.width === this.width
      && cached.length === logs.length
      && cached.firstLog === firstLog
      && cached.lastLog === lastLog
    ) {
      return cached;
    }

    const gap = 8;
    let offsetY = 0;
    const items = [...logs].reverse().map(log => {
      const height = this.logCardHeight(log);
      const item = { log, offsetY, height };
      offsetY += height + gap;
      return item;
    });
    const layout: LogLayoutCache = {
      logs,
      width: this.width,
      length: logs.length,
      firstLog,
      lastLog,
      items,
      totalHeight: offsetY,
    };
    this.logLayoutCache = layout;
    return layout;
  }

  private drawFixedLogCard(y: number, log: RunLog, height: number): void {
    const x = 20;
    const width = this.width - 40;
    this.ctx.save();
    this.ctx.shadowColor = theme.shadowSoft;
    this.ctx.shadowBlur = 14;
    this.ctx.shadowOffsetY = 5;
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.roundRect(x, y, width, height, 8);
    this.ctx.fill();
    this.ctx.shadowColor = 'transparent';
    this.ctx.strokeStyle = theme.line;
    this.ctx.stroke();
    this.ctx.restore();

    this.ctx.fillStyle = '#eef7ff';
    this.roundRect(x + 12, y + 14, 24, 24, 8);
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(58, 134, 232, 0.14)';
    this.ctx.stroke();
    this.ctx.fillStyle = theme.blue;
    this.ctx.beginPath();
    this.ctx.arc(x + 24, y + 26, 3, 0, Math.PI * 2);
    this.ctx.fill();

    let cursor = y + 21;
    this.setFont(13, 800);
    this.ctx.fillStyle = theme.ink;
    this.ctx.fillText(this.fitText(`${ageStageName(log.age)} · 第 ${log.round} 回合 · ${log.roundName}`, width - 58), x + 48, cursor);

    cursor += 23;
    this.setFont(13, 400);
    this.ctx.fillStyle = '#5d5a54';
    cursor = this.drawWrappedText(log.event.text, x + 48, cursor, width - 62, 18, Number.MAX_SAFE_INTEGER);

    if (log.triggeredTalents.length > 0) {
      this.setFont(12, 600);
      this.ctx.fillStyle = theme.teal;
      cursor = this.drawWrappedText(
        `天赋：${log.triggeredTalents.map(item => item.name).join(' / ')}`,
        x + 48,
        cursor + 2,
        width - 62,
        16,
        Number.MAX_SAFE_INTEGER,
      );
    }

    if (log.branchEvents.length > 0) {
      this.setFont(12, 600);
      this.ctx.fillStyle = theme.teal;
      this.drawWrappedText(
        `连锁：${log.branchEvents.map(item => item.text).join(' / ')}`,
        x + 48,
        cursor + 1,
        width - 62,
        16,
        Number.MAX_SAFE_INTEGER,
      );
    }
  }

  private drawSectionHeader(y: number, title: string, meta: string): number {
    this.setFont(19, 800);
    this.ctx.fillStyle = theme.title;
    this.ctx.fillText(title, 20, y + 22);
    this.setFont(13, 600);
    this.ctx.fillStyle = theme.subtle;
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
    this.ctx.shadowColor = theme.shadowSoft;
    this.ctx.shadowBlur = 18;
    this.ctx.shadowOffsetY = 8;
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    this.roundRect(x, startY, width, height, 8);
    this.ctx.fill();
    this.ctx.shadowColor = 'transparent';
    this.ctx.strokeStyle = theme.line;
    this.ctx.stroke();
    this.ctx.restore();

    return startY + height + 10;
  }

  private drawSectionTitle(title: string, subtitle: string, x: number, y: number): void {
    this.setFont(18, 800);
    this.ctx.fillStyle = theme.title;
    this.ctx.fillText(title, x, y);
    this.setFont(13, 500);
    this.ctx.fillStyle = theme.subtle;
    this.drawWrappedText(subtitle, x, y + 22, this.width - x * 2, 19, 2);
  }

  private drawFactRow(y: number, label: string, value: string): number {
    this.setFont(13, 600);
    this.ctx.fillStyle = theme.subtle;
    this.ctx.fillText(label, 36, y);
    this.setFont(15, 800);
    this.ctx.fillStyle = theme.ink;
    this.drawWrappedText(value, 116, y, this.width - 152, 21, 2);
    return y + 34;
  }

  private drawMessage(y: number, message: string): number {
    const x = 20;
    const width = this.width - 40;
    this.ctx.fillStyle = '#fff6e6';
    this.roundRect(x, y, width, 54, 8);
    this.ctx.fill();
    this.ctx.strokeStyle = '#f5d095';
    this.ctx.stroke();
    this.setFont(14, 600);
    this.ctx.fillStyle = '#8a5200';
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
    const primaryBg = this.ctx.createLinearGradient(x, y, x + width, y + height);
    primaryBg.addColorStop(0, '#5062df');
    primaryBg.addColorStop(0.52, '#3a91e8');
    primaryBg.addColorStop(1, '#35a7a1');
    const bg = disabled
      ? '#f3f0e8'
      : variant === 'primary'
        ? primaryBg
        : variant === 'danger'
          ? '#fff5f5'
          : 'rgba(255, 255, 255, 0.72)';
    const fg = disabled
      ? '#9aa0a6'
      : variant === 'primary'
        ? '#ffffff'
      : variant === 'danger'
          ? '#c92a2a'
          : theme.ink;
    const border = disabled
      ? theme.line
      : variant === 'primary'
        ? 'rgba(32, 95, 99, 0.7)'
        : variant === 'danger'
          ? '#ffc9c9'
          : theme.ghostBorder;

    this.ctx.save();
    if (!disabled) {
      this.ctx.shadowColor = variant === 'primary' ? 'rgba(58, 134, 232, 0.22)' : 'rgba(40, 54, 78, 0.06)';
      this.ctx.shadowBlur = variant === 'primary' ? 16 : 10;
      this.ctx.shadowOffsetY = variant === 'primary' ? 6 : 4;
    }
    this.ctx.fillStyle = bg;
    this.roundRect(x, y, width, height, 8);
    this.ctx.fill();
    this.ctx.shadowColor = 'transparent';
    this.ctx.strokeStyle = border;
    this.ctx.stroke();
    this.setFont(width < 58 ? 19 : 15, 800);
    this.ctx.fillStyle = fg;
    const displayLabel = this.fitText(label, Math.max(20, width - 18));
    const textWidth = this.ctx.measureText(displayLabel).width;
    this.ctx.fillText(displayLabel, x + (width - textWidth) / 2, y + height / 2 + 6);
    this.ctx.restore();
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
    const bg = this.ctx.createLinearGradient(x, y, x + 62, y + 40);
    bg.addColorStop(0, theme.blueDeep);
    bg.addColorStop(1, theme.blueMid);
    this.ctx.fillStyle = bg;
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
    this.ctx.font = `${weight} ${size}px Inter, "Microsoft YaHei", "PingFang SC", system-ui, sans-serif`;
  }

  private remainingPoints(): number {
    const allocation = this.state.allocation;
    return 20 - allocation.INT - allocation.STR - allocation.MNY - allocation.SPR;
  }

  private savedInheritedTalent(): Talent | null {
    if (!this.contentLoader.hasTalentContent()) return null;
    const inheritedTalentId = this.game.save.inheritedTalentId;
    if (inheritedTalentId === null) return null;
    return this.game.content.talents.find(item => item.id === inheritedTalentId) ?? null;
  }

  private inheritedCandidateTalent(): Talent | null {
    const inheritedTalentId = this.state.inheritedCandidateId;
    if (inheritedTalentId === null) return null;
    return this.state.candidates.find(item => item.id === inheritedTalentId) ?? null;
  }

  private totalRounds(gameState: GameState): number {
    const retakeRounds = gameState.retakeUsed ? this.game.content.ages.filter(round => round.age >= 17).length : 0;
    return this.game.content.ages.length + retakeRounds;
  }

  private talentCardHeight(): number {
    return this.height <= 640 ? 100 : 108;
  }

  private logCardHeight(log: RunLog): number {
    const width = this.width - 40;
    const textWidth = width - 62;
    const minHeight = 72;
    const bottomPadding = 10;

    this.setFont(13, 400);
    const eventLines = Math.max(1, this.wrapText(log.event.text, textWidth, Number.MAX_SAFE_INTEGER).length);
    let height = 44 + eventLines * 18 + bottomPadding;

    if (log.triggeredTalents.length > 0) {
      this.setFont(12, 600);
      const text = `天赋：${log.triggeredTalents.map(item => item.name).join(' / ')}`;
      height += 2 + Math.max(1, this.wrapText(text, textWidth, Number.MAX_SAFE_INTEGER).length) * 16;
    }

    if (log.branchEvents.length > 0) {
      this.setFont(12, 600);
      const text = `连锁：${log.branchEvents.map(item => item.text).join(' / ')}`;
      height += 1 + Math.max(1, this.wrapText(text, textWidth, Number.MAX_SAFE_INTEGER).length) * 16;
    }

    return Math.max(minHeight, height);
  }

  private universityCardHeight(): number {
    return this.height <= 640 ? 92 : 100;
  }

  private headerHeight(): number {
    if (this.state.screen === 'talents') return Math.max(82, this.safeTop + 74);
    return Math.max(172, this.safeTop + 164);
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

function universityTierLabel(tier: University['prestigeTier']): string {
  return {
    top: '顶尖',
    strong: '强校',
    solid: '稳健',
    regional: '区域',
    private: '民办',
  }[tier];
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
    universities: '院校',
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

function requestNextFrame(callback: FrameRequestCallback): number {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(callback);
  }
  return Number(setTimeout(() => callback(Date.now()), 16));
}

const wxApi = getWxApi();
new WxGameApp(createRuntimeCanvas(wxApi), wxApi).start();
