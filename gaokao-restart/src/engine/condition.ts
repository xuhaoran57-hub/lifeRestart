import type { PropCode } from '../app/types';

export interface ConditionContext {
  props: Partial<Record<PropCode, number>>;
  talentIds: Set<number>;
  eventIds: Set<number>;
  endingIds: Set<number>;
}

type Token =
  | { type: 'number'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: string };

const operators = ['>=', '<=', '!=', '>', '<', '=', '&', '|', '(', ')', '?', '!', '[', ']', ','];

export function evaluateCondition(condition: string | undefined, context: ConditionContext): boolean {
  if (!condition || condition.trim() === '') return true;
  const parser = new Parser(tokenize(condition), context);
  return parser.parse();
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    const operator = operators.find(item => input.startsWith(item, index));
    if (operator) {
      tokens.push({ type: 'op', value: operator });
      index += operator.length;
      continue;
    }

    const numberMatch = input.slice(index).match(/^-?\d+(?:\.\d+)?/);
    if (numberMatch) {
      tokens.push({ type: 'number', value: Number(numberMatch[0]) });
      index += numberMatch[0].length;
      continue;
    }

    const identMatch = input.slice(index).match(/^[A-Z]+/);
    if (identMatch) {
      tokens.push({ type: 'ident', value: identMatch[0] });
      index += identMatch[0].length;
      continue;
    }

    throw new Error(`Invalid condition token near "${input.slice(index)}"`);
  }
  return tokens;
}

class Parser {
  private cursor = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly context: ConditionContext,
  ) {}

  parse(): boolean {
    const value = this.parseOr();
    if (this.peek()) throw new Error(`Unexpected token ${this.peekText()}`);
    return value;
  }

  private parseOr(): boolean {
    let value = this.parseAnd();
    while (this.consume('|')) value = this.parseAnd() || value;
    return value;
  }

  private parseAnd(): boolean {
    let value = this.parsePrimary();
    while (this.consume('&')) value = this.parsePrimary() && value;
    return value;
  }

  private parsePrimary(): boolean {
    if (this.consume('(')) {
      const value = this.parseOr();
      this.expect(')');
      return value;
    }
    return this.parsePredicate();
  }

  private parsePredicate(): boolean {
    const ident = this.expectIdent();
    const next = this.peek();
    if (next?.type !== 'op') throw new Error(`Missing operator after ${ident}`);

    if (next.value === '?' || next.value === '!') {
      this.cursor += 1;
      const ids = this.parseIdList();
      const hasAny = ids.some(id => this.hasMembership(ident, id));
      return next.value === '?' ? hasAny : !hasAny;
    }

    const operator = this.expectComparisonOperator();
    const right = this.expectNumber();
    const left = this.context.props[ident as PropCode] ?? 0;
    switch (operator) {
      case '>':
        return left > right;
      case '<':
        return left < right;
      case '>=':
        return left >= right;
      case '<=':
        return left <= right;
      case '=':
        return left === right;
      case '!=':
        return left !== right;
      default:
        throw new Error(`Unsupported operator ${operator}`);
    }
  }

  private parseIdList(): number[] {
    this.expect('[');
    const ids = [this.expectNumber()];
    while (this.consume(',')) ids.push(this.expectNumber());
    this.expect(']');
    return ids;
  }

  private hasMembership(ident: string, id: number): boolean {
    if (ident === 'TLT') return this.context.talentIds.has(id);
    if (ident === 'EVT') return this.context.eventIds.has(id);
    if (ident === 'END') return this.context.endingIds.has(id);
    return this.context.props[ident as PropCode] === id;
  }

  private expectComparisonOperator(): string {
    const token = this.peek();
    if (token?.type === 'op' && ['>', '<', '>=', '<=', '=', '!='].includes(token.value)) {
      this.cursor += 1;
      return token.value;
    }
    throw new Error(`Expected comparison operator, got ${this.peekText()}`);
  }

  private expectIdent(): string {
    const token = this.peek();
    if (token?.type === 'ident') {
      this.cursor += 1;
      return token.value;
    }
    throw new Error(`Expected identifier, got ${this.peekText()}`);
  }

  private expectNumber(): number {
    const token = this.peek();
    if (token?.type === 'number') {
      this.cursor += 1;
      return token.value;
    }
    throw new Error(`Expected number, got ${this.peekText()}`);
  }

  private expect(value: string): void {
    if (!this.consume(value)) throw new Error(`Expected ${value}, got ${this.peekText()}`);
  }

  private consume(value: string): boolean {
    const token = this.peek();
    if (token?.type === 'op' && token.value === value) {
      this.cursor += 1;
      return true;
    }
    return false;
  }

  private peek(): Token | undefined {
    return this.tokens[this.cursor];
  }

  private peekText(): string {
    const token = this.peek();
    return token ? token.type === 'op' ? token.value : String(token.value) : 'end of condition';
  }
}
