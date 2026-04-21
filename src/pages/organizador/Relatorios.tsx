import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Participant, Event } from '@/types';
import { 
  FileText, 
  Search, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  Loader2,
  Filter,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';

export default function RelatoriosPage() {
  const [participants, setParticipants] = useState<(Participant & { eventName?: string })[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [participantToDelete, setParticipantToDelete] = useState<Participant | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eventsList, allParticipantesResults] = await Promise.all([
        api.getEventos(),
        // Since we don't have a global get all participants yet, we fetch per event
        api.getEventos().then(evs => 
          Promise.all(evs.map(async (e) => {
            const parts = await api.getParticipantes(e.id);
            return parts.map(p => ({ ...p, eventName: e.nome }));
          }))
        )
      ]);
      
      setEvents(eventsList);
      setParticipants(allParticipantesResults.flat());
    } catch (err) {
      console.error('Erro ao carregar relatórios:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (participant: Participant) => {
    const newStatus = participant.status === 'ENTREGUE' ? 'INSCRITO' : 'ENTREGUE';
    try {
      await api.atualizarStatusParticipante(participant.id, newStatus);
      setParticipants(prev => prev.map(p => 
        p.id === participant.id ? { ...p, status: newStatus } : p
      ));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async () => {
    if (!participantToDelete) return;
    setIsActionLoading(true);
    try {
      await api.deletarParticipante(participantToDelete.id);
      setParticipants(prev => prev.filter(p => p.id !== participantToDelete.id));
      setParticipantToDelete(null);
      setDeleteConfirmName('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };
  
  const handleExportCSV = () => {
    const participantsToExport = filteredParticipants;
    if (participantsToExport.length === 0) return;

    const headers = [
      'Nome',
      'CPF',
      'Data Nascimento',
      'Sexo',
      'Equipe',
      'Cidade',
      'Modalidade',
      'Número Peito',
      'Chip',
      'Kit',
      'Tamanho Camiseta',
      'Status',
      'Hora Entrega',
      'Solicitou Retirada'
    ];

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = participantsToExport.map(p => [
      escapeCSV(p.nome),
      escapeCSV(p.cpf),
      escapeCSV(p.dataNascimento),
      escapeCSV(p.sexo),
      escapeCSV(p.equipe),
      escapeCSV(p.cidade),
      escapeCSV(p.modalidade),
      escapeCSV(p.numeroPeito),
      escapeCSV(p.chip),
      escapeCSV(p.kit),
      escapeCSV(p.tamanhoCamiseta),
      escapeCSV(p.status === 'ENTREGUE' ? 'ENTREGUE' : 'PENDENTE'),
      escapeCSV(p.status === 'ENTREGUE' && p.entregueAt ? new Date(p.entregueAt).toLocaleString('pt-BR') : ''),
      escapeCSV(p.deliveryRequests && p.deliveryRequests.length > 0 ? 'SIM' : 'NÃO')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Suggest filename: relatorio-evento-nome-do-evento.csv
    let eventName = 'geral';
    if (selectedEventId !== 'all') {
      const selectedEvent = events.find(e => e.id === selectedEventId);
      if (selectedEvent) {
        eventName = selectedEvent.nome.toLowerCase().replace(/\s+/g, '-');
      }
    }
    
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio-evento-${eventName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredParticipants = participants.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(search.toLowerCase()) || 
                         p.cpf.includes(search);
    const matchesEvent = selectedEventId === 'all' || p.eventId === selectedEventId;
    return matchesSearch && matchesEvent;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            Relatórios <FileText size={32} className="text-primary" />
           </h1>
           <p className="text-muted-foreground mt-1">Visão completa e controle manual de todos os participantes.</p>
        </div>
        <Button 
          onClick={handleExportCSV} 
          disabled={loading || filteredParticipants.length === 0}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl px-6 flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all active:scale-95"
        >
          <Download size={20} />
          <span>EXPORTAR CSV</span>
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex flex-col lg:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="Buscar por nome ou CPF..." 
              className="pl-10 w-full bg-secondary/50 border-border focus:bg-white h-11 rounded-xl shadow-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <Filter size={18} className="text-muted-foreground hidden lg:block" />
            <select 
              className="h-11 bg-secondary/50 border border-border rounded-xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all w-full lg:w-64"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              <option value="all">Todos os Eventos</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/50 border-b border-border">
              <TableRow>
                <TableHead className="px-6 py-4 font-bold uppercase text-xs tracking-wider text-muted-foreground">Nome</TableHead>
                <TableHead className="px-6 py-4 font-bold uppercase text-xs tracking-wider text-muted-foreground">CPF</TableHead>
                <TableHead className="px-6 py-4 font-bold uppercase text-xs tracking-wider text-muted-foreground">Modalidade</TableHead>
                <TableHead className="px-6 py-4 font-bold uppercase text-xs tracking-wider text-muted-foreground">Kit</TableHead>
                <TableHead className="px-6 py-4 font-bold uppercase text-xs tracking-wider text-muted-foreground">Cidade</TableHead>
                <TableHead className="px-6 py-4 font-bold uppercase text-xs tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="px-6 py-4 text-right font-bold uppercase text-xs tracking-wider text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-20 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                       <Loader2 className="w-8 h-8 animate-spin text-primary" />
                       <p className="font-medium animate-pulse">Cruzando dados dos participantes...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredParticipants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-20 text-muted-foreground">
                    Nenhum participante encontrado.
                  </TableCell>
                </TableRow>
              ) : filteredParticipants.map((p) => (
                <TableRow key={p.id} className="hover:bg-secondary/20 transition-all group">
                  <TableCell className="px-6 py-4">
                    <div className="font-bold text-foreground">{p.nome}</div>
                    <div className="text-[10px] text-muted-foreground uppercase font-black">{p.eventName}</div>
                  </TableCell>
                  <TableCell className="px-6 py-4 font-mono text-xs">{p.cpf}</TableCell>
                  <TableCell className="px-6 py-4 text-sm">{p.modalidade || '-'}</TableCell>
                  <TableCell className="px-6 py-4 text-sm">{p.kit || '-'}</TableCell>
                  <TableCell className="px-6 py-4 text-sm">{p.cidade || '-'}</TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge 
                      variant={p.status === 'ENTREGUE' ? 'default' : 'secondary'}
                      className={p.status === 'ENTREGUE' ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-amber-100 text-amber-700 border-0'}
                    >
                      {p.status === 'ENTREGUE' ? 'Entregue' : 'Pendente'}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className={p.status === 'ENTREGUE' ? 'border-amber-100 text-amber-600 hover:bg-amber-50' : 'border-emerald-100 text-emerald-600 hover:bg-emerald-50'}
                        onClick={() => handleToggleStatus(p)}
                        title={p.status === 'ENTREGUE' ? 'Marcar como Pendente' : 'Marcar como Entregue'}
                      >
                        {p.status === 'ENTREGUE' ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                        <span className="ml-2 hidden sm:inline">{p.status === 'ENTREGUE' ? 'Pendente' : 'Entregue'}</span>
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="border-red-100 text-red-600 hover:bg-red-50"
                        onClick={() => setParticipantToDelete(p)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!participantToDelete} onOpenChange={(open) => !open && setParticipantToDelete(null)}>
        <DialogContent className="rounded-2xl p-8 border-0 shadow-2xl">
          <DialogHeader className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle size={32} />
            </div>
            <DialogTitle className="text-2xl font-bold">Deletar Participante?</DialogTitle>
            <DialogDescription className="text-muted-foreground mt-2">
              Tem certeza que deseja remover este participante? Essa ação é imediata e irreversível.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4 space-y-3">
             <div>
               <div className="text-sm font-bold text-slate-900">{participantToDelete?.nome}</div>
               <div className="text-xs text-slate-500">{participantToDelete?.cpf}</div>
             </div>
             
             <div className="space-y-1">
               <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Confirme o nome para excluir</label>
               <Input 
                placeholder="Digite o nome completo"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                className="bg-white border-slate-200"
               />
             </div>
          </div>
          <DialogFooter className="mt-8 gap-3 sm:justify-center">
            <Button variant="outline" onClick={() => { setParticipantToDelete(null); setDeleteConfirmName(''); }} disabled={isActionLoading} className="px-8 rounded-xl font-bold">
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={isActionLoading || deleteConfirmName !== participantToDelete?.nome} 
              className="px-8 rounded-xl font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {isActionLoading ? 'Removendo...' : 'Confirmar Exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
