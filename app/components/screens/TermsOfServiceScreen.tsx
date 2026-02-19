import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

export default function TermsOfServiceScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky bg-white border-b border-gray-200 p-4 z-10" style={{ top: 'env(safe-area-inset-top, 0px)', paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">Kullanım Koşulları</h1>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="h-[calc(100vh-80px)]" style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))' }}>
        <div className="p-4 space-y-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <p className="text-sm text-gray-500 mb-4">
              Son Güncelleme: {new Date().toLocaleDateString('tr-TR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>

            <section className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">1. Kabul</h2>
              <p className="text-gray-700 leading-relaxed">
                esnaftaucuz uygulamasını ("Uygulama") kullanarak, bu Kullanım Koşullarını kabul etmiş 
                sayılırsınız. Bu koşulları kabul etmiyorsanız, lütfen uygulamayı kullanmayın.
              </p>
            </section>

            <section className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">2. Hizmet Açıklaması</h2>
              <p className="text-gray-700 leading-relaxed">
                esnaftaucuz, kullanıcıların yakınlarındaki ürün fiyatlarını paylaşmasına ve görüntülemesine 
                olanak tanıyan bir platformdur. Fiyat bilgileri kullanıcılar tarafından sağlanır ve 
                doğruluğu garanti edilmez.
              </p>
            </section>

            <section className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">3. Kullanıcı Hesabı</h2>
              <div className="space-y-3">
                <p className="text-gray-700 leading-relaxed">
                  Uygulamayı kullanmak için bir hesap oluşturmanız gerekebilir. Hesap bilgilerinizin 
                  güvenliğinden siz sorumlusunuz.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  Aşağıdaki durumlarda hesabınız askıya alınabilir veya silinebilir:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li>Yanlış veya yanıltıcı bilgi paylaşımı</li>
                  <li>Spam veya kötüye kullanım</li>
                  <li>Başkalarının haklarını ihlal etme</li>
                  <li>Yasalara aykırı davranış</li>
                </ul>
              </div>
            </section>

            <section className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">4. Kullanıcı İçeriği</h2>
              <div className="space-y-3">
                <p className="text-gray-700 leading-relaxed">
                  Uygulamaya eklediğiniz içeriklerden (fiyat bilgileri, fotoğraflar vb.) siz sorumlusunuz. 
                  İçerikleriniz:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li>Yasalara uygun olmalıdır</li>
                  <li>Başkalarının haklarını ihlal etmemelidir</li>
                  <li>Doğru ve güncel olmalıdır</li>
                  <li>Spam veya reklam içermemelidir</li>
                </ul>
                <p className="text-gray-700 leading-relaxed">
                  Uygulamaya eklediğiniz içeriği kullanma, görüntüleme ve paylaşma hakkını bize veriyorsunuz.
                </p>
              </div>
            </section>

            <section className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">5. Fikri Mülkiyet</h2>
              <p className="text-gray-700 leading-relaxed">
                Uygulamanın tüm içeriği, özellikleri ve işlevselliği esnaftaucuz'a aittir ve telif hakkı, 
                ticari marka ve diğer yasalarla korunmaktadır.
              </p>
            </section>

            <section className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">6. Sorumluluk Reddi</h2>
              <p className="text-gray-700 leading-relaxed">
                Uygulama "olduğu gibi" sunulmaktadır. Fiyat bilgilerinin doğruluğunu, güncelliğini veya 
                eksiksizliğini garanti etmiyoruz. Uygulamayı kullanımınızdan kaynaklanan herhangi bir 
                zarardan sorumlu değiliz.
              </p>
            </section>

            <section className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">7. Hizmet Değişiklikleri</h2>
              <p className="text-gray-700 leading-relaxed">
                Hizmetleri önceden haber vermeksizin değiştirme, askıya alma veya sonlandırma hakkını 
                saklı tutarız.
              </p>
            </section>

            <section className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">8. Üçüncü Taraf Hizmetleri</h2>
              <p className="text-gray-700 leading-relaxed">
                Uygulama üçüncü taraf hizmetler (haritalar, ödeme sistemleri vb.) kullanabilir. 
                Bu hizmetlerin kendi kullanım koşulları ve gizlilik politikaları vardır.
              </p>
            </section>

            <section className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">9. Fesih</h2>
              <p className="text-gray-700 leading-relaxed">
                Bu koşulları ihlal etmeniz durumunda, önceden haber vermeksizin hesabınızı askıya alabilir 
                veya silebiliriz.
              </p>
            </section>

            <section className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">10. Uygulanacak Hukuk</h2>
              <p className="text-gray-700 leading-relaxed">
                Bu Kullanım Koşulları Türkiye Cumhuriyeti yasalarına tabidir. Herhangi bir anlaşmazlık 
                durumunda Türkiye mahkemeleri yetkilidir.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">11. İletişim</h2>
              <p className="text-gray-700 leading-relaxed">
                Kullanım koşulları hakkında sorularınız varsa, lütfen bizimle iletişime geçin:
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



