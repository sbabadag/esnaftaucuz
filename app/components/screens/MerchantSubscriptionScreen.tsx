import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { merchantSubscriptionAPI } from '../../services/supabase-api';
import { toast } from 'sonner';

type MerchantSubscriptionStatus = 'inactive' | 'active' | 'past_due' | 'canceled';

const MONTHLY_FEE_TL = 1000;
const YEARLY_MONTHS = 12;
const YEARLY_DISCOUNT_RATE = 0.2;
const YEARLY_FEE_TL = Math.round(MONTHLY_FEE_TL * YEARLY_MONTHS * (1 - YEARLY_DISCOUNT_RATE));

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
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');

  const currentStatus: MerchantSubscriptionStatus = (statusData?.merchant_subscription_status || 'inactive') as MerchantSubscriptionStatus;
  const feeTl = statusData?.merchant_subscription_fee_tl || MONTHLY_FEE_TL;
  const selectedBillingMonths = selectedPlan === 'yearly' ? YEARLY_MONTHS : 1;
  const selectedAmountTl = selectedPlan === 'yearly' ? YEARLY_FEE_TL : MONTHLY_FEE_TL;
  const periodEndDate = statusData?.merchant_subscription_current_period_end
    ? new Date(statusData.merchant_subscription_current_period_end)
    : null;
  const daysRemaining = periodEndDate
    ? Math.max(0, Math.ceil((periodEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  const isSubscriptionActive = !!statusData?.is_active;
  const isRenewalLocked = isSubscriptionActive && daysRemaining > 7;

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
      toast.error(error.message || 'Abonelik verileri yüklenemedi');
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isMerchant) {
      toast.error('Bu sayfa sadece esnaf hesapları içindir');
      navigate('/app/profile', { replace: true });
      return;
    }
    loadData(true);
  }, [isMerchant, user?.id]);

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

  const handleGooglePayment = async () => {
    if (!user?.id) return;
    if (isRenewalLocked) {
      toast.error(`Aboneliğiniz aktif. Yenileme dönem bitimine 7 gün kala açılır (${daysRemaining} gün kaldı).`);
      return;
    }
    try {
      setIsPaying(true);
      const result = await merchantSubscriptionAPI.startProviderCheckout({
        userId: user.id,
        amountTl: selectedAmountTl,
        billingPeriodMonths: selectedBillingMonths,
      });

      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, '_blank');
        toast.success('Ödeme sayfası açıldı');
      } else {
        toast.error('Ödeme bağlantısı üretilemedi. Lütfen tekrar deneyin.');
      }
      await loadData(false);
    } catch (error: any) {
      console.error('Provider payment start error:', error);
      toast.error(error.message || 'Ödeme başlatılamadı');
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className={`sticky top-0 z-50 border-b p-4 ${isMerchant ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'}`}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          height: 'calc(56px + env(safe-area-inset-top, 0px))',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
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

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Durum</span>
            <span className={`font-semibold ${currentStatus === 'active' ? 'text-green-600' : 'text-amber-700'}`}>{statusLabel}</span>
          </div>
          <div className="text-sm text-gray-700">
            Plan: {statusData?.merchant_subscription_plan || 'merchant_basic_1000_tl_monthly'}
          </div>
          <div className="text-sm text-gray-700">{feeTl} TL / ay</div>
          <div className="text-sm text-gray-700">
            Dönem Sonu:{' '}
            {statusData?.merchant_subscription_current_period_end
              ? new Date(statusData.merchant_subscription_current_period_end).toLocaleString('tr-TR')
              : '-'}
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3">Plan Seçimi</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant={selectedPlan === 'monthly' ? 'default' : 'outline'}
              onClick={() => setSelectedPlan('monthly')}
              disabled={isLoading || isPaying || isRenewalLocked}
            >
              Aylık - {MONTHLY_FEE_TL} TL
            </Button>
            <Button
              variant={selectedPlan === 'yearly' ? 'default' : 'outline'}
              onClick={() => setSelectedPlan('yearly')}
              disabled={isLoading || isPaying || isRenewalLocked}
            >
              Yıllık - {YEARLY_FEE_TL} TL (%20 indirim)
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {selectedPlan === 'yearly'
              ? `Yıllık ödeme ile 12.000 TL yerine ${YEARLY_FEE_TL} TL ödersiniz.`
              : 'Aylık plan her ay otomatik/manuel yenilenir.'}
          </p>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3">Google Pay ile Ödeme</h2>
          <div className="grid grid-cols-1 gap-2">
            <Button onClick={handleGooglePayment} disabled={isPaying || isLoading || isRenewalLocked}>
              <CreditCard className="w-4 h-4 mr-2" />
              Google Pay ile Öde ({selectedAmountTl} TL)
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Google Pay, Stripe Checkout ile güvenli olarak işlenir. Başarılı ödeme sonrası webhook ile abonelik otomatik uzatılır.
          </p>
          {isAwaitingConfirmation && (
            <p className="text-xs text-blue-700 mt-2">
              Odeme alindi. Saglayici onayi bekleniyor, durum otomatik yenileniyor...
            </p>
          )}
          {isRenewalLocked && (
            <p className="text-xs text-amber-700 mt-2">
              Aboneliğiniz aktif. Yeni ödeme butonu dönem bitimine 7 gün kala açılır ({daysRemaining} gün kaldı).
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
