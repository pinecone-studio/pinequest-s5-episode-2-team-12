// All question templates, by SAT Math domain. HARD goes last so older templates keep their seeds.
import { ADVANCED } from './advanced';
import { ALGEBRA } from './algebra';
import { DATA } from './data';
import { GEOMETRY } from './geometry';
import { HARD } from './hard';
import type { Template } from './shared';

/** The templates the trained kits (ai/data/tuning, tuning-v2) were built from. Keep it fixed so the committed data
 *  can be rebuilt byte for byte; new templates go into TEMPLATES only. */
export const KIT_TEMPLATES: Template[] = [...ALGEBRA, ...ADVANCED, ...DATA, ...GEOMETRY];
export const TEMPLATES: Template[] = [...KIT_TEMPLATES, ...HARD];
