'use client';

interface LevelUpModalProps {
  level: number;
  title: string;
  isOpen: boolean;
  onClose: () => void;
}

export function LevelUpModal({ level, title, isOpen, onClose }: LevelUpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border p-6 rounded-3xl max-w-sm w-full text-center space-y-4 shadow-xl">
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-extrabold">Түвшин ахилаа!</h2>
        <p className="text-muted-foreground">
          Та амжилттай дэвшиж <span className="font-bold text-primary">{title}</span> (Түвшин {level}) боллоо!
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition"
        >
          Үргэлжлүүлэх
        </button>
      </div>
    </div>
  );
}
