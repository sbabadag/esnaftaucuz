import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { useGeolocation } from '../../../src/hooks/useGeolocation';
import { isNative } from '../../../src/utils/capacitor';
import { Geolocation } from '@capacitor/geolocation';
import { useAuth } from '../../contexts/AuthContext';

export default function LocationPermissionScreen({ onAllow }: { onAllow: () => void }) {
  const navigate = useNavigate();
  const { getCurrentPosition } = useGeolocation();
  const { user } = useAuth(); // Check if user is logged in
  const [isRequesting, setIsRequesting] = useState(false);

  const hasNativePermission = (permissions: any) => {
    const fine = String(permissions?.location || '').toLowerCase();
    const coarse = String(permissions?.coarseLocation || '').toLowerCase();
    return fine === 'granted' || coarse === 'granted';
  };
  
  // Determine where to navigate after location permission
  const getNextRoute = () => {
    if (user) {
      // User is logged in, go to main app
      return '/app/explore';
    } else {
      // User is not logged in, go to login
      return '/login';
    }
  };

  const handleAllow = async () => {
    setIsRequesting(true);
    
    try {
      // On native, check and request permissions first
      if (isNative()) {
        try {
          // Check if permissions are already granted
          const permissions = await Geolocation.checkPermissions();
          console.log('📱 Native: Current permissions:', permissions);
          
          if (hasNativePermission(permissions)) {
            // Already granted, get position with timeout
            console.log('📱 Native: Permission already granted, getting position...');
            
            // Add timeout for getCurrentPosition (20 seconds)
            const positionPromise = getCurrentPosition();
            const positionTimeout = new Promise<null>((resolve) => 
              setTimeout(() => {
                console.warn('📱 Native: getCurrentPosition timeout (20s)');
                resolve(null);
              }, 20000)
            );
            
            const position = await Promise.race([positionPromise, positionTimeout]);
            
            if (position) {
              toast.success('Konum izni zaten verilmiş');
              onAllow();
              navigate(getNextRoute());
              return;
            } else {
              console.warn('📱 Native: Permission granted but position not available or timeout');
              toast.warning('Konum izni verilmiş ancak konum alınamadı. GPS\'i açık olduğundan emin olun.');
              // Still navigate - permission is granted, position can be obtained later
              onAllow();
              navigate(getNextRoute());
              return;
            }
          } else if (
            permissions.location === 'prompt' ||
            permissions.location === 'prompt-with-rationale' ||
            permissions.coarseLocation === 'prompt' ||
            permissions.coarseLocation === 'prompt-with-rationale'
          ) {
            // Request permission with timeout
            console.log('📱 Native: Requesting location permission...');
            
            // On both iOS and Android, requestPermissions() shows the system dialog
            // We need to wait for user response, but also handle timeout
            const permissionPromise = Geolocation.requestPermissions();
            const timeoutPromise = new Promise<{ location: string }>((resolve) => 
              setTimeout(() => {
                console.warn('📱 Native: Permission request timeout (30s) - user may not have responded');
                // Return denied status on timeout
                resolve({ location: 'denied' });
              }, 30000)
            );
            
            const requestResult = await Promise.race([permissionPromise, timeoutPromise]);
            console.log('📱 Native: Permission request result:', requestResult);
            
            if (hasNativePermission(requestResult)) {
              // Wait for the system to fully process the permission
              // iOS needs more time, Android is usually faster
              console.log('📱 Native: Permission granted, waiting for system to process...');
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Permission granted, get position with timeout
              console.log('📱 Native: Getting position...');
              
              // Add timeout for getCurrentPosition (20 seconds)
              const positionPromise = getCurrentPosition();
              const positionTimeout = new Promise<null>((resolve) => 
                setTimeout(() => {
                  console.warn('📱 Native: getCurrentPosition timeout (20s)');
                  resolve(null);
                }, 20000)
              );
              
              const position = await Promise.race([positionPromise, positionTimeout]);
              
              if (position) {
                toast.success('Konum izni verildi');
                onAllow();
                navigate(getNextRoute());
                return;
              } else {
                console.warn('📱 Native: Permission granted but position not available or timeout');
                toast.warning('Konum izni verildi ancak konum alınamadı. GPS\'i açık olduğundan emin olun.');
                // Still navigate - permission is granted, position can be obtained later
                onAllow();
                navigate(getNextRoute());
                return;
              }
            } else if (requestResult.location === 'denied') {
              // Permission denied or timeout
              console.log('📱 Native: Permission denied or timeout:', requestResult.location);
              toast.error('Konum izni reddedildi veya zaman aşımına uğradı. Ayarlardan izin verebilirsiniz.');
              navigate(getNextRoute());
              return;
            } else {
              // Other status (prompt, etc.)
              console.log('📱 Native: Permission status:', requestResult.location);
              toast.warning('Konum izni durumu belirsiz. Ayarlardan kontrol edebilirsiniz.');
              navigate(getNextRoute());
              return;
            }
          } else {
            // Permission denied
            console.log('📱 Native: Permission already denied:', permissions.location);
            toast.error('Konum izni reddedildi. Ayarlardan izin verebilirsiniz.');
            navigate(getNextRoute());
            return;
          }
        } catch (error: any) {
          console.error('📱 iOS: Permission error:', error);
          
          // If timeout, still try to navigate
          if (error.message?.includes('timeout')) {
            console.warn('📱 iOS: Permission request timeout, navigating anyway');
            toast.warning('Konum izni isteği zaman aşımına uğradı. Ayarlardan manuel olarak izin verebilirsiniz.');
            navigate(getNextRoute());
            return;
          }
          
          toast.error('Konum izni alınamadı: ' + (error.message || 'Bilinmeyen hata'));
          navigate(getNextRoute());
          return;
        }
      } else {
        // Web - use HTML5 geolocation
        console.log('🌐 Web: Requesting geolocation...');
        try {
          const position = await getCurrentPosition();
          if (position) {
            console.log('✅ Web: Position obtained:', position);
            toast.success('Konum izni verildi');
            onAllow();
            navigate(getNextRoute());
          } else {
            console.warn('⚠️ Web: Position is null');
            toast.error('Konum izni reddedildi');
            navigate(getNextRoute());
          }
        } catch (geoError: any) {
          console.error('Web geolocation error:', geoError);
          throw geoError; // Re-throw to be caught by outer catch
        }
      }
    } catch (error: any) {
      console.error('Location error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      if (error.code === 1) {
        // PERMISSION_DENIED
        toast.error('Konum izni reddedildi. Tarayıcı ayarlarından izin verebilirsiniz.', {
          duration: 5000,
        });
      } else if (error.code === 2) {
        // POSITION_UNAVAILABLE
        toast.error('Konum bilgisi alınamadı. Lütfen GPS\'i açın veya internet bağlantınızı kontrol edin.', {
          duration: 5000,
        });
      } else if (error.code === 3) {
        // TIMEOUT
        toast.error('Konum isteği zaman aşımına uğradı. Lütfen tekrar deneyin veya "Şimdilik Geç" butonuna tıklayın.', {
          duration: 5000,
        });
      } else if (error.message?.includes('not supported')) {
        toast.error('Tarayıcınız konum özelliğini desteklemiyor.', {
          duration: 5000,
        });
      } else {
        toast.error('Konum alınamadı: ' + (error.message || 'Bilinmeyen hata'), {
          duration: 5000,
        });
      }
      navigate(getNextRoute());
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSkip = () => {
    navigate(getNextRoute());
  };

  return (
    <div className="min-h-screen bg-white flex flex-col p-6">
      <div className="flex-1 flex flex-col items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="bg-green-100 rounded-full p-16 mb-8"
        >
          <MapPin className="w-24 h-24 text-green-600" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl text-center mb-4 text-gray-900"
        >
          Konumunu kullanalım mı?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center text-lg text-gray-600 max-w-md"
        >
          Sana en yakın ve güncel fiyatları gösterebilmemiz için konumuna ihtiyacımız var.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-3"
      >
        <Button
          onClick={handleAllow}
          disabled={isRequesting}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg disabled:opacity-50"
        >
          {isRequesting ? 'İzin isteniyor...' : 'Konumu Aç'}
        </Button>

        <Button
          onClick={handleSkip}
          variant="ghost"
          disabled={isRequesting}
          className="w-full text-gray-600 hover:text-gray-900 py-6 text-lg"
        >
          Şimdilik Geç
        </Button>
      </motion.div>
    </div>
  );
}
