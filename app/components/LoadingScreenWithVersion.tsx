import { BuildVersionBadge } from './BuildVersionBadge';

export function LoadingScreenWithVersion({ message }: { message: string }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 pb-24">
      <div className="text-gray-500">{message}</div>
      <div className="absolute bottom-10 left-4 right-4 mx-auto w-full max-w-sm">
        <BuildVersionBadge variant="onLight" />
      </div>
    </div>
  );
}
