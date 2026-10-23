'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ClipboardCheck, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';

type Organization = { id: string; name: string };
type Company = { id: string; name: string };
type Status = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
type Item = {
  id: string; organizationId: string; companyId: string | null; title: string;
  description: string | null; category: string; status: Status; priority: Priority;
  dueDate: string | null; responsible: string | null; evidenceUrl: string | null;
  company?: Company | null; createdAt: string;
};
const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const statusLabel: Record<Status, string> = { PENDING: 'Pendente', IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluída' };
const priorityLabel: Record<Priority, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta' };
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Sem prazo';

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = window.localStorage.getItem('reforma360_access_token');
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options?.headers || {}) },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Não foi possível concluir a solicitação.');
  return body as T;
}

export default function ChecklistPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | Status>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('GERAL');
  const [companyId, setCompanyId] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [responsible, setResponsible] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  const load = useCallback(async (preferredId?: string) => {
    setLoading(true); setError('');
    try {
      const orgs = await apiRequest<Organization[]>('/organizations');
      setOrganizations(orgs);
      const active = orgs.find(o => o.id === (preferredId || organizationId))?.id || orgs[0]?.id || '';
      setOrganizationId(active);
      if (!active) { setItems([]); setCompanies([]); return; }
      const [tasks, businesses] = await Promise.all([
        apiRequest<Item[]>(`/checklist?organizationId=${encodeURIComponent(active)}`),
        apiRequest<Company[]>(`/companies?organizationId=${encodeURIComponent(active)}`),
      ]);
      setItems(tasks); setCompanies(businesses);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar o checklist.');
    } finally { setLoading(false); }
  }, [organizationId]);

  useEffect(() => {
    if (!window.localStorage.getItem('reforma360_access_token')) {
      setError('Sua sessão não foi encontrada. Volte ao painel e entre novamente.');
      setLoading(false);
      return;
    }
    void load();
  }, [load]);

  const visibleItems = useMemo(() => items.filter(item => {
    const matchesStatus = filter === 'ALL' || item.status === filter;
    const text = `${item.title} ${item.description || ''} ${item.category} ${item.company?.name || ''}`.toLowerCase();
    return matchesStatus && text.includes(search.toLowerCase());
  }), [items, filter, search]);
  const pending = items.filter(i => i.status === 'PENDING').length;
  const inProgress = items.filter(i => i.status === 'IN_PROGRESS').length;
  const completed = items.filter(i => i.status === 'COMPLETED').length;

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) { setError('Cadastre ou selecione uma organização no painel antes de criar tarefas.'); return; }
    setSaving(true); setError('');
    try {
      await apiRequest<Item>(`/checklist?organizationId=${encodeURIComponent(organizationId)}`, {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined, category, companyId: companyId || undefined, priority, dueDate: dueDate || undefined, responsible: responsible.trim() || undefined, evidenceUrl: evidenceUrl.trim() || undefined }),
      });
      setTitle(''); setDescription(''); setCategory('GERAL'); setCompanyId(''); setPriority('MEDIUM'); setDueDate(''); setResponsible(''); setEvidenceUrl(''); setShowForm(false);
      await load(organizationId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar a tarefa.'); }
    finally { setSaving(false); }
  }

  async function changeStatus(item: Item, status: Status) {
    setError('');
    try {
      const updated = await apiRequest<Item>(`/checklist/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setItems(current => current.map(x => x.id === updated.id ? updated : x));
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível atualizar a tarefa.'); }
  }

  async function removeItem(item: Item) {
    if (!window.confirm(`Excluir a tarefa “${item.title}”?`)) return;
    setError('');
    try {
      await apiRequest(`/checklist/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      setItems(current => current.filter(x => x.id !== item.id));
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível excluir a tarefa.'); }
  }

  return <main className="checklist-page">
    <header className="checklist-header">
      <div>
        <Link href="/" className="checklist-back"><ArrowLeft size={16}/> Voltar ao painel</Link>
        <div className="checklist-title-row"><span className="checklist-mark"><ClipboardCheck size={22}/></span><div><h1>Checklist de adequação</h1><p>Organize tarefas, responsáveis, prazos e evidências da transição tributária.</p></div></div>
      </div>
      <div className="checklist-actions"><button className="btn btn-light" type="button" onClick={() => void load(organizationId)} disabled={loading}><RefreshCw size={15}/> Atualizar</button><button className="btn btn-primary" type="button" onClick={() => setShowForm(v => !v)}><Plus size={16}/> Nova tarefa</button></div>
    </header>

    <section className="checklist-orgbar">
      <div><span className="eyebrow">ORGANIZAÇÃO ATIVA</span><strong>{organizations.find(o => o.id === organizationId)?.name || 'Nenhuma organização cadastrada'}</strong></div>
      <select aria-label="Selecionar organização" value={organizationId} onChange={e => { setOrganizationId(e.target.value); void load(e.target.value); }} disabled={!organizations.length}><option value="">Selecione uma organização</option>{organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select>
    </section>

    {error && <div className="checklist-error" role="alert">{error}</div>}
    {!organizations.length && !loading && <div className="checklist-empty"><h2>Crie sua organização primeiro</h2><p>O checklist fica vinculado à organização selecionada para manter os dados separados por conta.</p><Link href="/" className="btn btn-primary">Ir ao painel</Link></div>}

    <section className="checklist-stats">
      <article><span>Pendentes</span><strong>{pending}</strong><small>Aguardando início</small></article>
      <article><span>Em andamento</span><strong>{inProgress}</strong><small>Em execução</small></article>
      <article><span>Concluídas</span><strong>{completed}</strong><small>Finalizadas</small></article>
      <article><span>Total de tarefas</span><strong>{items.length}</strong><small>Na organização ativa</small></article>
    </section>

    {showForm && <section className="checklist-form-card"><div className="checklist-section-heading"><div><h2>Nova tarefa</h2><p>Defina o que precisa ser feito e quem acompanhará.</p></div></div>
      <form className="checklist-form" onSubmit={createItem}>
        <label className="span-2">Título da tarefa<input required minLength={2} maxLength={180} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Mapear operações sujeitas à CBS e ao IBS"/></label>
        <label>Categoria<select value={category} onChange={e => setCategory(e.target.value)}><option value="GERAL">Geral</option><option value="CADASTRO">Cadastros fiscais</option><option value="SISTEMAS">Sistemas e ERP</option><option value="DOCUMENTOS">Documentos fiscais</option><option value="CREDITOS">Créditos tributários</option><option value="PROCESSOS">Processos internos</option><option value="TREINAMENTO">Treinamento</option></select></label>
        <label>Empresa (opcional)<select value={companyId} onChange={e => setCompanyId(e.target.value)}><option value="">Todas / organização</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label>Prioridade<select value={priority} onChange={e => setPriority(e.target.value as Priority)}><option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option></select></label>
        <label>Prazo<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}/></label>
        <label>Responsável<input maxLength={160} value={responsible} onChange={e => setResponsible(e.target.value)} placeholder="Nome do responsável"/></label>
        <label>Link da evidência<input type="url" maxLength={500} value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} placeholder="https://..."/></label>
        <label className="span-2">Descrição (opcional)<textarea maxLength={2000} rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhe a atividade, documentos necessários ou critérios de conclusão."/></label>
        <div className="checklist-form-actions span-2"><button className="btn btn-light" type="button" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={saving || !organizationId}>{saving ? 'Salvando…' : 'Salvar tarefa'}</button></div>
      </form>
    </section>}

    <section className="checklist-list-card">
      <div className="checklist-section-heading"><div><h2>Tarefas da organização</h2><p>O acesso é validado pela organização associada à sua conta.</p></div><span className="checklist-total">{visibleItems.length} tarefa(s)</span></div>
      <div className="checklist-toolbar"><div className="checklist-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tarefa, empresa ou categoria" aria-label="Buscar tarefas"/></div><select aria-label="Filtrar por status" value={filter} onChange={e => setFilter(e.target.value as 'ALL' | Status)}><option value="ALL">Todos os status</option><option value="PENDING">Pendentes</option><option value="IN_PROGRESS">Em andamento</option><option value="COMPLETED">Concluídas</option></select></div>
      {loading ? <div className="checklist-empty">Carregando tarefas…</div> : visibleItems.length === 0 ? <div className="checklist-empty"><CheckCircle2 size={28}/><h3>{items.length ? 'Nenhuma tarefa encontrada' : 'Seu checklist está vazio'}</h3><p>{items.length ? 'Altere a busca ou o filtro de status.' : 'Crie a primeira tarefa para começar a organizar a adequação tributária.'}</p>{!items.length && <button className="btn btn-primary" type="button" onClick={() => setShowForm(true)}><Plus size={16}/> Criar primeira tarefa</button>}</div> :
        <div className="checklist-items">{visibleItems.map(item => <article className={`checklist-item status-${item.status.toLowerCase()}`} key={item.id}>
          <div className="checklist-item-main"><div className="checklist-item-top"><span className={`priority-dot priority-${item.priority.toLowerCase()}`}/><span className="checklist-category">{item.category}</span><span className={`checklist-priority priority-label-${item.priority.toLowerCase()}`}>{priorityLabel[item.priority]}</span></div><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}<div className="checklist-meta"><span>{item.company?.name || 'Organização inteira'}</span><span>Prazo: {dateLabel(item.dueDate)}</span>{item.responsible && <span>Responsável: {item.responsible}</span>}{item.evidenceUrl && <a href={item.evidenceUrl} target="_blank" rel="noreferrer">Abrir evidência</a>}</div></div>
          <div className="checklist-item-controls"><label>Status<select aria-label={`Status de ${item.title}`} value={item.status} onChange={e => void changeStatus(item, e.target.value as Status)}><option value="PENDING">Pendente</option><option value="IN_PROGRESS">Em andamento</option><option value="COMPLETED">Concluída</option></select></label><button className="checklist-delete" type="button" onClick={() => void removeItem(item)} aria-label={`Excluir ${item.title}`} title="Excluir tarefa"><Trash2 size={16}/></button></div>
        </article>)}</div>}
    </section>
    <footer className="checklist-footer">Reforma 360 · Checklist de adequação tributária · Etapa 2</footer>
  </main>;
}
