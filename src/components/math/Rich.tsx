import { Fragment, useMemo } from 'react';
import { parseRich } from './parse-rich';
import { Tex } from './Tex';

/** Text with inline math in $…$, **bold**, images/videos, and newlines. */
export function Rich({ text, className = '' }: { text: string; className?: string }) {
  // Эхлээд медиатай хэсгийг эх хэлбэрээр нь салгах Regex
  const mediaRegex = /!\[(.*?)\]\((.+?\.(?:mp4|webm|gif|png|jpg|jpeg|svg))\)/gi;

  const renderedContent = useMemo(() => {
    if (!text) return null;

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = mediaRegex.exec(text)) !== null) {
      // Медиагийн өмнөх текстийг parseRich руу явуулж хэвлэх
      if (match.index > lastIndex) {
        const textBefore = text.slice(lastIndex, match.index);
        elements.push(<ParsedText key={`text-${lastIndex}`} text={textBefore} />);
      }

      const alt = match[1] || 'Media';
      const url = match[2].trim();
      const isVideo = url.endsWith('.mp4') || url.endsWith('.webm');

      if (isVideo) {
        elements.push(
          <video
            key={`media-${match.index}`}
            src={url}
            autoPlay
            loop
            muted
            playsInline
            className="mx-auto my-3 max-h-96 w-full rounded-2xl border border-border object-cover shadow-md"
          >
            {alt}
          </video>,
        );
      } else {
        elements.push(
          <img
            key={`media-${match.index}`}
            src={url}
            alt={alt}
            className="mx-auto my-3 max-h-60 rounded-2xl border border-border object-contain shadow-md"
          />,
        );
      }

      lastIndex = mediaRegex.lastIndex;
    }

    // Төгсгөлийн текстийг parseRich руу явуулах
    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex);
      elements.push(<ParsedText key={`text-${lastIndex}`} text={remainingText} />);
    }

    return elements;
  }, [text]);

  return <span className={className}>{renderedContent}</span>;
}

/** Текстийг $...$, **...**, \n парс хийх хэсэг */
function ParsedText({ text }: { text: string }) {
  const parts = useMemo(() => parseRich(text), [text]);

  return (
    <>
      {parts.map((p, i) =>
        p.k === 'm' ? (
          <Tex key={i} tex={p.v} />
        ) : p.k === 'b' ? (
          <strong key={i} className="font-semibold text-ink">
            {p.v}
          </strong>
        ) : (
          <Fragment key={i}>
            {p.v.split('\n').map((line, j, arr) => (
              <Fragment key={j}>
                {line}
                {j < arr.length - 1 && <br />}
              </Fragment>
            ))}
          </Fragment>
        ),
      )}
    </>
  );
}