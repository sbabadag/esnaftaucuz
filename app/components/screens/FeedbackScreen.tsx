import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { feedbackAPI } from '../../services/supabase-api';
import { useAuth } from '../../contexts/AuthContext';

export default function FeedbackScreen() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error('Lütfen bir mesaj girin');
      return;
    }
    setLoading(true);
    try {
      await feedbackAPI.send({
        user_id: user?.id || null,
        message: message.trim(),
        platform: 'web',
      });
      toast.success('Geri bildiriminiz gönderildi. Teşekkürler!');
      navigate(-1);
    } catch (err) {
      console.error('Feedback send error:', err);
      toast.error('Gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 bg-background">
      <div className="max-w-lg mx-auto bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl mb-4">Destek & Geri Bildirim</h2>
        <textarea
          aria-label="Feedback message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full p-3 border rounded mb-4 min-h-[120px]"
        />
        <div className="flex gap-2">
          <Button onClick={() => navigate(-1)} className="flex-1" variant="secondary">İptal</Button>
          <Button onClick={handleSubmit} className="flex-1" disabled={loading}>{loading ? 'Gönderiliyor...' : 'Gönder'}</Button>
        </div>
      </div>
    </div>
  );
}

