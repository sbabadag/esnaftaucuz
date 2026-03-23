import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { merchantSubscriptionAPI } from '../../services/supabase-api';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { GooglePlayBilling } from '../../lib/google-play-billing';

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

  const currentStatus: MerchantSubscriptionStatus = (statusData?.merchant_subscription_status || 'inactive') as MerchantSubscriptionStatus;
  const feeTl = statusData?.merchant_subscription_fee_tl || MONTHLY_FEE_TL;
  const [selectedBillingMonths, setSelectedBillingMonths] = useState<1 | 12>(1);
  const periodEndDate = statusData?.merchant_subscription_current_period_end
    ? new Date(statusData.merchant_subscription_current_period_end)
    : null;
  const daysRemaining = periodEndDate
    ? Math.max(0, Math.ceil((periodEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  const isSubscriptionActive = !!statusData?.is_active;
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

  const loadData = async (showLoader: boolean = true) => {
    if (!user?.id) return null;
    try {
      if (showLoader) setIsLoading(true);
      const [status, paymentList] = await Promise.all([
        merchantSubscriptionAPI.getStatus(user.id),
        merchantSubscriptionAPI.getPayments(user.id, 10),
      ]);
      setStatusData(status);
      setPayments(paymentList);
      return { status, paymentList };
    } catch (error: any) {
      console.error('Subscription screen load error:', error);
      const msg = String(error?.message || '').toLowerCase();
      const isTransient =
        msg.includes('zaman aşım') ||
        msg.includes('timeout') ||
        msg.includes('failed to fetch') ||
        msg.includes('network');
      if (!isTransient) {
        toast.error(error.message || 'Abonelik verileri yüklenemedi');
      }
      return null;
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

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
      await loadData(false);
      if (refreshUser) await refreshUser();
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
      await merchantSubscriptionAPI.confirmGooglePlayPurchase({
        purchaseToken: purchase.purchaseToken,
        productId: purchase.productId || productId,
        orderId: purchase.orderId,
        packageName: purchase.packageName,
        purchaseTime: purchase.purchaseTime,
      });

      try {
        localStorage.removeItem(MERCHANT_SUBSCRIPTION_ONBOARDING_KEY);
      } catch {
        // ignore storage errors
      }

      await loadData(false);
      if (refreshUser) await refreshUser();
      toast.success('Abonelik Google Play ile aktif edildi.');
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
      await merchantSubscriptionAPI.startTrial(user.id, TRIAL_DAYS);
      try {
        localStorage.removeItem(MERCHANT_SUBSCRIPTION_ONBOARDING_KEY);
      } catch {
        // ignore storage errors
      }
      await loadData(false);
      if (refreshUser) await refreshUser();
      toast.success(`${TRIAL_DAYS} günlük deneme aboneliği başlatıldı.`);
    } catch (error: any) {
      console.error('Start trial error:', error);
      toast.error(error.message || 'Deneme aboneliği başlatılamadı');
    } finally {
      setIsStartingTrial(false);
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
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Durum</span>
            <span className={`font-semibold ${currentStatus === 'active' ? 'text-green-600' : 'text-amber-700'}`}>{statusLabel}</span>
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
            <Button onClick={handleGooglePlayPayment} disabled={isPaying} className="h-12">
              <CreditCard className="w-4 h-4 mr-2" />
              {isPaying
                ? 'Google Play açılıyor...'
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
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3">Ödeme Geçmişi</h2>
          {isLoading ? (
            <p className="text-sm text-gray-500">Yükleniyor...</p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-gray-500">Henüz ödeme kaydı yok.</p>
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
      </div>
    </div>
  );
}
