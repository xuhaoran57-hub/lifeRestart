import achievements from './achievements.json';
import admissionLines from './admissions/admission-lines.json';
import admissionProfiles from './admissions/profiles.json';
import ages from './ages.json';
import characters from './characters.json';
import endings from './endings.json';
import events from './events.json';
import talents from './talents.json';
import universities from './admissions/universities.json';
import type { GameContent } from '../../app/types';

export const zhCnContent: GameContent = {
  talents,
  events,
  ages,
  endings,
  achievements,
  characters,
  admissionProfiles,
  universities,
  admissionLines,
};
