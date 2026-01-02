import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Bell, Lock, Globe, Info, ChevronRight } from 'lucide-react';

const settingsItems = [
  { icon: MapPin, label: 'Konum ayarları' },
  { icon: Bell, label: 'Bildirimler' },
  { icon: Lock, label: 'Gizlilik' },
  { icon: Globe, label: 'Dil' },
  { icon: Info, label: 'Hakkında' },
];

export default function SettingsScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl">Ayarlar</h1>
        </div>
      </div>

      {/* Settings List */}
      <div className="p-4 space-y-2">
        {settingsItems.map((item) => (
          <button
            key={item.label}
            className="w-full bg-white rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5 text-gray-600" />
              <span>{item.label}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        ))}
      </div>
    </div>
  );
}
