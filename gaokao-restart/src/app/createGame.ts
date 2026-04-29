import { zhCnContent } from '../content/zh-cn';
import { loadSave, saveData } from '../engine/storage';
import type { GameContent, SaveData } from './types';

export interface GameApp {
  content: GameContent;
  save: SaveData;
  persist(save: SaveData): void;
}

export function createGame(): GameApp {
  const save = loadSave();
  return {
    content: zhCnContent,
    save,
    persist(nextSave) {
      this.save = nextSave;
      saveData(nextSave);
    },
  };
}
