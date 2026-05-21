import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = join(projectRoot, 'src', 'content', 'zh-cn');
const targetRoot = join(projectRoot, 'wxgame', 'content', 'zh-cn');

const plainContentFiles = [
  'achievements.json',
  'ages.json',
  'characters.json',
  'endings.json',
  'events.json',
  'talents.json',
  join('admissions', 'profiles.json'),
  join('admissions', 'universities.json'),
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(sourceRoot, relativePath), 'utf8'));
}

async function writeJson(relativePath, value) {
  const target = join(targetRoot, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(value), 'utf8');
}

for (const file of plainContentFiles) {
  await writeJson(file, await readJson(file));
}

const admissionLines = await readJson(join('admissions', 'admission-lines.json'));
const profileIds = [...new Set(admissionLines.map(line => line.profileId))];
const slimAdmissionLines = {
  profiles: profileIds,
  lines: admissionLines.map(line => {
    const row = [
      profileIds.indexOf(line.profileId),
      line.universityCode,
      line.groupName,
      line.minScore,
      line.minRank ?? null,
    ];
    if (line.lineType === 'sinoForeign') row.push(1, line.resourceNeed ?? 6);
    return row;
  }),
};

await writeJson(join('admissions', 'admission-lines.slim.json'), slimAdmissionLines);
