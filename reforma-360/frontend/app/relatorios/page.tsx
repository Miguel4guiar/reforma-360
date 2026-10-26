'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Download, Calendar, Briefcase, TrendingDown, TrendingUp, AlertCircle, Search, Building2 } from 'lucide-react';

type Organization = { id: string; name: string };
type Results = { currentTax: number; netReformTax: number; difference: number; differencePercent: number | null; methodology: string };
type Simulation = { id: string; name: string; inputs: any; results: Results; createdAt: string };

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const money = (n: number) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const printDate = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('reforma360_access_token') : null;
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'Erro de comunicação.');
  return body as T;
}

export default function RelatoriosPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const load = useCallback(async (preferred?: string) => {
    setLoading(true); setError('');
    try {
      const orgs = await request<Organization[]>('/organizations');
      setOrganizations(orgs);
      const active = orgs.find(o => o.id === (preferred || organizationId))?.id || orgs[0]?.id || '';
      setOrganizationId(active);
      if (active) {
        const sims = await request<Simulation[]>(`/tax-simulations?organizationId=${encodeURIComponent(active)}`);
        // Ordenar do mais recente para o mais antigo
        setSimulations(sims.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
    } catch (e) { 
      setError(e instanceof Error ? e.message : 'Erro ao carregar relatórios.'); 
    } finally { 
      setLoading(false); 
    }
  }, [organizationId]);

  useEffect(() => { 
    if (!window.localStorage.getItem('reforma360_access_token')) { window.location.href = '/'; return; } 
    void load(); 
  }, [load]);

  const filteredSimulations = simulations.filter(sim => 
    sim.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    sim.inputs.simulationYear?.toString().includes(searchTerm)
  );

  const activeOrg = organizations.find(o => o.id === organizationId);

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="dashboard-shell sim-page" style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <header className="topbar no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Link href="/" className="brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: '#111827', fontWeight: 'bold' }}>
          <span className="brand-mark" style={{ background: '#1446b3', color: '#fff', padding: '5px 10px', borderRadius: '6px' }}>R</span>
          <span>Reforma <b>360</b></span>
        </Link>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handlePrint} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', border: 'none', borderRadius: '6px', background: '#1446b3', color: '#fff', cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 4px rgba(20, 70, 179, 0.2)' }}>
            <Download size={16}/> Exportar Relatório (PDF)
          </button>
          <Link href="/" className="btn btn-light" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', border: '1px solid #dce3ed', borderRadius: '6px', textDecoration: 'none', color: '#374151' }}>
            <ArrowLeft size={16}/> Voltar
          </Link>
        </div>
      </header>
      
      <section className="page-content">
        
        {/* CABEÇALHO EXCLUSIVO PARA IMPRESSÃO (PDF) */}
        <div className="print-only-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #1446b3', paddingBottom: '20px', marginBottom: '30px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
                <div style={{ background: '#1446b3', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '20px' }}>R</div>
                Reforma 360
              </div>
              <p style={{ margin: '5px 0 0 0', color: '#4b5563', fontSize: '14px' }}>Relatório de Impacto e Cenários Tributários (EC 132/23)</p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '14px' }}>
              <div style={{ fontWeight: 'bold', color: '#111827', fontSize: '18px' }}>{activeOrg?.name || 'Cliente'}</div>
              <div style={{ color: '#6b7280', marginTop: '4px' }}>Gerado em: {printDate}</div>
            </div>
          </div>
        </div>

        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Histórico de Cenários</span>
            <h1 style={{ margin: '5px 0', fontSize: '28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText size={28} color="#1446b3" />
              Relatórios de Simulação
            </h1>
            <p style={{ color: '#4b5563', margin: 0 }}>Consulte e exporte as simulações tributárias guardadas para apresentação.</p>
          </div>
          
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px', fontWeight: 500, minWidth: '250px' }}>
            Organização ativa
            <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0 10px' }}>
              <Building2 size={16} color="#6b7280" />
              <select value={organizationId} onChange={e => { setOrganizationId(e.target.value); void load(e.target.value); }} style={{ width: '100%', padding: '10px 5px', border: 'none', background: 'transparent', outline: 'none' }}>
                <option value="">Selecione...</option>
                {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </label>
        </div>
        
        {error && <div className="no-print" style={{ background: '#fef2f2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #f87171', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={18}/>{error}</div>}
        
        <div className="report-container" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div className="no-print" style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#111827' }}>
              Cenários Guardados
            </h2>
            
            <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
              <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '10px' }} />
              <input 
                type="text" 
                placeholder="Pesquisar por nome ou ano..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '9px 12px 9px 35px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
              />
            </div>
          </div>

          <div className="sim-grid" style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '25px' }}>
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#6b7280', gridColumn: '1 / -1' }}>A carregar relatórios...</div>
            ) : filteredSimulations.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#6b7280', gridColumn: '1 / -1' }}>Nenhuma simulação encontrada. Crie uma no Simulador CBS/IBS.</div>
            ) : (
              filteredSimulations.map((sim) => (
                <div key={sim.id} className="sim-card" style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ background: '#f8faff', padding: '15px 20px', borderBottom: '1px solid #e5e7eb' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', color: '#111827', fontWeight: 600 }}>
                      {sim.name}
                    </h3>
                    <div style={{ display: 'flex', gap: '15px', fontSize: '12px', color: '#6b7280' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={13}/> {formatDate(sim.createdAt)}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Briefcase size={13}/> {sim.inputs.taxRegime === 'SIMPLES_NACIONAL' ? 'Simples Nacional' : 'Lucro Real/Pres.'} (Ano {sim.inputs.simulationYear})</span>
                    </div>
                  </div>
                  
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: '#4b5563' }}>Imposto Antigo Estimado:</span>
                      <strong style={{ color: '#111827' }}>{money(sim.results.currentTax)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: '#4b5563' }}>Novo Imposto (CBS/IBS):</span>
                      <strong style={{ color: '#111827' }}>{money(sim.results.netReformTax)}</strong>
                    </div>
                    
                    <div style={{ background: '#f3f4f6', height: '1px', margin: '5px 0' }} />
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', color: '#4b5563', fontWeight: 600 }}>Impacto Final Estimado:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', background: sim.results.difference > 0 ? '#fef2f2' : '#f0fdf4', color: sim.results.difference > 0 ? '#b91c1c' : '#15803d', fontWeight: 'bold', fontSize: '16px', border: `1px solid ${sim.results.difference > 0 ? '#fca5a5' : '#86efac'}` }}>
                        {sim.results.difference > 0 ? <TrendingUp size={18}/> : <TrendingDown size={18}/>}
                        {sim.results.difference > 0 ? '+' : '-'}{money(Math.abs(sim.results.difference))}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ padding: '12px 20px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', fontSize: '12px', color: '#6b7280', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Setor: {sim.inputs.activitySector || 'Geral'}</span>
                    <strong>{sim.inputs.purchaseDocumentIds?.length > 0 ? 'Cruzamento por XML' : 'Simulação Manual'}</strong>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
      
      {/* MAGIA DO PDF: CSS EXCLUSIVO PARA IMPRESSÃO */}
      <style dangerouslySetInnerHTML={{__html: `
        .print-only-header { display: none; }
        
        @media print {
          @page { size: A4 portrait; margin: 15mm 15mm 20mm 15mm; }
          
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: #fff !important; }
          
          /* Esconder elementos desnecessários da UI */
          .no-print, .topbar, .sidebar, select, input, button { display: none !important; }
          
          /* Mostrar o cabeçalho oficial do PDF */
          .print-only-header { display: block !important; }
          
          /* Ajustar o contentor principal para ocupar o espaço todo */
          .dashboard-shell, .page-content { padding: 0 !important; max-width: 100% !important; margin: 0 !important; }
          .report-container { border: none !important; border-radius: 0 !important; }
          
          /* Transformar a grelha em lista para melhor leitura no PDF e não cortar ao meio */
          .sim-grid { display: block !important; padding: 0 !important; }
          
          /* Proteger os cards para não quebrarem entre páginas */
          .sim-card { 
            page-break-inside: avoid !important; 
            break-inside: avoid !important; 
            margin-bottom: 25px !important;
            border: 1px solid #cbd5e1 !important; 
            background: #fff !important;
          }
          
          /* Títulos com cor preta para contraste de impressora */
          h3, strong { color: #000 !important; }
        }
      `}} />
    </main>
  );
}