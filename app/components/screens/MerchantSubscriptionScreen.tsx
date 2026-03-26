import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { BuildVersionBadge } from '../BuildVersionBadge';
import { useAuth } from '../../contexts/AuthContext';
import { merchantSubscriptionAPI, setMerchantSubscriptionCache } from '../../services/supabase-api';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { GooglePlayBilling, type GooglePlayRestoredPurchase } from '../../lib/google-play-billing';
import { supabase, safeGetSession } from '../../lib/supabase';

type MerchantSubscriptionStatus = 'inactive' | 'active' | 'past_due' | 'canceled';

const MONTHLY_FEE_TL = 900;
const YEARLY_FEE_TL = 9000;
const TRIAL_DAYS = 10;
const MERCHANT_SUBSCRIPTION_ONBOARDING_KEY = 'merchant-subscription-onboarding-user';
const MERCHANT_SIGNUP_INTENT_KEY = 'merchant-signup-intent';

const resolveMerchantRole = (profile: any): boolean => {
  const explicit = profile?.is_merchant === true;
  const status = String(profile?.merchant_subscription_status || '').toLowerCase();
  const hasActiveSubscription = status === 'active' || status === 'past_due';
  const hasMerchantPlan = String(profile?.merchant_subscription_plan || '').trim().length > 0;
  return explicit || hasActiveSubscription || hasMerchantPlan;
};

/** Align UI plan selection with DB / Play plan id (monthly vs yearly). */
const billingMonthsFromPlan = (plan: string | undefined | null): 1 | 12 => {
  const p = String(plan || '').toLowerCase();
  if (
    p.includes('year') ||
    p.includes('yillik') ||
    p.includes('yıllık') ||
    p.includes('annual') ||
    p.includes('12')
  ) {
    return 12;
  }
  return 1;
};

export default function MerchantSubscriptionScreen() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const isMerchant = resolveMerchantRole(user);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [statusData, setStatusData] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const setLocalMerchantFlag = () => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const cached = JSON.parse(raw);
        cached.is_merchant = true;
        cached.merchant_subscription_status = 'active';
        localStorage.setItem('user', JSON.stringify(cached));
      }
      if (user?.email) {
        localStorage.setItem('merchant-hint-' + user.email, '1');
      }
    } catch { /* best effort */ }
  };

  // Prevents stale DB reads from overwriting a confirmed-active optimistic state.
  const purchaseConfirmedAtRef = useRef<number>(0);
  const PROTECTION_WINDOW_MS = 120_000;

  const currentStatus: MerchantSubscriptionStatus = (() => {
    const raw = String(statusData?.merchant_subscription_status || '').toLowerCase();
    if (raw === 'active' || raw === 'past_due' || raw === 'canceled') return raw as MerchantSubscriptionStatus;
    if (statusData?.is_active) return 'active';
    return 'inactive';
  })();
  const feeTl = statusData?.merchant_subscription_fee_tl || MONTHLY_FEE_TL;
  const [selectedBillingMonths, setSelectedBillingMonths] = useState<1 | 12>(1);
  const periodEndDate = statusData?.merchant_subscription_current_period_end
    ? new Date(statusData.merchant_subscription_current_period_end)
    : null;
  const daysRemaining = periodEndDate
    ? Math.max(0, Math.ceil((periodEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  const isSubscriptionActive = !!statusData?.is_active || currentStatus === 'active' || currentStatus === 'past_due';
  const isRenewalLocked = isSubscriptionActive && daysRemaining > 7;
  const isTrialPlan = String(statusData?.merchant_subscription_plan || '').includes('trial');
  const onboardingRequired = (() => {
    try {
      const byUser = !!user?.id && localStorage.getItem(MERCHANT_SUBSCRIPTION_ONBOARDING_KEY) === user.id;
      const byIntent = localStorage.getItem(MERCHANT_SIGNUP_INTENT_KEY) === '1';
      return byUser || byIntent;
    } catch {
      return false;
    }
  })();

  const statusLabel = useMemo(() => {
    switch (currentStatus) {
      case 'active':
        return 'Aktif';
      case 'past_due':
        return 'Ödeme Bekleniyor';
      case 'canceled':
        return 'İptal Edildi';
      case 'inactive':
      default:
        return 'Pasif';
    }
  }, [currentStatus]);

  const isStatusActive = (s: any) =>
    !!s?.is_active ||
    ['active', 'past_due'].includes(String(s?.merchant_subscription_status || '').toLowerCase());

  const loadData = async (showLoader: boolean = true) => {
    if (!user?.id) return null;
    try {
      if (showLoader) setIsLoading(true);

      let status: any = null;
      let paymentList: any[] = [];

      try {
        status = await merchantSubscriptionAPI.getStatus(user.id);
      } catch (e) {
        console.warn('⚠️ getStatus failed, trying direct DB:', e);
        try {
          const { data, error } = await supabase
            .from('users')
            .select('id, is_merchant, merchant_subscription_status, merchant_subscription_plan, merchant_subscription_fee_tl, merchant_subscription_current_period_start, merchant_subscription_current_period_end')
            .eq('id', user.id)
            .single();
          if (!error && data) {
            const dbSt = String(data.merchant_subscription_status || '').toLowerCase();
            status = { ...data, is_active: dbSt === 'active' || dbSt === 'past_due' };
          }
        } catch { /* give up */ }
      }

      try {
        paymentList = await merchantSubscriptionAPI.getPayments(user.id, 10);
      } catch { /* payments are non-critical */ }

      if (status !== null) {
        const inProtectionWindow =
          Date.now() - purchaseConfirmedAtRef.current < PROTECTION_WINDOW_MS;

        setStatusData((prev: any) => {
          if (inProtectionWindow && isStatusActive(prev) && !isStatusActive(status)) {
            console.log('🛡️ Protecting confirmed-active state from stale DB read');
            return prev;
          }
          return status;
        });
      }
      setPayments(paymentList);
      return { status, paymentList };
    } catch (error: any) {
      console.error('Subscription screen load error:', error);
      return null;
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  // When subscription is active, highlight the actual plan from the server (not last click).
  useEffect(() => {
    if (!statusData) return;
    const st = String(statusData.merchant_subscription_status || '').toLowerCase();
    const active =
      !!statusData.is_active || st === 'active' || st === 'past_due';
    if (active && statusData.merchant_subscription_plan) {
      setSelectedBillingMonths(billingMonthsFromPlan(statusData.merchant_subscription_plan));
    }
  }, [
    statusData?.merchant_subscription_plan,
    statusData?.merchant_subscription_status,
    statusData?.is_active,
  ]);

  useEffect(() => {
    let cancelled = false;
    try {
      if (user?.id && localStorage.getItem(MERCHANT_SIGNUP_INTENT_KEY) === '1') {
        localStorage.setItem(MERCHANT_SUBSCRIPTION_ONBOARDING_KEY, user.id);
      }
    } catch {
      // best effort
    }

    const bootstrap = async () => {
      const loaded = await loadData(true);
      if (cancelled) return;

      // Redirect only after we have an authoritative status snapshot.
      if (!loaded) return;
      const status = loaded.status || {};
      const resolvedMerchantByStatus =
        String(status?.merchant_subscription_status || '').toLowerCase() === 'active' ||
        String(status?.merchant_subscription_status || '').toLowerCase() === 'past_due' ||
        String(status?.merchant_subscription_plan || '').trim().length > 0;
      if (!isMerchant && !resolvedMerchantByStatus && !onboardingRequired) {
        toast.error('Bu sayfa sadece esnaf hesapları içindir');
        navigate('/app/profile', { replace: true });
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [isMerchant, onboardingRequired, user?.id]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    html.classList.add('merchant-subscription-lock');
    body.classList.add('merchant-subscription-lock');
    root?.classList.add('merchant-subscription-lock');

    return () => {
      html.classList.remove('merchant-subscription-lock');
      body.classList.remove('merchant-subscription-lock');
      root?.classList.remove('merchant-subscription-lock');
    };
  }, []);

  const handleRefresh = async () => {
    if (!user?.id) return;
    try {
      setIsRefreshing(true);
      if (refreshUser) await refreshUser();
      await loadData(false);
      toast.success('Abonelik durumu güncellendi');
    } catch {
      // handled in loadData
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGooglePlayPayment = async () => {
    if (!user?.id) {
      toast.error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      toast.error('Abonelik ödemesi sadece Android Google Play üzerinden alınır.');
      return;
    }

    const productId = merchantSubscriptionAPI.getGooglePlayProductId(selectedBillingMonths);
    if (!productId) {
      toast.error('Google Play ürün ID yapılandırması eksik.');
      return;
    }

    try {
      setIsPaying(true);
      toast.info('Google Play ödeme ekranı açılıyor...');

      const purchase = await GooglePlayBilling.purchaseSubscription({ productId });
      const purchasedMonths = selectedBillingMonths;

      let confirmResult: any = null;
      try {
        confirmResult = await merchantSubscriptionAPI.confirmGooglePlayPurchase({
          purchaseToken: purchase.purchaseToken,
          productId: purchase.productId || productId,
          orderId: purchase.orderId,
          purchaseTime: purchase.purchaseTime,
        });
      } catch (confirmErr: any) {
        console.error('confirmGooglePlayPurchase error:', confirmErr);
        toast.error(
          confirmErr?.message ||
            'Sunucu ödemeyi doğrulayamadı. İnternet veya Play yapılandırmasını kontrol edin.',
        );
        throw confirmErr;
      }

      try {
        localStorage.removeItem(MERCHANT_SUBSCRIPTION_ONBOARDING_KEY);
      } catch {
        // ignore storage errors
      }

      purchaseConfirmedAtRef.current = Date.now();
      setSelectedBillingMonths(purchasedMonths);

      let activated = false;

      if (confirmResult?.ok && confirmResult?.active) {
        activated = true;
        const planCode =
          confirmResult.billingPeriodMonths >= 12
            ? 'merchant_google_play_yearly'
            : 'merchant_google_play_monthly';
        setStatusData((prev: any) => ({
          ...(prev || {}),
          id: user.id,
          is_merchant: true,
          merchant_subscription_status: confirmResult.status || 'active',
          merchant_subscription_plan: planCode,
          merchant_subscription_fee_tl: confirmResult.amountTl || (purchasedMonths >= 12 ? YEARLY_FEE_TL : MONTHLY_FEE_TL),
          merchant_subscription_current_period_start: new Date().toISOString(),
          merchant_subscription_current_period_end: confirmResult.periodEnd || null,
          is_active: true,
        }));
        const months = (confirmResult.billingPeriodMonths ?? purchasedMonths) >= 12 ? 12 : 1;
        setSelectedBillingMonths(months as 1 | 12);
      } else if (confirmResult?.ok && !confirmResult?.active) {
        toast.warning(
          `Google Play durumu: ${confirmResult?.googleSubscriptionState || 'bilinmiyor'}. Bir süre sonra Yenile deneyin.`,
        );
      }

      if (activated) {
        setMerchantSubscriptionCache(true);
        toast.success('Abonelik Google Play ile aktif edildi!');
        setLocalMerchantFlag();
        await new Promise((r) => setTimeout(r, 3000));
        try { await loadData(false); } catch { /* best effort */ }
        try { if (refreshUser) await refreshUser(); } catch { /* best effort */ }
      } else {
        await new Promise((r) => setTimeout(r, 2500));
        for (let attempt = 0; attempt < 12; attempt++) {
          const loaded = await loadData(false);
          const s = loaded?.status as any;
          if (isStatusActive(s)) {
            activated = true;
            setMerchantSubscriptionCache(true);
            if (s.merchant_subscription_plan) {
              setSelectedBillingMonths(billingMonthsFromPlan(s.merchant_subscription_plan));
            }
            break;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }

        await new Promise((r) => setTimeout(r, 1000));
        try { if (refreshUser) await refreshUser(); } catch { /* best effort */ }
        try { await loadData(false); } catch { /* best effort */ }

        if (activated) {
          toast.success('Abonelik Google Play ile aktif edildi!');
        } else {
          toast.error(
            'Abonelik sunucuda görünmüyor. Yenile’ye basın; düzelmezse Supabase edge function ve Play API ayarlarını kontrol edin.',
          );
        }
      }
    } catch (error: any) {
      console.error('Google Play payment error:', error);
      const errText = String(error?.message || '').toLowerCase();
      if (errText.includes('iptal')) {
        toast.error('Satın alma işlemi iptal edildi.');
        return;
      }
      toast.error(error.message || 'Google Play abonelik işlemi tamamlanamadı');
    } finally {
      setIsPaying(false);
    }
  };

  const handleStartTrial = async () => {
    if (!user?.id) return;
    try {
      setIsStartingTrial(true);
      const trialResult = await merchantSubscriptionAPI.startTrial(user.id, TRIAL_DAYS);

      purchaseConfirmedAtRef.current = Date.now();

      if (trialResult) {
        setStatusData({
          ...trialResult,
          is_active: true,
        });
      }

      try {
        localStorage.removeItem(MERCHANT_SUBSCRIPTION_ONBOARDING_KEY);
      } catch {
        // ignore storage errors
      }

      toast.success(`${TRIAL_DAYS} günlük deneme aboneliği başlatıldı.`);
      setLocalMerchantFlag();
      await new Promise((r) => setTimeout(r, 2000));
      try { if (refreshUser) await refreshUser(); } catch { /* best effort */ }
      try { await loadData(false); } catch { /* best effort */ }
    } catch (error: any) {
      console.error('Start trial error:', error);
      toast.error(error.message || 'Deneme aboneliği başlatılamadı');
    } finally {
      setIsStartingTrial(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (!user?.id) {
      toast.error('Oturum bulunamadı.');
      return;
    }
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      toast.error('Satın alma geri yükleme sadece Android üzerinden çalışır.');
      return;
    }

    try {
      setIsRestoring(true);
      toast.info('Google Play satın almaları sorgulanıyor...');

      const result = await GooglePlayBilling.restorePurchases();
      const purchases: GooglePlayRestoredPurchase[] = JSON.parse(result.purchases || '[]');

      if (!purchases.length) {
        toast.warning('Google Play hesabınızda aktif abonelik bulunamadı.');
        return;
      }

      toast.info(`${purchases.length} satın alma bulundu. Sunucuya gönderiliyor...`);

      let confirmedAny = false;
      const errors: string[] = [];

      const sbUrl = String(import.meta.env.VITE_SUPABASE_URL || '');
      const sbAnon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');

      let accessToken = '';
      try {
        const { data: refreshed } = await Promise.race([
          supabase.auth.refreshSession(),
          new Promise<any>((r) => setTimeout(() => r({ data: null }), 6000)),
        ]);
        accessToken = refreshed?.session?.access_token || '';
      } catch { /* fallback below */ }
      if (!accessToken) {
        const safe = await safeGetSession();
        accessToken = safe.accessToken;
      }
      if (!accessToken) {
        toast.error('Oturum bulunamadı. Lütfen uygulamadan çıkıp tekrar giriş yapın.', { duration: 8000 });
        return;
      }
      toast.info('Oturum bulundu, devam ediliyor...', { duration: 3000 });

      for (const p of purchases) {
        const stateLabels: Record<number, string> = { 0: 'PURCHASED', 1: 'PENDING', 2: 'UNSPECIFIED' };
        const stateLabel = stateLabels[p.purchaseState] || `UNKNOWN(${p.purchaseState})`;

        try {
          toast.info(`${p.productId} (${stateLabel}) doğrulanıyor...`, { duration: 8000 });

          if (p.purchaseState === 1) {
            errors.push(`${p.productId}: Satın alma PENDING (beklemede) - henüz tamamlanmamış. Google Play'den ödemeyi tamamlayın.`);
            continue;
          }

          toast.info('Sunucuya gönderiliyor...', { duration: 5000 });
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          let res: Response;
          try {
            res = await fetch(`${sbUrl}/functions/v1/merchant-subscription-google-confirm`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: sbAnon,
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                purchaseToken: p.purchaseToken,
                productId: p.productId,
                orderId: p.orderId || null,
                purchaseTime: p.purchaseTime || null,
              }),
              signal: controller.signal,
            });
          } catch (fetchErr: any) {
            clearTimeout(timeoutId);
            const msg = fetchErr?.name === 'AbortError' ? '15sn timeout - sunucu yanıt vermedi' : (fetchErr?.message || String(fetchErr));
            errors.push(`${p.productId}: Fetch hatası: ${msg}`);
            continue;
          }
          clearTimeout(timeoutId);

          const rawText = await res.text().catch(() => '');
          toast.info(`Sunucu yanıtı: HTTP ${res.status}`, { duration: 5000 });

          let json: any = null;
          try { json = rawText ? JSON.parse(rawText) : null; } catch { /* */ }

          if (!res.ok) {
            const errDetail = json?.error || json?.details || rawText?.substring(0, 200) || `HTTP ${res.status}`;
            errors.push(`${p.productId}: ${errDetail}`);
            continue;
          }

          const confirmResult = json;
          if (confirmResult?.ok) {
            confirmedAny = true;
            purchaseConfirmedAtRef.current = Date.now();

            if (confirmResult.active) {
              const planCode =
                (confirmResult.billingPeriodMonths ?? 1) >= 12
                  ? 'merchant_google_play_yearly'
                  : 'merchant_google_play_monthly';
              setStatusData((prev: any) => ({
                ...(prev || {}),
                id: user.id,
                is_merchant: true,
                merchant_subscription_status: confirmResult.status || 'active',
                merchant_subscription_plan: planCode,
                merchant_subscription_fee_tl: confirmResult.amountTl || feeTl,
                merchant_subscription_current_period_start: new Date().toISOString(),
                merchant_subscription_current_period_end: confirmResult.periodEnd || null,
                is_active: true,
              }));
            }
          } else {
            errors.push(`${p.productId}: Sunucu onay döndürmedi`);
          }
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          console.error('Restore confirm error for', p.productId, err);
          errors.push(`${p.productId}: ${errMsg}`);
        }
      }

      if (confirmedAny) {
        setMerchantSubscriptionCache(true);
        toast.success('Satın alma başarıyla geri yüklendi!');
        setLocalMerchantFlag();
        await new Promise((r) => setTimeout(r, 2000));
        try { if (refreshUser) await refreshUser(); } catch { /* best effort */ }
        try { await loadData(false); } catch { /* best effort */ }
      } else {
        const detail = errors.length > 0 ? errors.join(' | ') : 'Bilinmeyen hata';
        toast.error(`Onay başarısız: ${detail}`, { duration: 10000 });
      }
    } catch (error: any) {
      console.error('Restore purchases error:', error);
      toast.error(error.message || 'Satın alma geri yükleme başarısız.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="h-full min-h-0 bg-gray-50 overflow-hidden flex flex-col">
      <div
        className={`z-50 border-b p-4 ${isMerchant ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'}`}
        style={{
          paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))',
          minHeight: 'calc(56px + env(safe-area-inset-top, 0px))',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                navigate(-1);
              }}
              className={`p-2 -ml-2 rounded-full ${isMerchant ? 'hover:bg-blue-700' : 'hover:bg-gray-100'}`}
              aria-label="Geri"
            >
              <ArrowLeft className={`w-5 h-5 ${isMerchant ? 'text-white' : ''}`} />
            </button>
            <h1 className={`text-xl ${isMerchant ? 'text-white' : ''}`}>Abonelik ve Ödeme</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={isMerchant ? 'bg-white text-blue-700 border-white' : ''}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Yenile
          </Button>
        </div>
      </div>

      <div
        className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <p className="text-xs text-gray-500 px-0.5 -mt-1 mb-1">
          Durum ve ödeme listesi hesabınızdaki kayıtlara göre gösterilir. Ödeme sonrası hemen güncellenmezse üstteki{' '}
          <strong>Yenile</strong>ye basmayı deneyin.
        </p>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Durum</span>
            <span className={`font-semibold ${currentStatus === 'active' || currentStatus === 'past_due' ? 'text-green-600' : 'text-amber-700'}`}>{statusLabel}</span>
          </div>
          <div className="text-sm text-gray-700">
            Plan: {statusData?.merchant_subscription_plan || 'merchant_basic_monthly'}
          </div>
          <div className="text-sm text-gray-700">
            {feeTl} TL / {String(statusData?.merchant_subscription_plan || '').includes('yearly') ? 'yıl' : 'ay'}
          </div>
          <div className="text-sm text-gray-700">
            Dönem Sonu:{' '}
            {statusData?.merchant_subscription_current_period_end
              ? new Date(statusData.merchant_subscription_current_period_end).toLocaleString('tr-TR')
              : '-'}
          </div>
          {isTrialPlan && currentStatus === 'active' && (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Deneme aboneliği aktif. Kalan süre: <span className="font-semibold">{daysRemaining} gün</span>.
              Deneme sonunda Google Play ile abonelik başlatmanız gerekir.
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3">Esnaf Planı</h2>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setSelectedBillingMonths(1)}
              className={`w-full rounded-md border p-3 text-sm text-left transition-colors ${
                selectedBillingMonths === 1
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-900">Aylık Plan</div>
                <div className="font-bold text-blue-700">{MONTHLY_FEE_TL} TL / ay</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSelectedBillingMonths(12)}
              className={`w-full rounded-md border p-3 text-sm text-left transition-colors ${
                selectedBillingMonths === 12
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900">Yıllık Plan</div>
                  <div className="text-xs text-green-600 mt-0.5">Aylık {Math.round(YEARLY_FEE_TL / 12)} TL &mdash; %{Math.round((1 - YEARLY_FEE_TL / (MONTHLY_FEE_TL * 12)) * 100)} tasarruf</div>
                </div>
                <div className="font-bold text-blue-700">{YEARLY_FEE_TL} TL / yıl</div>
              </div>
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Kayıt sırasında ödeme yapmazsan {TRIAL_DAYS} gün deneme başlar. Deneme bitiminde Google Play ile abonelik başlatabilirsin.
          </div>
        </div>

        {onboardingRequired && (
          <div className="bg-white rounded-lg p-4 border border-amber-200">
            <h2 className="text-lg font-semibold mb-2">Devam etmek için seçim yap</h2>
            <p className="text-sm text-gray-700 mb-3">
              Esnaf hesabına devam etmek için önce {TRIAL_DAYS} günlük deneme başlatmalı veya Google Play ile abone olmalısın.
            </p>
            <Button
              onClick={handleStartTrial}
              disabled={isStartingTrial || isPaying}
              variant="outline"
              className="w-full"
            >
              {isStartingTrial ? 'Deneme başlatılıyor...' : `${TRIAL_DAYS} Günlük Denemeyi Başlat`}
            </Button>
          </div>
        )}

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3">Google Play ile Abonelik</h2>
          <div className="grid grid-cols-1 gap-2">
            <Button onClick={handleGooglePlayPayment} disabled={isPaying || (isSubscriptionActive && !isRenewalLocked)} className="h-12">
              <CreditCard className="w-4 h-4 mr-2" />
              {isPaying
                ? 'Google Play açılıyor...'
                : isSubscriptionActive && !isRenewalLocked
                  ? 'Abonelik Aktif ✓'
                  : selectedBillingMonths === 12
                    ? `Google Play ile Öde (${YEARLY_FEE_TL} TL / yıl)`
                    : `Google Play ile Öde (${MONTHLY_FEE_TL} TL / ay)`}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Android uygulamada dijital abonelik ödemeleri yalnızca Google Play Billing üzerinden tamamlanır.
          </p>
          {isRenewalLocked && (
            <p className="text-xs text-amber-700 mt-2">
              Aboneliğiniz aktif ({daysRemaining} gün kaldı). Erken yenileme için ödeme yapabilirsiniz.
            </p>
          )}
          {Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && (
            <Button
              variant="outline"
              onClick={handleRestorePurchases}
              disabled={isRestoring || isPaying}
              className="w-full mt-3 h-10"
            >
              <RotateCcw className={`w-4 h-4 mr-2 ${isRestoring ? 'animate-spin' : ''}`} />
              {isRestoring ? 'Sorgulanıyor...' : 'Satın Almaları Geri Yükle'}
            </Button>
          )}
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3">Ödeme Geçmişi</h2>
          {isLoading ? (
            <p className="text-sm text-gray-500">Yükleniyor...</p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-gray-500">
              Henüz ödeme kaydı yok. Ödeme yaptıysanız birkaç dakika sonra <strong>Yenile</strong>ye basın.
            </p>
          ) : (
            <div className="space-y-2">
              {payments.map((payment) => (
                <div key={payment.id} className="rounded border border-gray-200 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{payment.provider}</span>
                    <span className="uppercase text-xs">{payment.status}</span>
                  </div>
                  <div>{payment.amount_tl} TL / {payment.billing_period_months} ay</div>
                  <div className="text-gray-500">{new Date(payment.created_at).toLocaleString('tr-TR')}</div>
                  {payment.provider_reference && (
                    <div className="text-gray-600">Ref: {payment.provider_reference}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-1 pb-2">
          <BuildVersionBadge variant="onLight" className="px-1" />
        </div>
      </div>
    </div>
  );
}
