import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

export default function PrivacyPolicyScreen() {
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
          <h1 className="text-xl font-semibold">Gizlilik Politikası</h1>
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
              <h2 className="text-lg font-semibold">1. Giriş</h2>
              <p className="text-gray-700 leading-relaxed">
                esnaftaucuz ("Biz", "Bizim" veya "Uygulama"), kullanıcılarımızın gizliliğini korumayı 
                taahhüt eder. Bu Gizlilik Politikası, uygulamamızı kullandığınızda topladığımız, 
                kullandığımız ve paylaştığımız bilgileri açıklar.
              </p>
            </section>

            <section className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">2. Toplanan Bilgiler</h2>
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold mb-2">2.1. Hesap Bilgileri</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Uygulamayı kullanmak için e-posta adresi ve şifre gibi hesap bilgilerinizi topluyoruz.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">2.2. Konum Bilgileri</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Size en yakın fiyatları gösterebilmek için konum bilgilerinize ihtiyaç duyuyoruz. 
                    Bu bilgiler yalnızca size yakın fiyatları bulmak için kullanılır ve üçüncü taraflarla 
                    paylaşılmaz.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">2.3. Kamera ve Fotoğraf Erişimi</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Fiyat fotoğrafları eklemek için kamera ve fotoğraf galerinize erişim talep ediyoruz. 
                    Bu erişim yalnızca fiyat bilgisi eklerken kullanılır.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">2.4. Kullanım Verileri</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Uygulamanın performansını iyileştirmek için anonim kullanım verileri toplayabiliriz.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">3. Bilgilerin Kullanımı</h2>
              <p className="text-gray-700 leading-relaxed">
                Topladığımız bilgileri aşağıdaki amaçlar için kullanıyoruz:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Uygulama hizmetlerini sağlamak ve iyileştirmek</li>
                <li>Size kişiselleştirilmiş içerik sunmak</li>
                <li>Yakındaki fiyatları göstermek</li>
                <li>Güvenlik ve dolandırıcılık önleme</li>
                <li>Yasal yükümlülüklerimizi yerine getirmek</li>
              </ul>
            </section>

            <section className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">4. Bilgi Paylaşımı</h2>
              <p className="text-gray-700 leading-relaxed">
                Kişisel bilgilerinizi aşağıdaki durumlar dışında üçüncü taraflarla paylaşmıyoruz:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Yasal zorunluluklar gereği</li>
                <li>Hizmet sağlayıcılarımızla (veri depolama, analitik vb.)</li>
                <li>Kullanıcı izni ile</li>
              </ul>
            </section>

            <section className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">5. Veri Güvenliği</h2>
              <p className="text-gray-700 leading-relaxed">
                Verilerinizin güvenliğini sağlamak için endüstri standardı güvenlik önlemleri alıyoruz. 
                Ancak, internet üzerinden hiçbir veri aktarımı %100 güvenli değildir.
              </p>
            </section>

            <section className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">6. Veri Saklama</h2>
              <p className="text-gray-700 leading-relaxed">
                Hesabınız aktif olduğu sürece verilerinizi saklıyoruz. Hesabınızı sildiğinizde, 
                yasal yükümlülüklerimiz saklı kalmak kaydıyla verileriniz silinir.
              </p>
            </section>

            <section className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">7. Haklarınız</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                KVKK kapsamında aşağıdaki haklara sahipsiniz:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Kişisel verilerinize erişim</li>
                <li>Yanlış verilerin düzeltilmesi</li>
                <li>Verilerin silinmesi</li>
                <li>Veri işlemeye itiraz etme</li>
                <li>Veri taşınabilirliği</li>
              </ul>
            </section>

            <section className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">8. Çocukların Gizliliği</h2>
              <p className="text-gray-700 leading-relaxed">
                Uygulamamız 13 yaşın altındaki çocuklardan bilerek veri toplamaz. 13 yaşın altındaysanız, 
                lütfen uygulamayı kullanmayın.
              </p>
            </section>

            <section className="space-y-4 mb-6">
              <h2 className="text-lg font-semibold">9. Politika Değişiklikleri</h2>
              <p className="text-gray-700 leading-relaxed">
                Bu Gizlilik Politikasını zaman zaman güncelleyebiliriz. Önemli değişikliklerde 
                size bildirimde bulunacağız.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">10. İletişim</h2>
              <p className="text-gray-700 leading-relaxed">
                Gizlilik politikamız hakkında sorularınız varsa, lütfen bizimle iletişime geçin:
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



