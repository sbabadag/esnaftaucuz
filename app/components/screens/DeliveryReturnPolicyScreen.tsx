import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

export default function DeliveryReturnPolicyScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className="sticky bg-white border-b border-gray-200 p-4 z-10"
        style={{ top: 'env(safe-area-inset-top, 0px)', paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">Teslimat ve Iade Sartlari</h1>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-80px)]" style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))' }}>
        <div className="p-4 space-y-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <p className="text-sm text-gray-500 mb-4">
              Son Guncelleme: {new Date().toLocaleDateString('tr-TR')}
            </p>

            <section className="space-y-3 mb-6">
              <h2 className="text-lg font-semibold">1. Hizmetin Teslim Sekli</h2>
              <p className="text-gray-700 leading-relaxed">
                esnaftaucuz uzerinden sunulan urun, fiziksel urun degil dijital abonelik hizmetidir.
                Odeme onayi sonrasinda hizmet, kullanici hesabina dijital olarak tanimlanir.
              </p>
            </section>

            <section className="space-y-3 mb-6">
              <h2 className="text-lg font-semibold">2. Teslimat Suresi</h2>
              <p className="text-gray-700 leading-relaxed">
                Odeme islemi basariyla tamamlandiginda abonelik genellikle aninda, teknik aksaklik
                durumunda en gec 24 saat icinde aktif edilir.
              </p>
            </section>

            <section className="space-y-3 mb-6">
              <h2 className="text-lg font-semibold">3. Iade Kosullari</h2>
              <p className="text-gray-700 leading-relaxed">
                Dijital hizmetlerde, hizmetin ifasina baslanmasi ile birlikte cayma hakki mevzuatin
                izin verdigi kapsamda sinirlanabilir. Buna ragmen hatali tahsilat, cift cekim veya
                teknik sebeple sunulamayan hizmet durumlarinda iade talebi degerlendirilir.
              </p>
            </section>

            <section className="space-y-3 mb-6">
              <h2 className="text-lg font-semibold">4. Iptal ve Yenileme</h2>
              <p className="text-gray-700 leading-relaxed">
                Aboneliginizi dilediginiz zaman uygulama icinden iptal edebilirsiniz. Iptal sonrasinda
                mevcut donem sonuna kadar hizmetten yararlanmaya devam edersiniz. Sonraki donemler
                icin otomatik tahsilat yapilmaz.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">5. Iletisim ve Talep</h2>
              <p className="text-gray-700 leading-relaxed">
                Iade ve teslimatla ilgili tum talepleriniz icin:
              </p>
              <p className="text-gray-700 leading-relaxed">
                E-posta: admin@selahattinbabadag.com
              </p>
            </section>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

