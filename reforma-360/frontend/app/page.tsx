'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, Bell, Building2, Calculator, CheckCircle2, ChevronRight, CircleHelp, ClipboardCheck, FileCheck2, FileSearch, Files, Gauge, LayoutDashboard, ListTodo, LockKeyhole, Plus, Settings2, ShieldAlert, Users, WalletCards, X, RefreshCw, Search, LogOut, ShieldCheck } from 'lucide-react';

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
type ApiHealth = { status: string; service: string; version: string };
type Organization = { id: string; name: string; type: 'ACCOUNTING_FIRM' | 'COMPANY' | 'TAX_DEPARTMENT'; createdAt: string };
type Company = { id: string; organizationId: string; name: string; taxId: string; taxRegime: string; state?: string | null; city?: string | null; createdAt: string };
type Modal = 'organization' | 'company' | null;
type AuthMode = 'login' | 'register';

const organizationTypes = [
  { value: 'ACCOUNTING_FIRM', label: 'Escritório contábil' },
  { value: 'COMPANY', label: 'Empresa' },
  { value: 'TAX_DEPARTMENT', label: 'Departamento fiscal' },
];
const taxRegimes = [
  { value: 'NAO_INFORMADO', label: 'Não informado' },
  { value: 'SIMPLES_NACIONAL', label: 'Simples Nacional' },
  { value: 'LUCRO_PRESUMIDO', label: 'Lucro Presumido' },
  { value: 'LUCRO_REAL', label: 'Lucro Real' },
];
const organizationLabel = (value: Organization['type']) => organizationTypes.find(x => x.value === value)?.label || value;
const regimeLabel = (value: string) => taxRegimes.find(x => x.value === value)?.label || value;

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('reforma360_access_token') : null;
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options?.headers || {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    throw new Error(message || `Erro na solicitação (${response.status}).`);
  }
  return body as T;
}

export default function Home() {
  const [apiStatus, setApiStatus] = useState<'checking'|'online'|'offline'>('checking');
  const [authReady, setAuthReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authOrgName, setAuthOrgName] = useState('');
  const [authOrgType, setAuthOrgType] = useState<Organization['type']>('ACCOUNTING_FIRM');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<Organization['type']>('ACCOUNTING_FIRM');
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [taxRegime, setTaxRegime] = useState('NAO_INFORMADO');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const selectedOrganization = organizations.find(o => o.id === organizationId);
  const filteredCompanies = useMemo(() => companies.filter(c => `${c.name} ${c.taxId} ${c.city || ''} ${c.state || ''}`.toLowerCase().includes(search.toLowerCase())), [companies, search]);

  const loadOrganizations = useCallback(async () => {
    const data = await apiRequest<Organization[]>('/organizations');
    setOrganizations(data);
    setOrganizationId(current => data.some(o => o.id === current) ? current : (data[0]?.id || ''));
    return data;
  }, []);

  const loadCompanies = useCallback(async (id: string) => {
    if (!id) { setCompanies([]); return; }
    const data = await apiRequest<Company[]>(`/companies?organizationId=${encodeURIComponent(id)}`);
    setCompanies(data);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const status = await apiRequest<ApiHealth>('/health');
      setHealth(status); setApiStatus('online');
      const orgs = await loadOrganizations();
      const activeId = orgs.find(o => o.id === organizationId)?.id || orgs[0]?.id || '';
      await loadCompanies(activeId);
    } catch (e) {
      setApiStatus('offline'); setError(e instanceof Error ? e.message : 'Não foi possível carregar os dados.');
    } finally { setLoading(false); }
  }, [loadOrganizations, loadCompanies, organizationId]);

  useEffect(() => {
    const token = window.localStorage.getItem('reforma360_access_token');
    setAuthenticated(Boolean(token));
    setAuthReady(true);
  }, []);
  
  useEffect(() => { if (authReady && authenticated) void refresh(); }, [authReady, authenticated, refresh]);
  
  useEffect(() => {
    if (!organizationId || apiStatus !== 'online') { setCompanies([]); return; }
    let active = true;
    apiRequest<Company[]>(`/companies?organizationId=${encodeURIComponent(organizationId)}`)
      .then(data => { if (active) setCompanies(data); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Erro ao listar empresas.'); });
    return () => { active = false; };
  }, [organizationId, apiStatus]);

  async function submitOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try {
      const created = await apiRequest<Organization>('/organizations', { method: 'POST', body: JSON.stringify({ name: orgName.trim(), type: orgType }) });
      const all = await loadOrganizations();
      setOrganizationId(created.id);
      setCompanies([]);
      setOrgName(''); setOrgType('ACCOUNTING_FIRM'); setModal(null);
      setSuccess(`Organização “${created.name}” cadastrada com sucesso.`);
      await loadCompanies(created.id);
      if (!all.some(o => o.id === created.id)) await loadOrganizations();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível cadastrar a organização.'); }
    finally { setSaving(false); }
  }

  async function submitCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    const normalizedTaxId = taxId.replace(/\D/g, '');
    if (!organizationId) { setError('Cadastre ou selecione uma organização antes de cadastrar uma empresa.'); setSaving(false); return; }
    if (normalizedTaxId.length !== 14) { setError('Informe um CNPJ com 14 números.'); setSaving(false); return; }
    try {
      const created = await apiRequest<Company>('/companies', { method: 'POST', body: JSON.stringify({ name: companyName.trim(), taxId: normalizedTaxId, taxRegime, organizationId, city: city.trim() || undefined, state: state.trim().toUpperCase() || undefined }) });
      setCompanies(current => [created, ...current.filter(c => c.id !== created.id)]);
      setCompanyName(''); setTaxId(''); setTaxRegime('NAO_INFORMADO'); setCity(''); setState(''); setModal(null);
      setSuccess(`Empresa “${created.name}” cadastrada com sucesso.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível cadastrar a empresa.'); }
    finally { setSaving(false); }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthSubmitting(true); setError('');
    try {
      const path = authMode === 'register' ? '/auth/register' : '/auth/login';
      const payload = authMode === 'register'
        ? { name: authName.trim(), email: authEmail.trim(), password: authPassword, organizationName: authOrgName.trim(), organizationType: authOrgType }
        : { email: authEmail.trim(), password: authPassword };
      const result = await apiRequest<{ accessToken: string }>(path, { method: 'POST', body: JSON.stringify(payload) });
      window.localStorage.setItem('reforma360_access_token', result.accessToken);
      setAuthenticated(true); setAuthPassword(''); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível autenticar.'); }
    finally { setAuthSubmitting(false); }
  }
  
  function logout() {
    window.localStorage.removeItem('reforma360_access_token');
    setAuthenticated(false); setOrganizations([]); setCompanies([]); setOrganizationId(''); setApiStatus('checking'); setError(''); setAuthMode('login');
  }
  
  function openModal(which: Exclude<Modal, null>) { setError(''); setSuccess(''); setModal(which); }
  function closeModal() { if (!saving) setModal(null); }

  if (!authReady) return <div className="auth-loading">Carregando Reforma 360…</div>;
  
  if (!authenticated) return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-brand"><div className="brand-mark">R</div><div><strong>reforma 360</strong><small>INTELIGÊNCIA TRIBUTÁRIA</small></div></div>
        <div className="eyebrow">PLATAFORMA DE ADEQUAÇÃO TRIBUTÁRIA</div>
        <h1>{authMode === 'register' ? 'Crie sua conta' : 'Bem-vindo de volta'}</h1>
        <p className="auth-description">{authMode === 'register' ? 'Cadastre seu acesso e crie a primeira organização.' : 'Entre para acessar as empresas e os módulos da sua organização.'}</p>
        {error && <div className="alert error-alert" role="alert"><ShieldAlert size={17}/><span>{error}</span></div>}
        <form onSubmit={submitAuth} className="form-stack">
          {authMode === 'register' && <><label>Seu nome<input required minLength={2} maxLength={120} autoComplete="name" value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Nome completo"/></label></>}
          <label>E-mail<input type="email" required maxLength={180} autoComplete="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="voce@empresa.com.br"/></label>
          <label>Senha<input type="password" required minLength={authMode === 'register' ? 10 : 1} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder={authMode === 'register' ? 'Mínimo de 10 caracteres' : 'Sua senha'}/></label>
          {authMode === 'register' && <><label>Nome da organização<input required minLength={2} maxLength={160} value={authOrgName} onChange={e => setAuthOrgName(e.target.value)} placeholder="Ex.: Escritório Contábil Exemplo"/></label><label>Tipo de organização<select value={authOrgType} onChange={e => setAuthOrgType(e.target.value as Organization['type'])}>{organizationTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label><div className="form-help">Use uma senha forte com pelo menos 10 caracteres, incluindo letras e números. O primeiro usuário será proprietário da organização criada.</div></>}
          <button type="submit" className="btn auth-submit" disabled={authSubmitting}>{authSubmitting ? 'Aguarde…' : authMode === 'register' ? 'Criar conta e organização' : 'Entrar'}</button>
        </form>
        <div className="auth-switch">{authMode === 'register' ? 'Já possui uma conta?' : 'Ainda não tem conta?'} <button type="button" onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); setError(''); }}>{authMode === 'register' ? 'Entrar' : 'Criar conta'}</button></div>
        <div className="auth-safety"><ShieldCheck size={15}/> Plataforma Segura. Dados encriptados.</div>
      </section>
    </main>
  );

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">R</div><div><strong>reforma 360</strong><small>INTELIGÊNCIA TRIBUTÁRIA</small></div></div>
      <div>
        <div className="nav-label">Workspace</div>
        <Link className="nav-item active" href="/"><LayoutDashboard size={17}/> Visão geral</Link>
        <a className="nav-item" href="#companies"><Building2 size={17}/> Empresas</a>
        <button className="nav-item nav-button" onClick={() => openModal('organization')}><Users size={17}/> Organizações e acessos</button>
      </div>
      <div>
        <div className="nav-label">Reforma tributária</div>
        <Link className="nav-item" href="/checklist"><ClipboardCheck size={17}/> Checklist de adequação</Link>
        <Link className="nav-item" href="/xml"><FileSearch size={17}/> Análise de XML</Link>
        <Link className="nav-item" href="/simulador"><Calculator size={17}/> Simulador CBS / IBS</Link>
        <Link className="nav-item" href="/creditos"><WalletCards size={17}/> Créditos tributários</Link>
        <Link className="nav-item" href="/relatorios"><Files size={17}/> Relatórios</Link>
      </div>
      <div>
        <div className="nav-label">Sistema</div>
        <Link className="nav-item" href="/historico"><Activity size={17}/> Histórico de atividades</Link>
        <Link className="nav-item" href="/configuracoes"><Settings2 size={17}/> Configurações</Link>
      </div>
      <div className="sidebar-footer">Reforma 360 · versão 1.0<br/>Todos os sistemas online</div>
    </aside>
    <main className="main" id="overview">
      <header className="topbar">
        <div className="crumb">Workspace <ChevronRight size={12} style={{display:'inline',verticalAlign:'middle'}}/> <strong>Visão geral</strong></div>
        <div className="top-right">
          <span className="role-label" style={{background:'#dcfce7', color:'#166534'}}>Ambiente Seguro</span>
          <Bell size={17}/>
          <div className="avatar">R</div>
          <button className="icon-button" onClick={logout} title="Sair da conta" aria-label="Sair da conta"><LogOut size={16}/></button>
        </div>
      </header>
      <div className="content">
        <div className="eyebrow">PAINEL DE CONTROLE</div>
        <div className="page-head">
          <div><h1>Visão geral</h1><p>Acompanhe a preparação tributária e acesse os módulos da Reforma 360.</p></div>
          <div className="head-actions">
            <button className="btn btn-light" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} style={{display:'inline',verticalAlign:'middle',marginRight:7}}/>Atualizar</button>
            <button className="btn" onClick={() => selectedOrganization ? openModal('company') : openModal('organization')}><Plus size={15} style={{display:'inline',verticalAlign:'middle',marginRight:7}}/>{selectedOrganization ? 'Nova empresa' : 'Nova organização'}</button>
          </div>
        </div>
        
        {error && !modal && <div className="alert error-alert" role="alert"><ShieldAlert size={17}/><span>{error}</span><button className="icon-button" aria-label="Fechar aviso" onClick={() => setError('')}><X size={16}/></button></div>}
        {success && <div className="alert success-alert" role="status"><CheckCircle2 size={17}/><span>{success}</span><button className="icon-button" aria-label="Fechar aviso" onClick={() => setSuccess('')}><X size={16}/></button></div>}
        
        <section className="workspace-select card">
          <div><label htmlFor="organization-select">Organização ativa</label><p>Os dados exibidos pertencem à organização selecionada.</p></div>
          <select id="organization-select" value={organizationId} onChange={e => setOrganizationId(e.target.value)} disabled={!organizations.length}>
            <option value="">{organizations.length ? 'Selecione uma organização' : 'Nenhuma organização cadastrada'}</option>
            {organizations.map(o => <option key={o.id} value={o.id}>{o.name} · {organizationLabel(o.type)}</option>)}
          </select>
          <button className="text-button" onClick={() => openModal('organization')}><Plus size={14}/> Nova organização</button>
        </section>
        
        <div className="stats">
          <div className="card"><div className="stat-top">Empresas cadastradas <span className="stat-icon"><Building2 size={17}/></span></div><div className="stat-value">{loading ? '…' : companies.length}</div><div className="stat-note">{selectedOrganization ? `Em ${selectedOrganization.name}` : 'Cadastre uma organização para começar'}</div></div>
          <div className="card"><div className="stat-top">Pendências em aberto <span className="stat-icon"><ListTodo size={17}/></span></div><div className="stat-value">3</div><div className="stat-note"><Link href="/checklist" style={{color:'var(--brand)', textDecoration:'none', fontWeight:500}}>Abrir checklist de adequação</Link></div></div>
          <div className="card"><div className="stat-top">Auditoria e Créditos <span className="stat-icon"><WalletCards size={17}/></span></div><div className="stat-value" style={{color: '#16a34a'}}>Ativo</div><div className="stat-note"><Link href="/creditos" style={{color:'var(--brand)', textDecoration:'none', fontWeight:500}}>Acessar carteira XML</Link></div></div>
          <div className="card"><div className="stat-top">Status da Plataforma <span className="stat-icon"><Gauge size={17}/></span></div><div className="stat-value" style={{fontSize:22}}>{apiStatus === 'checking' ? 'Verificando' : apiStatus === 'online' ? 'Conectada' : 'Offline'}</div><div className="stat-note">{health ? `${health.service} · v${health.version}` : apiStatus === 'offline' ? 'Confira o backend e a conexão' : 'Testando conexão com o backend'}</div></div>
        </div>

        {/* ACESSO RÁPIDO AOS MÓDULOS */}
        <section className="card" style={{ padding: '25px', marginBottom: '30px' }}>
          <div className="section-head" style={{ marginBottom: '20px', borderBottom: 'none' }}>
            <div><h2 className="card-title">Módulos da Reforma 360</h2><div className="card-sub">Acesse rapidamente as ferramentas de inteligência tributária.</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '15px' }}>
            
            <Link href="/simulador" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '20px', border: '1px solid #e5e7eb', borderRadius: '10px', textDecoration: 'none', color: '#111827', background: '#f8faff', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ background: '#1446b3', color: '#fff', padding: '12px', borderRadius: '8px' }}><Calculator size={24}/></div>
              <div><strong style={{ display: 'block', fontSize: '15px' }}>Simulador CBS/IBS</strong><span style={{ fontSize: '13px', color: '#6b7280' }}>Planeje cenários e regimes</span></div>
            </Link>
            
            <Link href="/creditos" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '20px', border: '1px solid #e5e7eb', borderRadius: '10px', textDecoration: 'none', color: '#111827', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ background: '#f0fdf4', color: '#166534', padding: '12px', borderRadius: '8px' }}><WalletCards size={24}/></div>
              <div><strong style={{ display: 'block', fontSize: '15px' }}>Créditos Tributários</strong><span style={{ fontSize: '13px', color: '#6b7280' }}>Auditoria de XMLs de Entrada</span></div>
            </Link>
            
            <Link href="/relatorios" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '20px', border: '1px solid #e5e7eb', borderRadius: '10px', textDecoration: 'none', color: '#111827', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ background: '#fefce8', color: '#854d0e', padding: '12px', borderRadius: '8px' }}><Files size={24}/></div>
              <div><strong style={{ display: 'block', fontSize: '15px' }}>Relatórios e PDFs</strong><span style={{ fontSize: '13px', color: '#6b7280' }}>Exportar simulações salvas</span></div>
            </Link>
            
            <Link href="/historico" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '20px', border: '1px solid #e5e7eb', borderRadius: '10px', textDecoration: 'none', color: '#111827', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ background: '#f3f4f6', color: '#4b5563', padding: '12px', borderRadius: '8px' }}><Activity size={24}/></div>
              <div><strong style={{ display: 'block', fontSize: '15px' }}>Auditoria do Sistema</strong><span style={{ fontSize: '13px', color: '#6b7280' }}>Histórico de atividades</span></div>
            </Link>
            
          </div>
        </section>

        <section className="card table-card" id="companies">
          <div className="section-head"><div><h2 className="card-title">Empresas cadastradas</h2><div className="card-sub">{selectedOrganization ? `Empresas vinculadas a ${selectedOrganization.name}` : 'Cadastre uma organização para começar'}</div></div><button className="text-button" onClick={() => selectedOrganization ? openModal('company') : openModal('organization')}><Plus size={14}/>{selectedOrganization ? 'Cadastrar empresa' : 'Criar organização'}</button></div>
          {companies.length > 0 && <div className="table-toolbar"><div className="search-box"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, CNPJ ou cidade" aria-label="Buscar empresas"/></div><span className="result-count">{filteredCompanies.length} resultado(s)</span></div>}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Empresa</th><th>CNPJ</th><th>Regime tributário</th><th>Localidade</th><th>Cadastro</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5} className="table-empty">Carregando dados…</td></tr> : !selectedOrganization ? <tr><td colSpan={5} className="table-empty"><Building2 size={22}/><strong>Nenhuma organização selecionada</strong><span>Crie uma organização para começar a cadastrar empresas.</span><button className="btn" onClick={() => openModal('organization')}>Criar organização</button></td></tr> : filteredCompanies.length === 0 ? <tr><td colSpan={5} className="table-empty"><Building2 size={22}/><strong>{companies.length ? 'Nenhum resultado encontrado' : 'Nenhuma empresa cadastrada ainda'}</strong><span>{companies.length ? 'Tente alterar o termo da busca.' : 'Cadastre a primeira empresa vinculada a esta organização.'}</span>{!companies.length && <button className="btn" onClick={() => openModal('company')}>Nova empresa</button>}</td></tr> : filteredCompanies.map(c => <tr key={c.id}><td>{c.name}</td><td className="tax-id">{c.taxId}</td><td>{regimeLabel(c.taxRegime)}</td><td>{[c.city, c.state].filter(Boolean).join(' / ') || '—'}</td><td>{new Date(c.createdAt).toLocaleDateString('pt-BR')}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) closeModal(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><span className="eyebrow">REFORMA 360</span><h2 id="modal-title">{modal === 'organization' ? 'Nova organização' : 'Cadastrar empresa'}</h2><p>{modal === 'organization' ? 'Defina o tipo de operação que utilizará a plataforma.' : `A empresa será vinculada a ${selectedOrganization?.name || 'organização selecionada'}.`}</p></div><button className="icon-button close-button" onClick={closeModal} aria-label="Fechar" disabled={saving}><X size={19}/></button></div>
      {error && <div className="alert error-alert" role="alert"><ShieldAlert size={17}/><span>{error}</span></div>}
      {modal === 'organization' ? <form onSubmit={submitOrganization} className="form-stack"><label>Nome da organização<input autoFocus required minLength={2} maxLength={160} value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Ex.: Escritório Contábil Exemplo"/></label><label>Tipo de organização<select value={orgType} onChange={e => setOrgType(e.target.value as Organization['type'])}>{organizationTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label><div className="modal-actions"><button type="button" className="btn btn-light" onClick={closeModal} disabled={saving}>Cancelar</button><button type="submit" className="btn" disabled={saving}>{saving ? 'Salvando…' : 'Salvar organização'}</button></div></form> : <form onSubmit={submitCompany} className="form-stack"><label>Razão social / nome da empresa<input autoFocus required minLength={2} maxLength={160} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ex.: Empresa Exemplo Ltda."/></label><label>CNPJ<input required inputMode="numeric" maxLength={18} value={taxId} onChange={e => setTaxId(e.target.value.replace(/\D/g, '').slice(0,14))} placeholder="Somente números"/><small>{taxId.replace(/\D/g, '').length}/14 dígitos</small></label><label>Regime tributário<select value={taxRegime} onChange={e => setTaxRegime(e.target.value)}>{taxRegimes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label><div className="form-row"><label>Cidade<input maxLength={120} value={city} onChange={e => setCity(e.target.value)} placeholder="Ex.: São Paulo"/></label><label>UF<input maxLength={2} value={state} onChange={e => setState(e.target.value.replace(/[^a-z]/gi, '').slice(0,2))} placeholder="SP"/></label></div><div className="modal-actions"><button type="button" className="btn btn-light" onClick={closeModal} disabled={saving}>Cancelar</button><button type="submit" className="btn" disabled={saving || !organizationId}>{saving ? 'Salvando…' : 'Salvar empresa'}</button></div></form>}
    </section></div>}
  </div>;
}