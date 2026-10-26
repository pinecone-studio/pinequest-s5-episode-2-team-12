import mn from '../messages/mn.json';

/** Parser errors remain Mongolian as required by the calculator contract. */
export function mathMessage(key: string, values: Record<string, string | number> = {}): string {
  const text = mn.ui[key.slice(3) as keyof typeof mn.ui] || key;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}
