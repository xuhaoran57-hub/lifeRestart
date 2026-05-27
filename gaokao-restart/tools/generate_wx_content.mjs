import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = join(projectRoot, 'src', 'content', 'zh-cn');
const wxRoot = join(projectRoot, 'wxgame');

// Map each content file to the subpackage (folder) it ships in.
// Keeping content out of the main package is the whole point of this split.
const subpackageFiles = {
  sim: [
    'talents.json',
    'achievements.json',
    'ages.json',
    'events.json',
    'endings.json',
    'characters.json',
  ],
  adm: [
    { source: join('admissions', 'profiles.json'), target: 'profiles.json' },
    { source: join('admissions', 'universities.json'), target: 'universities.json' },
  ],
};

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(sourceRoot, relativePath), 'utf8'));
}

async function writeJson(target, value) {
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(value), 'utf8');
}

// Remove stale outputs from previous layouts so the main package never
// accidentally keeps shipping the content JSON.
for (const stale of ['content', 'sim', 'adm']) {
  await rm(join(wxRoot, stale), { recursive: true, force: true });
}

for (const [subpackage, files] of Object.entries(subpackageFiles)) {
  for (const entry of files) {
    const source = typeof entry === 'string' ? entry : entry.source;
    const target = typeof entry === 'string' ? entry : entry.target;
    await writeJson(join(wxRoot, subpackage, target), await readJson(source));
  }
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

await writeJson(join(wxRoot, 'adm', 'admission-lines.slim.json'), slimAdmissionLines);

// WeChat requires a game.js entry in each subpackage root.
for (const sub of ['sim', 'adm']) {
  await writeFile(join(wxRoot, sub, 'game.js'), '', 'utf8');
}
