// URL filters shared by the admin pages (server) and their views (client).
export const FEEDBACK_FILTERS = ['new', 'approved', 'rejected', 'all'] as const;
export type FeedbackFilter = (typeof FEEDBACK_FILTERS)[number];

export function feedbackFilter(value: string | string[] | undefined): FeedbackFilter {
  return FEEDBACK_FILTERS.find((f) => f === value) ?? 'new';
}
