import type { AdminOverview } from '../queries';

export type SyntheticAccount = {
  id: string;
  created_at: string;
  is_anonymous?: boolean;
  onboarded?: boolean;
};
export function excludeSyntheticAccounts(
  overview: AdminOverview,
  accounts: SyntheticAccount[],
  now = Date.now(),
): AdminOverview {
  const subtract = (count: number, n: number) => Math.max(0, count - n);
  const members = accounts.filter((account) => !account.is_anonymous);
  return {
    ...overview,
    users: subtract(overview.users, members.length),
    guests: subtract(overview.guests, accounts.length - members.length),
    onboarded: subtract(overview.onboarded, accounts.filter((account) => account.onboarded).length),
    new_7d: subtract(
      overview.new_7d,
      members.filter((account) => Date.parse(account.created_at) > now - 7 * 86400000).length,
    ),
    days: overview.days.map((day) => ({
      ...day,
      signups: subtract(
        day.signups,
        members.filter(
          (account) =>
            new Intl.DateTimeFormat('en-CA', {
              timeZone: 'Asia/Ulaanbaatar',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).format(new Date(account.created_at)) === day.day,
        ).length,
      ),
    })),
  };
}
