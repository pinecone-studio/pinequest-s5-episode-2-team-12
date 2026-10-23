// Aggregates every messages/*.json. Add a line here when a new feature folder gets messages.

import auth_en from '@/features/auth/messages/en.json';
import auth_mn from '@/features/auth/messages/mn.json';
import cards_en from '@/features/cards/messages/en.json';
import cards_mn from '@/features/cards/messages/mn.json';
import desmos_en from '@/features/desmos/messages/en.json';
import desmos_mn from '@/features/desmos/messages/mn.json';
import exam_en from '@/features/exam/messages/en.json';
import exam_mn from '@/features/exam/messages/mn.json';
import home_en from '@/features/home/messages/en.json';
import home_mn from '@/features/home/messages/mn.json';
import journey_en from '@/features/journey/messages/en.json';
import journey_mn from '@/features/journey/messages/mn.json';
import mistakes_en from '@/features/mistakes/messages/en.json';
import mistakes_mn from '@/features/mistakes/messages/mn.json';
import notifications_en from '@/features/notifications/messages/en.json';
import notifications_mn from '@/features/notifications/messages/mn.json';
import onboarding_en from '@/features/onboarding/messages/en.json';
import onboarding_mn from '@/features/onboarding/messages/mn.json';
import planner_en from '@/features/planner/messages/en.json';
import planner_mn from '@/features/planner/messages/mn.json';
import practice_en from '@/features/practice/messages/en.json';
import practice_mn from '@/features/practice/messages/mn.json';
import progress_en from '@/features/progress/messages/en.json';
import progress_mn from '@/features/progress/messages/mn.json';
import tutor_en from '@/features/tutor/messages/en.json';
import tutor_mn from '@/features/tutor/messages/mn.json';
import type { Messages } from '@/lib/i18n';
import common_en from './en.json';
import common_mn from './mn.json';

const mn: Messages = {
  common: common_mn,
  auth: auth_mn,
  cards: cards_mn,
  desmos: desmos_mn,
  exam: exam_mn,
  home: home_mn,
  journey: journey_mn,
  mistakes: mistakes_mn,
  notifications: notifications_mn,
  onboarding: onboarding_mn,
  planner: planner_mn,
  practice: practice_mn,
  progress: progress_mn,
  tutor: tutor_mn,
};

const en: Messages = {
  common: common_en,
  auth: auth_en,
  cards: cards_en,
  desmos: desmos_en,
  exam: exam_en,
  home: home_en,
  journey: journey_en,
  mistakes: mistakes_en,
  notifications: notifications_en,
  onboarding: onboarding_en,
  planner: planner_en,
  practice: practice_en,
  progress: progress_en,
  tutor: tutor_en,
};

export const MESSAGES: Record<'mn' | 'en', Messages> = { mn, en };
