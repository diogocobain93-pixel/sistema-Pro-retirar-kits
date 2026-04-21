import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Participant, Event } from '@/types';
import { 
  Users, 
  Search, 
  Upload, 
  Plus, 
  MapPin, 
  Calendar,
  ChevronLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Trash2,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function OrganizadorParticipantes() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [participantToDelete, setParticipantToDelete] = useState<Participant | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Add Manual State
  const [newParticipant, setNewParticipant] = useState({
    nome: '',
    cpf: '',
    numero: '',
    chip: '',
    sexo: '',
    equipe: '',
    cidade: '',
    dataNascimento: '',
    modalidade: '',
    kit: '',
    tamanhoCamiseta: '',
    numeroPeito: ''
  });
  
  // Import CSV State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<{
    imported: number;
    ignored: number;
    errors: number;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [eventData, participantsData] = await Promise.all([
        api.getEvento(id),
        api.getParticipantes(id)
      ]);
      setEvent(eventData);
      setParticipants(participantsData);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsRefreshing(true);
    try {
      const results = await api.getParticipantes(id, search);
      setParticipants(results);
    } catch (err: any) {
      setError(err.message || 'Erro na busca');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError('');
    try {
      await api.criarParticipante(id, newParticipant);
      setSuccess('Participante adicionado com sucesso!');
      setShowAddModal(false);
      setNewParticipant({ 
        nome: '', cpf: '', numero: '', chip: '', sexo: '', 
        equipe: '', cidade: '', dataNascimento: '', 
        modalidade: '', kit: '', tamanhoCamiseta: '', numeroPeito: '' 
      });
      const updated = await api.getParticipantes(id);
      setParticipants(updated);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao adicionar participante');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError('Por favor, selecione um arquivo CSV válido.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvPreview(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!id || !csvPreview) return;
    setIsRefreshing(true);
    setError('');
    try {
      const res = await api.importarParticipantes(id, csvPreview);
      setImportResults(res);
      const updatedList = await api.getParticipantes(id);
      setParticipants(updatedList);
      setCsvPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(err.message || 'Erro na importação');
    } finally {
      setIsRefreshing(false);
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
      setError(err.message || 'Erro ao atualizar status');
    }
  };

  const handleDelete = async () => {
    if (!participantToDelete) return;
    setIsActionLoading(true);
    try {
      await api.deletarParticipante(participantToDelete.id);
      setParticipants(prev => prev.filter(p => p.id !== participantToDelete.id));
      setParticipantToDelete(null);
      setSuccess('Participante removido com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao remover participante');
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link to="/organizador/eventos" className="flex items-center text-sm text-slate-500 hover:text-indigo-600 mb-2 transition-colors">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Voltar para Eventos
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            Participantes: {event?.nome}
          </h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
             <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {event?.local}</span>
             <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {event && new Date(event.dataEvento).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => setShowImportModal(true)} variant="outline" className="gap-2">
            <Upload className="w-4 h-4" />
            Importar CSV
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <Plus className="w-4 h-4" />
            Adicionar Manual
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      {/* Participants List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Buscar por nome ou CPF..." 
              className="pl-10 h-10 border-slate-200 focus-visible:ring-indigo-600"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">CPF</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Modalidade</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kit</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cidade</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {participants.length > 0 ? (
                participants.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors text-sm">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{p.nome}</div>
                      {p.numero && <div className="text-[10px] text-indigo-600 font-black uppercase">Nº {p.numero}</div>}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                      {p.cpf}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {p.modalidade || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {p.kit || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {p.cidade || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        p.status === 'ENTREGUE' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        {p.status === 'ENTREGUE' ? 'Entregue' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 text-right">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className={`h-8 w-8 p-0 rounded-full ${p.status === 'ENTREGUE' ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                          onClick={() => handleToggleStatus(p)}
                          title={p.status === 'ENTREGUE' ? 'Remover entrega' : 'Marcar como entregue'}
                        >
                          {p.status === 'ENTREGUE' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 rounded-full"
                          onClick={() => setParticipantToDelete(p)}
                          title="Remover participante"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    Nenhum participante encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                Novo Participante
              </h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <form onSubmit={handleAddParticipant} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input 
                    id="nome" 
                    required 
                    placeholder="Nome do participante"
                    value={newParticipant.nome}
                    onChange={(e) => setNewParticipant({...newParticipant, nome: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input 
                    id="cpf" 
                    required 
                    placeholder="000.000.000-00"
                    value={newParticipant.cpf}
                    onChange={(e) => setNewParticipant({...newParticipant, cpf: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numero">Número</Label>
                  <Input 
                    id="numero" 
                    placeholder="Ex: 123"
                    value={newParticipant.numero}
                    onChange={(e) => setNewParticipant({...newParticipant, numero: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chip">Chip</Label>
                  <Input 
                    id="chip" 
                    placeholder="ID do Chip"
                    value={newParticipant.chip}
                    onChange={(e) => setNewParticipant({...newParticipant, chip: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numeroPeito">Nº Peito</Label>
                  <Input 
                    id="numeroPeito" 
                    placeholder="Nº de Peito"
                    value={newParticipant.numeroPeito}
                    onChange={(e) => setNewParticipant({...newParticipant, numeroPeito: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sexo">Sexo</Label>
                  <Input 
                    id="sexo" 
                    placeholder="Masculino/Feminino"
                    value={newParticipant.sexo}
                    onChange={(e) => setNewParticipant({...newParticipant, sexo: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataNascimento">Data Nascimento</Label>
                  <Input 
                    id="dataNascimento" 
                    placeholder="dd/mm/aaaa"
                    value={newParticipant.dataNascimento}
                    onChange={(e) => setNewParticipant({...newParticipant, dataNascimento: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="equipe">Equipe</Label>
                  <Input 
                    id="equipe" 
                    placeholder="Nome da Equipe"
                    value={newParticipant.equipe}
                    onChange={(e) => setNewParticipant({...newParticipant, equipe: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input 
                    id="cidade" 
                    placeholder="Cidade - UF"
                    value={newParticipant.cidade}
                    onChange={(e) => setNewParticipant({...newParticipant, cidade: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="modalidade">Modalidade</Label>
                  <Input 
                    id="modalidade" 
                    placeholder="Ex: 5km"
                    value={newParticipant.modalidade}
                    onChange={(e) => setNewParticipant({...newParticipant, modalidade: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kit">Kit</Label>
                  <Input 
                    id="kit" 
                    placeholder="Tipo de Kit"
                    value={newParticipant.kit}
                    onChange={(e) => setNewParticipant({...newParticipant, kit: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tamanhoCamiseta">Camiseta</Label>
                  <Input 
                    id="tamanhoCamiseta" 
                    placeholder="P, M, G..."
                    value={newParticipant.tamanhoCamiseta}
                    onChange={(e) => setNewParticipant({...newParticipant, tamanhoCamiseta: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="flex gap-3 pt-4 justify-end border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancelar</Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 min-w-[120px]">
                  Salvar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                Importar Participantes
              </h2>
              <button 
                onClick={() => {
                  setShowImportModal(false);
                  setImportResults(null);
                  setCsvPreview(null);
                }}
                className="p-1 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {!importResults ? (
                <>
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl space-y-2">
                    <h3 className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      Novo Formato de Importação
                    </h3>
                    <p className="text-xs text-indigo-700 leading-relaxed font-medium">
                      O arquivo CSV deve possuir as seguintes colunas (exatamente nesta ordem):
                    </p>
                    <code className="block bg-white/70 p-2 rounded text-[10px] font-mono whitespace-nowrap overflow-x-auto text-indigo-800">
                      Nome,CPF,Data Nascimento,Sexo,Equipe,Cidade,Modalidade,Número Peito,Chip,Kit,Tamanho Camiseta,Status,Em Entrega,Hora Entrega,Solicitou Retirada
                    </code>
                    <p className="text-[10px] text-indigo-500 mt-1 italic">
                      * O campo 'entregue' aceita: sim, s, 1 ou entregue.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <Label htmlFor="csv-file">Selecione o arquivo .csv</Label>
                    <div className="flex items-center justify-center w-full">
                      <label 
                        htmlFor="csv-file" 
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-500">
                          <Upload className="w-8 h-8 mb-2 opacity-50" />
                          <p className="mb-2 text-sm">Clique para fazer upload ou arraste</p>
                          <p className="text-xs opacity-50 font-mono">SOMENTE ARQUIVOS .CSV</p>
                        </div>
                        <input 
                          id="csv-file" 
                          type="file" 
                          accept=".csv" 
                          className="hidden" 
                          ref={fileInputRef}
                          onChange={handleFileUpload} 
                        />
                      </label>
                    </div>
                    {csvPreview && (
                      <div className="flex items-center justify-between bg-slate-50 p-2 px-3 rounded-lg border border-slate-200">
                        <span className="text-sm text-slate-600 truncate font-mono">CSV carregado e pronto</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4 justify-end">
                    <Button variant="outline" onClick={() => setShowImportModal(false)}>Cancelar</Button>
                    <Button 
                      onClick={handleImport}
                      disabled={!csvPreview || isRefreshing}
                      className="bg-indigo-600 hover:bg-indigo-700 min-w-[120px]"
                    >
                      {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Processar CSV'}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-6 animate-in fade-in zoom-in-95">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
                      !
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Resultado da Importação</h3>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-center">
                      <div className="text-2xl font-bold text-emerald-600">{importResults.imported}</div>
                      <div className="text-xs text-emerald-600 font-medium">Importados</div>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-center">
                      <div className="text-2xl font-bold text-amber-600">{importResults.ignored}</div>
                      <div className="text-xs text-amber-600 font-medium">Ignorados</div>
                    </div>
                    <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-center">
                      <div className="text-2xl font-bold text-red-600">{importResults.errors}</div>
                      <div className="text-xs text-red-600 font-medium">Erros/Inválidos</div>
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-slate-900" 
                    onClick={() => {
                      setShowImportModal(false);
                      setImportResults(null);
                    }}
                  >
                    Fechar e Ver Lista
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {participantToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Remover Participante</h2>
              <p className="text-slate-500 mt-2 text-sm">
                Tem certeza que deseja remover <span className="font-bold text-slate-900">{participantToDelete.nome}</span>?<br/>
                Esta ação é irreversível e removerá todos os dados vinculados.
              </p>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 w-full mt-6 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 uppercase font-black tracking-widest">Confirmação</span>
                  <span className="text-red-500 font-bold uppercase tracking-widest">Atenção</span>
                </div>
                <Input 
                  placeholder="Digite o nome do participante para confirmar"
                  className="bg-white border-slate-200"
                  onChange={(e) => {
                    // Logic for name confirmation if desired, but user just said "typed to proceed" for EVENT deletion.
                    // For participants, they said "display a modal asking for confirmation, requiring the participant's name to be typed to proceed".
                    // I will check this in the button click.
                    (window as any)._participantConfirmName = e.target.value;
                  }}
                />
              </div>

              <div className="flex gap-3 mt-8 w-full">
                <Button variant="outline" className="flex-1 rounded-xl h-12 font-bold" onClick={() => setParticipantToDelete(null)} disabled={isActionLoading}>
                  Cancelar
                </Button>
                <Button 
                  className="flex-1 bg-red-600 hover:bg-red-700 rounded-xl h-12 font-bold" 
                  onClick={() => {
                    const typed = (window as any)._participantConfirmName;
                    if (typed === participantToDelete.nome) {
                       handleDelete();
                    } else {
                       alert('O nome digitado não corresponde ao nome do participante.');
                    }
                  }} 
                  disabled={isActionLoading}
                >
                  {isActionLoading ? 'Removendo...' : 'Confirmar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
