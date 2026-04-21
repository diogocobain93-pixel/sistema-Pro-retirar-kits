import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Participant, Event } from '@/types';
import { 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  User,
  X,
  ArrowRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function TotemPage() {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [step, setStep] = useState<'welcome' | 'search' | 'details' | 'confirmation'>('welcome');
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Inactivity Timer Logic
  useEffect(() => {
    const handleActivity = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      
      if (step !== 'welcome') {
        timerRef.current = setTimeout(() => {
          resetTotem();
        }, 5000);
      }
    };

    // Events to track user interaction
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    if (step !== 'welcome') {
      // Start initial timer
      timerRef.current = setTimeout(() => {
        resetTotem();
      }, 5000);

      events.forEach(event => window.addEventListener(event, handleActivity));
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [step]);

  useEffect(() => {
    if (slug) {
      fetchEvent();
    }
  }, [slug]);

  useEffect(() => {
    if (step === 'search' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [step]);

  const fetchEvent = async () => {
    try {
      const data = await api.getTotemEvento(slug!);
      setEvent(data);
    } catch (err: any) {
      setError(err.message || 'Evento não encontrado');
    } finally {
      setIsLoading(false);
    }
  };

  const performSearch = async () => {
    if (!search || search.length < 2) return;
    setIsSearching(true);
    setError('');
    try {
      const results = await api.buscarParticipantesTotem(slug!, search);
      if (results.length > 0) {
        // Find by exact CPF match if possible, or take the first result
        const exactMatch = results.find(p => p.cpf.replace(/\D/g, '') === search.replace(/\D/g, ''));
        const p = exactMatch || results[0];
        
        if (p.status === 'ENTREGUE') {
          setError('Kit já retirado anteriormente.');
          return;
        }

        setSelectedParticipant(p);
        setStep('details');
      } else {
        setError('CPF não encontrado ou já retirado');
      }
    } catch (err) {
      setError('Erro ao buscar participante');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDeliver = async (id: string) => {
    setDeliveringId(id);
    setError('');
    setSuccess('');
    try {
      await api.entregarKit(id);
      
      setStep('confirmation');
      
      // Auto reset after 5 seconds is already handled by the inactivity timer 
      // or we can explicitly set it here to be sure.
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        resetTotem();
      }, 5000);

    } catch (err: any) {
      setError(err.message || 'Erro ao realizar entrega');
    } finally {
      setDeliveringId(null);
    }
  };

  const resetTotem = () => {
    setSearch('');
    setSelectedParticipant(null);
    setSuccess('');
    setError('');
    setStep('welcome');
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Carregando Totem...</p>
        </div>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-2xl text-center border-t-8 border-red-500">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-slate-900 mb-2">{error}</h1>
          <p className="text-slate-500">Verifique se o link está correto ou contate o administrador.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-600 flex flex-col overflow-hidden font-sans select-none">
      
      {/* TELA 1 — BOAS-VINDAS */}
      {step === 'welcome' && (
        <div 
          className="fixed inset-0 flex flex-col items-center justify-center p-12 text-white cursor-pointer"
          onClick={() => setStep('search')}
        >
          <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
            <div className="absolute -top-48 -left-48 w-[800px] h-[800px] bg-white rounded-full blur-[160px] animate-pulse" />
            <div className="absolute -bottom-48 -right-48 w-[800px] h-[800px] bg-indigo-400 rounded-full blur-[160px] animate-pulse delay-700" />
          </div>

          <div className="relative z-10 text-center space-y-8 animate-in fade-in zoom-in duration-700">
            {event?.imageUrl && (
              <div className="mx-auto w-full max-w-lg aspect-auto flex justify-center mb-6">
                <img 
                  src={event.imageUrl} 
                  alt={event.nome} 
                  className="max-h-[300px] w-auto object-contain rounded-3xl shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            <div className="space-y-2">
               <p className="text-2xl md:text-3xl font-bold uppercase tracking-[0.3em] text-indigo-100">Bem-vindo ao</p>
               <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none drop-shadow-xl">
                 Autoatendimento
               </h1>
               <p className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white/90">
                 {event?.nome}
               </p>
            </div>

            <div className="pt-8">
               <button className="px-16 py-10 bg-white text-indigo-600 rounded-full shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] transition-all active:scale-95 group">
                 <span className="text-4xl md:text-5xl font-black uppercase tracking-tight">CLIQUE AQUI PARA INICIAR</span>
               </button>
            </div>
          </div>
        </div>
      )}

      {/* TELA 2 — BUSCA */}
      {step === 'search' && (
        <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
          <div className="max-w-5xl w-full flex flex-col items-center space-y-16">
            
            <div className="text-center space-y-4">
               <h2 className="text-6xl md:text-8xl font-black text-slate-900 uppercase tracking-tighter leading-none">Retirada de Kit</h2>
               <p className="text-2xl md:text-3xl text-slate-400 font-bold uppercase tracking-widest leading-tight">
                 Digite seu CPF para iniciar o autoatendimento
               </p>
            </div>

            <div className="w-full flex flex-col md:flex-row items-center gap-6 justify-center">
              <div className="relative flex-1 max-w-3xl w-full">
                <Input 
                  ref={inputRef}
                  placeholder="000.000.000-00"
                  className="w-full h-32 md:h-40 px-10 bg-slate-50 border-4 border-slate-100 rounded-[2.5rem] text-4xl md:text-6xl font-black uppercase placeholder:text-slate-200 focus-visible:ring-indigo-600 focus-visible:border-indigo-600 transition-all text-center text-slate-800 shadow-inner"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                />
              </div>
              
              <Button 
                onClick={performSearch}
                disabled={isSearching}
                className="h-32 md:h-40 px-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2.5rem] shadow-2xl shadow-indigo-200 text-3xl md:text-4xl font-black uppercase tracking-tight flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
              >
                {isSearching ? <Loader2 className="w-16 h-16 animate-spin" /> : "BUSCAR MEU KIT"}
              </Button>
            </div>

            {error && (
              <div className="w-full max-w-3xl p-10 rounded-[2.5rem] border-4 bg-red-50 border-red-200 text-red-800 flex items-center gap-8 animate-in slide-in-from-top-6 duration-300">
                 <AlertCircle className="w-16 h-16" />
                 <p className="text-3xl md:text-4xl font-black uppercase tracking-tight">{error}</p>
              </div>
            )}

            <button onClick={resetTotem} className="fixed bottom-12 right-12 text-slate-300 hover:text-slate-400 font-black uppercase tracking-[0.2em] text-xs">
              Recomeçar
            </button>
          </div>
        </div>
      )}

      {/* TELA 3 — DADOS DO ATLETA */}
      {step === 'details' && selectedParticipant && (
        <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center p-8 animate-in slide-in-from-right duration-500 overflow-y-auto">
          <div className="max-w-6xl w-full bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
            
            {/* Header / Title Area */}
            <div className="p-12 bg-indigo-600 text-white flex justify-between items-center">
              <div>
                <p className="text-indigo-200 font-black uppercase tracking-[0.2em] text-xl mb-2">Seus Dados</p>
                <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-tight">{event?.nome}</h2>
              </div>
              <button onClick={() => setStep('search')} className="p-4 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                <X size={48} />
              </button>
            </div>

            <div className="p-12 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Data Card Blocks */}
                <div className="space-y-6">
                  <div className="p-8 bg-slate-50 rounded-3xl border-2 border-slate-100">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Nome Completo</p>
                    <p className="text-3xl md:text-4xl font-black text-slate-900 uppercase">{selectedParticipant.nome}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-8 bg-slate-50 rounded-3xl border-2 border-slate-100">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">CPF</p>
                      <p className="text-2xl font-black text-slate-700">{selectedParticipant.cpf}</p>
                    </div>
                    <div className="p-8 bg-slate-50 rounded-3xl border-2 border-slate-100">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Nascimento</p>
                      <p className="text-2xl font-black text-slate-700">{selectedParticipant.dataNascimento || '---'}</p>
                    </div>
                  </div>
                  <div className="p-8 bg-slate-50 rounded-3xl border-2 border-slate-100">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Equipe</p>
                    <p className="text-2xl font-black text-slate-700 uppercase">{selectedParticipant.equipe || '---'}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-8 bg-indigo-50 border-2 border-indigo-100 rounded-3xl">
                      <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">Modalidade</p>
                      <p className="text-2xl font-black text-indigo-900 uppercase">{selectedParticipant.modalidade}</p>
                    </div>
                    <div className="p-8 bg-slate-50 rounded-3xl border-2 border-slate-100">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Sexo</p>
                      <p className="text-2xl font-black text-slate-700 uppercase">{selectedParticipant.sexo || '---'}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-8 bg-indigo-50 border-2 border-indigo-100 rounded-3xl">
                      <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">Kit</p>
                      <p className="text-2xl font-black text-indigo-900 uppercase">{selectedParticipant.kit || '---'}</p>
                    </div>
                    <div className="p-8 bg-indigo-50 border-2 border-indigo-100 rounded-3xl">
                      <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">Camiseta</p>
                      <p className="text-2xl font-black text-indigo-900 uppercase">{selectedParticipant.tamanhoCamiseta || '---'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-8 bg-slate-50 rounded-3xl border-2 border-slate-100">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Cidade</p>
                      <p className="text-2xl font-black text-slate-700 uppercase">{selectedParticipant.cidade || '---'}</p>
                    </div>
                    <div className="p-8 bg-slate-900 rounded-3xl shadow-xl">
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Número</p>
                      <p className="text-4xl font-black text-white">{selectedParticipant.numero || '---'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Area */}
              <div className="mt-12 pt-12 border-t-4 border-slate-50 flex flex-col items-center gap-8">
                {success ? (
                  <div className="w-full p-12 bg-emerald-50 border-4 border-emerald-200 rounded-[3rem] text-emerald-800 text-center flex flex-col items-center gap-6 animate-in zoom-in-95">
                    <CheckCircle2 size={80} className="animate-bounce" />
                    <h3 className="text-5xl font-black uppercase tracking-tighter">Solicitação Enviada!</h3>
                    <p className="text-2xl font-bold uppercase">Aguarde no balcão de entregas.</p>
                  </div>
                ) : error ? (
                   <div className="w-full p-8 bg-red-50 border-4 border-red-200 rounded-[2rem] text-red-800 flex items-center justify-center gap-6">
                      <AlertCircle size={40} />
                      <p className="text-2xl font-black uppercase tracking-tight">{error}</p>
                   </div>
                ) : (
                  <button 
                    onClick={() => handleDeliver(selectedParticipant.id)}
                    disabled={deliveringId !== null}
                    className="group relative w-full h-40 bg-indigo-600 hover:bg-slate-900 text-white rounded-[3rem] shadow-2xl flex items-center justify-center gap-6 overflow-hidden transition-all active:scale-95 disabled:opacity-50"
                  >
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {deliveringId ? (
                      <Loader2 className="w-20 h-20 animate-spin" />
                    ) : (
                      <>
                        <span className="text-4xl md:text-6xl font-black uppercase tracking-tighter">SOLICITAR RETIRADA</span>
                        <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-indigo-400 transition-colors">
                          <ArrowRight size={48} className="group-hover:translate-x-2 transition-transform" />
                        </div>
                      </>
                    )}
                  </button>
                )}
                
                {!success && !deliveringId && (
                  <button onClick={resetTotem} className="text-slate-400 hover:text-indigo-600 px-12 py-4 font-black uppercase tracking-widest text-xl transition-colors">
                    Voltar / Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TELA 4 — CONFIRMAÇÃO FINAL */}
      {step === 'confirmation' && (
        <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-12 animate-in fade-in zoom-in duration-500">
          <div className="max-w-5xl w-full text-center space-y-12">
            <div className="flex justify-center mb-8">
              <div className="w-40 h-40 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-bounce">
                <CheckCircle2 size={100} />
              </div>
            </div>
            
            <h1 className="text-8xl md:text-[10rem] font-black text-emerald-600 uppercase tracking-tighter leading-none mb-8">
              SOLICITADO!
            </h1>
            
            <div className="space-y-6">
              <p className="text-4xl md:text-6xl font-black text-slate-800 uppercase tracking-tight leading-tight">
                DIRIJA-SE AO GUICHÊ PARA RETIRADA DO KIT.
              </p>
              <p className="text-2xl md:text-4xl font-bold text-slate-400 uppercase tracking-widest leading-tight pt-4">
                VOCÊ SERÁ CHAMADO PELO NOME.
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 99px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
      `}</style>
    </div>
  );
}
