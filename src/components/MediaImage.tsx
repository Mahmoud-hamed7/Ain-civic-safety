import { useEffect, useState } from 'react';
import { fetchMediaBlob, getMediaUrl } from '../utils/media';

type MediaImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
  /** When true, load via authenticated API request (default for uploads). */
  authenticated?: boolean;
};

/**
 * Renders API-hosted images. Relative paths are resolved against VITE_API_BASE_URL.
 * Authenticated mode fetches with Bearer token so protected uploads and ngrok work.
 */
export default function MediaImage({
  src,
  authenticated = true,
  alt = '',
  className,
  ...props
}: MediaImageProps) {
  const directUrl = getMediaUrl(src);
  const [displaySrc, setDisplaySrc] = useState(directUrl);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    directUrl ? 'loading' : 'error',
  );

  useEffect(() => {
    const nextDirect = getMediaUrl(src);
    if (!src || !nextDirect) {
      setDisplaySrc('');
      setStatus('error');
      return;
    }

    setDisplaySrc(nextDirect);
    setStatus('loading');

    if (!authenticated) {
      setStatus('ready');
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    void (async () => {
      objectUrl = await fetchMediaBlob(src);
      if (cancelled) return;
      if (objectUrl) {
        setDisplaySrc(objectUrl);
        setStatus('ready');
      } else {
        setStatus('ready');
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, authenticated]);

  if (!src) return null;

  if (status === 'error' || !displaySrc) {
    return (
      <div
        className={`bg-gray-800 flex items-center justify-center text-[10px] text-gray-500 ${className ?? ''}`}
        title={alt || 'Image unavailable'}
      >
        {alt ? alt.slice(0, 12) : '—'}
      </div>
    );
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      {...props}
      onLoad={() => setStatus('ready')}
      onError={() => {
        if (!authenticated) {
          setStatus('error');
          return;
        }
        void fetchMediaBlob(src).then((blob) => {
          if (blob) {
            setDisplaySrc(blob);
            setStatus('ready');
          } else {
            setStatus('error');
          }
        });
      }}
    />
  );
}
