import { zhCnContent } from '../content/zh-cn';
import { loadSave, saveData, type SaveStorage } from '../engine/storage';
import type { GameContent, SaveData } from './types';

export interface GameApp {
  content: GameContent;
  save: SaveData;
  persist(save: SaveData): void;
}

export interface CreateGameOptions {
  storage?: SaveStorage;
}

export function createGame(options: CreateGameOptions = {}): GameApp {
  const save = loadSave(options.storage);
  return {
    content: zhCnContent,
    save,
    persist(nextSave) {
      this.save = nextSave;
      saveData(nextSave, options.storage);
    },
  };
}
