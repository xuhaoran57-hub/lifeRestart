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
  talents: talents as GameContent['talents'],
  events: events as GameContent['events'],
  ages: ages as GameContent['ages'],
  endings: endings as GameContent['endings'],
  achievements: achievements as GameContent['achievements'],
  characters: characters as GameContent['characters'],
  admissionProfiles: admissionProfiles as GameContent['admissionProfiles'],
  universities: universities as GameContent['universities'],
  admissionLines: admissionLines as GameContent['admissionLines'],
};
