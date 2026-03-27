import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

type Props = {
  className?: string;
  /** Light text on dark bg (splash) vs dark on light (loading) */
  variant?: 'onDark' | 'onLight';
};

export function BuildVersionBadge({ className = '', variant = 'onLight' }: Props) {
  const [line1, setLine1] = useState<string>('');
  const [line2, setLine2] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const isNative = Capacitor.isNativePlatform();
      const platform = Capacitor.getPlatform();
      try {
        if (isNative) {
          const info = await App.getInfo();
          if (!cancelled) {
            setLine1(`Sürüm ${info.version}  ·  build ${info.build}`);
            setLine2('');
          }
          return;
        }
      } catch (e: any) {
        if (!cancelled) {
          setLine1(`Native (${platform}) · getInfo hatası`);
          setLine2(String(e?.message || '').substring(0, 60));
        }
        return;
      }
      if (!cancelled) {
        setLine1(`Web · ${platform}`);
        setLine2('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const muted =
    variant === 'onDark' ? 'text-white/75' : 'text-gray-500';

  if (!line1) {
    return (
      <div className={`text-center text-[11px] ${muted} ${className}`}>
        Sürüm bilgisi yükleniyor…
      </div>
    );
  }

  return (
    <div className={`text-center text-[11px] leading-snug ${className}`}>
      <p className={variant === 'onDark' ? 'font-medium text-white/95' : 'font-medium text-gray-700'}>
        {line1}
      </p>
      {line2 ? <p className={`mt-0.5 ${muted}`}>{line2}</p> : null}
    </div>
  );
}
