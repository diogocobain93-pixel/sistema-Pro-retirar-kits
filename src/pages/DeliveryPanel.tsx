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
  Bell
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
    <div className="flex flex-col h-full bg-slate-50/50 -m-8 min-h-[calc(100vh-72px)] overflow-hidden">
      {/* Header Info */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
            <MonitorSpeaker size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Painel de Entrega</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Controle de Saída em Tempo Real</p>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
            <Bell size={16} className="animate-bounce" />
            <span className="text-xs font-black uppercase tracking-widest">Acompanhamento de retiradas em tempo real</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
          </p>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto overflow-x-hidden">
        {loading && requests.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-50">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Sincronizando painel...</p>
          </div>
        ) : requests.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full flex flex-col items-center justify-center text-center p-12"
          >
            <div className="w-48 h-48 bg-white rounded-full flex items-center justify-center shadow-2xl shadow-slate-200 mb-10 relative">
               <div className="absolute inset-0 bg-indigo-600/5 rounded-full animate-ping" />
               <Search className="w-24 h-24 text-slate-200" />
            </div>
            
            <div className="space-y-4 max-w-lg">
              <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Monitorando em tempo real</h2>
              <p className="text-2xl font-bold text-slate-400 uppercase tracking-tight leading-none">
                Nenhum pedido na fila no momento.
              </p>
              <div className="pt-8">
                <p className="text-slate-400 font-medium bg-white px-8 py-4 rounded-2xl border-2 border-dashed border-slate-200 inline-block">
                  Novos pedidos aparecerão aqui automaticamente assim que o atleta solicitar no totem.
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="max-w-7xl mx-auto w-full pb-20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
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
                      className={`rounded-3xl p-6 shadow-sm border transition-all overflow-hidden relative ${
                        statusInfo.isSeparating 
                          ? 'bg-emerald-50 border-emerald-200 shadow-emerald-100' 
                          : 'bg-white border-slate-100 shadow-slate-200 hover:shadow-xl hover:translate-y-[-4px]'
                      }`}
                    >
                      {/* Status Badge */}
                      <div className="absolute top-0 right-0 p-4">
                         <div className={`${statusInfo.color} px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border flex items-center gap-1 shadow-sm`}>
                           {statusInfo.isSeparating ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                           {statusInfo.label}
                         </div>
                      </div>

                      <div className="flex flex-col space-y-6">
                         {/* Basic Info */}
                         <div className="flex items-start gap-4">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
                              statusInfo.isSeparating ? 'bg-white text-emerald-600' : 'bg-slate-50 text-slate-400'
                            }`}>
                              <User size={32} />
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className={`text-xs font-black uppercase tracking-widest mb-1 ${
                                 statusInfo.isSeparating ? 'text-emerald-600/60' : 'text-slate-400'
                               }`}>Participante</p>
                               <h3 className={`text-2xl font-black truncate leading-tight uppercase ${
                                 statusInfo.isSeparating ? 'text-emerald-900' : 'text-slate-900'
                               }`}>{p.nome}</h3>
                               <p className={`text-sm font-mono mt-1 ${
                                 statusInfo.isSeparating ? 'text-emerald-700/70' : 'text-slate-500'
                               }`}>CPF: {p.cpf}</p>
                            </div>
                         </div>

                         {/* Details Grid */}
                         <div className={`grid grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-2xl border ${
                           statusInfo.isSeparating ? 'bg-white/60 border-emerald-100' : 'bg-slate-50/50 border-slate-100'
                         }`}>
                            <div>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Nascimento</p>
                               <p className="text-sm font-bold text-slate-700">{p.dataNascimento || '---'}</p>
                            </div>
                            <div>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Modalidade</p>
                               <p className="text-sm font-bold text-slate-700">{p.modalidade || '---'}</p>
                            </div>
                            <div>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Sexo</p>
                               <p className="text-sm font-bold text-slate-700">{p.sexo || '---'}</p>
                            </div>
                            <div>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Kit</p>
                               <p className="text-sm font-black text-indigo-600">{p.kit || '---'}</p>
                            </div>
                            <div>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Camiseta</p>
                               <p className="text-sm font-black text-indigo-600">{p.tamanhoCamiseta || '---'}</p>
                            </div>
                            <div>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Cidade</p>
                               <p className="text-sm font-bold text-slate-700 truncate">{p.cidade || '---'}</p>
                            </div>
                         </div>

                         {/* Bottom Info & Stats */}
                         <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-6">
                               <div className="px-4 py-2 bg-slate-900 text-white rounded-xl shadow-lg">
                                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none mb-1">Nº Atleta</p>
                                  <p className="text-xl font-black leading-none">{p.numero || '---'}</p>
                               </div>
                               <div className="text-right">
                                  <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                    <Clock size={10} /> Solicitado em
                                  </p>
                                  <p className="text-lg font-black text-red-600 leading-none">{formatTime(req.createdAt)}</p>
                               </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-3">
                               {req.status === 'PENDENTE' ? (
                                 <button 
                                   onClick={() => handleSeparate(req.id)}
                                   disabled={processingId === req.id}
                                   className="h-12 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                                 >
                                   {processingId === req.id ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                   Entregar Kit
                                 </button>
                               ) : (
                                 <>
                                   <button 
                                     onClick={() => handleCancel(req.id)}
                                     disabled={processingId === req.id}
                                     className="h-12 px-4 bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 disabled:opacity-50"
                                   >
                                     Cancelar
                                   </button>
                                   <button 
                                     onClick={() => handleConfirm(req.id)}
                                     disabled={processingId === req.id || isBeingSeparatedByOthers}
                                     className={`h-12 px-6 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 ${
                                       isBeingSeparatedByOthers 
                                         ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                                         : 'bg-emerald-900 border-2 border-emerald-400 text-white hover:bg-emerald-950 shadow-emerald-200'
                                     }`}
                                   >
                                     {processingId === req.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                     {isBeingSeparatedByOthers ? 'Em Uso' : 'Entregue'}
                                   </button>
                                 </>
                               )}
                            </div>
                         </div>
                      </div>
                      
                      {/* Decorative border accent for separation state */}
                      {req.status === 'EM_SEPARACAO' && (
                        <div className="absolute left-0 top-0 bottom-0 w-2 bg-emerald-500" />
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="fixed bottom-8 right-8 bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-8">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest">{error}</span>
        </div>
      )}
    </div>
  );
}
