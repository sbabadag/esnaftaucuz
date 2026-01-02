import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Navigation, Heart } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';

const mockLocationPrices = [
  { id: 1, product: 'Domates', price: '12,00', unit: 'kg', time: '2 saat önce' },
  { id: 2, product: 'Patates', price: '8,50', unit: 'kg', time: '2 saat önce' },
  { id: 3, product: 'Soğan', price: '7,00', unit: 'kg', time: '3 saat önce' },
];

export default function LocationDetailScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl">Yazır Pazarı</h1>
        </div>
      </div>

      {/* Location Info */}
      <div className="bg-white p-6 border-b border-gray-200">
        <Badge variant="secondary" className="mb-3">Pazar</Badge>
        <div className="flex items-start gap-2 text-gray-600 mb-4">
          <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>Selçuklu / Konya</span>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1 bg-green-600 hover:bg-green-700">
            <Navigation className="w-4 h-4 mr-2" />
            Yol Tarifi Al
          </Button>
          <Button variant="outline">
            <Heart className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Prices */}
      <div className="p-4">
        <h2 className="text-lg mb-3">Bu yerdeki fiyatlar</h2>
        <div className="space-y-3">
          {mockLocationPrices.map((item) => (
            <div key={item.id} className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-lg">{item.product}</h3>
                  <p className="text-2xl text-green-600">
                    {item.price} TL <span className="text-sm text-gray-500">/ {item.unit}</span>
                  </p>
                </div>
                <Badge className="bg-green-600">BUGÜN</Badge>
              </div>
              <p className="text-sm text-gray-500">{item.time}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
