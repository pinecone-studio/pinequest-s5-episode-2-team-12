// View model for the map: one entry per stop with everything a pin/card needs.
import type { T } from '@/lib/i18n';
import { REGIONS, STOPS } from '../stops';
import { topicById } from '../topics';
import type { Region, RoadmapState, Stop, StopProgress, StopStatus, Topic } from '../types';
import { neededToPass } from './scoring';
import { setLengthAt } from './state';
import { frontier, stopStatuses } from './unlock';

export type StopView = {
  stop: Stop;
  topic: Topic;
  region: Region;
  status: StopStatus;
  progress: StopProgress;
  /** Best correct vs needed to pass, for the ring on the current stop. */
  ring: { have: number; need: number; total: number };
};

export function stopViews(s: RoadmapState, open: boolean): StopView[] {
  const st = stopStatuses(s.stops, open);
  return STOPS.map((stop) => {
    const progress = s.stops.find((p) => p.no === stop.no)!;
    const total = setLengthAt(s, stop.no);
    return {
      stop,
      topic: topicById(stop.no)!,
      region: REGIONS.find((r) => r.id === stop.region)!,
      status: st[stop.no],
      progress,
      ring: { have: Math.round(progress.best * total), need: neededToPass(total), total },
    };
  });
}

export { frontier };

/** «5-р зогсоол, Улиастай, Шугаман тэнцэтгэл биш, түгжээтэй» (+ stars when completed). `t` = roadmap namespace. */
export function stopAriaLabel(v: Pick<StopView, 'stop' | 'topic' | 'status' | 'progress'>, t: T): string {
  const parts = [t('stopNo', { n: v.stop.no }), v.stop.place, v.topic.title, t(`status.${v.status}`)];
  if (v.status === 'completed' && v.progress.stars) parts.push(t('status.stars', { n: v.progress.stars }));
  return parts.join(', ');
}
