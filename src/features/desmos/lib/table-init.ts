import type { TableInit } from '@/types';

/** Decode the existing content format used by the five prototype hacks. */
export function toGraphInit(rows: string[]): (string | TableInit)[] {
  return rows.map((row) => {
    if (!row.startsWith('TABLE:')) return row;
    const cells = row.slice(6).split(';');
    const table: [number, number][] = cells
      .filter((cell) => cell !== 'R')
      .map((cell) => {
        const [x, y] = cell.split(',').map(Number);
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Хүснэгтийн өгөгдөл буруу байна');
        return [x, y];
      });
    return { table, regression: cells.includes('R') };
  });
}
