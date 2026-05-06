import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = join(root, 'data', 'anhui-2025-undergrad', 'anhui_2025_undergraduate_scores_slim.json');
const admissionDir = join(root, 'src', 'content', 'zh-cn', 'admissions');

const profileByTrack = {
  历史类: {
    id: 'ah-2025-history',
    name: '安徽 2025 历史类',
    year: 2025,
    sourceProvince: '安徽',
    subjectTrack: '历史类',
    scoreScale: 750,
    batch: '本科普通批',
  },
  物理类: {
    id: 'ah-2025-physics',
    name: '安徽 2025 物理类',
    year: 2025,
    sourceProvince: '安徽',
    subjectTrack: '物理类',
    scoreScale: 750,
    batch: '本科普通批',
  },
};

const topUniversities = new Set([
  '北京大学',
  '清华大学',
  '复旦大学',
  '上海交通大学',
  '浙江大学',
  '南京大学',
  '中国科学技术大学',
]);

const project985 = new Set([
  '北京大学',
  '中国人民大学',
  '清华大学',
  '北京航空航天大学',
  '北京理工大学',
  '中国农业大学',
  '北京师范大学',
  '中央民族大学',
  '南开大学',
  '天津大学',
  '大连理工大学',
  '东北大学',
  '吉林大学',
  '哈尔滨工业大学',
  '复旦大学',
  '同济大学',
  '上海交通大学',
  '华东师范大学',
  '南京大学',
  '东南大学',
  '浙江大学',
  '中国科学技术大学',
  '厦门大学',
  '山东大学',
  '中国海洋大学',
  '武汉大学',
  '华中科技大学',
  '湖南大学',
  '中南大学',
  '国防科技大学',
  '中山大学',
  '华南理工大学',
  '四川大学',
  '电子科技大学',
  '重庆大学',
  '西安交通大学',
  '西北工业大学',
  '西北农林科技大学',
  '兰州大学',
]);

const project211Only = new Set([
  '北京交通大学',
  '北京工业大学',
  '北京科技大学',
  '北京化工大学',
  '北京邮电大学',
  '北京林业大学',
  '北京中医药大学',
  '北京外国语大学',
  '中国传媒大学',
  '中央财经大学',
  '对外经济贸易大学',
  '北京体育大学',
  '中央音乐学院',
  '中国政法大学',
  '华北电力大学',
  '天津医科大学',
  '河北工业大学',
  '太原理工大学',
  '内蒙古大学',
  '辽宁大学',
  '大连海事大学',
  '延边大学',
  '东北师范大学',
  '哈尔滨工程大学',
  '东北农业大学',
  '东北林业大学',
  '华东理工大学',
  '东华大学',
  '上海外国语大学',
  '上海财经大学',
  '上海大学',
  '苏州大学',
  '南京航空航天大学',
  '南京理工大学',
  '中国矿业大学',
  '河海大学',
  '江南大学',
  '南京农业大学',
  '中国药科大学',
  '南京师范大学',
  '安徽大学',
  '合肥工业大学',
  '福州大学',
  '南昌大学',
  '郑州大学',
  '中国地质大学',
  '武汉理工大学',
  '华中农业大学',
  '华中师范大学',
  '中南财经政法大学',
  '湖南师范大学',
  '暨南大学',
  '华南师范大学',
  '海南大学',
  '广西大学',
  '西南交通大学',
  '四川农业大学',
  '西南大学',
  '西南财经大学',
  '贵州大学',
  '云南大学',
  '西藏大学',
  '西北大学',
  '西安电子科技大学',
  '长安大学',
  '陕西师范大学',
  '青海大学',
  '宁夏大学',
  '新疆大学',
  '石河子大学',
  '中国石油大学',
  '第二军医大学',
  '第四军医大学',
]);

const doubleFirstClassOnly = new Set([
  '北京协和医学院',
  '首都师范大学',
  '外交学院',
  '中国人民公安大学',
  '中国音乐学院',
  '中央美术学院',
  '中央戏剧学院',
  '中国科学院大学',
  '天津工业大学',
  '天津中医药大学',
  '上海海洋大学',
  '上海中医药大学',
  '上海体育大学',
  '上海音乐学院',
  '上海科技大学',
  '南京邮电大学',
  '南京林业大学',
  '南京信息工程大学',
  '南京中医药大学',
  '中国美术学院',
  '宁波大学',
  '河南大学',
  '湘潭大学',
  '广州中医药大学',
  '广州医科大学',
  '成都理工大学',
  '成都中医药大学',
  '西南石油大学',
  '南京医科大学',
  '南方科技大学',
  '山西大学',
  '华南农业大学',
]);

const privateNamePattern = /(民办|独立学院|职业技术大学|职业大学|信息工程学院|城市学院|科技学院|财经学院|商学院|工商学院|文理学院|艺术学院|传媒学院|外事学院|翻译学院|旅游学院|应用技术学院|工程技术学院|学院)$/;

function main() {
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const profiles = [profileByTrack.历史类, { ...profileByTrack.物理类, default: true }];
  const universities = [];
  const admissionLines = [];
  const skipped = [];

  for (const sourceUniversity of source.universities) {
    const code = String(sourceUniversity['院校代码']);
    const name = sourceUniversity['院校名称'];
    universities.push({
      code,
      name,
      province: '未知',
      city: '未知',
      tags: tagsForUniversity(name),
      prestigeTier: prestigeTierForUniversity(name),
    });

    for (const trackName of ['历史类', '物理类']) {
      const row = sourceUniversity[trackName];
      if (!row) continue;
      const minScore = row['投档最低分'];
      if (!Number.isInteger(minScore) || minScore < 250 || minScore > 750) {
        skipped.push({ code, name, trackName, minScore, groupName: row['院校专业组'] });
        continue;
      }
      const groupName = row['院校专业组'] ?? '';
      admissionLines.push({
        profileId: profileByTrack[trackName].id,
        universityCode: code,
        universityName: name,
        groupCode: extractGroupCode(groupName),
        groupName: `${name} ${groupName}`.trim(),
        batch: '本科普通批',
        minScore,
        minRank: Number.isInteger(row['最低分名次']) ? row['最低分名次'] : null,
        subjectRequirement: extractSubjectRequirement(groupName) || trackName,
        sourceName: source.metadata.sourceName,
        sourceUrl: source.metadata.sourceUrls?.[trackName] ?? '',
        sourcePublishedAt: source.metadata.publishedAt,
      });
    }
  }

  writeJson('profiles.json', profiles);
  writeJson('universities.json', universities);
  writeJson('admission-lines.json', admissionLines);

  console.log(`wrote ${universities.length} universities`);
  console.log(`wrote ${admissionLines.length} admission lines`);
  console.log(`skipped ${skipped.length} invalid lines`);
  for (const item of skipped.slice(0, 20)) {
    console.log(`skip ${item.code} ${item.name} ${item.trackName} score=${item.minScore ?? 'null'} group=${item.groupName}`);
  }
}

function writeJson(fileName, value) {
  writeFileSync(join(admissionDir, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normalizedName(name) {
  return String(name)
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[\s·]/g, '')
    .trim();
}

function projectBaseName(name) {
  const normalized = normalizedName(name);
  for (const candidate of [...project985, ...project211Only, ...doubleFirstClassOnly]) {
    const normalizedCandidate = normalizedName(candidate);
    if (normalized === normalizedCandidate) return candidate;
    const suffix = normalized.slice(normalizedCandidate.length);
    if (normalized.startsWith(normalizedCandidate) && isAllowedProjectBranchSuffix(suffix)) return candidate;
  }
  return null;
}

function isAllowedProjectBranchSuffix(suffix) {
  return suffix === '医学部'
    || suffix === '分校'
    || suffix === '校区'
    || suffix.endsWith('分校')
    || suffix.endsWith('校区');
}

function tagsForUniversity(name) {
  const base = projectBaseName(name);
  const tags = [];
  if (project985.has(base)) tags.push('985', '211', 'doubleFirstClass');
  else if (project211Only.has(base)) tags.push('211', 'doubleFirstClass');
  else if (doubleFirstClassOnly.has(base)) tags.push('doubleFirstClass');
  return tags;
}

function prestigeTierForUniversity(name) {
  const base = projectBaseName(name);
  if (topUniversities.has(base)) return 'top';
  if (project985.has(base)) return 'strong';
  if (project211Only.has(base) || doubleFirstClassOnly.has(base)) return 'strong';
  if (privateNamePattern.test(name)) return 'private';
  return 'regional';
}

function extractGroupCode(groupName) {
  const match = String(groupName).match(/^([A-Za-z0-9]+)/);
  return match?.[1] ?? String(groupName || 'unknown');
}

function extractSubjectRequirement(groupName) {
  const match = String(groupName).match(/[（(](.+?)[）)]/);
  return match?.[1] ?? '';
}

main();
