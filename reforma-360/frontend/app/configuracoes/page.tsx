'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Settings, User, Building, CreditCard, CheckCircle2, AlertCircle, Plus, LogOut, Trash2, AlertTriangle } from 'lucide-react';

type Organization = { id: string; name: string };
type UserProfile = { id: string; email: string; name: string };
type FiscalDocument = { id: string; fileName: string; documentNumber: string | null; totalAmount: string | number | null };

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const money = (n: number) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('reforma360_access_token') : null;
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'Erro de comunicação.');
  return body as T;
}

export default function ConfiguracoesPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  
  const [newOrgName, setNewOrgName] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);
  
  const [docToDelete, setDocToDelete] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async (preferred?: string) => {
    setLoading(true); setError(''); setNotice('');
    try {
      const orgs = await request<Organization[]>('/organizations');
      setOrganizations(orgs);
      
      const active = orgs.find(o => o.id === (preferred || activeOrgId))?.id || orgs[0]?.id || '';
      setActiveOrgId(active);
      
      if (active) {
        const docs = await request<FiscalDocument[]>(`/fiscal-documents?organizationId=${encodeURIComponent(active)}`);
        setDocuments(docs);
      }
      
      try {
        const profile = await request<UserProfile>('/auth/me'); 
        setUserProfile(profile);
      } catch (e) {
        setUserProfile({ id: '1', name: 'Administrador', email: 'admin@reforma360.com' });
      }
    } catch (e) { 
      setError(e instanceof Error ? e.message : 'Erro ao carregar configurações.'); 
    } finally { 
      setLoading(false); 
    }
  }, [activeOrgId]);

  useEffect(() => { 
    if (!window.localStorage.getItem('reforma360_access_token')) { window.location.href = '/'; return; } 
    void load(); 
  }, [load]);

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setCreatingOrg(true); setError(''); setNotice('');
    
    try {
      await request('/organizations', { method: 'POST', body: JSON.stringify({ name: newOrgName }) });
      setNotice('Organização criada com sucesso!');
      setNewOrgName('');
      await load(activeOrgId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar organização.');
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!docToDelete) return;
    if (!confirm('Tem a certeza que deseja apagar esta Nota Fiscal? Esta ação não pode ser desfeita e pode afetar simulações existentes.')) return;
    
    setIsDeleting(true); setError(''); setNotice('');
    try {
      await request(`/fiscal-documents/${docToDelete}`, { method: 'DELETE' });
      setNotice('Nota Fiscal apagada com sucesso.');
      setDocToDelete('');
      await load(activeOrgId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao apagar o documento.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (!activeOrgId) return;
    const confirmText = prompt(`Escreva "LIMPAR" para confirmar a exclusão de todas as notas fiscais e simulações da organização selecionada.`);
    if (confirmText !== 'LIMPAR') {
      alert('Ação cancelada. O texto digitado não confere.');
      return;
    }
    
    setIsDeleting(true); setError(''); setNotice('');
    try {
      await request(`/organizations/${activeOrgId}/data`, { method: 'DELETE' });
      setNotice('Todos os dados da organização foram limpos com sucesso. Pode recomeçar.');
      await load(activeOrgId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao limpar dados.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem('reforma360_access_token');
    window.location.href = '/';
  };

  return (
    <main className="dashboard-shell sim-page" style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <header className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Link href="/" className="brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: '#111827', fontWeight: 'bold' }}>
          <span className="brand-mark" style={{ background: '#1446b3', color: '#fff', padding: '5px 10px', borderRadius: '6px' }}>R</span>
          <span>Reforma <b>360</b></span>
        </Link>
        <Link href="/" className="btn btn-light" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', border: '1px solid #dce3ed', borderRadius: '6px', textDecoration: 'none', color: '#374151' }}>
          <ArrowLeft size={16}/> Voltar ao painel
        </Link>
      </header>
      
      <section className="page-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Sistema</span>
            <h1 style={{ margin: '5px 0', fontSize: '28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Settings size={28} color="#1446b3" />
              Configurações
            </h1>
            <p style={{ color: '#4b5563', margin: 0 }}>Gira o seu perfil, acesso a empresas, subscrição e gestão de dados.</p>
          </div>
          
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 15px', background: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
            <LogOut size={16}/> Terminar Sessão
          </button>
        </div>
        
        {error && <div style={{ background: '#fef2f2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #f87171', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={18}/>{error}</div>}
        {notice && <div style={{ background: '#f0fdf4', color: '#166534', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #4ade80', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={18}/>{notice}</div>}
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px' }}>
          
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', alignSelf: 'start' }}>
            <div style={{ padding: '15px 20px', background: '#f8faff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <User size={18} color="#1e3a8a"/>
              <h2 style={{ margin: 0, fontSize: '16px', color: '#1e3a8a' }}>O Meu Perfil</h2>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Nome Completo</label>
                <input type="text" value={userProfile?.name || ''} readOnly style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#f9fafb', color: '#4b5563' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>Email</label>
                <input type="text" value={userProfile?.email || ''} readOnly style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#f9fafb', color: '#4b5563' }} />
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', alignSelf: 'start' }}>
            <div style={{ padding: '15px 20px', background: '#fefce8', borderBottom: '1px solid #fef08a', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CreditCard size={18} color="#854d0e"/>
              <h2 style={{ margin: 0, fontSize: '16px', color: '#854d0e' }}>Plano e Faturação</h2>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', color: '#111827' }}>Plano Profissional</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Acesso ilimitado ao motor tributário.</p>
                </div>
                <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>Ativo</span>
              </div>
              <hr style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '5px 0' }} />
              <button disabled style={{ width: '100%', padding: '10px', background: '#f3f4f6', color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: '6px', fontWeight: 600, cursor: 'not-allowed' }}>
                Gerir Subscrição (Em Breve)
              </button>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', gridColumn: '1 / -1' }}>
            <div style={{ padding: '15px 20px', background: '#f8faff', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building size={18} color="#1e3a8a"/>
                <h2 style={{ margin: 0, fontSize: '16px', color: '#1e3a8a' }}>Organizações / Clientes</h2>
              </div>
              <select value={activeOrgId} onChange={e => { setActiveOrgId(e.target.value); void load(e.target.value); }} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '13px', background: '#fff' }}>
                {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            
            <div style={{ padding: '20px' }}>
              <form onSubmit={handleCreateOrganization} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '15px', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
                <div style={{ flex: 1 }}>
                  <input type="text" placeholder="Nome da nova empresa ou cliente..." value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} required />
                </div>
                <button type="submit" disabled={creatingOrg || !newOrgName.trim()} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 15px', background: '#111827', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: (creatingOrg || !newOrgName.trim()) ? 'not-allowed' : 'pointer', opacity: (creatingOrg || !newOrgName.trim()) ? 0.7 : 1 }}>
                  <Plus size={16}/> Adicionar
                </button>
              </form>
            </div>
          </div>

          {/* === A ZONA DE PERIGO ESTÁ AQUI === */}
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #fecaca', overflow: 'hidden', gridColumn: '1 / -1', marginBottom: '30px' }}>
            <div style={{ padding: '15px 20px', background: '#fef2f2', borderBottom: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={18} color="#b91c1c"/>
              <h2 style={{ margin: 0, fontSize: '16px', color: '#b91c1c' }}>Zona de Perigo (Gestão de Dados)</h2>
            </div>
            
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '5px' }}>Apagar Nota Fiscal específica</label>
                  <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#6b7280' }}>Selecione um XML importado para removê-lo da base de dados.</p>
                  <select value={docToDelete} onChange={e => setDocToDelete(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#f9fafb' }}>
                    <option value="">Selecione um documento...</option>
                    {documents.map(d => (
                      <option key={d.id} value={d.id}>NF-e {d.documentNumber || d.fileName} ({money(Number(d.totalAmount))})</option>
                    ))}
                  </select>
                </div>
                <button onClick={handleDeleteDocument} disabled={isDeleting || !docToDelete} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 15px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '6px', fontWeight: 600, cursor: (isDeleting || !docToDelete) ? 'not-allowed' : 'pointer', opacity: (isDeleting || !docToDelete) ? 0.5 : 1 }}>
                  <Trash2 size={16}/> Apagar Documento
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <strong style={{ display: 'block', fontSize: '14px', color: '#111827' }}>Começar do Zero (Apagar tudo)</strong>
                  <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#6b7280' }}>Elimina permanentemente <strong>todos os XMLs e simulações</strong> da organização ativa. As empresas e regras mantêm-se.</p>
                </div>
                <button onClick={handleDeleteAllData} disabled={isDeleting} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: isDeleting ? 'not-allowed' : 'pointer', opacity: isDeleting ? 0.7 : 1 }}>
                  <AlertTriangle size={16}/> Limpar Todos os Dados
                </button>
              </div>

            </div>
          </div>

        </div>
      </section>
    </main>
  );
}