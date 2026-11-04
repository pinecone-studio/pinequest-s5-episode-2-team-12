import type { Domain } from '@/types';

/** Keep the supplied flat artwork intact; topic props never redraw or dress Suu. */
export function TopicMascot({ topic }: { topic: Domain }) {
  return (
    <span className={`bank-mascot bank-mascot-${topic}`} aria-hidden="true">
      <svg viewBox="0 0 320 210" className="bank-mascot-scene" fill="none">
        <ellipse cx="155" cy="192" rx="73" ry="9" fill="currentColor" opacity="0.08" />
        <g className="bank-mascot-float">
          <image href="/brand/suu-sitting.webp" x="58" y="4" width="192" height="192" />
          {topic === 'alg' && (
            <g className="bank-mascot-prop">
              <rect x="200" y="28" width="106" height="65" rx="14" />
              <text x="253" y="56" textAnchor="middle">
                x + 2 = 5
              </text>
              <text x="253" y="80" textAnchor="middle">
                x = ?
              </text>
              <circle cx="191" cy="98" r="4" />
              <circle cx="181" cy="107" r="2" />
            </g>
          )}
          {topic === 'adv' && (
            <g className="bank-mascot-prop">
              <text x="235" y="46" className="bank-mascot-question">
                ?
              </text>
              <circle cx="228" cy="65" r="4" />
              <circle cx="218" cy="77" r="2" />
              <text x="17" y="109">
                ƒ(x)
              </text>
              <text x="251" y="113">
                x²
              </text>
            </g>
          )}
          {topic === 'psda' && (
            <g className="bank-mascot-prop">
              <rect x="206" y="95" width="99" height="82" rx="12" />
              <path d="M220 109v53h70M227 149l17-15 17 5 25-28" />
              <circle cx="244" cy="134" r="3" />
              <circle cx="261" cy="139" r="3" />
            </g>
          )}
          {topic === 'geo' && (
            <g className="bank-mascot-prop">
              <path d="M213 172l40-74 43 74Z" strokeWidth="3" />
              <path d="M222 172v-12h11" />
              <rect x="20" y="135" width="83" height="21" rx="4" transform="rotate(-12 20 135)" />
              <path d="M32 134v8m14-11v8m14-11v8m14-11v8m14-11v8" />
            </g>
          )}
        </g>
      </svg>
    </span>
  );
}
