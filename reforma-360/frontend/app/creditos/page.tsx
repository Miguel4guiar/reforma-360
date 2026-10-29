'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Wallet, Receipt, Search, FileCheck, AlertCircle, TrendingUp } from 'lucide-react';

type Organization = { id: string; name: string };
type FiscalDocument = { id: string; fileName: string; documentNumber: string | null; documentType: string; status: string; totalAmount: string | number | null; createdAt: string; items: any[] };

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const money = (n: number) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('reforma360_access_token') : null;
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'Erro de comunicação.');
  return body as T;
}

export default function CreditosTributariosPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
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
        const docs = await request<FiscalDocument[]>(`/fiscal-documents?organizationId=${encodeURIComponent(active)}`);
        
        // FILTRAGEM RIGOROSA: Mantém apenas documentos que sejam estritamente de ENTRADA (Compras)
        const purchaseDocs = docs.filter(d => {
          if (d.documentType === 'TEXT' || d.status === 'FAILED') return false;
          const firstItem = d.items?.[0] as any;
          // Se o item tiver a propriedade operationType, valida se é ENTRADA. Caso contrário, por segurança assume que não é de saída óbvia.
          return !firstItem?.operationType || firstItem.operationType === 'ENTRADA';
        });

        setDocuments(purchaseDocs);
      }
    } catch (e) { 
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados.'); 
    } finally { 
      setLoading(false); 
    }
  }, [organizationId]);

  useEffect(() => { 
    if (!window.localStorage.getItem('reforma360_access_token')) { window.location.href = '/'; return; } 
    void load(); 
  }, [load]);

  // Cálculos de Totais da Carteira restritos apenas a Compras Reais
  const { totalVolume, estimatedCredits, totalItems } = useMemo(() => {
    const volume = documents.reduce((acc, doc) => acc + Number(doc.totalAmount || 0), 0);
    const itemsCount = documents.reduce((acc, doc) => acc + (doc.items?.length || 0), 0);
    const credits = volume * 0.265; 
    return { totalVolume: volume, estimatedCredits: credits, totalItems: itemsCount };
  }, [documents]);

  const filteredDocs = useMemo(() => {
    if (!searchTerm) return documents;
    const lower = searchTerm.toLowerCase();
    return documents.filter(d => 
      (d.documentNumber && d.documentNumber.toLowerCase().includes(lower)) || 
      (d.fileName && d.fileName.toLowerCase().includes(lower))
    );
  }, [documents, searchTerm]);

  return (
    <main className="dashboard-shell sim-page" style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
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
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Gestão de Entradas</span>
            <h1 style={{ margin: '5px 0', fontSize: '28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Wallet size={28} color="#1446b3" />
              Carteira de Créditos Tributários
            </h1>
            <p style={{ color: '#4b5563', margin: 0 }}>Controle os XMLs dos seus fornecedores e monitorize o saldo de créditos gerados (CBS e IBS).</p>
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
        
        {/* DASHBOARD CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', color: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', position: 'relative', overflow: 'hidden' }}>
            <Wallet size={100} color="rgba(255,255,255,0.05)" style={{ position: 'absolute', right: '-20px', bottom: '-20px' }} />
            <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#94a3b8', fontWeight: 500 }}>Saldo Potencial de Créditos</h3>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#4ade80' }}>{money(estimatedCredits)}</div>
            <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <TrendingUp size={14}/> Disponível para abater nos impostos
            </p>
          </div>

          <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>Base de Compras (Volume Total)</h3>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>{money(totalVolume)}</div>
            <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>Soma de todas as notas fiscais de entrada processadas.</p>
          </div>

          <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>Auditoria de Itens</h3>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>{totalItems} <span style={{ fontSize: '16px', fontWeight: 'normal', color: '#6b7280' }}>produtos analisados</span></div>
            <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>Em {documents.length} XMLs de fornecedores.</p>
          </div>
        </div>

        {/* LISTA DE NOTAS */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={20} color="#4b5563" /> Extrato de Faturas (Entradas de Fornecedores)
            </h2>
            
            <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
              <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '10px' }} />
              <input 
                type="text" 
                placeholder="Pesquisar fatura ou chave..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '9px 12px 9px 35px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '15px 20px', color: '#4b5563', fontWeight: 600 }}>Documento</th>
                  <th style={{ padding: '15px 20px', color: '#4b5563', fontWeight: 600 }}>Data de Importação</th>
                  <th style={{ padding: '15px 20px', color: '#4b5563', fontWeight: 600 }}>Itens</th>
                  <th style={{ padding: '15px 20px', color: '#4b5563', fontWeight: 600, textAlign: 'right' }}>Valor Total da Base</th>
                  <th style={{ padding: '15px 20px', color: '#4b5563', fontWeight: 600, textAlign: 'right' }}>Crédito Estimado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>A carregar documentos de entrada...</td></tr>
                ) : filteredDocs.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>Nenhuma nota de entrada (fornecedor) encontrada.</td></tr>
                ) : (
                  filteredDocs.map((doc) => {
                    const docValue = Number(doc.totalAmount || 0);
                    const estimatedDocCredit = docValue * 0.265;
                    return (
                      <tr key={doc.id} style={{ borderBottom: '1px solid #f3f4f6', transition: 'background 0.2s' }}>
                        <td style={{ padding: '15px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ background: '#f0fdf4', padding: '8px', borderRadius: '8px', color: '#166534' }}><FileCheck size={16} /></div>
                            <div>
                              <div style={{ fontWeight: 500, color: '#111827' }}>NF-e {doc.documentNumber || 'S/N'}</div>
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>{doc.fileName}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '15px 20px', color: '#4b5563' }}>{formatDate(doc.createdAt)}</td>
                        <td style={{ padding: '15px 20px', color: '#4b5563' }}>{doc.items?.length || 0} produtos</td>
                        <td style={{ padding: '15px 20px', textAlign: 'right', fontWeight: 500, color: '#111827' }}>{money(docValue)}</td>
                        <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                          <strong style={{ color: '#16a34a' }}>{money(estimatedDocCredit)}</strong>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}