import type { AdmissionResult, PropCode } from '../app/types';

export interface ConditionContext {
  props: Partial<Record<PropCode | string, number>>;
  talentIds: Set<number>;
  eventIds: Set<number>;
  endingIds: Set<number>;
  admission?: AdmissionResult | null;
}

type Token =
  | { type: 'number'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: string };

type MembershipValue = number | string;

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

    const identMatch = input.slice(index).match(/^[A-Za-z][A-Za-z0-9_]*/);
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
    const left = this.numericValue(ident);
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

  private parseIdList(): MembershipValue[] {
    this.expect('[');
    const ids = [this.expectMembershipValue()];
    while (this.consume(',')) ids.push(this.expectMembershipValue());
    this.expect(']');
    return ids;
  }

  private hasMembership(ident: string, id: MembershipValue): boolean {
    if (ident === 'TLT' && typeof id === 'number') return this.context.talentIds.has(id);
    if (ident === 'EVT' && typeof id === 'number') return this.context.eventIds.has(id);
    if (ident === 'END' && typeof id === 'number') return this.context.endingIds.has(id);
    if (ident === 'ADM') return this.hasAdmissionTier(String(id));
    if (ident === 'SCHOOL') return this.context.admission?.admittedUniversity?.code === String(id);
    return this.context.props[ident] === id;
  }

  private hasAdmissionTier(tier: string): boolean {
    const admission = this.context.admission;
    if (!admission?.admitted) return false;
    if (tier === '985') return admission.admissionTier === '985';
    if (tier === '211') return admission.admissionTier === '985' || admission.admissionTier === '211';
    if (tier === 'doubleFirstClass') return ['985', '211', 'doubleFirstClass'].includes(admission.admissionTier);
    return admission.admissionTier === tier;
  }

  private numericValue(ident: string): number {
    if (ident === 'ADMSCORE') return this.context.admission?.finalScore ?? 0;
    if (ident === 'MARGIN') return this.context.admission?.margin ?? 0;
    if (ident === 'SLIDE') return this.context.admission?.admissionTier === 'slide' ? 1 : 0;
    return this.context.props[ident] ?? 0;
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

  private expectMembershipValue(): MembershipValue {
    const token = this.peek();
    if (token?.type === 'number') {
      this.cursor += 1;
      return token.value;
    }
    if (token?.type === 'ident') {
      this.cursor += 1;
      return token.value;
    }
    throw new Error(`Expected membership value, got ${this.peekText()}`);
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
