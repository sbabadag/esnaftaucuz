import { useEffect, useState } from 'react';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { campaignsAPI } from '../services/supabase-api';

interface Campaign {
  id: string;
  merchant_id: string;
  title: string;
  description?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
  created_at?: string;
}

const isLive = (c: Campaign) => {
  if (c.is_active === false) return false;
  if (!c.ends_at) return true;
  return new Date(c.ends_at).getTime() > Date.now();
};

/**
 * Dükkan kampanyaları:
 * - Ziyaretçi görünümü: aktif kampanya banner'ları
 * - Kendi dükkanı: kampanya listesi + ekleme/silme yönetimi
 */
export default function ShopCampaignsSection({
  merchantId,
  isOwnShop,
}: {
  merchantId: string;
  isOwnShop: boolean;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', ends_at: '' });

  const loadCampaigns = async () => {
    if (!merchantId) return;
    const list = await campaignsAPI.listByMerchant(merchantId);
    setCampaigns(list);
  };

  useEffect(() => {
    void loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  const live = campaigns.filter(isLive);

  // Ziyaretçi görünümü: yalnızca aktif kampanya banner'ları
  if (!isOwnShop) {
    if (live.length === 0) return null;
    return (
      <div className="space-y-2 mb-4">
        {live.map((c) => (
          <div
            key={c.id}
            className="bg-amber-50 border border-amber-200 rounded-xl p-3.5"
          >
            <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
              <Megaphone className="w-4 h-4 shrink-0" />
              <span>{c.title}</span>
            </div>
            {c.description && (
              <p className="text-xs text-amber-800 mt-1">{c.description}</p>
            )}
            {c.ends_at && (
              <p className="text-[11px] text-amber-600 mt-1.5">
                ⏳ {new Date(c.ends_at).toLocaleDateString('tr-TR')} tarihine kadar
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Esnaf görünümü: yönetim
  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Kampanya başlığı gerekli');
      return;
    }
    setSaving(true);
    try {
      await campaignsAPI.upsert(merchantId, {
        title: form.title,
        description: form.description,
        ends_at: form.ends_at || null,
      });
      toast.success('Kampanya yayınlandı 🎉');
      setForm({ title: '', description: '', ends_at: '' });
      setDialogOpen(false);
      await loadCampaigns();
    } catch (error: any) {
      toast.error(error.message || 'Kampanya kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    const ok = await campaignsAPI.remove(id);
    if (ok) {
      toast.success('Kampanya kaldırıldı');
      await loadCampaigns();
    } else {
      toast.error('Kampanya silinemedi');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-amber-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-amber-600" />
          Kampanyalar ({campaigns.length})
        </h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> Kampanya Ekle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Kampanya</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label htmlFor="camp-title">Başlık</Label>
                <Input
                  id="camp-title"
                  placeholder="Örn: Hafta sonu %20 indirim"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="camp-desc">Açıklama (isteğe bağlı)</Label>
                <Textarea
                  id="camp-desc"
                  placeholder="Detaylar, geçerli ürünler..."
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="camp-ends">Bitiş tarihi (isteğe bağlı)</Label>
                <Input
                  id="camp-ends"
                  type="date"
                  value={form.ends_at}
                  onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                />
              </div>
              <Button
                className="w-full bg-amber-600 hover:bg-amber-700"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Kaydediliyor...' : 'Yayınla 🎉'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-xs text-gray-500">
          Henüz kampanya yok. "Kampanya Ekle" ile müşterilerine indirim duyur.
        </p>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className={`flex items-start justify-between gap-2 rounded-lg border p-3 ${
                isLive(c) ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">
                  {c.title}{' '}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isLive(c) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isLive(c) ? 'Yayında' : 'Süresi doldu'}
                  </span>
                </p>
                {c.description && (
                  <p className="text-xs text-gray-600 mt-0.5">{c.description}</p>
                )}
                {c.ends_at && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Bitiş: {new Date(c.ends_at).toLocaleDateString('tr-TR')}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:text-red-700 shrink-0"
                onClick={() => handleRemove(c.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
