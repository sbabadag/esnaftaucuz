import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

export default function DistanceSalesAgreementScreen() {
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
          <h1 className="text-xl font-semibold">Mesafeli Satis Sozlesmesi</h1>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-80px)]" style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))' }}>
        <div className="p-4 space-y-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <p className="text-sm text-gray-500 mb-4">
              Son Guncelleme: {new Date().toLocaleDateString('tr-TR')}
            </p>

            <section className="space-y-3 mb-6">
              <h2 className="text-lg font-semibold">1. Taraflar</h2>
              <p className="text-gray-700 leading-relaxed">
                Isbu sozlesme, esnaftaucuz dijital platformu ile abonelik satin alan kullanici arasinda
                elektronik ortamda kurulmustur.
              </p>
            </section>

            <section className="space-y-3 mb-6">
              <h2 className="text-lg font-semibold">2. Konu</h2>
              <p className="text-gray-700 leading-relaxed">
                Sozlesmenin konusu, kullanicinin dijital abonelik hizmetini uzaktan iletisim araclariyla
                satin almasina iliskin taraflarin hak ve yukumluluklerinin belirlenmesidir.
              </p>
            </section>

            <section className="space-y-3 mb-6">
              <h2 className="text-lg font-semibold">3. Hizmet Bedeli ve Odeme</h2>
              <p className="text-gray-700 leading-relaxed">
                Abonelik bedeli, odeme adiminda gosterilen tutardir. Tahsilat, secilen odeme yontemi
                uzerinden guvenli odeme kurulusu altyapisi ile yapilir.
              </p>
            </section>

            <section className="space-y-3 mb-6">
              <h2 className="text-lg font-semibold">4. Hizmetin Ifasi</h2>
              <p className="text-gray-700 leading-relaxed">
                Dijital hizmet, odeme onayi sonrasinda kullanici hesabinda aktif edilir. Hizmetin teknik
                olarak sunulamadigi durumlarda kullaniciya bilgilendirme yapilir.
              </p>
            </section>

            <section className="space-y-3 mb-6">
              <h2 className="text-lg font-semibold">5. Cayma Hakki</h2>
              <p className="text-gray-700 leading-relaxed">
                Dijital icerik/hizmetlerde, ifaya kullanici onayi ile baslanmasi halinde cayma hakki
                mevzuatin izin verdigi olcude sinirlanabilir. Iade talepleri olay bazinda incelenir.
              </p>
            </section>

            <section className="space-y-3 mb-6">
              <h2 className="text-lg font-semibold">6. Uyusmazliklarin Cozumu</h2>
              <p className="text-gray-700 leading-relaxed">
                Isbu sozlesmeden dogan uyusmazliklarda T.C. mevzuati uygulanir; gorevli ve yetkili
                merciler tuketici hakem heyetleri ve tuketici mahkemeleridir.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">7. Iletisim</h2>
              <p className="text-gray-700 leading-relaxed">E-posta: admin@selahattinbabadag.com</p>
            </section>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

