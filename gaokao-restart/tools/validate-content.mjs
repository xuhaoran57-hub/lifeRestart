import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'src', 'content', 'zh-cn');
const allowedProps = new Set(['AGE', 'INT', 'STR', 'MNY', 'SPR', 'VOL', 'RSK', 'SCR', 'HSCR', 'HVOL', 'SCOREMOD', 'SUM']);
const rarityConfig = {
  common: { grade: 0, name: '普通', target: 64 },
  rare: { grade: 1, name: '稀有', target: 56 },
  epic: { grade: 2, name: '史诗', target: 32 },
  legendary: { grade: 3, name: '传说', target: 8 },
};
const categoryConfig = {
  family: '家庭背景',
  aptitude: '学习禀赋',
  habit: '习惯人格',
  relation: '社会关系',
  route: '赛道机会',
  exam: '考场变量',
  volunteer: '志愿信息',
};

function readJson(name) {
  return JSON.parse(readFileSync(join(contentDir, `${name}.json`), 'utf8'));
}

const talents = readJson('talents');
const events = readJson('events');
const ages = readJson('ages');
const endings = readJson('endings');
const achievements = readJson('achievements');
const characters = readJson('characters');

const talentIds = new Set(talents.map(item => item.id));
const eventIds = new Set(events.map(item => item.id));
const endingIds = new Set(endings.map(item => item.id));

function fail(message) {
  throw new Error(message);
}

function checkEffect(owner, effect = {}) {
  for (const [prop, value] of Object.entries(effect)) {
    if (!allowedProps.has(prop)) fail(`${owner} uses invalid prop ${prop}`);
    if (typeof value !== 'number') fail(`${owner} effect ${prop} is not numeric`);
  }
}

function effectBudget(effect = {}) {
  let benefit = 0;
  let cost = 0;
  for (const [prop, value] of Object.entries(effect)) {
    const weight = effectBudgetWeight(prop);
    if (prop === 'RSK') {
      if (value < 0) benefit += -value * weight;
      else cost += value * weight;
      continue;
    }
    if (value > 0) benefit += value * weight;
    else cost += -value * weight;
  }
  return Number((benefit - cost * 0.65).toFixed(2));
}

function effectBudgetWeight(prop) {
  if (['INT', 'STR', 'MNY', 'SPR'].includes(prop)) return 1;
  if (['VOL', 'RSK'].includes(prop)) return 0.08;
  if (prop === 'SCOREMOD') return 0.12;
  return 0;
}

function countBy(items, keyOf) {
  return items.reduce((result, item) => {
    const key = keyOf(item);
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
}

function averageBudget(rarity) {
  const items = talents.filter(item => item.rarity === rarity);
  return items.reduce((sum, item) => sum + item.effectBudget, 0) / Math.max(1, items.length);
}

function idsFromCondition(condition = '', type) {
  const results = [];
  const re = new RegExp(`${type}[?!]\\[([0-9,]+)\\]`, 'g');
  for (const match of condition.matchAll(re)) {
    results.push(...match[1].split(',').filter(Boolean).map(Number));
  }
  return results;
}

for (const talent of talents) {
  checkEffect(`talent ${talent.id}`, talent.effect);
  const rarity = rarityConfig[talent.rarity];
  if (!rarity) fail(`talent ${talent.id} has invalid rarity ${talent.rarity}`);
  if (talent.grade !== rarity.grade) fail(`talent ${talent.id} grade does not match rarity ${talent.rarity}`);
  if (talent.rarityName !== rarity.name) fail(`talent ${talent.id} rarityName does not match rarity ${talent.rarity}`);
  if (!categoryConfig[talent.category]) fail(`talent ${talent.id} has invalid category ${talent.category}`);
  if (talent.categoryName !== categoryConfig[talent.category]) fail(`talent ${talent.id} categoryName does not match category ${talent.category}`);
  if (typeof talent.effectBudget !== 'number') fail(`talent ${talent.id} missing numeric effectBudget`);
  if (talent.effectBudget !== effectBudget(talent.effect)) fail(`talent ${talent.id} effectBudget is stale`);
  if (talent.rarity === 'legendary' && talent.polarity === 'drawback') fail(`talent ${talent.id} is drawback legendary`);
  for (const id of talent.exclude || []) if (!talentIds.has(id)) fail(`talent ${talent.id} excludes missing talent ${id}`);
}

const rarityCounts = countBy(talents, item => item.rarity);
for (const [rarity, config] of Object.entries(rarityConfig)) {
  if (rarityCounts[rarity] !== config.target) fail(`rarity ${rarity} expected ${config.target}, got ${rarityCounts[rarity] ?? 0}`);
}
if (!(averageBudget('common') < averageBudget('rare'))) fail('common average effectBudget should be lower than rare');
if (!(averageBudget('rare') < averageBudget('epic'))) fail('rare average effectBudget should be lower than epic');
if (!(averageBudget('epic') < averageBudget('legendary'))) fail('epic average effectBudget should be lower than legendary');

for (const event of events) {
  checkEffect(`event ${event.id}`, event.effect);
  for (const id of idsFromCondition(event.include, 'TLT')) if (!talentIds.has(id)) fail(`event ${event.id} include references missing talent ${id}`);
  for (const id of idsFromCondition(event.exclude, 'TLT')) if (!talentIds.has(id)) fail(`event ${event.id} exclude references missing talent ${id}`);
  for (const id of idsFromCondition(event.include, 'EVT')) if (!eventIds.has(id)) fail(`event ${event.id} include references missing event ${id}`);
  for (const id of idsFromCondition(event.exclude, 'EVT')) if (!eventIds.has(id)) fail(`event ${event.id} exclude references missing event ${id}`);
  for (const branch of event.branch || []) {
    if (!eventIds.has(branch.next)) fail(`event ${event.id} branch references missing event ${branch.next}`);
  }
}

for (let age = 3; age <= 18; age += 1) {
  const rows = ages.filter(item => item.age === age);
  if (rows.length !== 4) fail(`age ${age} should have 4 rounds, got ${rows.length}`);
  for (let round = 1; round <= 4; round += 1) {
    if (!rows.some(item => item.round === round)) fail(`age ${age} missing round ${round}`);
  }
}

const steps = new Set();
for (const age of ages) {
  if (typeof age.step !== 'number') fail(`age ${age.age} round ${age.round} missing numeric step`);
  if (steps.has(age.step)) fail(`duplicate step ${age.step}`);
  steps.add(age.step);
  for (const entry of age.eventPool || []) if (!eventIds.has(entry.id)) fail(`age ${age.age} round ${age.round} references missing event ${entry.id}`);
  for (const id of age.talentPool || []) if (!talentIds.has(id)) fail(`age ${age.age} round ${age.round} references missing talent ${id}`);
}
if (steps.size !== 64) fail(`expected 64 unique steps, got ${steps.size}`);
for (let step = 1; step <= 64; step += 1) {
  if (!steps.has(step)) fail(`missing step ${step}`);
}

for (const ending of endings) {
  if (!ending.condition) fail(`ending ${ending.id} missing condition`);
  if (!ending.tier) fail(`ending ${ending.id} missing tier`);
  if (typeof ending.priority !== 'number') fail(`ending ${ending.id} priority is not numeric`);
  for (const id of idsFromCondition(ending.condition, 'TLT')) if (!talentIds.has(id)) fail(`ending ${ending.id} references missing talent ${id}`);
  for (const id of idsFromCondition(ending.condition, 'EVT')) if (!eventIds.has(id)) fail(`ending ${ending.id} references missing event ${id}`);
}

for (const achievement of achievements) {
  for (const id of idsFromCondition(achievement.condition, 'END')) if (!endingIds.has(id)) fail(`achievement ${achievement.id} references missing ending ${id}`);
}

for (const character of characters) {
  for (const id of character.talents || []) if (!talentIds.has(id)) fail(`character ${character.id} references missing talent ${id}`);
}

console.log(`Content OK: ${talents.length} talents, ${events.length} events, ${ages.length} ages, ${endings.length} endings, ${achievements.length} achievements, ${characters.length} characters.`);
