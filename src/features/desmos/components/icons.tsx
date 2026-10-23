import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement> & { size?: number };
const icon = (path: string) =>
  function Icon({ size = 18, ...props }: Props) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <path d={path} />
      </svg>
    );
  };
export const LuPlus = icon('M12 5v14M5 12h14');
export const LuMinus = icon('M5 12h14');
export const LuX = icon('m6 6 12 12M6 18 18 6');
export const LuHouse = icon('m3 10 9-7 9 7v11h-7v-7h-4v7H3Z');
export const LuEye = icon('M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm7 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0');
export const LuEyeOff = icon('m3 3 18 18M9 5c7-2 13 7 13 7l-3 4M6 6l-4 6s5 9 13 6');
export const LuKeyboard = icon('M2 5h20v14H2ZM5 9h1m3 0h1m3 0h1m3 0h1M5 13h1m3 0h1m3 0h1m3 0h1M7 16h10');
export const LuTable = icon('M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18');
export const LuTriangleAlert = icon('M12 3 2 21h20ZM12 9v5m0 3v1');
export const LuSquareFunction = icon('M3 3h18v18H3ZM8 16l3-8h4m-7 4h6');
export const LuPlay = icon('m7 3 14 9-14 9Z');
export const LuCheck = icon('m4 12 5 5L20 6');
export const LuSpline = icon('M3 18c8 0 2-12 10-12h8');
