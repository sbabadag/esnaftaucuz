import { useAppVersion } from '../hooks/useAppVersion';
import { cn } from './ui/utils';

type Props = {
  className?: string;
  /** true: tek satır ortalanmış (ayarlar altı gibi) */
  centered?: boolean;
};

const buildTime =
  typeof __APP_BUILD_TIME__ !== 'undefined' && __APP_BUILD_TIME__
    ? __APP_BUILD_TIME__
    : null;

/**
 * Küçük sürüm / yapı numarası metni (Hakkında, Ayarlar).
 */
export function AppVersionBadge({ className, centered }: Props) {
  const { version, nativeVersion, build } = useAppVersion();
  const nativeDiffers =
    nativeVersion != null && nativeVersion !== version;

  return (
    <p
      className={cn(
        'text-xs text-gray-400 tabular-nums',
        centered && 'text-center',
        className,
      )}
      aria-label={`Uygulama paketi sürümü ${version}${build ? `, yapı ${build}` : ''}`}
    >
      Sürüm {version}
      {build != null ? ` · Yapı ${build}` : null}
      {buildTime ? (
        <span className="block mt-0.5 text-[10px] text-gray-300">
          Build: {buildTime}
        </span>
      ) : null}
      {nativeVersion ? (
        <span className={cn('block mt-0.5 text-[10px]', nativeDiffers ? 'text-amber-600' : 'text-gray-300')}>
          Native: {nativeVersion}{build ? ` (${build})` : ''}
        </span>
      ) : null}
    </p>
  );
}
