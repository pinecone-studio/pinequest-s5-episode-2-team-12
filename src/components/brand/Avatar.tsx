// A student's avatar: a preset (Суу on a colored disc) or, without one, their initial on green.
import { avatarById } from './avatars';
import { CatHead } from './Cat';

export function Avatar({
  name,
  avatarId,
  size = 42,
}: {
  name: string;
  avatarId?: string | null;
  size?: number;
}) {
  const preset = avatarById(avatarId);
  return (
    <span
      className="grid place-items-center overflow-hidden rounded-full font-bold text-[var(--c-on-leaf)] shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: preset?.bg ?? 'linear-gradient(135deg, var(--c-leaf), var(--c-leaf-2))',
      }}
      aria-hidden="true"
    >
      {preset ? (
        <CatHead size={Math.round(size * 0.78)} mood={preset.mood} />
      ) : (
        (name.trim()[0] ?? 'S').toUpperCase()
      )}
    </span>
  );
}
