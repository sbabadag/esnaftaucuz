import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, Users, MapPin } from 'lucide-react';
import { Button } from '../ui/button';

const onboardingData = [
  {
    icon: Eye,
    title: 'Alışverişten önce bak',
    description: 'Pazara, markete gitmeden önce fiyatları gör.',
    subtext: 'Bugün girilen fiyatlar her zaman üstte.',
  },
  {
    icon: Users,
    title: 'Halktan halka fiyat',
    description: 'Fiyatları sen gir, herkes faydalansın.',
    subtext: 'Fotoğraf ve doğrulama ile daha güvenilir.',
  },
  {
    icon: MapPin,
    title: 'Sana yakın en ucuz',
    description: 'Konumuna göre en uygun fiyatlar listelensin.',
    subtext: 'Konya\'ya özel, mahalle mahalle.',
  },
];

export default function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const isLastStep = currentStep === onboardingData.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
      navigate('/location');
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const currentData = onboardingData[currentStep];
  const Icon = currentData.icon;

  return (
    <div className="min-h-screen bg-white flex flex-col p-6">
      <div className="flex-1 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md flex flex-col items-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="bg-green-100 rounded-full p-12 mb-8"
            >
              <Icon className="w-20 h-20 text-green-600" />
            </motion.div>

            <h2 className="text-3xl text-center mb-4 text-gray-900">
              {currentData.title}
            </h2>
            
            <p className="text-center text-lg text-gray-600 mb-3">
              {currentData.description}
            </p>
            
            <p className="text-center text-sm text-gray-500">
              {currentData.subtext}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="space-y-4">
        <div className="flex justify-center gap-2 mb-6">
          {onboardingData.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentStep ? 'bg-green-600 w-8' : 'bg-gray-300 w-2'
              }`}
            />
          ))}
        </div>

        <Button
          onClick={handleNext}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg"
        >
          {isLastStep ? 'Başlayalım' : 'Devam et'}
        </Button>
      </div>
    </div>
  );
}
