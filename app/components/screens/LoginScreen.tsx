import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShoppingBag, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

type AuthMode = 'login' | 'register';

export default function LoginScreen({ onLogin }: { onLogin?: () => void }) {
  const navigate = useNavigate();
  const { register, login, googleLogin, guestLogin } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });
  const [isMerchant, setIsMerchant] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      // For demo: Simulated Google OAuth
      // In production, use Google OAuth library or backend OAuth flow
      const mockEmail = `user_${Date.now()}@gmail.com`;
      const mockName = 'Google Kullanıcı';
      const mockGoogleId = `google_${Date.now()}`;
      
      await googleLogin();
      toast.success('Google ile giriş yapıldı');
      onLogin?.();
      navigate('/app/explore');
    } catch (error: any) {
      toast.error(error.message || 'Google ile giriş başarısız');
      console.error('Google login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'register') {
      if (!formData.name.trim()) {
        toast.error('Lütfen adınızı girin');
        return;
      }
    }

    if (!formData.email.trim() || !formData.password.trim()) {
      toast.error('Lütfen email ve şifre girin');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Geçerli bir email adresi girin');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalı');
      return;
    }

    try {
      setIsLoading(true);

      if (mode === 'register') {
        await register(formData.email, formData.password, formData.name, isMerchant);
        toast.success(isMerchant ? 'Esnaf kaydı başarılı! Hoş geldiniz' : 'Kayıt başarılı! Hoş geldiniz');
      } else {
        await login(formData.email, formData.password);
        toast.success('Giriş başarılı');
      }

      onLogin?.();
      navigate('/app/explore');
    } catch (error: any) {
      console.error('Auth error:', error);
      const errorMessage = error.message || (mode === 'register' ? 'Kayıt başarısız' : 'Giriş başarısız');
      
      // Check if it's a network error
      if (errorMessage.includes('bağlanılamıyor') || errorMessage.includes('fetch')) {
        toast.error('Backend\'e bağlanılamıyor. Lütfen backend\'in çalıştığından emin olun.', {
          duration: 5000,
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    try {
      setIsLoading(true);
      await guestLogin();
      toast.info('Misafir olarak devam ediliyor');
      navigate('/app/explore');
    } catch (error: any) {
      toast.error(error.message || 'Giriş başarısız');
      console.error('Guest login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex flex-col p-6">
      <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full mx-auto">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", duration: 0.8 }}
          className="bg-white rounded-full p-8 shadow-lg mb-8"
        >
          <ShoppingBag className="w-20 h-20 text-green-600" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl text-center mb-2 text-gray-900"
        >
          {mode === 'login' ? 'Hoş geldin' : 'Kayıt ol'}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center text-gray-600 mb-8"
        >
          {mode === 'login' 
            ? 'Devam etmek için giriş yap' 
            : 'Hesap oluştur ve fiyat paylaşmaya başla'}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full space-y-4"
        >
          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === 'register' && (
              <div>
                <Label htmlFor="name">Ad Soyad</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Adınız ve soyadınız"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>
            )}

            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="ornek@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Şifre</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'register' ? 'En az 6 karakter' : 'Şifreniz'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isMerchant"
                  checked={isMerchant}
                  onChange={(e) => setIsMerchant(e.target.checked)}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <label htmlFor="isMerchant" className="text-sm text-gray-700 cursor-pointer">
                  Esnaf olarak kayıt olmak istiyorum
                </label>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg disabled:opacity-50"
            >
              {isLoading ? 'İşleniyor...' : mode === 'login' ? 'Giriş Yap' : (isMerchant ? 'Esnaf Kayıt' : 'Kayıt Ol')}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gradient-to-br from-green-50 to-emerald-50 text-gray-500">
                veya
              </span>
            </div>
          </div>

          {/* Google Login */}
          <Button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 py-6 text-lg shadow-sm flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google ile {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
          </Button>

          {/* Toggle Mode */}
          <div className="text-center">
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setFormData({ email: '', password: '', name: '' });
                setIsMerchant(false);
              }}
              className="text-sm text-green-600 hover:text-green-700 underline"
            >
              {mode === 'login' 
                ? 'Hesabın yok mu? Kayıt ol' 
                : 'Zaten hesabın var mı? Giriş yap'}
            </button>
          </div>

          {/* Guest Login */}
          <button
            onClick={handleGuestLogin}
            disabled={isLoading}
            className="w-full text-green-600 hover:text-green-700 py-4 text-lg underline disabled:opacity-50"
          >
            Misafir Olarak Devam Et
          </button>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center text-sm text-gray-500 mt-8"
      >
        Giriş yaparak kullanım şartlarını kabul etmiş olursun.
      </motion.p>
    </div>
  );
}
