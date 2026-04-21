import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { 
  Users, 
  PackageCheck, 
  Package2, 
  Clock, 
  History, 
  Loader2, 
  Activity,
  ArrowUpRight
} from 'lucide-react';
import { motion } from 'motion/react';

export default function OrganizadorDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchStats = async () => {
    try {
      const stats = await api.getDashboardStats();
      setData(stats);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Falha ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000); // 10s auto refresh
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  const { stats, activeRequests, recentDeliveries } = data || { 
    stats: { totalInscritos: 0, totalEntregues: 0, totalPendentes: 0 },
    activeRequests: [],
    recentDeliveries: []
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <div className="flex items-center gap-2 text-indigo-600 font-black uppercase tracking-[0.2em] text-xs mb-2">
             <Activity size={14} className="animate-pulse" /> Operação Live
           </div>
           <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase leading-none">
            Visão geral do seu evento em tempo real
           </h1>
           <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2 flex items-center gap-2">
             Monitorando performance de entrega • Atualizado às {lastUpdate.toLocaleTimeString('pt-BR')}
           </p>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-xl shadow-slate-100/50 flex flex-col justify-between"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-3xl">
              <Users size={32} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Total de inscritos</span>
          </div>
          <div>
            <p className="text-6xl font-black text-slate-900 tracking-tighter">{stats.totalInscritos}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Atletas confirmados</p>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white p-8 rounded-[2.5rem] border-2 border-emerald-100 shadow-xl shadow-emerald-100/50 flex flex-col justify-between"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-3xl">
              <PackageCheck size={32} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Kits entregues</span>
          </div>
          <div>
            <p className="text-6xl font-black text-emerald-600 tracking-tighter">{stats.totalEntregues}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Entregas concluídas</p>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white p-8 rounded-[2.5rem] border-2 border-amber-100 shadow-xl shadow-amber-100/50 flex flex-col justify-between"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-4 bg-amber-50 text-amber-600 rounded-3xl">
              <Package2 size={32} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Kits pendentes</span>
          </div>
          <div>
            <p className="text-6xl font-black text-amber-600 tracking-tighter">{stats.totalPendentes}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Aguardando retirada</p>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Active Requests List */}
        <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-xl shadow-slate-100/50 overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center">
                 <Clock size={24} />
               </div>
               <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Solicitações Pendentes (Totem)</h3>
            </div>
            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-widest">Live</span>
            </div>
          </div>
          <div className="flex-1 p-8 overflow-y-auto max-h-[400px] space-y-4">
            {activeRequests.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-12">
                 <Clock size={48} className="mb-4" />
                 <p className="font-black uppercase tracking-widest">Nenhuma solicitação no momento</p>
              </div>
            ) : (
              activeRequests.map((req: any) => (
                <div key={req.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:border-indigo-200 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-lg font-black text-slate-900 uppercase">{req.participant.nome}</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{req.event.nome}</span>
                  </div>
                  <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                    req.status === 'EM_SEPARACAO' 
                      ? 'bg-emerald-600 text-white border-emerald-700' 
                      : 'bg-amber-100 text-amber-700 border-amber-200'
                  }`}>
                    {req.status === 'EM_SEPARACAO' ? 'Separando' : 'Pendente'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Deliveries List */}
        <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-xl shadow-slate-100/50 overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 flex items-center gap-4">
             <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center">
               <History size={24} />
             </div>
             <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Retiradas Recentes</h3>
          </div>
          <div className="flex-1 p-8 overflow-y-auto max-h-[400px] space-y-4">
            {recentDeliveries.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-12">
                 <PackageCheck size={48} className="mb-4" />
                 <p className="font-black uppercase tracking-widest">Nenhuma retirada registrada</p>
              </div>
            ) : (
              recentDeliveries.map((delivery: any) => (
                <div key={delivery.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white transition-all shadow-hover-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                       <ArrowUpRight size={20} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-black text-slate-900 uppercase">{delivery.nome}</span>
                      <span className="text-xs font-bold text-slate-400 capitalize">
                        {new Date(delivery.entregueAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                    <PackageCheck size={16} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
