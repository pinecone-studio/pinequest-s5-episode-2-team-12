// All question templates, by SAT Math domain. HARD goes last so older templates keep their seeds.
import { ADVANCED } from './advanced';
import { ALGEBRA } from './algebra';
import { DATA } from './data';
import { GEOMETRY } from './geometry';
import { HARD } from './hard';
import type { Template } from './shared';

export const TEMPLATES: Template[] = [...ALGEBRA, ...ADVANCED, ...DATA, ...GEOMETRY, ...HARD];
