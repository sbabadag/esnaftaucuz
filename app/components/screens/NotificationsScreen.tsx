import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingDown, MapPin, CheckCircle2, Bell } from 'lucide-react';

const mockNotifications = [
  { id: 1, icon: TrendingDown, text: 'Domates fiyatı düştü', time: '2 saat önce', color: 'text-green-600' },
  { id: 2, icon: MapPin, text: 'Yakınında ucuz ürün var', time: '5 saat önce', color: 'text-blue-600' },
  { id: 3, icon: CheckCircle2, text: 'Paylaşımın doğrulandı', time: '1 gün önce', color: 'text-green-600' },
];

export default function NotificationsScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl">Bildirimler</h1>
        </div>
      </div>

      {/* Notifications */}
      {mockNotifications.length > 0 ? (
        <div className="p-4 space-y-2">
          {mockNotifications.map((notif) => (
            <div key={notif.id} className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-start gap-3">
                <notif.icon className={`w-5 h-5 flex-shrink-0 ${notif.color}`} />
                <div className="flex-1">
                  <p className="text-gray-900">{notif.text}</p>
                  <p className="text-sm text-gray-500 mt-1">{notif.time}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-96 text-gray-400">
          <Bell className="w-16 h-16 mb-4" />
          <p>Henüz bildirim yok</p>
        </div>
      )}
    </div>
  );
}
