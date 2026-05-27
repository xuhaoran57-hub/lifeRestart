import type {
  Achievement,
  AdmissionLine,
  AdmissionProfile,
  AgeRound,
  CharacterPreset,
  Ending,
  GameContent,
  GameEvent,
  Talent,
  University,
} from '../app/types';

interface WxFileSystemApi {
  readFileSync(path: string, encoding: 'utf8'): string | ArrayBuffer;
}

interface WxLoadSubpackageOptions {
  name: string;
  success?: () => void;
  fail?: (err: { errMsg?: string }) => void;
  complete?: () => void;
}

interface WxContentApi {
  getFileSystemManager?(): WxFileSystemApi;
  loadSubpackage?(options: WxLoadSubpackageOptions): unknown;
}

export interface WxContentSummary {
  achievements: number;
  universities: number;
}

type ContentStage = 'talents' | 'simulation' | 'admissionBasics' | 'admissionLines';
type Subpackage = 'sim' | 'adm';
type SlimAdmissionLineRow = [number, string, string, number, number | null, 1?, number?];

interface SlimAdmissionLinesPayload {
  profiles: string[];
  lines: SlimAdmissionLineRow[];
}

// Each content file lives under exactly one wxgame subpackage. Web/browser
// builds keep the legacy `content/zh-cn/...` layout served from the dev root.
const wxFilePaths: Record<string, { subpackage: Subpackage; path: string }> = {
  'talents.json': { subpackage: 'sim', path: 'sim/talents.json' },
  'achievements.json': { subpackage: 'sim', path: 'sim/achievements.json' },
  'ages.json': { subpackage: 'sim', path: 'sim/ages.json' },
  'events.json': { subpackage: 'sim', path: 'sim/events.json' },
  'endings.json': { subpackage: 'sim', path: 'sim/endings.json' },
  'characters.json': { subpackage: 'sim', path: 'sim/characters.json' },
  'admissions/profiles.json': { subpackage: 'adm', path: 'adm/profiles.json' },
  'admissions/universities.json': { subpackage: 'adm', path: 'adm/universities.json' },
  'admissions/admission-lines.slim.json': { subpackage: 'adm', path: 'adm/admission-lines.slim.json' },
};

const browserContentRoots = ['content/zh-cn', 'wxgame/content/zh-cn'];

const defaultSummary: WxContentSummary = {
  achievements: 54,
  universities: 1182,
};

const admissionLineExpandChunkSize = 250;

export class WxContentLoader {
  readonly content: GameContent = createEmptyContent();
  readonly summary: WxContentSummary = { ...defaultSummary };

  private readonly loadedStages = new Set<ContentStage>();
  private readonly pendingStages = new Map<ContentStage, Promise<void>>();
  private readonly subpackagePromises = new Map<Subpackage, Promise<void>>();

  constructor(private readonly wxApi: WxContentApi | undefined) {}

  hasTalentContent(): boolean {
    return this.loadedStages.has('talents');
  }

  hasSimulationContent(): boolean {
    return this.loadedStages.has('simulation');
  }

  hasAdmissionBasics(): boolean {
    return this.loadedStages.has('admissionBasics');
  }

  hasAdmissionLines(): boolean {
    return this.loadedStages.has('admissionLines');
  }

  loadTalentContent(): Promise<void> {
    return this.loadOnce('talents', async () => {
      const talents = await this.readContent<Talent[]>('talents.json');
      await yieldToMainThread();
      const achievements = await this.readContent<Achievement[]>('achievements.json');
      this.content.talents = talents;
      this.content.achievements = achievements;
      this.summary.achievements = achievements.length;
    });
  }

  loadSimulationContent(): Promise<void> {
    return this.loadOnce('simulation', async () => {
      await this.loadTalentContent();
      await yieldToMainThread();
      const ages = await this.readContent<AgeRound[]>('ages.json');
      await yieldToMainThread();
      const events = await this.readContent<GameEvent[]>('events.json');
      await yieldToMainThread();
      const endings = await this.readContent<Ending[]>('endings.json');
      await yieldToMainThread();
      const characters = await this.readContent<CharacterPreset[]>('characters.json');
      this.content.ages = ages;
      this.content.events = events;
      this.content.endings = endings;
      this.content.characters = characters;
    });
  }

  loadAdmissionBasics(): Promise<void> {
    return this.loadOnce('admissionBasics', async () => {
      const admissionProfiles = await this.readContent<AdmissionProfile[]>('admissions/profiles.json');
      await yieldToMainThread();
      const universities = await this.readContent<University[]>('admissions/universities.json');
      this.content.admissionProfiles = admissionProfiles;
      this.content.universities = universities;
      this.summary.universities = universities.length;
    });
  }

  loadAdmissionLines(): Promise<void> {
    return this.loadOnce('admissionLines', async () => {
      await this.loadAdmissionBasics();
      const payload = await this.readContent<SlimAdmissionLinesPayload>('admissions/admission-lines.slim.json');
      await yieldToMainThread();
      this.content.admissionLines = await expandAdmissionLines(
        payload,
        this.content.admissionProfiles,
        this.content.universities,
      );
    });
  }

  private loadOnce(stage: ContentStage, load: () => Promise<void>): Promise<void> {
    if (this.loadedStages.has(stage)) return Promise.resolve();
    const pending = this.pendingStages.get(stage);
    if (pending) return pending;

    const next = load()
      .then(() => {
        this.loadedStages.add(stage);
      })
      .finally(() => {
        this.pendingStages.delete(stage);
      });
    this.pendingStages.set(stage, next);
    return next;
  }

  private async readContent<T>(relativePath: string): Promise<T> {
    const fileSystem = this.wxApi?.getFileSystemManager?.();
    if (fileSystem) {
      const mapping = wxFilePaths[relativePath];
      if (!mapping) throw new Error(`No wxgame mapping for content file: ${relativePath}`);
      await this.ensureSubpackage(mapping.subpackage);
      const raw = fileSystem.readFileSync(mapping.path, 'utf8');
      return JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)) as T;
    }

    for (const root of browserContentRoots) {
      try {
        const response = await fetch(`${root}/${relativePath}`);
        if (response.ok) return await response.json() as T;
      } catch {
        // Try the next root.
      }
    }

    throw new Error(`Failed to load content: ${relativePath}`);
  }

  private ensureSubpackage(name: Subpackage): Promise<void> {
    const cached = this.subpackagePromises.get(name);
    if (cached) return cached;
    const loadSubpackage = this.wxApi?.loadSubpackage;
    // Older basic libraries (or non-wx fallbacks) do not provide
    // loadSubpackage; in that case the file system reads succeed directly.
    if (typeof loadSubpackage !== 'function') {
      const resolved = Promise.resolve();
      this.subpackagePromises.set(name, resolved);
      return resolved;
    }
    const pending = new Promise<void>((resolve, reject) => {
      loadSubpackage.call(this.wxApi, {
        name,
        success: () => resolve(),
        fail: err => reject(new Error(err?.errMsg ?? `Failed to load subpackage ${name}`)),
      });
    });
    // Cache only after success; on failure allow a retry on next access.
    pending.catch(() => this.subpackagePromises.delete(name));
    this.subpackagePromises.set(name, pending);
    return pending;
  }
}

export function createWxContentLoader(wxApi: WxContentApi | undefined): WxContentLoader {
  return new WxContentLoader(wxApi);
}

function createEmptyContent(): GameContent {
  return {
    talents: [],
    events: [],
    ages: [],
    endings: [],
    achievements: [],
    characters: [],
    admissionProfiles: [],
    universities: [],
    admissionLines: [],
  };
}

async function expandAdmissionLines(
  payload: SlimAdmissionLinesPayload,
  admissionProfiles: AdmissionProfile[],
  universities: University[],
): Promise<AdmissionLine[]> {
  const profileMap = new Map(admissionProfiles.map(profile => [profile.id, profile]));
  const universityMap = new Map(universities.map(university => [university.code, university]));
  const admissionLines: AdmissionLine[] = [];

  for (let start = 0; start < payload.lines.length; start += admissionLineExpandChunkSize) {
    const end = Math.min(payload.lines.length, start + admissionLineExpandChunkSize);
    for (let index = start; index < end; index += 1) {
      const row = payload.lines[index];
      const [profileIndex, universityCode, groupName, minScore, minRank, lineType, resourceNeed] = row;
      const profileId = payload.profiles[profileIndex] ?? '';
      const profile = profileMap.get(profileId);
      const university = universityMap.get(universityCode);
      admissionLines.push({
        profileId,
        universityCode,
        universityName: university?.name ?? '',
        groupCode: '',
        groupName,
        batch: profile?.batch ?? '',
        minScore,
        minRank,
        subjectRequirement: '',
        sourceName: '',
        sourceUrl: '',
        sourcePublishedAt: '',
        lineType: lineType === 1 ? 'sinoForeign' : 'normal',
        ...(lineType === 1 ? { resourceNeed: resourceNeed ?? 6 } : {}),
      });
    }
    if (end < payload.lines.length) await yieldToMainThread();
  }

  return admissionLines;
}

function yieldToMainThread(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}
