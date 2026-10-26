'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Activity, FileText, Calculator, Clock, AlertCircle } from 'lucide-react';

type Organization = { id: string; name: string };
type FiscalDocument = { id: string; fileName: string; documentType: string; createdAt: string };
type Simulation = { id: string; name: string; createdAt: string };

type ActivityItem = {
  id: string;
  type: 'DOCUMENT' | 'SIMULATION';
  title: string;
  description: string;
  date: Date;
};

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const formatDate = (date: Date) => date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('reforma360_access_token') : null;
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'Erro de comunicação.');
  return body as T;
}

export default function HistoricoPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (preferred?: string) => {
    setLoading(true); setError('');
    try {
      const orgs = await request<Organization[]>('/organizations');
      setOrganizations(orgs);
      const active = orgs.find(o => o.id === (preferred || organizationId))?.id || orgs[0]?.id || '';
      setOrganizationId(active);
      
      if (active) {
        // Busca simultaneamente documentos e simulações para unificar no histórico
        const [docs, sims] = await Promise.all([
          request<FiscalDocument[]>(`/fiscal-documents?organizationId=${encodeURIComponent(active)}`),
          request<Simulation[]>(`/tax-simulations?organizationId=${encodeURIComponent(active)}`)
        ]);

        const timeline: ActivityItem[] = [
          ...docs.map(d => ({
            id: d.id,
            type: 'DOCUMENT' as const,
            title: 'Documento Importado',
            description: `Arquivo: ${d.fileName}`,
            date: new Date(d.createdAt)
          })),
          ...sims.map(s => ({
            id: s.id,
            type: 'SIMULATION' as const,
            title: 'Cenário Simulado',
            description: `Simulação gerada: ${s.name}`,
            date: new Date(s.createdAt)
          }))
        ];

        // Ordena do mais recente para o mais antigo
        timeline.sort((a, b) => b.date.getTime() - a.date.getTime());
        setActivities(timeline);
      }
    } catch (e) { 
      setError(e instanceof Error ? e.message : 'Erro ao carregar histórico.'); 
    } finally { 
      setLoading(false); 
    }
  }, [organizationId]);

  useEffect(() => { 
    if (!window.localStorage.getItem('reforma360_access_token')) { window.location.href = '/'; return; } 
    void load(); 
  }, [load]);

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
              <Activity size={28} color="#1446b3" />
              Histórico de Atividades
            </h1>
            <p style={{ color: '#4b5563', margin: 0 }}>Registo cronológico de ações e processamentos da organização.</p>
          </div>
          
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px', fontWeight: 500, minWidth: '250px' }}>
            Organização ativa
            <select value={organizationId} onChange={e => { setOrganizationId(e.target.value); void load(e.target.value); }} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff' }}>
              <option value="">Selecione...</option>
              {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        </div>
        
        {error && <div style={{ background: '#fef2f2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #f87171', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={18}/>{error}</div>}
        
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '25px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>A carregar atividades...</div>
          ) : activities.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>Sem atividades registadas até ao momento.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {activities.map((act, index) => (
                <div key={`${act.id}-${index}`} style={{ display: 'flex', gap: '15px', position: 'relative' }}>
                  {/* Linha vertical da timeline */}
                  {index !== activities.length - 1 && (
                    <div style={{ position: 'absolute', left: '19px', top: '40px', bottom: '-20px', width: '2px', background: '#e5e7eb' }}></div>
                  )}
                  
                  {/* Ícone */}
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: act.type === 'DOCUMENT' ? '#f0fdf4' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1, border: `1px solid ${act.type === 'DOCUMENT' ? '#bbf7d0' : '#bfdbfe'}` }}>
                    {act.type === 'DOCUMENT' ? <FileText size={18} color="#166534" /> : <Calculator size={18} color="#1d4ed8" />}
                  </div>
                  
                  {/* Conteúdo */}
                  <div style={{ paddingTop: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <strong style={{ color: '#111827', fontSize: '15px' }}>{act.title}</strong>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6b7280' }}><Clock size={12}/> {formatDate(act.date)}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#4b5563' }}>{act.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}