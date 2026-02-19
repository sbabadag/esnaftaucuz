import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, MapPin, Users, Shield } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';

export default function AboutScreen() {
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
          <h1 className="text-xl font-semibold">Hakkında</h1>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="h-[calc(100vh-80px)]" style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))' }}>
        <div className="p-4 space-y-6">
          {/* App Info */}
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-green-600 rounded-full p-3">
                <ShoppingBag className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">esnaftaucuz</h2>
                <p className="text-gray-500">Versiyon 0.0.1</p>
              </div>
            </div>
            <p className="text-gray-700 leading-relaxed">
              esnaftaucuz, yakınınızdaki en ucuz fiyatları bulmanıza ve paylaşmanıza olanak tanıyan 
              bir platformdur. Topluluk odaklı fiyat karşılaştırma uygulaması.
            </p>
          </div>

          {/* Features */}
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h2 className="text-lg font-semibold mb-4">Özellikler</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1">Konum Bazlı Arama</h3>
                  <p className="text-sm text-gray-600">
                    Size en yakın fiyatları bulun
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1">Topluluk Odaklı</h3>
                  <p className="text-sm text-gray-600">
                    Kullanıcılar fiyat bilgilerini paylaşır
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1">Güvenli ve Gizli</h3>
                  <p className="text-sm text-gray-600">
                    Verileriniz güvende, gizliliğiniz korunur
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Legal Links */}
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h2 className="text-lg font-semibold mb-4">Yasal Bilgiler</h2>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/app/privacy-policy')}
              >
                Gizlilik Politikası
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/app/terms-of-service')}
              >
                Kullanım Koşulları
              </Button>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h2 className="text-lg font-semibold mb-4">İletişim</h2>
            <div className="space-y-2 text-gray-700">
              <p>
                <span className="font-semibold">E-posta:</span> admin@selahattinbabadag.com
              </p>
            </div>
          </div>

          {/* Copyright */}
          <div className="text-center text-sm text-gray-500 pb-4">
            <p>© {new Date().getFullYear()} esnaftaucuz. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}



