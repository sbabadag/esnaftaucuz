import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { Button } from '../ui/button';
import { merchantProductsAPI } from '../../services/supabase-api';
import { useAuth } from '../../contexts/AuthContext';
import { Capacitor } from '@capacitor/core';

type DailyRow = {
  date: string;
  count: number;
};

type ProductRow = {
  merchant_product_id: string;
  product_id: string;
  product_name: string;
  count: number;
};

export default function MerchantReportsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNativePlatform = Capacitor.isNativePlatform();
  const headerTopOffsetPx = isNativePlatform ? 14 : 0;
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [productRows, setProductRows] = useState<ProductRow[]>([]);

  const merchantStatus = String((user as any)?.merchant_subscription_status || '').toLowerCase();
  const merchantPlan = String((user as any)?.merchant_subscription_plan || '').trim();
  const isMerchant =
    (user as any)?.is_merchant === true ||
    merchantStatus === 'active' ||
    merchantStatus === 'past_due' ||
    merchantPlan.length > 0;

  const loadReport = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      if (!isMerchant) {
        setIsLoading(false);
        navigate('/app/explore', { replace: true });
        return;
      }

      try {
        setIsLoading(true);
        setLoadError(null);
        const report: any = await Promise.race([
          merchantProductsAPI.getDailyClickReport(user.id, 14),
          new Promise((resolve) =>
            setTimeout(() => resolve({ daily: [], products: [] }), 4000)
          ),
        ]);
        setDailyRows(Array.isArray(report?.daily) ? report.daily : []);
        setProductRows(Array.isArray(report?.products) ? report.products : []);
      } catch (error) {
        console.error('Merchant report load failed:', error);
        setLoadError(null);
        setDailyRows([]);
        setProductRows([]);
      } finally {
        setIsLoading(false);
      }
  };

  useEffect(() => {
    loadReport();
  }, [isMerchant, navigate, user?.id]);

  const totalClicks = useMemo(
    () => dailyRows.reduce((sum, row) => sum + (Number(row.count) || 0), 0),
    [dailyRows]
  );

  const maxDailyCount = useMemo(
    () => Math.max(1, ...dailyRows.map((r) => Number(r.count) || 0)),
    [dailyRows]
  );

  const formatDay = (day: string) => {
    const date = new Date(`${day}T00:00:00`);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-gray-50 relative">
      <div
        className="bg-white border-b border-gray-200 z-20 relative"
        style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + ${headerTopOffsetPx}px)` }}
      >
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Raporlar</h1>
            <p className="text-xs text-gray-500">Son 14 gün tıklanma istatistikleri</p>
          </div>
        </div>
      </div>

      <div
        className="h-full overflow-y-auto overscroll-none p-4 space-y-4 pb-28"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-700 mb-2">
            <BarChart3 className="w-4 h-4" />
            <span className="text-sm font-medium">Toplam Tıklanma (14 gün)</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{totalClicks}</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Günlük Tıklanma</h2>
          {loadError && !isLoading && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-red-100 bg-red-50 p-2">
              <span className="text-xs text-red-700">{loadError}</span>
              <Button size="sm" variant="outline" onClick={loadReport}>
                Yeniden Dene
              </Button>
            </div>
          )}
          {isLoading ? (
            <div className="text-sm text-gray-500 py-2">Yükleniyor...</div>
          ) : dailyRows.length === 0 ? (
            <div className="text-sm text-gray-500 py-2">Henüz tıklanma verisi yok</div>
          ) : (
            <div className="space-y-2">
              {dailyRows.map((row) => {
                const pct = Math.round(((Number(row.count) || 0) / maxDailyCount) * 100);
                return (
                  <div key={row.date}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600">{formatDay(row.date)}</span>
                      <span className="font-medium text-gray-900">{row.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-blue-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Ürün Bazlı Tıklanma</h2>
          {isLoading ? (
            <div className="text-sm text-gray-500 py-2">Yükleniyor...</div>
          ) : productRows.length === 0 ? (
            <div className="text-sm text-gray-500 py-2">Henüz ürün tıklanması yok</div>
          ) : (
            <div className="space-y-2">
              {productRows.slice(0, 20).map((row) => (
                <div
                  key={row.merchant_product_id}
                  className="flex items-center justify-between rounded-md border border-gray-100 p-2"
                >
                  <span className="text-sm text-gray-800 truncate pr-3">{row.product_name}</span>
                  <span className="text-sm font-semibold text-blue-600">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
