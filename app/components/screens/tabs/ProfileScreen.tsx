import { useNavigate } from 'react-router-dom';
import { Settings, Heart, Award, Share2, LogOut, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'sonner';

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Çıkış yapıldı');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Çıkış yapılırken bir hata oluştu');
    }
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.name) return 'K';
    const names = user.name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  };

  // Get level badge text
  const getLevelBadge = () => {
    if (!user?.level) return 'Yeni';
    const levels: Record<number, string> = {
      1: 'Yeni',
      2: 'Mahalleli',
      3: 'Uzman',
      4: 'Master',
      5: 'Efsane',
    };
    return levels[user.level] || 'Yeni';
  };

  const menuItems = [
    { icon: Share2, label: 'Katkılarım', onClick: () => navigate('/app/contributions') },
    { icon: Heart, label: 'Favorilerim', onClick: () => {} },
    { icon: Award, label: 'Rozetler', onClick: () => {} },
    { icon: Settings, label: 'Ayarlar', onClick: () => navigate('/app/settings') },
    { icon: Share2, label: 'Destek & Geri Bildirim', onClick: () => {} },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Profile Header */}
      <div className="bg-white p-6 border-b border-gray-200">
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="w-20 h-20">
            <AvatarImage src={user?.avatar || ''} />
            <AvatarFallback className="bg-green-600 text-white text-2xl">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-2xl">{user?.name || 'Kullanıcı'}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-600">Seviye:</span>
              <Badge variant="secondary">{getLevelBadge()} 🏅</Badge>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl text-green-600">
              {typeof user?.contributions === 'object' 
                ? user.contributions?.shares || 0 
                : user?.contributions || 0}
            </div>
            <div className="text-sm text-gray-600">Paylaşım</div>
          </div>
          <div className="text-center">
            <div className="text-2xl text-green-600">
              {typeof user?.contributions === 'object' 
                ? user.contributions?.verifications || 0 
                : 0}
            </div>
            <div className="text-sm text-gray-600">Doğrulama</div>
          </div>
          <div className="text-center">
            <div className="text-2xl text-green-600">{user?.points || 0}</div>
            <div className="text-sm text-gray-600">Puan</div>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className="w-full bg-white rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5 text-gray-600" />
              <span>{item.label}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        ))}

        <button
          onClick={handleLogout}
          className="w-full bg-white rounded-lg p-4 flex items-center gap-3 hover:bg-red-50 transition-colors text-red-600"
        >
          <LogOut className="w-5 h-5" />
          <span>Çıkış Yap</span>
        </button>
      </div>
    </div>
  );
}
