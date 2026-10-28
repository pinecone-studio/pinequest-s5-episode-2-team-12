// Aggregates every messages/*.json. Add a line here when a new feature folder gets messages.

import admin_en from '@/features/admin/messages/en.json';
import admin_mn from '@/features/admin/messages/mn.json';
import auth_en from '@/features/auth/messages/en.json';
import auth_mn from '@/features/auth/messages/mn.json';
import cards_en from '@/features/cards/messages/en.json';
import cards_mn from '@/features/cards/messages/mn.json';
import daily_en from '@/features/daily/messages/en.json';
import daily_mn from '@/features/daily/messages/mn.json';
import desmos_en from '@/features/desmos/messages/en.json';
import desmos_mn from '@/features/desmos/messages/mn.json';
import exam_en from '@/features/exam/messages/en.json';
import exam_mn from '@/features/exam/messages/mn.json';
import flashcards_en from '@/features/flashcards/messages/en.json';
import flashcards_mn from '@/features/flashcards/messages/mn.json';
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
import profile_en from '@/features/profile/messages/en.json';
import profile_mn from '@/features/profile/messages/mn.json';
import progress_en from '@/features/progress/messages/en.json';
import progress_mn from '@/features/progress/messages/mn.json';
import roadmap_en from '@/features/roadmap/messages/en.json';
import roadmap_mn from '@/features/roadmap/messages/mn.json';
import settings_en from '@/features/settings/messages/en.json';
import settings_mn from '@/features/settings/messages/mn.json';
import shop_en from '@/features/shop/messages/en.json';
import shop_mn from '@/features/shop/messages/mn.json';
import social_en from '@/features/social/messages/en.json';
import social_mn from '@/features/social/messages/mn.json';
import tutor_en from '@/features/tutor/messages/en.json';
import tutor_mn from '@/features/tutor/messages/mn.json';
import type { Messages } from '@/lib/i18n';
import common_en from './en.json';
import common_mn from './mn.json';

const mn: Messages = {
  common: common_mn,
  admin: admin_mn,
  auth: auth_mn,
  cards: cards_mn,
  daily: daily_mn,
  desmos: desmos_mn,
  exam: exam_mn,
  flashcards: flashcards_mn,
  home: home_mn,
  journey: journey_mn,
  mistakes: mistakes_mn,
  notifications: notifications_mn,
  onboarding: onboarding_mn,
  planner: planner_mn,
  practice: practice_mn,
  profile: profile_mn,
  progress: progress_mn,
  roadmap: roadmap_mn,
  settings: settings_mn,
  shop: shop_mn,
  social: social_mn,
  tutor: tutor_mn,
};

const en: Messages = {
  common: common_en,
  admin: admin_en,
  auth: auth_en,
  cards: cards_en,
  daily: daily_en,
  desmos: desmos_en,
  exam: exam_en,
  flashcards: flashcards_en,
  home: home_en,
  journey: journey_en,
  mistakes: mistakes_en,
  notifications: notifications_en,
  onboarding: onboarding_en,
  planner: planner_en,
  practice: practice_en,
  profile: profile_en,
  progress: progress_en,
  roadmap: roadmap_en,
  settings: settings_en,
  shop: shop_en,
  social: social_en,
  tutor: tutor_en,
};

export const MESSAGES: Record<'mn' | 'en', Messages> = { mn, en };
