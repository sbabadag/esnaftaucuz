import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { merchantSubscriptionAPI } from '../../services/supabase-api';
import { toast } from 'sonner';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

type MerchantSubscriptionStatus = 'inactive' | 'active' | 'past_due' | 'canceled';

const MONTHLY_FEE_TL = 500;
const TRIAL_DAYS = 10;
const MERCHANT_SUBSCRIPTION_ONBOARDING_KEY = 'merchant-subscription-onboarding-user';
const MERCHANT_SIGNUP_INTENT_KEY = 'merchant-signup-intent';
const CHECKOUT_UI_TIMEOUT_MS = 40000;

export default function MerchantSubscriptionScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUser } = useAuth();
  const isMerchant = (user as any)?.is_merchant === true;

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);
  const [statusData, setStatusData] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [isStartingTrial, setIsStartingTrial] = useState(false);

  const currentStatus: MerchantSubscriptionStatus = (statusData?.merchant_subscription_status || 'inactive') as MerchantSubscriptionStatus;
  const feeTl = statusData?.merchant_subscription_fee_tl || MONTHLY_FEE_TL;
  const selectedBillingMonths = 1;
  const selectedAmountTl = MONTHLY_FEE_TL;
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
    if (!user?.id) return;
    try {
      if (showLoader) setIsLoading(true);
      const [status, paymentList] = await Promise.all([
        merchantSubscriptionAPI.getStatus(user.id),
        merchantSubscriptionAPI.getPayments(user.id, 10),
      ]);
      setStatusData(status);
      setPayments(paymentList);
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
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  useEffect(() => {
    try {
      if (user?.id && localStorage.getItem(MERCHANT_SIGNUP_INTENT_KEY) === '1') {
        localStorage.setItem(MERCHANT_SUBSCRIPTION_ONBOARDING_KEY, user.id);
      }
    } catch {
      // best effort
    }
    if (!isMerchant && !onboardingRequired) {
      toast.error('Bu sayfa sadece esnaf hesapları içindir');
      navigate('/app/profile', { replace: true });
      return;
    }
    loadData(true);
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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkout = params.get('checkout');
    const paymentId = params.get('paymentId');

    if (checkout === 'success') {
      setIsAwaitingConfirmation(true);
      toast.info('Odeme alindi, abonelik onayi bekleniyor...');
      loadData(false);
      if (refreshUser) refreshUser();
      navigate('/app/merchant-subscription', { replace: true });
      return;
    }

    if (checkout === 'cancel') {
      toast.error('Ödeme iptal edildi');
      navigate('/app/merchant-subscription', { replace: true });
    }
  }, [location.search]);

  useEffect(() => {
    if (!isAwaitingConfirmation || !user?.id) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 12;

    const poll = async () => {
      while (!cancelled && attempts < maxAttempts) {
        attempts += 1;
        try {
          const [status, paymentList] = await Promise.all([
            merchantSubscriptionAPI.getStatus(user.id),
            merchantSubscriptionAPI.getPayments(user.id, 10),
          ]);
          if (cancelled) return;
          setStatusData(status);
          setPayments(paymentList);

          const latestPendingOrConfirmed = (paymentList || []).find(
            (p: any) => p?.provider === 'stripe' || p?.provider === 'iyzico'
          );

          if (status?.is_active || latestPendingOrConfirmed?.status === 'confirmed') {
            toast.success('Odeme onaylandi, abonelik aktif edildi.');
            if (refreshUser) await refreshUser();
            setIsAwaitingConfirmation(false);
            return;
          }
        } catch (error) {
          console.warn('Subscription confirmation poll failed:', error);
        }

        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      if (!cancelled) {
        toast.warning('Onay biraz gecikiyor olabilir. "Yenile" ile durumu kontrol edebilirsiniz.');
        setIsAwaitingConfirmation(false);
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [isAwaitingConfirmation, user?.id, refreshUser]);

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

  const handleCardPayment = async () => {
    if (!user?.id) {
      toast.error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }

    const tryRecoverAndOpenCheckout = async (): Promise<boolean> => {
      try {
        const paymentList = await merchantSubscriptionAPI.getPayments(user.id, 10);
        const recovered = (paymentList || []).find((p: any) => {
          const url = String(
            p?.metadata?.invoice_hosted_url ||
            p?.metadata?.invoiceHostedUrl ||
            p?.metadata?.checkout_url ||
            p?.metadata?.checkoutUrl ||
            ''
          ).trim();
          const status = String(p?.status || '').toLowerCase();
          return p?.provider === 'iyzico' && url.startsWith('http') && (status === 'pending' || status === 'processing');
        });

        const recoveredUrl = String(
          recovered?.metadata?.invoice_hosted_url ||
          recovered?.metadata?.invoiceHostedUrl ||
          recovered?.metadata?.checkout_url || recovered?.metadata?.checkoutUrl || ''
        ).trim();
        if (!recoveredUrl.startsWith('http')) return false;

        if (Capacitor.isNativePlatform()) {
          await Promise.race([
            Browser.open({ url: recoveredUrl }),
            new Promise((resolve) => setTimeout(resolve, 8000)),
          ]);
        } else {
          window.open(recoveredUrl, '_blank');
        }
        toast.success('Ödeme bağlantısı kurtarıldı ve açıldı');
        return true;
      } catch {
        return false;
      }
    };

    const tryRecoverAndOpenCheckoutWithPolling = async (): Promise<boolean> => {
      const startedAt = Date.now();
      const maxWaitMs = 60000;
      const intervalMs = 4000;
      while ((Date.now() - startedAt) < maxWaitMs) {
        const recovered = await tryRecoverAndOpenCheckout();
        if (recovered) return true;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
      return false;
    };

    try {
      setIsPaying(true);
      toast.info('Ödeme sayfası hazırlanıyor...');

      const result = await Promise.race([
        merchantSubscriptionAPI.startProviderCheckout({
          userId: user.id,
          provider: 'iyzico',
          amountTl: selectedAmountTl,
          billingPeriodMonths: selectedBillingMonths,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('checkout_ui_timeout')), CHECKOUT_UI_TIMEOUT_MS)
        ),
      ]) as Awaited<ReturnType<typeof merchantSubscriptionAPI.startProviderCheckout>>;

      if (result.checkoutUrl) {
        try {
          localStorage.removeItem(MERCHANT_SUBSCRIPTION_ONBOARDING_KEY);
        } catch {
          // ignore storage errors
        }
        if (Capacitor.isNativePlatform()) {
          await Promise.race([
            Browser.open({ url: result.checkoutUrl }),
            new Promise((resolve) => setTimeout(resolve, 8000)),
          ]);
        } else {
          window.open(result.checkoutUrl, '_blank');
        }
        toast.success('Ödeme sayfası açıldı');
        void loadData(false);
        return;
      }

      throw new Error('Ödeme bağlantısı oluşturulamadı. Lütfen internetinizi değiştirip tekrar deneyin.');
    } catch (error: any) {
      console.error('Provider payment start error:', error);
      const errText = String(error?.message || '').toLowerCase();
      if (errText.includes('oturum') || errText.includes('401') || errText.includes('geçersiz')) {
        toast.error('Oturum süresi doldu. Lütfen çıkış yapıp tekrar giriş yapın.');
        setIsAwaitingConfirmation(false);
        return;
      }
      if (
        errText.includes('checkout_ui_timeout') ||
        errText.includes('subscription_create_timeout') ||
        errText.includes('timeout') ||
        errText.includes('zaman aşım')
      ) {
        toast.info('Ödeme bağlantısı aranıyor, lütfen bekleyin...');
        const recovered = await tryRecoverAndOpenCheckoutWithPolling();
        if (!recovered) {
          toast.error('Ödeme hazırlığı uzadı. Lütfen tekrar deneyin.');
        }
      } else {
        const recovered = await tryRecoverAndOpenCheckout();
        if (!recovered) {
          toast.error(error.message || 'Ödeme başlatılamadı');
        }
      }
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
            disabled={isRefreshing || isAwaitingConfirmation}
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
            Plan: {statusData?.merchant_subscription_plan || 'merchant_basic_500_tl_monthly'}
          </div>
          <div className="text-sm text-gray-700">{feeTl} TL / ay</div>
          <div className="text-sm text-gray-700">
            Dönem Sonu:{' '}
            {statusData?.merchant_subscription_current_period_end
              ? new Date(statusData.merchant_subscription_current_period_end).toLocaleString('tr-TR')
              : '-'}
          </div>
          {isTrialPlan && currentStatus === 'active' && (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Deneme aboneliği aktif. Kalan süre: <span className="font-semibold">{daysRemaining} gün</span>.
              Deneme sonunda kredi kartı ile aylık {MONTHLY_FEE_TL} TL abonelik başlatmanız gerekir.
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3">Esnaf Planı</h2>
          <div className="rounded-md border border-gray-200 p-3 text-sm">
            <div className="font-semibold text-gray-900">Aylık Abonelik</div>
            <div className="text-gray-700 mt-1">{MONTHLY_FEE_TL} TL / ay</div>
            <div className="text-xs text-gray-500 mt-1">
              Kayıt sırasında ödeme yapmazsan {TRIAL_DAYS} gün deneme başlar. Deneme bitiminde kredi kartı ile abonelik başlatabilirsin.
            </div>
          </div>
        </div>

        {onboardingRequired && (
          <div className="bg-white rounded-lg p-4 border border-amber-200">
            <h2 className="text-lg font-semibold mb-2">Devam etmek için seçim yap</h2>
            <p className="text-sm text-gray-700 mb-3">
              Esnaf hesabına devam etmek için önce {TRIAL_DAYS} günlük deneme başlatmalı veya kredi kartı ile abone olmalısın.
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
          <h2 className="text-lg font-semibold mb-3">iyzico ile Güvenli Ödeme</h2>
          <div className="grid grid-cols-1 gap-2">
            <Button onClick={handleCardPayment} disabled={isPaying}>
              <CreditCard className="w-4 h-4 mr-2" />
              {isPaying ? 'Ödeme başlatılıyor...' : `iyzico ile Öde (${selectedAmountTl} TL / ay)`}
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Odeme iyzico guvenli odeme sayfasi uzerinden tamamlanir.
            Basarili odeme sonrasi webhook ile abonelik otomatik aktif edilir.
          </p>
          {isAwaitingConfirmation && (
            <p className="text-xs text-blue-700 mt-2">
              Odeme alindi. Saglayici onayi bekleniyor, durum otomatik yenileniyor...
            </p>
          )}
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
