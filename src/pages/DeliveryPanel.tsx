import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Participant } from '@/types';
import { 
  MonitorSpeaker, 
  Search, 
  Loader2, 
  Clock, 
  User, 
  MapPin, 
  CheckCircle2,
  Bell,
  Fingerprint,
  Calendar,
  Target,
  Users,
  Package,
  Shirt,
  Info,
  Circle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type DeliveryRequestWithData = {
  id: string;
  status: 'PENDENTE' | 'EM_SEPARACAO' | 'ENTREGUE';
  atendenteNome: string | null;
  createdAt: string;
  participant: Participant;
  event: { nome: string };
};

export default function DeliveryPanelPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<DeliveryRequestWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchRequests = async () => {
    try {
      const data = await api.getEntregasRecentes();
      setRequests(data as unknown as DeliveryRequestWithData[]);
      setLastUpdate(new Date());
      setError('');
    } catch (err: any) {
      console.error('Error fetching delivery requests:', err);
      setError('Falha na sincronização em tempo real');
    } finally {
      setLoading(false);
    }
  };

  const handleSeparate = async (id: string) => {
    setProcessingId(id);
    try {
      await api.separarEntrega(id);
      fetchRequests();
    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar separação');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirm = async (id: string) => {
    setProcessingId(id);
    try {
      await api.confirmarEntrega(id);
      fetchRequests();
    } catch (err: any) {
      setError(err.message || 'Erro ao confirmar entrega');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    setProcessingId(id);
    try {
      await api.cancelarSeparacao(id);
      fetchRequests();
    } catch (err: any) {
      setError(err.message || 'Erro ao cancelar separação');
    } finally {
      setProcessingId(null);
    }
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '--:--';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getStatusInfo = (status: string, attendant?: string | null) => {
    if (status === 'PENDENTE') {
      return { label: 'Pendente', color: 'bg-amber-50 text-amber-600 border-amber-100', isSeparating: false };
    }
    if (status === 'EM_SEPARACAO') {
      return { label: `Em Separação (${attendant || 'Equipe'})`, color: 'bg-emerald-600 text-white border-emerald-700', isSeparating: true };
    }
    return { label: status, color: 'bg-slate-100 text-slate-600 border-slate-200', isSeparating: false };
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/30 -m-8 min-h-[calc(100vh-72px)] overflow-hidden">
      {/* Header Info */}
      <div className="px-8 py-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Painel de Entrega</h1>
          <p className="text-sm font-semibold text-slate-400 mt-1">Pedidos de retirada via Totem em tempo real.</p>
        </div>

        <div className="flex items-center gap-2 text-[#2563EB] bg-blue-50 px-4 py-2 rounded-full border border-blue-100 shadow-sm">
          <Circle size={8} className="fill-current animate-pulse" />
          <span className="text-xs font-bold tracking-tight">Monitorando em tempo real</span>
        </div>
      </div>

      <div className="flex-1 px-8 pb-8 overflow-y-auto overflow-x-hidden">
        {loading && requests.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-50">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Sincronizando painel...</p>
          </div>
        ) : requests.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full flex flex-col items-center justify-center text-center p-12"
          >
            <div className="w-48 h-48 bg-white rounded-full flex items-center justify-center shadow-2xl shadow-slate-200 mb-10 relative">
               <div className="absolute inset-0 bg-primary/5 rounded-full animate-ping" />
               <Search className="w-24 h-24 text-slate-200" />
            </div>
            
            <div className="space-y-4 max-w-lg">
              <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Fila Vazia</h2>
              <p className="text-xl font-bold text-slate-400 uppercase tracking-tight leading-none">
                Nenhum pedido pendente no momento.
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="max-w-7xl w-full pb-20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <AnimatePresence mode="popLayout">
                {requests.map((req) => {
                  const statusInfo = getStatusInfo(req.status, req.atendenteNome);
                  const isBeingSeparatedByMe = req.status === 'EM_SEPARACAO' && req.atendenteNome === user?.nome;
                  const isBeingSeparatedByOthers = statusInfo.isSeparating && !isBeingSeparatedByMe;
                  const p = req.participant;

                  return (
                    <motion.div
                      key={req.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                      className="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col relative group transition-all hover:shadow-2xl hover:-translate-y-1"
                    >
                      {/* Top Bar */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="bg-blue-50 text-primary w-12 h-10 rounded-xl flex items-center justify-center font-black text-lg">
                          {p.numeroPeito || '---'}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                          {req.status === 'PENDENTE' ? 'AGUARDANDO' : statusInfo.label}
                        </div>
                      </div>

                      {/* Header Info */}
                      <div className="mb-8">
                        <h3 className="text-2xl font-black text-slate-900 uppercase leading-none mb-1">
                          {p.nome}
                        </h3>
                        <p className="text-sm font-bold text-slate-400 capitalize">
                          {p.modalidade || 'Individual'}
                        </p>
                      </div>

                      {/* Data Grid */}
                      <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-8">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                            <Fingerprint size={12} /> CPF
                          </p>
                          <p className="text-xs font-black text-slate-900 uppercase truncate">{p.cpf}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                            <Calendar size={12} /> NASCIMENTO
                          </p>
                          <p className="text-xs font-black text-slate-900 uppercase truncate">{p.dataNascimento || '---'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                            <Info size={12} /> MODALIDADE
                          </p>
                          <p className="text-xs font-black text-slate-900 uppercase truncate">{p.modalidade || '---'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                            <User size={12} /> SEXO
                          </p>
                          <p className="text-xs font-black text-slate-900 uppercase truncate">{p.sexo || '---'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                            <Package size={12} /> KIT
                          </p>
                          <p className="text-xs font-black text-slate-900 uppercase truncate">{p.kit || '---'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                            <Shirt size={12} /> CAMISETA
                          </p>
                          <p className="text-xs font-black text-slate-900 uppercase truncate">{p.tamanhoCamiseta || '---'}</p>
                        </div>
                        <div className="space-y-1 col-span-2">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                            <MapPin size={12} /> CIDADE
                          </p>
                          <p className="text-xs font-black text-slate-900 uppercase truncate">{p.cidade || '---'}</p>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="mt-auto pt-2">
                        {req.status === 'PENDENTE' ? (
                          <button 
                            onClick={() => handleSeparate(req.id)}
                            disabled={processingId === req.id}
                            className="w-full h-16 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                          >
                            {processingId === req.id ? (
                              <Loader2 size={24} className="animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 size={24} />
                                ENTREGAR KIT
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="flex gap-3">
                            <button 
                              onClick={() => handleCancel(req.id)}
                              disabled={processingId === req.id}
                              className="flex-1 h-16 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest transition-all"
                            >
                              Cancelar
                            </button>
                            <button 
                              onClick={() => handleConfirm(req.id)}
                              disabled={processingId === req.id || isBeingSeparatedByOthers}
                              className={`flex-[2] h-16 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 ${
                                isBeingSeparatedByOthers 
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'
                              }`}
                            >
                              {processingId === req.id ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                              {isBeingSeparatedByOthers ? 'Em Uso' : 'Confirmar'}
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="fixed bottom-8 right-8 bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-8 z-50">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest">{error}</span>
        </div>
      )}
    </div>
  );
}
