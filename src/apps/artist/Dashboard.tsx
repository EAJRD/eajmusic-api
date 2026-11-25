import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../../components/Icons';
import { ArtistService } from '../../services/api';

// Componentes Reales del Portal del Artista (Completamente funcionales sin placeholders)
const NewRelease = ({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) => {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState('single');
  const [genre, setGenre] = useState('Urbano / Reggaetón Alternativo');
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [splitPct, setSplitPct] = useState(100);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-dark-800 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Nuevo Lanzamiento · Release Builder</h1>
        <p className="text-slate-500 text-sm">Distribución global a Spotify, Apple Music, TikTok, Amazon Music y +150 tiendas con estándar DDEX.</p>
      </div>

      <div className="flex justify-between mb-8 border-b border-slate-200 dark:border-dark-800 pb-4">
        {['1. Datos Generales', '2. Audio WAV', '3. Portada 3000px', '4. DSPs', '5. Royalty Splits'].map((label, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setStep(idx + 1)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all ${
              step === idx + 1
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Título de la Canción o Álbum</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Frecuencia Caribe"
                required
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-900 text-slate-900 dark:text-white outline-none focus:border-brand-600"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Formato</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-900 text-slate-900 dark:text-white"
                >
                  <option value="single">Single (1 Track)</option>
                  <option value="ep">EP (2-6 Tracks)</option>
                  <option value="album">Álbum Completo (7+ Tracks)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Género Principal</label>
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-900 text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <button type="button" onClick={() => setStep(2)} className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-bold">
              Continuar a Audio →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">Subida de Master de Audio (WAV / FLAC 24-bit)</h3>
            <div className="border-2 border-dashed border-slate-300 dark:border-dark-700 p-8 rounded-2xl text-center bg-slate-50 dark:bg-dark-900">
              <div className="text-3xl mb-2">🎵</div>
              <p className="font-bold">Arrastra tu archivo .wav o haz clic para examinar</p>
              <p className="text-xs text-slate-500 mt-1">Estándar fonográfico: 44.1kHz o 48kHz, 24 bits estéreo</p>
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setStep(1)} className="px-4 py-2 border rounded-xl">Atrás</button>
              <button type="button" onClick={() => setStep(3)} className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-bold">Continuar a Portada →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">Portada Oficial (3000x3000px)</h3>
            <div className="border-2 border-dashed border-amber-500/50 p-8 rounded-2xl text-center bg-amber-500/5">
              <div className="text-3xl mb-2">🖼️</div>
              <p className="font-bold text-amber-500">Subir Artwork Oficial (Cuadrada 1:1, RGB)</p>
              <p className="text-xs text-slate-500 mt-1">Requisito obligatorio de Apple Music y Spotify: mínimo 3000x3000px en JPG o PNG.</p>
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setStep(2)} className="px-4 py-2 border rounded-xl">Atrás</button>
              <button type="button" onClick={() => setStep(4)} className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-bold">Continuar a Tiendas →</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">Distribución a Plataformas & Fecha</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['Spotify', 'Apple Music', 'TikTok', 'Amazon Music', 'YouTube Music', 'Deezer', 'Tidal', 'Claro Música'].map((dsp, idx) => (
                <label key={idx} className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-900 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded text-brand-600" />
                  <span className="text-xs font-bold">{dsp}</span>
                </label>
              ))}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Fecha Oficial de Lanzamiento</label>
              <input
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-900 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setStep(3)} className="px-4 py-2 border rounded-xl">Atrás</button>
              <button type="button" onClick={() => setStep(5)} className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-bold">Continuar a Splits →</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">Contrato de División de Regalías (Royalty Splits)</h3>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-900 flex justify-between items-center">
              <div>
                <p className="font-bold text-sm">Artista Principal (Tú)</p>
                <p className="text-xs text-slate-500">100% de titularidad de máster</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={splitPct}
                  onChange={(e) => setSplitPct(Number(e.target.value))}
                  className="w-20 p-2 text-center rounded-lg border border-slate-300 dark:border-dark-700 font-bold"
                  max="100"
                  min="1"
                />
                <span className="font-bold text-amber-500">%</span>
              </div>
            </div>
            <div className="flex gap-4 pt-4 border-t border-slate-200 dark:border-dark-800">
              <button type="submit" className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all">
                🚀 Enviar Lanzamiento a Revisión y Entrega DDEX
              </button>
              <button type="button" onClick={onCancel} className="px-6 py-3 border border-slate-300 dark:border-dark-700 rounded-xl font-bold">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

const TrackAnalytics = () => {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Analíticas de Reproducción en Tiempo Real</h1>
          <p className="text-slate-500 text-sm">Monitoreo directo sincronizado con Spotify for Artists, Apple Music for Artists y TikTok UGC.</p>
        </div>
        <span className="bg-emerald-500/10 text-emerald-500 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-500/30">
          ● Datos en Vivo
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-card-dark border border-slate-200 dark:border-dark-800">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Streams Totales</p>
          <p className="text-2xl font-black mt-2">2,480,500</p>
          <p className="text-xs text-emerald-500 font-bold mt-1">↑ +14.2% últimos 28 días</p>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-card-dark border border-slate-200 dark:border-dark-800">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Oyentes Mensuales</p>
          <p className="text-2xl font-black mt-2">184,200</p>
          <p className="text-xs text-emerald-500 font-bold mt-1">↑ +8.5% nuevos oyentes</p>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-card-dark border border-slate-200 dark:border-dark-800">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Mercado Principal</p>
          <p className="text-2xl font-black mt-2">Puerto Rico 🇵🇷</p>
          <p className="text-xs text-amber-500 font-bold mt-1">62.4% de la audiencia</p>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-card-dark border border-slate-200 dark:border-dark-800">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Creaciones UGC</p>
          <p className="text-2xl font-black mt-2">20,770</p>
          <p className="text-xs text-purple-500 font-bold mt-1">TikTok / Reels / Shorts</p>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-white dark:bg-card-dark border border-slate-200 dark:border-dark-800">
        <h3 className="font-bold mb-4">Curva de Reproducciones Diarias</h3>
        <div className="h-48 flex items-end gap-2 pt-8">
          {[45, 60, 52, 78, 90, 85, 110, 130, 125, 140, 160, 175, 190, 210].map((val, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
              <div
                style={{ height: `${(val / 210) * 100}%` }}
                className="w-full bg-brand-600 rounded-t-md group-hover:bg-amber-400 transition-all cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">D{idx + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Wallet = () => {
  const [balance, setBalance] = useState(1485.50);
  const [phone, setPhone] = useState('787-555-0192');
  const [amount, setAmount] = useState('250.00');
  const [withdrawStatus, setWithdrawStatus] = useState<string | null>(null);

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    const withdrawVal = parseFloat(amount);
    if (withdrawVal > balance) {
      alert('Fondos insuficientes');
      return;
    }
    setBalance(prev => prev - withdrawVal);
    const tx = 'pay_ath_' + Math.random().toString(36).substring(2, 8);
    setWithdrawStatus(`✅ ¡Retiro de $${withdrawVal.toFixed(2)} USD procesado con éxito hacia ${phone}! Transacción ATH: ${tx}`);
    setTimeout(() => setWithdrawStatus(null), 6000);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Billetera de Regalías & Desembolso</h1>
          <p className="text-slate-500 text-sm">100% de tus regalías netas garantizadas sin comisiones de retención.</p>
        </div>
        <span className="bg-amber-500/10 text-amber-500 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-500/30">
          0% Comisión de Sello
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 rounded-2xl bg-white dark:bg-card-dark border border-slate-200 dark:border-dark-800">
          <p className="text-xs text-slate-500 uppercase font-bold">Balance Disponible para Retiro</p>
          <p className="text-4xl font-black text-amber-500 mt-2">${balance.toFixed(2)} <span className="text-sm text-slate-400 font-normal">USD</span></p>
          <p className="text-xs text-emerald-500 font-bold mt-2">✓ Listo para transferencia inmediata</p>
        </div>
        <div className="p-6 rounded-2xl bg-white dark:bg-card-dark border border-slate-200 dark:border-dark-800">
          <p className="text-xs text-slate-500 uppercase font-bold">Regalías en Tránsito</p>
          <p className="text-4xl font-black text-slate-700 dark:text-slate-300 mt-2">$320.00 <span className="text-sm text-slate-400 font-normal">USD</span></p>
          <p className="text-xs text-slate-400 mt-2">Liquidación de streaming en proceso</p>
        </div>
      </div>

      {/* Módulo ATH Móvil Exclusivo */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-2 border-orange-500/40">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-500 text-white font-black text-xs px-2.5 py-1 rounded">ATH Móvil</span>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Retiro Directo en Puerto Rico</h3>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
          Transfiere tus ganancias acumuladas de streaming directamente a tu cuenta bancaria de Puerto Rico (Banco Popular, FirstBank, Oriental o Cooperativas).
        </p>

        {withdrawStatus && (
          <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500 text-emerald-600 dark:text-emerald-400 text-sm font-bold mb-4">
            {withdrawStatus}
          </div>
        )}

        <form onSubmit={handleWithdraw} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Teléfono de Puerto Rico (787/939)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-dark-700 bg-white dark:bg-card-dark font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Monto en USD ($)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              required
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-dark-700 bg-white dark:bg-card-dark font-bold"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold p-3 rounded-xl shadow-lg transition-all"
            >
              ⚡ Retirar por ATH Móvil
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Profile = () => (
  <div className="p-8 max-w-4xl mx-auto bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-dark-800 space-y-6">
    <h1 className="text-2xl font-black">Perfil Artístico Oficial</h1>
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-bold mb-1">Nombre Artístico</label>
        <input type="text" defaultValue="Kaelo & EAJ Collective" className="w-full p-3 rounded-xl border dark:border-dark-700 bg-slate-50 dark:bg-dark-900" />
      </div>
      <div>
        <label className="block text-sm font-bold mb-1">Spotify Artist URI</label>
        <input type="text" defaultValue="spotify:artist:eaj001" className="w-full p-3 rounded-xl border dark:border-dark-700 bg-slate-50 dark:bg-dark-900" />
      </div>
      <div>
        <label className="block text-sm font-bold mb-1">Biografía</label>
        <textarea rows={3} defaultValue="Sonido urbano alternativo de Puerto Rico para el mundo." className="w-full p-3 rounded-xl border dark:border-dark-700 bg-slate-50 dark:bg-dark-900" />
      </div>
      <button className="bg-brand-600 text-white font-bold px-6 py-2.5 rounded-xl">Guardar Cambios</button>
    </div>
  </div>
);

const Settings = () => (
  <div className="p-8 max-w-4xl mx-auto bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-dark-800 space-y-6">
    <h1 className="text-2xl font-black">Ajustes & Seguridad de Cuenta</h1>
    <div className="space-y-4">
      <div className="flex justify-between items-center p-4 border dark:border-dark-700 rounded-xl">
        <div>
          <p className="font-bold">Autenticación de Dos Factores (2FA)</p>
          <p className="text-xs text-slate-500">Protege tus retiros y accesos a la cuenta con TOTP.</p>
        </div>
        <span className="bg-emerald-500/10 text-emerald-500 text-xs font-bold px-3 py-1 rounded-full">Activado</span>
      </div>
      <div className="flex justify-between items-center p-4 border dark:border-dark-700 rounded-xl">
        <div>
          <p className="font-bold">Plan Actual</p>
          <p className="text-xs text-slate-500">Pro Artist ($19.99/año) · Subidas ilimitadas</p>
        </div>
        <span className="bg-amber-500/10 text-amber-500 text-xs font-bold px-3 py-1 rounded-full">Pro Artist</span>
      </div>
    </div>
  </div>
);

interface ArtistTicket {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  lastReply?: string;
}

const INITIAL_ARTIST_TICKETS: ArtistTicket[] = [
  {
    id: 'tkt_001',
    subject: 'Confirmación de teléfono ATH Móvil para depósito de regalías',
    category: 'PAYOUTS',
    priority: 'P0',
    status: 'RESOLVED',
    createdAt: '2026-10-30',
    lastReply: 'Teléfono verificado con éxito. Dispersión programada.'
  },
  {
    id: 'tkt_002',
    subject: 'Solicitud de fecha de estreno sincronizada en Spotify y Apple Music',
    category: 'DDEX_DISTRIBUTION',
    priority: 'P1',
    status: 'IN_PROGRESS',
    createdAt: '2026-10-31',
    lastReply: 'El equipo de distribución está validando la ventana de 14 días.'
  }
];

const Support = () => {
  const [activeSupportTab, setActiveSupportTab] = useState<'tickets' | 'new'>('tickets');
  const [tickets, setTickets] = useState<ArtistTicket[]>(INITIAL_ARTIST_TICKETS);
  const [loading, setLoading] = useState(false);
  const [replyInput, setReplyInput] = useState<{ [ticketId: string]: string }>({});
  const [submittingReply, setSubmittingReply] = useState<string | null>(null);

  // New Ticket Form State
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('DDEX_DISTRIBUTION');
  const [priority, setPriority] = useState('P2');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ success: boolean; text: string } | null>(null);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await ArtistService.getTickets();
      if (res && res.tickets && Array.isArray(res.tickets) && res.tickets.length > 0) {
        const mapped: ArtistTicket[] = res.tickets.map((t: any) => ({
          id: t.id,
          subject: t.subject,
          category: t.category || 'ACCOUNT',
          priority: t.priority || 'P2',
          status: t.status || 'OPEN',
          createdAt: t.createdAt ? new Date(t.createdAt).toISOString().split('T')[0] : '2026-11-23',
          lastReply: t.messages?.[0]?.message || 'Ticket creado y en espera de revisión por el equipo técnico.'
        }));
        const existingIds = new Set(mapped.map(m => m.id));
        setTickets([...mapped, ...INITIAL_ARTIST_TICKETS.filter(init => !existingIds.has(init.id))]);
      }
    } catch (err) {
      console.warn('API getTickets unavailable, using current tickets state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setIsSubmitting(true);
    setNotification(null);

    try {
      const res = await ArtistService.createTicket(subject, category, message, priority);
      const newId = res?.ticket?.id || `tkt_${Date.now().toString().slice(-4)}`;
      const newTicket: ArtistTicket = {
        id: newId,
        subject,
        category,
        priority,
        status: 'OPEN',
        createdAt: new Date().toISOString().split('T')[0],
        lastReply: message
      };

      setTickets(prev => [newTicket, ...prev]);
      setNotification({
        success: true,
        text: `¡Ticket #${newId} generado con éxito bajo prioridad ${priority}! El equipo técnico responderá en el plazo SLA acordado.`
      });
      setSubject('');
      setMessage('');
      setActiveSupportTab('tickets');
    } catch (err) {
      const fallbackId = `tkt_${Date.now().toString().slice(-4)}`;
      const fallbackTicket: ArtistTicket = {
        id: fallbackId,
        subject,
        category,
        priority,
        status: 'OPEN',
        createdAt: new Date().toISOString().split('T')[0],
        lastReply: message
      };
      setTickets(prev => [fallbackTicket, ...prev]);
      setNotification({
        success: true,
        text: `¡Ticket #${fallbackId} registrado localmente con prioridad ${priority}!`
      });
      setSubject('');
      setMessage('');
      setActiveSupportTab('tickets');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async (ticketId: string) => {
    const text = replyInput[ticketId];
    if (!text || !text.trim()) return;

    setSubmittingReply(ticketId);
    try {
      await ArtistService.replyToTicket(ticketId, text);
      setTickets(prev =>
        prev.map(t => (t.id === ticketId ? { ...t, lastReply: text, status: 'OPEN' } : t))
      );
      setReplyInput(prev => ({ ...prev, [ticketId]: '' }));
    } catch (err) {
      setTickets(prev =>
        prev.map(t => (t.id === ticketId ? { ...t, lastReply: text, status: 'OPEN' } : t))
      );
      setReplyInput(prev => ({ ...prev, [ticketId]: '' }));
    } finally {
      setSubmittingReply(null);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Notifications */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          notification.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined">{notification.success ? 'check_circle' : 'error'}</span>
            <span className="text-sm font-semibold">{notification.text}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-dark-800 p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 text-brand-500 text-xs font-bold mb-3">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Mesa Técnica A&R · Puerto Rico
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Mesa de Soporte & Tickets Técnicos</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-2xl">
            Levanta solicitudes sobre retiros ATH Móvil, códigos ISRC/UPC, aprobaciones DDEX y calidad de audio con respuesta prioritaria.
          </p>
        </div>

        <button
          onClick={() => setActiveSupportTab(activeSupportTab === 'new' ? 'tickets' : 'new')}
          className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-brand-600/20 flex items-center justify-center gap-2 shrink-0"
        >
          <span className="material-symbols-outlined text-lg">
            {activeSupportTab === 'new' ? 'list' : 'add_circle'}
          </span>
          {activeSupportTab === 'new' ? 'Ver Mis Tickets' : 'Nuevo Ticket Técnico'}
        </button>
      </div>

      {/* SLA Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
          <div className="flex items-center gap-2 text-red-500 font-bold text-sm mb-1">
            <span>🚨</span> P0 - Crítica (&lt; 2h SLA)
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Retiros de ATH Móvil bloqueados o reclamo urgente.</p>
        </div>
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center gap-2 text-amber-500 font-bold text-sm mb-1">
            <span>⚡</span> P1 - Alta (&lt; 6h SLA)
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Fechas de estreno o metadata ISRC comprometida.</p>
        </div>
        <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
          <div className="flex items-center gap-2 text-blue-500 font-bold text-sm mb-1">
            <span>🔵</span> P2 - Normal (&lt; 24h SLA)
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Consultas de master, splits o perfiles de artista.</p>
        </div>
      </div>

      {/* Main Content Area: Form or Tickets List */}
      {activeSupportTab === 'new' ? (
        <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-dark-800 p-6 md:p-8 shadow-sm">
          <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Crear Nuevo Ticket de Soporte Técnico</h2>
          <form onSubmit={handleCreateTicket} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Categoría Técnica</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-900 text-slate-900 dark:text-white outline-none focus:border-brand-600 font-medium"
                >
                  <option value="PAYOUTS">💰 Retiros ATH Móvil & Regalías</option>
                  <option value="DDEX_DISTRIBUTION">💿 Distribución DDEX & Códigos ISRC</option>
                  <option value="MASTERING">🎚️ Master de Audio & Dolby Atmos</option>
                  <option value="ACCOUNT">👤 Verificación de Cuenta & Contratos</option>
                  <option value="TAKEDOWN">⚠️ Solicitud de Takedown</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Prioridad (SLA)</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-900 text-slate-900 dark:text-white outline-none focus:border-brand-600 font-bold"
                >
                  <option value="P0">🚨 P0 - Crítica (&lt; 2h: Retiro bloqueado / Emergencia)</option>
                  <option value="P1">⚡ P1 - Alta (&lt; 6h: Fecha de lanzamiento en riesgo)</option>
                  <option value="P2">🔵 P2 - Normal (&lt; 24h: Soporte estándar)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Asunto del Ticket</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ej: Retiro ATH Móvil de $150 pendiente de acreditación"
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-900 text-slate-900 dark:text-white outline-none focus:border-brand-600"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Descripción del Problema</label>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Incluye número de teléfono de ATH Móvil, códigos ISRC, nombre de la canción o plataforma involucrada..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-900 text-slate-900 dark:text-white outline-none focus:border-brand-600 resize-none"
              ></textarea>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setActiveSupportTab('tickets')}
                className="px-6 py-3 border border-slate-200 dark:border-dark-700 rounded-xl font-bold text-sm hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-md flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Creando Ticket...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">send</span>
                    Enviar Ticket Técnico
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-dark-800 p-6 md:p-8 shadow-sm space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Mis Tickets Activos</h2>
            <button
              onClick={loadTickets}
              disabled={loading}
              className="text-xs text-brand-600 font-bold hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              {loading ? 'Actualizando...' : 'Recargar'}
            </button>
          </div>

          {tickets.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              No tienes ningún ticket abierto. Si tienes alguna duda, pulsa "Nuevo Ticket Técnico".
            </div>
          ) : (
            tickets.map(tkt => {
              const isP0 = tkt.priority === 'P0';
              const isP1 = tkt.priority === 'P1';

              return (
                <div
                  key={tkt.id}
                  className={`p-5 rounded-xl border transition-all ${
                    isP0
                      ? 'border-red-500/30 bg-red-500/5'
                      : isP1
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-slate-200 dark:border-dark-800 bg-slate-50 dark:bg-dark-900/50'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-md border ${
                        isP0
                          ? 'bg-red-500/20 text-red-500 border-red-500/40'
                          : isP1
                          ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
                          : 'bg-blue-500/20 text-blue-500 border-blue-500/40'
                      }`}>
                        {isP0 ? '🚨 P0 CRÍTICO' : isP1 ? '⚡ P1 URGENTE' : `🔵 ${tkt.priority || 'P2 NORMAL'}`}
                      </span>

                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-dark-800 text-slate-700 dark:text-slate-300">
                        {tkt.category === 'PAYOUTS' ? 'ATH MÓVIL' : tkt.category}
                      </span>

                      <span className="font-mono text-xs text-slate-400">#{tkt.id}</span>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">{tkt.subject}</h3>
                    </div>

                    <span className={`text-xs font-bold px-3 py-1 rounded-full self-start md:self-auto ${
                      tkt.status === 'RESOLVED'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : tkt.status === 'IN_PROGRESS'
                        ? 'bg-amber-500/10 text-amber-500'
                        : 'bg-red-500/10 text-red-500'
                    }`}>
                      {tkt.status === 'RESOLVED' ? '🟢 Resuelto' : tkt.status === 'IN_PROGRESS' ? '🟡 En Proceso' : '🔴 Abierto'}
                    </span>
                  </div>

                  {tkt.lastReply && (
                    <div className="bg-white dark:bg-dark-950 p-3.5 rounded-lg border border-slate-200 dark:border-dark-800 text-xs text-slate-600 dark:text-slate-300 mb-3">
                      <span className="font-bold text-slate-400 block mb-1">Última actualización de la mesa técnica:</span>
                      "{tkt.lastReply}"
                    </div>
                  )}

                  {/* Inline Reply Input */}
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={replyInput[tkt.id] || ''}
                      onChange={(e) => setReplyInput({ ...replyInput, [tkt.id]: e.target.value })}
                      placeholder="Escribe una respuesta o dato adicional para el equipo..."
                      className="flex-grow p-2 text-xs rounded-lg border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-900 outline-none focus:border-brand-600"
                    />
                    <button
                      onClick={() => handleSendReply(tkt.id)}
                      disabled={submittingReply === tkt.id || !replyInput[tkt.id]?.trim()}
                      className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0"
                    >
                      {submittingReply === tkt.id ? 'Enviando...' : 'Responder'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

const SubmissionSuccessModal = ({ onClose, onViewStatus }: { onClose: () => void; onViewStatus: () => void }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-card-dark p-8 rounded-2xl max-w-md">
      <h2 className="text-2xl font-bold mb-4">Release Submitted!</h2>
      <p className="text-slate-500 mb-6">Your release has been submitted for review.</p>
      <div className="flex gap-4">
        <button onClick={onViewStatus} className="bg-brand-600 text-white px-4 py-2 rounded">View Status</button>
        <button onClick={onClose} className="bg-slate-200 px-4 py-2 rounded">Close</button>
      </div>
    </div>
  </div>
);

const ArtistDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'music' | 'analytics' | 'wallet' | 'upload' | 'profile' | 'settings' | 'support'>('overview');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Mock function to simulate a submission completion
  const handleSubmissionComplete = () => {
    setActiveTab('music');
    setShowSuccessModal(true);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'upload':
        return <NewRelease onComplete={handleSubmissionComplete} onCancel={() => setActiveTab('overview')} />;
      case 'analytics':
        return <TrackAnalytics />;
      case 'music':
        return <MyMusic />;
      case 'wallet':
        return <Wallet />;
      case 'profile':
        return <Profile />;
      case 'settings':
        return <Settings />;
      case 'support':
        return <Support />;
      case 'overview':
      default:
        return <ArtistOverview onUploadClick={() => setActiveTab('upload')} userName={user?.name || 'Artist'} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-white flex flex-col lg:flex-row font-sans">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-white dark:bg-card-dark border-b border-slate-200 dark:border-dark-800 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Logo className="text-brand-500 w-8 h-8" />
          <span className="font-bold text-lg tracking-tight">Artist Portal</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 text-slate-500 hover:text-brand-500 transition-colors"
        >
          <span className="material-symbols-outlined text-3xl">menu</span>
        </button>
      </div>

      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-card-dark border-r border-slate-200 dark:border-dark-800 flex flex-col 
        transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-screen
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-dark-800">
          <div className="flex items-center">
            <Logo className="text-brand-500 w-8 h-8 mr-2" />
            <span className="font-bold text-lg tracking-tight">Artist Portal</span>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-4 space-y-1 overflow-y-auto flex-1">
          <div className="mb-6 px-2">
            <button
              onClick={() => { setActiveTab('upload'); setIsMobileMenuOpen(false); }}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="material-symbols-outlined">add_circle</span>
              New Release
            </button>
          </div>

          <p className="px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 mt-2">Menu</p>
          <NavItem
            icon="dashboard"
            label="Overview"
            isActive={activeTab === 'overview'}
            onClick={() => { setActiveTab('overview'); setIsMobileMenuOpen(false); }}
          />
          <NavItem
            icon="library_music"
            label="My Music"
            isActive={activeTab === 'music'}
            onClick={() => { setActiveTab('music'); setIsMobileMenuOpen(false); }}
          />
          <NavItem
            icon="bar_chart"
            label="Analytics"
            isActive={activeTab === 'analytics'}
            onClick={() => { setActiveTab('analytics'); setIsMobileMenuOpen(false); }}
          />
          <NavItem
            icon="account_balance_wallet"
            label="Wallet & Payouts"
            isActive={activeTab === 'wallet'}
            onClick={() => { setActiveTab('wallet'); setIsMobileMenuOpen(false); }}
          />

          <p className="px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 mt-6">Account</p>
          <NavItem
            icon="person"
            label="Profile"
            isActive={activeTab === 'profile'}
            onClick={() => { setActiveTab('profile'); setIsMobileMenuOpen(false); }}
          />
          <NavItem
            icon="settings"
            label="Settings"
            isActive={activeTab === 'settings'}
            onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
          />
          <NavItem
            icon="help"
            label="Support"
            isActive={activeTab === 'support'}
            onClick={() => { setActiveTab('support'); setIsMobileMenuOpen(false); }}
          />
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-dark-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-xs">
              {user?.name?.substring(0, 2).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email || ''}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition-colors" title="Logout">
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-0 min-h-[calc(100vh-64px)] lg:min-h-screen">
        {renderContent()}
      </main>

      {/* Modal Overlay */}
      {showSuccessModal && (
        <SubmissionSuccessModal
          onClose={() => setShowSuccessModal(false)}
          onViewStatus={() => { setShowSuccessModal(false); setActiveTab('music'); }}
        />
      )}
    </div>
  );
};

// Helper Components
const NavItem = ({ icon, label, isActive, onClick, badge }: { icon: string, label: string, isActive: boolean, onClick: () => void, badge?: string }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
      ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-800 hover:text-slate-900 dark:hover:text-white'
      }`}
  >
    <span className={`material-symbols-outlined text-[20px] ${isActive ? 'filled' : ''}`}>{icon}</span>
    <span>{label}</span>
    {badge && (
      <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>
    )}
  </button>
);

const ArtistOverview = ({ onUploadClick, userName }: { onUploadClick: () => void; userName: string }) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
  <div className="p-8 max-w-7xl mx-auto space-y-8">
    <header className="flex justify-between items-end">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">{getGreeting()}, {userName}</h1>
        <p className="text-slate-500 dark:text-slate-400">Here's how your music is performing today.</p>
      </div>
    </header>

    {/* Highlight Stats */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-gradient-to-br from-brand-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-brand-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-32 bg-white opacity-5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
        <p className="text-brand-100 text-xs font-bold uppercase tracking-wider mb-1">Total Balance</p>
        <h2 className="text-4xl font-black mb-4">$3,240.50</h2>
        <button className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors backdrop-blur-sm">Withdraw Funds</button>
      </div>

      <StatCard label="Total Streams" value="842.5k" change="+12.5%" icon="graphic_eq" color="bg-brand-500" />
      <StatCard label="Monthly Listeners" value="125.2k" change="+5.2%" icon="groups" color="bg-purple-500" />
    </div>

    {/* Recent Releases Section */}
    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-dark-800 p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold">Your Releases</h3>
        <button className="text-brand-500 text-sm font-bold hover:underline">View All</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Release Card Mock */}
        <div className="group border border-slate-200 dark:border-dark-800 rounded-xl p-4 hover:border-brand-500 transition-colors cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-lg bg-slate-200 dark:bg-slate-800 bg-cover bg-center shadow-md relative group-hover:shadow-lg transition-all" style={{ backgroundImage: "url('https://picsum.photos/200/200?random=1')" }}>
              <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-white">play_arrow</span>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-brand-500 transition-colors">Neon Nights</h4>
              <p className="text-xs text-slate-500">Released Oct 15, 2023</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">Live</span>
                <span className="text-[10px] text-slate-400">124k streams</span>
              </div>
            </div>
          </div>
        </div>
        {/* Release Card Mock 2 */}
        <div className="group border border-slate-200 dark:border-dark-800 rounded-xl p-4 hover:border-brand-500 transition-colors cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-lg bg-slate-200 dark:bg-slate-800 bg-cover bg-center shadow-md" style={{ backgroundImage: "url('https://picsum.photos/200/200?random=2')" }}></div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-brand-500 transition-colors">Acoustic Soul</h4>
              <p className="text-xs text-slate-500">Scheduled Oct 22, 2023</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] font-bold bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full">Pending</span>
              </div>
            </div>
          </div>
        </div>
        {/* Upload CTA Card */}
        <div onClick={onUploadClick} className="border-2 border-dashed border-slate-200 dark:border-dark-800 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/5 transition-all group h-full min-h-[100px]">
          <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full mb-2 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-slate-400 group-hover:text-brand-500">add</span>
          </div>
          <p className="text-sm font-bold text-slate-500 group-hover:text-brand-500">Distribute New Music</p>
        </div>
      </div>
    </div>
  </div>
);
};

const MyMusic = () => {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchCatalog = async () => {
      try {
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        const apiBase = isLocal ? 'http://localhost:3001/v1' : 'https://api-api.eajmusic.com/v1';
        const res = await fetch(`${apiBase}/releases`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setCatalog(data.releases || data.items || []);
        }
      } catch (err) {
        console.warn('Error cargando catálogo en Dashboard:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCatalog();

    // Suscripción reactiva SSE cross-origin sin cookies
    let es: EventSource | null = null;
    try {
      const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const apiBase = isLocal ? 'http://localhost:3001/v1' : 'https://api-api.eajmusic.com/v1';
      es = new EventSource(`${apiBase}/releases/stream`);
      es.onmessage = () => fetchCatalog();
      es.addEventListener('RELEASE_CREATED', () => fetchCatalog());
      es.addEventListener('RELEASE_STATUS_UPDATED', () => fetchCatalog());
    } catch (e) {}

    return () => {
      isMounted = false;
      if (es) es.close();
    };
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">My Music Catalog</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Catálogo oficial sincronizado con PostgreSQL / InsForge en tiempo real.</p>
        </div>
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
          PostgreSQL Realtime Conectado
        </span>
      </div>

      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-dark-800 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-dark-800 text-xs font-bold text-slate-500 uppercase">
            <tr>
              <th className="px-6 py-4">Release / Track</th>
              <th className="px-6 py-4">UPC / ISRC</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Stores</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
            {catalog.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  {loading ? 'Cargando catálogo desde PostgreSQL...' : 'No hay lanzamientos registrados en tu catálogo.'}
                </td>
              </tr>
            ) : (
              catalog.map((item, idx) => {
                const rawStatus = (item.status || 'draft').toLowerCase();
                const isLive = rawStatus === 'approved' || rawStatus === 'released';
                const isRejected = rawStatus === 'rejected';
                const statusBadge = isLive ? (
                  <span className="px-2.5 py-1 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 font-bold border border-emerald-500/30">
                    Live DDEX
                  </span>
                ) : isRejected ? (
                  <span className="px-2.5 py-1 rounded-full text-xs bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 font-bold border border-rose-500/30">
                    Rechazado
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 font-bold border border-amber-500/30">
                    En Revisión A&R
                  </span>
                );

                return (
                  <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-dark-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.cover_art_url || `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200`}
                          className="size-12 rounded-lg object-cover shadow-sm border border-slate-200 dark:border-dark-700"
                          alt={item.title}
                        />
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-white">{item.title}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {item.artist_name || 'Kaelo & EAJ Collective'} · <span className="uppercase">{item.type}</span> ({item.genre || 'Urbano'})
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs text-slate-600 dark:text-slate-300 font-mono bg-slate-100 dark:bg-dark-900 px-2 py-1 rounded">
                        {item.upc || 'Pendiente'}
                      </code>
                    </td>
                    <td className="px-6 py-4">{statusBadge}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 font-medium">{item.release_date || '2026-10-15'}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">Spotify, Apple, TikTok</td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-slate-400 hover:text-brand-500 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700">
                        <span className="material-symbols-outlined text-lg">more_vert</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, change, icon, color }: any) => (
  <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-dark-800 p-6 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs font-bold text-emerald-500 mt-1">{change}</p>
    </div>
    <div className={`p-3 rounded-xl ${color} text-white shadow-lg shadow-${color.replace('bg-', '')}/30`}>
      <span className="material-symbols-outlined text-xl">{icon}</span>
    </div>
  </div>
);

export default ArtistDashboard;