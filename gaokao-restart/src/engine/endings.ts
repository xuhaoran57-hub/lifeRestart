import type { Ending, GameContent, GameState } from '../app/types';
import { evaluateCondition } from './condition';
import { createConditionContext } from './events';

export function pickEnding(content: GameContent, state: GameState): Ending {
  const context = createConditionContext(state);
  const ending = [...content.endings]
    .sort((a, b) => effectivePriority(b) - effectivePriority(a))
    .find(item => evaluateCondition(item.condition, context));

  if (ending) return ending;

  const fallbackId = state.props.HSCR >= 520 ? 41111 : 41007;
  const fallback = content.endings.find(item => item.id === fallbackId);
  if (!fallback) throw new Error(`Missing fallback ending ${fallbackId}`);
  return fallback;
}

function effectivePriority(ending: Ending): number {
  return ending.priority - (ending.tier === 'X' ? 12 : 0);
}
