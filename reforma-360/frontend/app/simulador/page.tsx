'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calculator, CheckCircle2, Save, Receipt, LayoutList, Zap, Award, ShoppingBag, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

type Organization = { id: string; name: string };
type FiscalDocument = { id: string; fileName: string; documentNumber: string | null; documentType: string; status: string; totalAmount: string | number | null; items: any[] };
type Inputs = { revenue: string; purchases: string; currentRate: string; cbsRate: string; ibsRate: string; reduction: string; creditablePurchases: string; documentId?: string; purchaseDocumentIds: string[]; simulationYear: string; taxRegime: string; sector: string };
type ItemResult = { description: string; ncm: string; total: string; currentTax: number; cbsTax: number; ibsTax: number; grossReformTax: number; appliedRules?: { isReduced: boolean; ruleDescription?: string } };
type Results = { currentTax: number; nominalReformRate: number; effectiveReformRate: number; grossReformTax: number; eligiblePurchaseBase: number; estimatedCredits: number; netReformTax: number; difference: number; differencePercent: number | null; estimatedMarginBeforeTax: number; estimatedMarginAfterCurrentTax: number; estimatedMarginAfterReformTax: number; creditTransferredToB2B: number; methodology: string; isDocumentSimulation?: boolean; hasRealPurchases?: boolean; originalTaxBreakdown?: { icms: number, pis: number, cofins: number, total: number }, itemsCalculated?: ItemResult[] };
type Simulation = { id: string; name: string; inputs: Inputs; results: Results; createdAt: string };

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const defaults: Inputs = { revenue: '100000', purchases: '45000', currentRate: '12', cbsRate: '8.8', ibsRate: '17.7', reduction: '0', creditablePurchases: '80', simulationYear: '2033', taxRegime: 'NORMAL', sector: 'GERAL', purchaseDocumentIds: [] };
const money = (n: number) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function getTransition(year: number) {
  if (year <= 2026) return { cbsMult: 0.1, ibsMult: 0.01, currentMult: 1.0 };
  if (year === 2027 || year === 2028) return { cbsMult: 1.0, ibsMult: 0.01, currentMult: 0.7 };
  if (year === 2029) return { cbsMult: 1.0, ibsMult: 0.1, currentMult: 0.6 };
  if (year === 2030) return { cbsMult: 1.0, ibsMult: 0.2, currentMult: 0.5 };
  if (year === 2031) return { cbsMult: 1.0, ibsMult: 0.3, currentMult: 0.4 };
  if (year === 2032) return { cbsMult: 1.0, ibsMult: 0.4, currentMult: 0.3 };
  return { cbsMult: 1.0, ibsMult: 1.0, currentMult: 0.0 };
}

function getSectorReduction(sector: string): number {
  if (sector === 'PROFISSIONAL_LIBERAL') return 30;
  if (sector === 'SAUDE_EDUCACAO') return 60;
  return 0;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('reforma360_access_token') : null;
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'Não foi possível concluir a operação.');
  return body as T;
}

function estimate(v: Inputs, doc: FiscalDocument | null, purchaseDocs: FiscalDocument[]): Results {
  const revenue = doc ? Math.max(0, Number(doc.totalAmount || 0)) : Math.max(0, Number(v.revenue) || 0);
  const hasReals = purchaseDocs.length > 0;
  const purchases = hasReals ? purchaseDocs.reduce((acc, d) => acc + Number(d.totalAmount || 0), 0) : Math.max(0, Number(v.purchases) || 0);
  
  const currentRateBase = Math.max(0, Number(v.currentRate) || 0), cbs = Math.max(0, Number(v.cbsRate) || 0), ibs = Math.max(0, Number(v.ibsRate) || 0);
  const manualReduction = Math.min(100, Math.max(0, Number(v.reduction) || 0));
  const sectorReduction = getSectorReduction(v.sector);
  const finalReduction = Math.max(manualReduction, sectorReduction);
  
  const creditable = hasReals ? 100 : Math.min(100, Math.max(0, Number(v.creditablePurchases) || 0));
  const trans = getTransition(Number(v.simulationYear));
  const regime = String(v.taxRegime || 'NORMAL');
  
  const finalCbs = cbs * trans.cbsMult;
  const finalIbs = ibs * trans.ibsMult;
  const effectiveReformRate = (finalCbs + finalIbs) * (1 - finalReduction / 100);
  const grossReformTax = revenue * effectiveReformRate / 100;

  // NOVO: Lê os impostos exatos do XML para construir a prévia em tempo real
  let totalRealIcms = 0, totalRealPis = 0, totalRealCofins = 0;
  if (doc && doc.items) {
    doc.items.forEach(item => {
      totalRealIcms += Number(item.vICMS || 0);
      totalRealPis += Number(item.vPIS || 0);
      totalRealCofins += Number(item.vCOFINS || 0);
    });
  }
  const totalRealOriginalTax = totalRealIcms + totalRealPis + totalRealCofins;
  const calculatedManualTax = revenue * currentRateBase / 100;
  
  // O sistema decide: se há imposto real no XML, usa-o. Senão, recai nos 12%.
  const originalTax = totalRealOriginalTax > 0 ? totalRealOriginalTax : calculatedManualTax;
  
  let finalCurrentTax = 0, finalNetReformTax = 0, finalCredits = 0, creditTransferred = 0;

  if (regime === 'SIMPLES_DAS') {
    finalCurrentTax = calculatedManualTax;
    creditTransferred = finalCurrentTax * 0.33; 
  } else if (regime === 'SIMPLES_POR_FORA') {
    finalCurrentTax = calculatedManualTax * 0.67; 
    finalCredits = (purchases * creditable / 100) * effectiveReformRate / 100;
    finalNetReformTax = Math.max(0, grossReformTax - finalCredits);
    creditTransferred = grossReformTax; 
  } else {
    finalCurrentTax = originalTax * trans.currentMult;
    finalCredits = (purchases * creditable / 100) * effectiveReformRate / 100;
    finalNetReformTax = Math.max(0, grossReformTax - finalCredits);
    creditTransferred = grossReformTax;
  }
  
  const difference = (finalCurrentTax + finalNetReformTax) - originalTax;
  
  const itemsCalculated = doc?.items?.map(item => {
    const itemTotal = Number(item.total || 0);
    const itemRealTax = Number(item.vICMS || 0) + Number(item.vPIS || 0) + Number(item.vCOFINS || 0);
    
    return {
      description: item.description || 'Produto', ncm: String(item.ncm || '0').padStart(8, '0'), total: item.total,
      currentTax: itemRealTax > 0 ? itemRealTax : itemTotal * currentRateBase / 100, 
      cbsTax: itemTotal * finalCbs / 100 * (1 - finalReduction / 100),
      ibsTax: itemTotal * finalIbs / 100 * (1 - finalReduction / 100), grossReformTax: itemTotal * effectiveReformRate / 100,
      appliedRules: { isReduced: finalReduction > 0, ruleDescription: `Redução Setor/Manual (${finalReduction}%)` }
    };
  });

  return { 
    currentTax: finalCurrentTax, nominalReformRate: finalCbs + finalIbs, effectiveReformRate, 
    grossReformTax: regime === 'SIMPLES_DAS' ? 0 : grossReformTax, eligiblePurchaseBase: purchases * creditable / 100, 
    estimatedCredits: finalCredits, netReformTax: finalNetReformTax, difference, 
    differencePercent: originalTax ? difference / originalTax * 100 : null, 
    estimatedMarginBeforeTax: revenue - purchases, estimatedMarginAfterCurrentTax: revenue - purchases - originalTax, 
    estimatedMarginAfterReformTax: revenue - purchases - (finalCurrentTax + finalNetReformTax), 
    creditTransferredToB2B: creditTransferred, methodology: doc ? 'Prévia local.' : 'Estimativa manual', 
    isDocumentSimulation: !!doc, hasRealPurchases: hasReals, itemsCalculated,
    originalTaxBreakdown: totalRealOriginalTax > 0 ? { icms: totalRealIcms, pis: totalRealPis, cofins: totalRealCofins, total: totalRealOriginalTax } : undefined
  };
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#fff', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#111827' }}>Ano da Lei: {label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '15px', fontSize: '13px', marginBottom: '4px' }}>
            <span style={{ color: entry.color, fontWeight: 500 }}>{entry.name}:</span>
            <span style={{ fontWeight: 'bold', color: '#374151' }}>{money(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function SimulatorPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [mode, setMode] = useState<'MANUAL' | 'DOCUMENT'>('MANUAL');
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const [documentId, setDocumentId] = useState('');
  const [name, setName] = useState('Cenário base');
  const [inputs, setInputs] = useState<Inputs>(defaults);
  const [history, setHistory] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  
  // FILTRAGEM INTELIGENTE DE VENDAS E COMPRAS (Evita misturar as notas)
  const salesDocs = useMemo(() => documents.filter(d => !d.items?.[0]?.operationType || d.items[0].operationType === 'SAIDA'), [documents]);
  const purchaseDocs = useMemo(() => documents.filter(d => !d.items?.[0]?.operationType || d.items[0].operationType === 'ENTRADA'), [documents]);

  const selectedDoc = useMemo(() => mode === 'DOCUMENT' ? documents.find(d => d.id === documentId) || null : null, [mode, documentId, documents]);
  const selectedPurchaseDocs = useMemo(() => documents.filter(d => inputs.purchaseDocumentIds.includes(d.id)), [documents, inputs.purchaseDocumentIds]);
  
  // Usamos os resultados gravados no backend, ou estimamos em tempo real
  const activeSimulation = history.find(h => mode === 'DOCUMENT' ? h.inputs.documentId === documentId && h.inputs.simulationYear === inputs.simulationYear : false);
  const results = useMemo(() => activeSimulation ? activeSimulation.results : estimate(inputs, selectedDoc, selectedPurchaseDocs), [inputs, selectedDoc, selectedPurchaseDocs, activeSimulation]);

  const chartData = useMemo(() => {
    const years = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];
    return years.map(y => {
      const yearInputs = { ...inputs, simulationYear: String(y) };
      const res = estimate(yearInputs, selectedDoc, selectedPurchaseDocs);
      return {
        year: String(y),
        "Imposto Antigo": res.currentTax,
        "CBS/IBS a Pagar": res.netReformTax,
        "Carga Tributária Total": res.currentTax + res.netReformTax
      };
    });
  }, [inputs, selectedDoc, selectedPurchaseDocs]);

  const load = useCallback(async (preferred?: string) => {
    setLoading(true); setError('');
    try {
      const orgs = await request<Organization[]>('/organizations');
      setOrganizations(orgs);
      const active = orgs.find(o => o.id === (preferred || organizationId))?.id || orgs[0]?.id || '';
      setOrganizationId(active);
      if (active) {
        const [hist, docs] = await Promise.all([request<Simulation[]>(`/tax-simulations?organizationId=${encodeURIComponent(active)}`), request<FiscalDocument[]>(`/fiscal-documents?organizationId=${encodeURIComponent(active)}`)]);
        setHistory(hist); setDocuments(docs.filter(d => d.documentType !== 'TEXT' && d.status !== 'FAILED'));
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar.'); } finally { setLoading(false); }
  }, [organizationId]);

  useEffect(() => { if (!window.localStorage.getItem('reforma360_access_token')) { window.location.href = '/'; return; } void load(); }, [load]);
  
  const update = (key: keyof Inputs, value: any) => setInputs(prev => ({ ...prev, [key]: value }));
  
  const togglePurchaseDoc = (id: string, checked: boolean) => {
    update('purchaseDocumentIds', checked ? [...inputs.purchaseDocumentIds, id] : inputs.purchaseDocumentIds.filter(pid => pid !== id));
  };
  
  async function save(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    if (!organizationId) { setError('Selecione uma organização.'); return; }
    if (mode === 'DOCUMENT' && !documentId) { setError('Selecione uma NF-e de Venda.'); return; }
    
    setSaving(true);
    try {
      const payload = { organizationId, name, inputs: Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, (k==='taxRegime' || k==='sector' || k==='purchaseDocumentIds') ? v : Number(v)])) };
      if (mode === 'DOCUMENT') await request<Simulation>('/tax-simulations/document', { method: 'POST', body: JSON.stringify({ ...payload, documentId }) });
      else await request<Simulation>('/tax-simulations', { method: 'POST', body: JSON.stringify(payload) });
      setNotice('Simulação processada no Motor Tributário.'); await load(organizationId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar.'); } finally { setSaving(false); }
  }

  const displayItems = results.itemsCalculated;
  const hasRealPurchases = inputs.purchaseDocumentIds.length > 0;

  return <main className="dashboard-shell sim-page" style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
    <header className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <Link href="/" className="brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: '#111827', fontWeight: 'bold' }}>
        <span className="brand-mark" style={{ background: '#1446b3', color: '#fff', padding: '5px 10px', borderRadius: '6px' }}>R</span>
        <span>Reforma <b>360</b></span>
      </Link>
      <Link href="/" className="btn btn-light" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', border: '1px solid #dce3ed', borderRadius: '6px', textDecoration: 'none', color: '#374151' }}><ArrowLeft size={16}/> Voltar ao painel</Link>
    </header>
    
    <section className="page-content sim-content">
      <div className="sim-heading" style={{ marginBottom: '25px' }}>
        <div><span className="eyebrow" style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', letterSpacing: '0.5px' }}>ETAPA 4 · PLANEJAMENTO TRIBUTÁRIO</span>
        <h1 style={{ margin: '5px 0', fontSize: '28px' }}>Simulador CBS / IBS</h1>
        <p style={{ color: '#4b5563', margin: 0 }}>Planeie os cenários comparando regimes tributários, setores e cruzando notas fiscais.</p></div>
      </div>
      
      {error && <div className="sim-alert error" style={{ background: '#fef2f2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #f87171' }}>{error}</div>}
      {notice && <div className="sim-alert success" style={{ background: '#f0fdf4', color: '#166534', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #4ade80', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={17}/>{notice}</div>}
      
      <div className="sim-mode-toggle" style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setMode('MANUAL')} className={`btn ${mode === 'MANUAL' ? 'btn-primary' : 'btn-light'}`} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid', flex: '1 1 auto', background: mode === 'MANUAL' ? '#1446b3' : '#fff', color: mode === 'MANUAL' ? '#fff' : '#374151' }}><Calculator size={17} style={{display:'inline', verticalAlign:'text-bottom', marginRight:8}}/> Simulação Manual</button>
        <button type="button" onClick={() => setMode('DOCUMENT')} className={`btn ${mode === 'DOCUMENT' ? 'btn-primary' : 'btn-light'}`} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid', flex: '1 1 auto', background: mode === 'DOCUMENT' ? '#1446b3' : '#fff', color: mode === 'DOCUMENT' ? '#fff' : '#374151' }}><Receipt size={17} style={{display:'inline', verticalAlign:'text-bottom', marginRight:8}}/> Inteligência por XML</button>
      </div>

      <div className="sim-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '25px', alignItems: 'start' }}>
        
        <form className="sim-card sim-form" onSubmit={save} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column' }}>
          <div className="sim-card-head" style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div className="sim-icon" style={{ background: '#f3f4f6', padding: '10px', borderRadius: '8px' }}><Calculator size={20} color="#4b5563"/></div>
            <div><h2 style={{ margin: 0, fontSize: '18px' }}>Premissas do cenário</h2><p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Defina as regras para o cálculo.</p></div>
          </div>
          
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <label className="sim-label" style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '14px', fontWeight: 500 }}>Organização
              <select value={organizationId} onChange={e => { setOrganizationId(e.target.value); void load(e.target.value); }} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                <option value="">Selecione...</option>{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            
            <label className="sim-label" style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '14px', fontWeight: 500 }}>Nome do cenário
              <input value={name} onChange={e => setName(e.target.value)} maxLength={120} required style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}/>
            </label>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px' }}>
              <label className="sim-label" style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '14px', fontWeight: 500 }}>Ano (Transição)
                <select value={inputs.simulationYear} onChange={e => update('simulationYear', e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                  <option value="2026">2026 (Ano Teste)</option><option value="2027">2027 - 2028</option><option value="2029">2029</option><option value="2030">2030</option><option value="2031">2031</option><option value="2032">2032</option><option value="2033">2033 (100% Reforma)</option>
                </select>
              </label>
              <label className="sim-label" style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '14px', fontWeight: 500 }}>Regime Tributário
                <select value={inputs.taxRegime} onChange={e => update('taxRegime', e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                  <option value="NORMAL">Normal (Lucro Real/Presumido)</option><option value="SIMPLES_DAS">Simples (Manter no DAS)</option><option value="SIMPLES_POR_FORA">Simples (Cobrar por fora)</option>
                </select>
              </label>
              <label className="sim-label" style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '14px', fontWeight: 500, gridColumn: '1 / -1' }}>Setor de Atividade (Reduções EC 132)
                <select value={inputs.sector} onChange={e => update('sector', e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#f8faff', color: '#1e3a8a', fontWeight: 600 }}>
                  <option value="GERAL">Geral (Sem redução global)</option>
                  <option value="PROFISSIONAL_LIBERAL">Profissões Regulamentadas (-30% de CBS/IBS)</option>
                  <option value="SAUDE_EDUCACAO">Saúde, Educação e Transportes (-60% de CBS/IBS)</option>
                </select>
              </label>
            </div>
            
            {mode === 'DOCUMENT' && (
              <div style={{ background: '#f8faff', padding: '15px', borderRadius: '8px', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <label className="sim-label" style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '14px', fontWeight: 500 }}>
                  <span style={{color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '5px'}}><Zap size={14}/> Faturamento (XML de Saída)</span>
                  <select value={documentId} onChange={e => setDocumentId(e.target.value)} required style={{ padding: '10px', borderRadius: '6px', border: '1px solid #93c5fd' }}>
                    <option value="">Selecione uma NF-e de Venda...</option>
                    {salesDocs.map(d => <option key={d.id} value={d.id}>NF-e {d.documentNumber || d.fileName} ({money(Number(d.totalAmount))})</option>)}
                  </select>
                </label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', fontWeight: 500}}><ShoppingBag size={14}/> Compras Reais (XMLs de Entrada)</span>
                  <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', padding: '5px' }}>
                    {purchaseDocs.length === 0 && <div style={{ padding: '10px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>Nenhuma nota de Entrada identificada</div>}
                    {purchaseDocs.map(d => (
                      <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                        <input type="checkbox" checked={inputs.purchaseDocumentIds.includes(d.id)} onChange={e => togglePurchaseDoc(d.id, e.target.checked)} />
                        NF-e {d.documentNumber || d.fileName} ({money(Number(d.totalAmount))})
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '15px', paddingTop: '10px', borderTop: '1px solid #e5e7eb' }}>
              {mode === 'MANUAL' && <label className="sim-label" style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '14px', fontWeight: 500 }}>Faturamento <input type="number" min="0" step="0.01" value={inputs.revenue} onChange={e => update('revenue', e.target.value)} required style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}/></label>}
              
              <label className="sim-label" style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '14px', fontWeight: 500, opacity: hasRealPurchases ? 0.5 : 1 }}>
                Compras e custos {hasRealPurchases && <span style={{fontSize: '10px', color: '#16a34a'}}>(XML)</span>}
                <input type="number" min="0" step="0.01" value={inputs.purchases} onChange={e => update('purchases', e.target.value)} disabled={hasRealPurchases} required style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}/>
              </label>
              
              <label className="sim-label" style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '14px', fontWeight: 500 }}>
                {inputs.taxRegime.includes('SIMPLES') ? 'Alíquota DAS Atual (%)' : 'Alíquota Atual (%)'}
                <input type="number" min="0" max="100" step="0.01" value={inputs.currentRate} onChange={e => update('currentRate', e.target.value)} required style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}/>
              </label>
              
              <label className="sim-label" style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '14px', fontWeight: 500, opacity: hasRealPurchases || inputs.taxRegime === 'SIMPLES_DAS' ? 0.5 : 1 }}>
                Compras creditáveis (%)
                <input type="number" min="0" max="100" step="0.01" value={inputs.creditablePurchases} onChange={e => update('creditablePurchases', e.target.value)} disabled={hasRealPurchases || inputs.taxRegime === 'SIMPLES_DAS'} required style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}/>
              </label>
            </div>
          </div>
          
          <div style={{ padding: '20px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
             <button type="submit" disabled={saving || loading || !organizationId || (mode==='DOCUMENT' && !documentId)} style={{ width: '100%', padding: '12px', background: '#111827', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: (saving || loading || !organizationId || (mode==='DOCUMENT' && !documentId)) ? 0.7 : 1 }}><Save size={18}/>Calcular no Motor Tributário</button>
          </div>
        </form>

        <div className="sim-results" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="sim-result-hero" style={{ background: '#1e293b', color: '#fff', padding: '25px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>Impacto Final Estimado (Ano {inputs.simulationYear})</span>
            <strong style={{ fontSize: '36px', color: results.difference > 0 ? '#fca5a5' : '#86efac' }}>{money(results.difference)}</strong>
            <small style={{ color: '#cbd5e1' }}>{results.difference > 0 ? 'Aumento estimado no total de impostos' : results.difference < 0 ? 'Redução estimada no total de impostos' : 'Sem diferença no volume financeiro'}</small>
          </div>
          
          {/* SECÇÃO DO GRÁFICO (RECHARTS) */}
          <div className="sim-card" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ background: '#f4f4f5', padding: '8px', borderRadius: '8px', color: '#52525b' }}><BarChart3 size={18}/></div>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#111827' }}>Evolução da Carga Tributária</h3>
            </div>
            
            <div style={{ width: '100%', height: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '15px' }} />
                  
                  {/* Linha representando o total a pagar de impostos ao longo dos anos */}
                  <Line type="monotone" dataKey="Carga Tributária Total" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  
                  {/* Barras Empilhadas mostrando a composição do imposto */}
                  <Bar dataKey="Imposto Antigo" stackId="a" fill="#94a3b8" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="CBS/IBS a Pagar" stackId="a" fill="#1446b3" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="sim-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
            <article style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <span style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '5px' }}>{inputs.taxRegime.includes('SIMPLES') ? 'Imposto Unificado (DAS)' : 'Imposto antigo'}</span>
              <strong style={{ display: 'block', fontSize: '24px', color: '#111827' }}>{money(results.currentTax)}</strong>
              {results.originalTaxBreakdown && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e5e7eb', fontSize: '11px', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}><span>ICMS:</span> <span>{money(results.originalTaxBreakdown.icms)}</span></div>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}><span>PIS:</span> <span>{money(results.originalTaxBreakdown.pis)}</span></div>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}><span>COFINS:</span> <span>{money(results.originalTaxBreakdown.cofins)}</span></div>
                </div>
              )}
            </article>
            
            <article style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <span style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '5px' }}>CBS + IBS brutos</span>
              <strong style={{ display: 'block', fontSize: '24px', color: '#111827' }}>{money(results.grossReformTax)}</strong>
            </article>
            
            <article style={{ background: results.hasRealPurchases ? '#f0fdf4' : '#fff', padding: '20px', borderRadius: '12px', border: results.hasRealPurchases ? '1px solid #4ade80' : '1px solid #e5e7eb' }}>
              <span style={{ display: 'block', fontSize: '13px', color: results.hasRealPurchases ? '#166534' : '#6b7280', marginBottom: '5px' }}>Créditos de Entrada</span>
              <strong style={{ display: 'block', fontSize: '24px', color: results.hasRealPurchases ? '#15803d' : '#111827' }}>{money(results.estimatedCredits)}</strong>
              {results.hasRealPurchases && <small style={{ display: 'block', marginTop: '5px', fontSize: '11px', color: '#166534', fontWeight: 600 }}>CÁLCULO EXATO VIA XML</small>}
            </article>
            
            <article style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <span style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '5px' }}>CBS + IBS a pagar</span>
              <strong style={{ display: 'block', fontSize: '24px', color: '#111827' }}>{money(results.netReformTax)}</strong>
            </article>
          </div>

          <div className="sim-card" style={{ background: 'linear-gradient(to right, #fbf7ef, #fff)', border: '1px solid #eaddc0', borderRadius: '12px', padding: '20px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ background: '#f5b82e', color: '#fff', padding: '12px', borderRadius: '10px' }}><Award size={24}/></div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <h2 style={{ margin: '0 0 5px 0', fontSize: '18px', color: '#825e07' }}>Competitividade B2B (Crédito Repassado)</h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#a17204' }}>Crédito estimado que a sua empresa repassará aos seus clientes corporativos.</p>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#a17204' }}>{money(results.creditTransferredToB2B)}</div>
          </div>

          {results.isDocumentSimulation && displayItems && displayItems.length > 0 && inputs.taxRegime !== 'SIMPLES_DAS' && (
            <div className="sim-card table-container" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div className="sim-card-head" style={{ padding: '15px 20px', background: '#f8faff', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ background: '#1446b3', color: '#fff', padding: '6px', borderRadius: '6px' }}><LayoutList size={16}/></div>
                <h2 style={{ margin: 0, fontSize: '16px', color: '#1e3a8a' }}>Projeção Item a Item (Saída)</h2>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '12px 20px', color: '#6b7280', fontWeight: 600 }}>Produto / Serviço</th>
                      <th style={{ padding: '12px 20px', color: '#6b7280', fontWeight: 600 }}>NCM</th>
                      <th style={{ padding: '12px 20px', color: '#6b7280', fontWeight: 600 }}>Valor</th>
                      <th style={{ padding: '12px 20px', color: '#6b7280', fontWeight: 600 }}>CBS + IBS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayItems.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 20px' }}><strong>{item.description}</strong> {item.appliedRules?.isReduced && <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', marginLeft: '5px' }}>Redução de Lei</span>}</td>
                        <td style={{ padding: '12px 20px', color: '#4b5563' }}>{String(item.ncm).padStart(8, '0')}</td>
                        <td style={{ padding: '12px 20px', color: '#111827' }}>{money(Number(item.total))}</td>
                        <td style={{ padding: '12px 20px' }}><strong style={{ color: '#0f766e' }}>{money(item.grossReformTax)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  </main>;
}