import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, MapPin, Search, ShoppingBag, Tag, Camera, Send, PlusCircle } from 'lucide-react';
import { BuildVersionBadge } from '../BuildVersionBadge';

const STEP_DURATION_MS = 1800;

const tutorialSteps = [
  {
    id: 'add',
    icon: PlusCircle,
    title: '1) + ile ürün ekle',
    description: 'Alt bardaki + butonuna dokun ve fiyat ekleme akışını aç.',
    tap: { x: '50%', y: '92%' },
    action: 'Orta + butonuna dokun',
  },
  {
    id: 'product',
    icon: Search,
    title: '2) Ürün seç',
    description: 'Arama kutusuna ürün adını yaz ve listeden seç.',
    tap: { x: '22%', y: '24%' },
    action: 'Domates ürün kartına dokun',
  },
  {
    id: 'price',
    icon: Tag,
    title: '3) Fiyatı gir',
    description: 'Gördüğün fiyatı ve birimi gir.',
    tap: { x: '50%', y: '45%' },
    action: 'Fiyat alanına dokun: 34.90 TL',
  },
  {
    id: 'location',
    icon: MapPin,
    title: '4) Konumu seç',
    description: 'Aldığın yeri seçerek fiyatı konumla eşleştir.',
    tap: { x: '72%', y: '58%' },
    action: 'Konum kartı: Selcuklu Pazar',
  },
  {
    id: 'photo',
    icon: Camera,
    title: '5) Fotoğraf ekle',
    description: 'Etiket veya tezgah fotoğrafı ile doğrulamayı güçlendir.',
    tap: { x: '28%', y: '70%' },
    action: 'Kamera butonuna dokun',
  },
  {
    id: 'confirm',
    icon: Send,
    title: '6) Kontrol et ve paylaş',
    description: 'Bilgileri onayla ve gönder.',
    tap: { x: '50%', y: '84%' },
    action: 'Fiyati Paylaş butonuna dokun',
  },
  {
    id: 'search_product',
    icon: Search,
    title: '7) Ürünü ara',
    description: 'Ana ekranda aramaya ürün yaz ve filtrele.',
    tap: { x: '50%', y: '24%' },
    action: 'Arama kutusuna: domates',
  },
  {
    id: 'map_locate',
    icon: MapPin,
    title: '8) Haritada yerini bul',
    description: 'Ürünün satıldığı noktayı haritada aç.',
    tap: { x: '62%', y: '54%' },
    action: 'Haritada fiyat pinine dokun',
  },
];

interface SplashScreenProps {
  autoNavigateToOnboarding?: boolean;
}

export default function SplashScreen({ autoNavigateToOnboarding = true }: SplashScreenProps) {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % tutorialSteps.length);
    }, STEP_DURATION_MS);

    return () => {
      clearInterval(stepTimer);
    };
  }, []);

  useEffect(() => {
    if (!autoNavigateToOnboarding) return;

    const timer = setTimeout(() => {
      navigate('/onboarding');
    }, tutorialSteps.length * STEP_DURATION_MS + 2000);

    return () => clearTimeout(timer);
  }, [autoNavigateToOnboarding, navigate]);

  const activeStepId = tutorialSteps[activeStep].id;
  const isAddStep = activeStepId === 'add';
  const isSearchMapStep = activeStepId === 'search_product' || activeStepId === 'map_locate';
  const isMapLocateStep = activeStepId === 'map_locate';
  const ActiveStepIcon = tutorialSteps[activeStep].icon;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-green-700 via-emerald-600 to-emerald-500 px-4 py-6 text-white">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto mb-4 flex max-w-md items-center justify-center gap-3"
      >
        <div className="rounded-full bg-white p-2">
          <ShoppingBag className="h-6 w-6 text-green-700" />
        </div>
        <h1 className="text-2xl font-semibold">Bugün Nerede Ucuz?</h1>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="mx-auto mb-4 max-w-md text-center text-sm text-white/90"
      >
        Tam ekran hızlı eğitim: yeni ürün fiyatı paylaşımı adım adım
      </motion.p>

      <div className="mx-auto w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative h-[68vh] min-h-[500px] overflow-hidden rounded-[30px] border border-white/40 bg-white shadow-2xl"
        >
          <div className="bg-green-600 px-4 pb-4 pt-6 text-white">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">
                {isAddStep ? 'Ana Ekran' : isSearchMapStep ? 'Ürün Ara ve Harita' : 'Yeni Fiyat Ekle'}
              </p>
              <span className="text-xs text-white/80">
                {activeStep + 1}/{tutorialSteps.length}
              </span>
            </div>
            <div className="flex gap-1">
              {tutorialSteps.map((step, index) => (
                <div
                  key={step.id}
                  className={`h-1 flex-1 rounded-full ${index <= activeStep ? 'bg-white' : 'bg-white/35'}`}
                />
              ))}
            </div>
          </div>

          <div className="relative h-[calc(100%-86px)] bg-gray-50 p-4 text-gray-800">
            {isAddStep ? (
              <>
                <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
                  <p className="mb-2 text-xs text-gray-500">Bugün En Ucuzlar</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2">
                      <span>Domates</span>
                      <span className="font-semibold text-green-700">34.90 TL</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2">
                      <span>Biber</span>
                      <span className="font-semibold text-green-700">42.50 TL</span>
                    </div>
                  </div>
                </div>
                <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-xs text-gray-500">En Yakın Pazarlar</p>
                  <div className="mt-2 rounded-lg bg-gray-100 px-3 py-2 text-sm">Selçuklu Pazarı • 1.2 km</div>
                </div>
              </>
            ) : isSearchMapStep ? (
              <>
                <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
                  <p className="mb-2 text-xs text-gray-500">Ürün Arama</p>
                  <div className="rounded-lg border border-gray-200 px-3 py-2 text-sm">domates</div>
                  <div className="mt-2 space-y-2 text-xs">
                    <div className="flex items-center justify-between rounded-md bg-green-100 px-2 py-2">
                      <span>Domates</span>
                      <span className="font-semibold text-green-700">34.90 TL</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-gray-100 px-2 py-2">
                      <span>Domates (Market)</span>
                      <span className="font-semibold text-gray-700">39.00 TL</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="mb-2 text-xs text-gray-500">Harita</p>
                  <div className="relative h-48 overflow-hidden rounded-lg bg-emerald-50">
                    <div className="absolute inset-0 opacity-60">
                      <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,#bbf7d0_0%,transparent_35%),radial-gradient(circle_at_70%_70%,#a7f3d0_0%,transparent_35%)]" />
                    </div>
                    <div className="absolute left-[58%] top-[48%] rounded-full bg-green-600 p-2 text-white shadow-lg">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="absolute bottom-2 left-2 rounded-md bg-white/95 px-2 py-1 text-xs text-gray-700">
                      Selçuklu Pazarı • 1.2 km
                    </div>
                  </div>
                  {isMapLocateStep && (
                    <div className="mt-2 rounded-md bg-green-100 px-2 py-1 text-xs text-green-700">
                      Pin seçildi: Navigasyon açılıyor
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
                  <p className="mb-2 text-xs text-gray-500">Ürün Ara</p>
                  <div className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    domates
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-green-100 px-2 py-1 text-green-700">Domates</div>
                    <div className="rounded-md bg-gray-100 px-2 py-1">Biber</div>
                  </div>
                </div>

                <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
                  <p className="mb-2 text-xs text-gray-500">Fiyat Bilgisi</p>
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                    <span className="text-sm font-semibold text-green-700">34.90 TL</span>
                    <span className="text-xs text-gray-500">/ kg</span>
                  </div>
                </div>

                <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
                  <p className="mb-2 text-xs text-gray-500">Konum</p>
                  <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm">Selçuklu Pazar</div>
                </div>

                <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
                  <p className="mb-2 text-xs text-gray-500">Fotoğraf</p>
                  <div className="h-14 rounded-lg border border-dashed border-gray-300 bg-gray-50" />
                </div>

                <button className="absolute bottom-16 left-4 right-4 flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-medium text-white">
                  <CheckCircle2 className="h-4 w-4" />
                  Fiyatı Paylaş
                </button>
              </>
            )}

            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t border-gray-200 bg-white px-6 py-2 text-gray-500">
              <span className="text-xs">Keşfet</span>
              <div className="relative -mt-6 rounded-full bg-green-600 p-3 text-white shadow-lg">
                <PlusCircle className="h-5 w-5" />
              </div>
              <div className="text-right">
                <span className="text-xs">Profil</span>
              </div>
            </div>

            <motion.div
              key={tutorialSteps[activeStep].id}
              className="pointer-events-none absolute"
              style={{
                left: tutorialSteps[activeStep].tap.x,
                top: tutorialSteps[activeStep].tap.y,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: [1, 1.12, 1] }}
              transition={{ duration: 0.7, repeat: Infinity }}
            >
              <div className="relative h-11 w-11 rounded-full bg-green-500/20">
                <div className="absolute inset-2 rounded-full bg-green-500/50" />
                <div className="absolute inset-[14px] rounded-full bg-green-600" />
              </div>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-4 rounded-2xl bg-white/95 p-4 text-gray-800"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={tutorialSteps[activeStep].id}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.25 }}
              className="flex items-start gap-3"
            >
              <div className="rounded-full bg-green-100 p-2">
                <ActiveStepIcon className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <p className="text-sm font-semibold">{tutorialSteps[activeStep].title}</p>
                <p className="text-xs text-gray-600">{tutorialSteps[activeStep].description}</p>
                <p className="mt-1 text-xs font-medium text-green-700">{tutorialSteps[activeStep].action}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="mt-auto shrink-0 pt-4 pb-2">
        <BuildVersionBadge variant="onDark" />
      </div>
    </div>
  );
}
