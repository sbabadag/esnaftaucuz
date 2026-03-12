import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Award, CheckCircle2, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type BadgeDef = {
  id: string;
  title: string;
  description: string;
  key: 'points' | 'shares' | 'verifications';
  threshold: number;
};

const BADGES: BadgeDef[] = [
  { id: 'first-share', title: 'Ilk Paylasim', description: 'En az 1 fiyat paylas', key: 'shares', threshold: 1 },
  { id: 'helper', title: 'Mahalle Yardimcisi', description: '10 fiyat paylas', key: 'shares', threshold: 10 },
  { id: 'verifier', title: 'Dogrulama Uzmani', description: '5 dogrulama yap', key: 'verifications', threshold: 5 },
  { id: 'point-100', title: 'Puan Avcisi', description: '100 puana ulas', key: 'points', threshold: 100 },
  { id: 'point-500', title: 'Usta Katkici', description: '500 puana ulas', key: 'points', threshold: 500 },
  { id: 'point-1000', title: 'Topluluk Efsanesi', description: '1000 puana ulas', key: 'points', threshold: 1000 },
];

export default function BadgesScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const stats = useMemo(() => {
    const points = Number((user as any)?.points || 0);
    const shares = Number(
      typeof (user as any)?.contributions === 'object'
        ? (user as any)?.contributions?.shares || 0
        : (user as any)?.contributions || 0
    );
    const verifications = Number(
      typeof (user as any)?.contributions === 'object' ? (user as any)?.contributions?.verifications || 0 : 0
    );
    return { points, shares, verifications };
  }, [user]);

  const getValue = (key: BadgeDef['key']) => stats[key];
  const earnedCount = BADGES.filter((badge) => getValue(badge.key) >= badge.threshold).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className="sticky bg-white border-b border-gray-200 p-4 z-10"
        style={{ top: 'env(safe-area-inset-top, 0px)', paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full" aria-label="Geri">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl">Rozetler</h1>
        </div>
      </div>

      <div className="p-4 space-y-3" style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))' }}>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-800">
            <Award className="w-5 h-5 text-amber-500" />
            <span>{earnedCount} / {BADGES.length} rozet kazanildi</span>
          </div>
        </div>

        {BADGES.map((badge) => {
          const current = getValue(badge.key);
          const earned = current >= badge.threshold;
          const progress = Math.min(100, Math.round((current / badge.threshold) * 100));
          return (
            <div key={badge.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{badge.title}</h3>
                  <p className="text-sm text-gray-600">{badge.description}</p>
                </div>
                {earned ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                ) : (
                  <Lock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </div>

              <div className="mt-3">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${earned ? 'bg-green-600' : 'bg-blue-500'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {current} / {badge.threshold}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

