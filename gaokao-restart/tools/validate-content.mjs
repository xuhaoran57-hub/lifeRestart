import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'src', 'content', 'zh-cn');
const allowedProps = new Set(['AGE', 'INT', 'STR', 'MNY', 'SPR', 'VOL', 'RSK', 'SCR', 'HSCR', 'HVOL', 'SCOREMOD', 'SUM']);
const rarityConfig = {
  common: { grade: 0, name: '普通', target: 64 },
  rare: { grade: 1, name: '稀有', target: 58 },
  epic: { grade: 2, name: '史诗', target: 32 },
  legendary: { grade: 3, name: '传说', target: 12 },
};
const subjectTracks = new Set(['history', 'physics']);
const requiredAdmissionProfiles = new Map([
  ['ah-2025-history', '历史类'],
  ['ah-2025-physics', '物理类'],
]);
const subjectTrackEvents = new Map([
  [32001, { flag: '理科定盘', tag: '物理类' }],
  [32002, { flag: '文科定盘', tag: '历史类' }],
  [32003, { flag: '物理类分科', tag: '物理类' }],
  [32004, { flag: '历史类分科', tag: '历史类' }],
]);
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

function readAdmissionJson(name) {
  return JSON.parse(readFileSync(join(contentDir, 'admissions', `${name}.json`), 'utf8'));
}

const talents = readJson('talents');
const events = readJson('events');
const ages = readJson('ages');
const endings = readJson('endings');
const achievements = readJson('achievements');
const characters = readJson('characters');
const admissionProfiles = readAdmissionJson('profiles');
const universities = readAdmissionJson('universities');
const admissionLines = readAdmissionJson('admission-lines');

const talentIds = new Set(talents.map(item => item.id));
const eventIds = new Set(events.map(item => item.id));
const eventById = new Map(events.map(item => [item.id, item]));
const endingIds = new Set(endings.map(item => item.id));
const admissionProfileIds = new Set(admissionProfiles.map(item => item.id));
const universityCodes = new Set(universities.map(item => item.code));
const universityByCode = new Map(universities.map(item => [item.code, item]));

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

const historyLockTalent = talents.find(item => item.id === 21801);
const physicsLockTalent = talents.find(item => item.id === 21802);
if (!historyLockTalent) fail('missing history lock talent 21801');
if (!physicsLockTalent) fail('missing physics lock talent 21802');
if (historyLockTalent.rarity !== 'rare' || physicsLockTalent.rarity !== 'rare') fail('subject lock talents should be rare');
if (historyLockTalent.category !== 'route' || physicsLockTalent.category !== 'route') fail('subject lock talents should be route talents');
if (!historyLockTalent.exclude?.includes(21802)) fail('history lock talent should exclude physics lock talent');
if (!physicsLockTalent.exclude?.includes(21801)) fail('physics lock talent should exclude history lock talent');

for (const event of events) {
  checkEffect(`event ${event.id}`, event.effect);
  if (event.subjectTrack && !subjectTracks.has(event.subjectTrack)) fail(`event ${event.id} has invalid subjectTrack ${event.subjectTrack}`);
  for (const id of idsFromCondition(event.include, 'TLT')) if (!talentIds.has(id)) fail(`event ${event.id} include references missing talent ${id}`);
  for (const id of idsFromCondition(event.exclude, 'TLT')) if (!talentIds.has(id)) fail(`event ${event.id} exclude references missing talent ${id}`);
  for (const id of idsFromCondition(event.include, 'EVT')) if (!eventIds.has(id)) fail(`event ${event.id} include references missing event ${id}`);
  for (const id of idsFromCondition(event.exclude, 'EVT')) if (!eventIds.has(id)) fail(`event ${event.id} exclude references missing event ${id}`);
  for (const branch of event.branch || []) {
    if (!eventIds.has(branch.next)) fail(`event ${event.id} branch references missing event ${branch.next}`);
  }
}

for (const [id, expectation] of subjectTrackEvents) {
  const event = eventById.get(id);
  if (!event) fail(`missing subject track event ${id}`);
  if (!event.noRandom) fail(`subject track event ${id} should be noRandom`);
  if (event.phase !== 'senior1') fail(`subject track event ${id} should be senior1`);
  if (event.flag !== expectation.flag) fail(`subject track event ${id} flag mismatch`);
  if (!event.tags?.includes('分科')) fail(`subject track event ${id} missing 分科 tag`);
  if (!event.tags?.includes(expectation.tag)) fail(`subject track event ${id} missing ${expectation.tag} tag`);
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
  if (age.age === 18) {
    const hasTaggedEvent = { prep: false, exam: false, volunteer: false, score: false };
    for (const entry of age.eventPool || []) {
      const event = eventById.get(entry.id);
      if (event?.tags?.includes('考前')) {
        hasTaggedEvent.prep = true;
        if (age.round !== 1) fail(`age 18 round ${age.round} contains prep event ${entry.id}`);
      }
      if (event?.tags?.includes('高考')) {
        hasTaggedEvent.exam = true;
        if (age.round !== 2) fail(`age 18 round ${age.round} contains exam event ${entry.id}`);
      }
      if (event?.tags?.includes('志愿')) {
        hasTaggedEvent.volunteer = true;
        if (age.round !== 3) fail(`age 18 round ${age.round} contains volunteer event ${entry.id}`);
      }
      if (event?.tags?.includes('出分')) {
        hasTaggedEvent.score = true;
        if (age.round !== 4) fail(`age 18 round ${age.round} contains score event ${entry.id}`);
      }
    }
    if (age.round === 1 && !hasTaggedEvent.prep) fail('age 18 round 1 should contain prep events');
    if (age.round === 2 && !hasTaggedEvent.exam) fail('age 18 round 2 should contain exam events');
    if (age.round === 3 && !hasTaggedEvent.volunteer) fail('age 18 round 3 should contain volunteer events');
    if (age.round === 4 && !hasTaggedEvent.score) fail('age 18 round 4 should contain score events');
  }
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

if (!admissionProfiles.length) fail('missing admission profiles');
if (admissionProfiles.some(item => item.id === 'gx-2024-physics')) fail('old Guangxi test admission profile should not remain');
if (admissionProfiles.filter(item => item.default).length > 1) fail('expected at most one default admission profile');
for (const [id, trackName] of requiredAdmissionProfiles) {
  const profile = admissionProfiles.find(item => item.id === id);
  if (!profile) fail(`missing required admission profile ${id}`);
  if (profile.subjectTrack !== trackName) fail(`admission profile ${id} should be ${trackName}`);
}

for (const profile of admissionProfiles) {
  if (!profile.id) fail('admission profile missing id');
  if (typeof profile.year !== 'number') fail(`admission profile ${profile.id} missing numeric year`);
  if (profile.scoreScale !== 750) fail(`admission profile ${profile.id} should use 750 score scale for current formula`);
  if (!profile.sourceProvince || !profile.subjectTrack || !profile.batch) fail(`admission profile ${profile.id} missing scope fields`);
  if (profile.sourceProvince !== '安徽') fail(`admission profile ${profile.id} should use Anhui source province`);
}

for (const university of universities) {
  if (!university.code || !university.name) fail('university missing code or name');
  if (typeof university.code !== 'string') fail(`university ${university.name} code should be string`);
  if (!['top', 'strong', 'solid', 'regional', 'private'].includes(university.prestigeTier)) {
    fail(`university ${university.code} has invalid prestigeTier ${university.prestigeTier}`);
  }
  if (university.prestigeTier === 'private' && university.tags?.some(tag => ['985', '211', 'doubleFirstClass'].includes(tag))) {
    fail(`private university ${university.name} should not have project tags`);
  }
}

const lineKeys = new Set();
for (const line of admissionLines) {
  if (!admissionProfileIds.has(line.profileId)) fail(`admission line ${line.universityName} references missing profile ${line.profileId}`);
  if (!universityCodes.has(line.universityCode)) fail(`admission line ${line.universityName} references missing university ${line.universityCode}`);
  if (line.universityName !== universityByCode.get(line.universityCode)?.name) fail(`admission line ${line.universityCode} universityName mismatch`);
  if (typeof line.minScore !== 'number' || line.minScore < 250 || line.minScore > 750) fail(`admission line ${line.universityName} has invalid minScore ${line.minScore}`);
  if (!line.groupCode || !line.groupName) fail(`admission line ${line.universityName} missing group`);
  if (!line.sourceName || !line.sourceUrl || !line.sourcePublishedAt) fail(`admission line ${line.universityName} missing source fields`);
  const profile = admissionProfiles.find(item => item.id === line.profileId);
  if (profile?.subjectTrack === '历史类' && !line.sourceUrl.includes('8466')) fail(`history line ${line.universityName} should use history source URL`);
  if (profile?.subjectTrack === '物理类' && !line.sourceUrl.includes('8467')) fail(`physics line ${line.universityName} should use physics source URL`);
  const key = `${line.profileId}:${line.universityCode}:${line.groupCode}`;
  if (lineKeys.has(key)) fail(`duplicate admission line ${key}`);
  lineKeys.add(key);
}

for (const profile of admissionProfiles) {
  const profileLines = admissionLines.filter(item => item.profileId === profile.id);
  if (profileLines.length < 80) fail(`admission profile ${profile.id} should have at least 80 lines, got ${profileLines.length}`);
  if (!profileLines.some(line => universityByCode.get(line.universityCode)?.tags.includes('985'))) fail(`admission profile ${profile.id} has no 985 line`);
  if (!profileLines.some(line => universityByCode.get(line.universityCode)?.tags.includes('211'))) fail(`admission profile ${profile.id} has no 211 line`);
  if (!profileLines.some(line => universityByCode.get(line.universityCode)?.prestigeTier === 'regional')) fail(`admission profile ${profile.id} has no regional undergraduate line`);
}

console.log(`Content OK: ${talents.length} talents, ${events.length} events, ${ages.length} ages, ${endings.length} endings, ${achievements.length} achievements, ${characters.length} characters, ${admissionLines.length} admission lines.`);
