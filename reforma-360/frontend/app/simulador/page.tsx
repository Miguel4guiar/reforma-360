'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calculator, CheckCircle2, Info, Save, TrendingDown, TrendingUp, Receipt, LayoutList, Zap, Award } from 'lucide-react';

type Organization = { id: string; name: string };
type FiscalDocument = { id: string; fileName: string; documentNumber: string | null; documentType: string; status: string; totalAmount: string | number | null; items: any[] };
type Inputs = { revenue: string; purchases: string; currentRate: string; cbsRate: string; ibsRate: string; reduction: string; creditablePurchases: string; documentId?: string; simulationYear: string; taxRegime: string };
type ItemResult = { description: string; ncm: string; total: string; currentTax: number; cbsTax: number; ibsTax: number; grossReformTax: number; appliedRules?: { isReduced: boolean } };
type Results = { currentTax: number; nominalReformRate: number; effectiveReformRate: number; grossReformTax: number; eligiblePurchaseBase: number; estimatedCredits: number; netReformTax: number; difference: number; differencePercent: number | null; estimatedMarginBeforeTax: number; estimatedMarginAfterCurrentTax: number; estimatedMarginAfterReformTax: number; creditTransferredToB2B: number; methodology: string; isDocumentSimulation?: boolean; itemsCalculated?: ItemResult[] };
type Simulation = { id: string; name: string; inputs: Inputs; results: Results; createdAt: string };

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const defaults: Inputs = { revenue: '100000', purchases: '45000', currentRate: '12', cbsRate: '8.8', ibsRate: '17.7', reduction: '0', creditablePurchases: '80', simulationYear: '2033', taxRegime: 'NORMAL' };
const money = (n: number) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n: number | null) => n === null ? '—' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

function getTransition(year: number) {
  if (year <= 2026) return { cbsMult: 0.1, ibsMult: 0.01, currentMult: 1.0 };
  if (year === 2027 || year === 2028) return { cbsMult: 1.0, ibsMult: 0.01, currentMult: 0.7 };
  if (year === 2029) return { cbsMult: 1.0, ibsMult: 0.1, currentMult: 0.6 };
  if (year === 2030) return { cbsMult: 1.0, ibsMult: 0.2, currentMult: 0.5 };
  if (year === 2031) return { cbsMult: 1.0, ibsMult: 0.3, currentMult: 0.4 };
  if (year === 2032) return { cbsMult: 1.0, ibsMult: 0.4, currentMult: 0.3 };
  return { cbsMult: 1.0, ibsMult: 1.0, currentMult: 0.0 };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('reforma360_access_token') : null;
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'Não foi possível concluir a operação.');
  return body as T;
}

function estimate(v: Inputs, doc: FiscalDocument | null): Results {
  const revenue = doc ? Math.max(0, Number(doc.totalAmount || 0)) : Math.max(0, Number(v.revenue) || 0);
  const purchases = Math.max(0, Number(v.purchases) || 0);
  const currentRateBase = Math.max(0, Number(v.currentRate) || 0), cbs = Math.max(0, Number(v.cbsRate) || 0), ibs = Math.max(0, Number(v.ibsRate) || 0);
  const reduction = Math.min(100, Math.max(0, Number(v.reduction) || 0)), creditable = Math.min(100, Math.max(0, Number(v.creditablePurchases) || 0));
  
  const trans = getTransition(Number(v.simulationYear));
  const regime = String(v.taxRegime || 'NORMAL');
  
  const finalCbs = cbs * trans.cbsMult;
  const finalIbs = ibs * trans.ibsMult;
  const effectiveReformRate = (finalCbs + finalIbs) * (1 - reduction / 100);
  const grossReformTax = revenue * effectiveReformRate / 100;
  
  let finalCurrentTax = 0, finalNetReformTax = 0, finalCredits = 0, creditTransferred = 0;

  if (regime === 'SIMPLES_DAS') {
    finalCurrentTax = revenue * currentRateBase / 100;
    creditTransferred = finalCurrentTax * 0.33; // Transfere fração do DAS
  } else if (regime === 'SIMPLES_POR_FORA') {
    finalCurrentTax = revenue * (currentRateBase * 0.67) / 100; // DAS mais barato
    finalCredits = (purchases * creditable / 100) * effectiveReformRate / 100;
    finalNetReformTax = Math.max(0, grossReformTax - finalCredits);
    creditTransferred = grossReformTax; // Transfere imposto novo cheio
  } else {
    finalCurrentTax = revenue * (currentRateBase * trans.currentMult) / 100;
    finalCredits = (purchases * creditable / 100) * effectiveReformRate / 100;
    finalNetReformTax = Math.max(0, grossReformTax - finalCredits);
    creditTransferred = grossReformTax;
  }
  
  const originalTax = revenue * currentRateBase / 100;
  const difference = (finalCurrentTax + finalNetReformTax) - originalTax;
  
  const itemsCalculated = doc?.items?.map(item => {
    const itemTotal = Number(item.total || 0);
    return {
      description: item.description || 'Produto', ncm: String(item.ncm || '0').padStart(8, '0'), total: item.total,
      currentTax: itemTotal * currentRateBase / 100, cbsTax: itemTotal * finalCbs / 100 * (1 - reduction / 100),
      ibsTax: itemTotal * finalIbs / 100 * (1 - reduction / 100), grossReformTax: itemTotal * effectiveReformRate / 100
    };
  });

  return { currentTax: finalCurrentTax, nominalReformRate: finalCbs + finalIbs, effectiveReformRate, grossReformTax: regime === 'SIMPLES_DAS' ? 0 : grossReformTax, eligiblePurchaseBase: purchases * creditable / 100, estimatedCredits: finalCredits, netReformTax: finalNetReformTax, difference, differencePercent: originalTax ? difference / originalTax * 100 : null, estimatedMarginBeforeTax: revenue - purchases, estimatedMarginAfterCurrentTax: revenue - purchases - originalTax, estimatedMarginAfterReformTax: revenue - purchases - (finalCurrentTax + finalNetReformTax), creditTransferredToB2B: creditTransferred, methodology: doc ? 'Prévia local.' : 'Estimativa manual', isDocumentSimulation: !!doc, itemsCalculated };
}

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
  
  const selectedDoc = useMemo(() => mode === 'DOCUMENT' ? documents.find(d => d.id === documentId) || null : null, [mode, documentId, documents]);
  const results = useMemo(() => estimate(inputs, selectedDoc), [inputs, selectedDoc]);

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

  useEffect(() => { if (!window.localStorage.getItem('reforma360_access_token')) { window.location.href = '/'; return; } void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  const update = (key: keyof Inputs, value: string) => setInputs(prev => ({ ...prev, [key]: value }));
  
  async function save(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    if (!organizationId) { setError('Selecione uma organização.'); return; }
    if (mode === 'DOCUMENT' && !documentId) { setError('Selecione uma NF-e.'); return; }
    
    setSaving(true);
    try {
      const payload = { organizationId, name, inputs: Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, k==='taxRegime' ? v : Number(v)])) };
      if (mode === 'DOCUMENT') await request<Simulation>('/tax-simulations/document', { method: 'POST', body: JSON.stringify({ ...payload, documentId }) });
      else await request<Simulation>('/tax-simulations', { method: 'POST', body: JSON.stringify(payload) });
      setNotice('Simulação processada com regras do regime.'); await load(organizationId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar.'); } finally { setSaving(false); }
  }

  const displayItems = useMemo(() => {
    const saved = history.find(h => h.inputs.documentId === documentId && h.name === name);
    return saved ? saved.results.itemsCalculated : results.itemsCalculated;
  }, [history, documentId, name, results.itemsCalculated]);

  return <main className="dashboard-shell sim-page">
    <header className="topbar"><Link href="/" className="brand"><span className="brand-mark">R</span><span>Reforma <b>360</b></span></Link><Link href="/" className="btn btn-light"><ArrowLeft size={16}/> Voltar ao painel</Link></header>
    <section className="page-content sim-content">
      <div className="sim-heading"><div><span className="eyebrow">ETAPA 4 · PLANEJAMENTO TRIBUTÁRIO</span><h1>Simulador CBS / IBS</h1><p>Planeie os cenários da sua empresa comparando regimes tributários e anos de transição.</p></div><div className="sim-live" style={{background: '#edf3ff', color: '#1446b3'}}><span><Zap size={13}/></span> Inteligência Ativa</div></div>
      
      {error && <div className="sim-alert error">{error}</div>}{notice && <div className="sim-alert success"><CheckCircle2 size={17}/>{notice}</div>}
      
      <div className="sim-warning"><Info size={19}/><div><strong>Estratégia do Simples Nacional</strong><p>A Reforma permite cobrar a CBS/IBS por fora do DAS para repassar 100% de crédito aos seus clientes empresariais (B2B), tornando-o mais competitivo.</p></div></div>
      
      <div className="sim-mode-toggle">
        <button type="button" onClick={() => setMode('MANUAL')} className={`btn ${mode === 'MANUAL' ? 'btn-primary' : 'btn-light'}`}><Calculator size={17} style={{display:'inline', verticalAlign:'text-bottom', marginRight:8}}/> Simulação Manual</button>
        <button type="button" onClick={() => setMode('DOCUMENT')} className={`btn ${mode === 'DOCUMENT' ? 'btn-primary' : 'btn-light'}`}><Receipt size={17} style={{display:'inline', verticalAlign:'text-bottom', marginRight:8}}/> Simulação por Nota Fiscal</button>
      </div>

      <div className="sim-layout">
        <form className="sim-card sim-form" onSubmit={save}>
          <div className="sim-card-head"><div className="sim-icon"><Calculator size={20}/></div><div><h2>Premissas do cenário</h2><p>Altere os campos para ver o impacto.</p></div></div>
          
          <label className="sim-label">Organização<select value={organizationId} onChange={e => { setOrganizationId(e.target.value); void load(e.target.value); }}><option value="">Selecione...</option>{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          <label className="sim-label">Nome do cenário<input value={name} onChange={e => setName(e.target.value)} maxLength={120} required /></label>
          
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px'}}>
            <label className="sim-label">Ano (Transição)<select value={inputs.simulationYear} onChange={e => update('simulationYear', e.target.value)} style={{width: '100%', padding: '9px', marginTop: '5px', borderRadius: '8px', border: '1px solid #dce3ed', background: '#fff'}}><option value="2026">2026 (Ano Teste)</option><option value="2027">2027 - 2028</option><option value="2029">2029</option><option value="2030">2030</option><option value="2031">2031</option><option value="2032">2032</option><option value="2033">2033 (100% Reforma)</option></select></label>
            <label className="sim-label">Regime Tributário<select value={inputs.taxRegime} onChange={e => update('taxRegime', e.target.value)} style={{width: '100%', padding: '9px', marginTop: '5px', borderRadius: '8px', border: '1px solid #dce3ed', background: '#fff'}}><option value="NORMAL">Normal (Lucro Real/Presumido)</option><option value="SIMPLES_DAS">Simples (Manter no DAS)</option><option value="SIMPLES_POR_FORA">Simples (Cobrar CBS/IBS por fora)</option></select></label>
          </div>
          
          {mode === 'DOCUMENT' && (
            <label className="sim-label" style={{background: '#f8faff', padding: '15px', borderRadius: '10px', border: '1px solid #dce3ed', marginBottom: '15px'}}>
              <span style={{color: '#1446b3', display: 'flex', alignItems: 'center', gap: '5px'}}><Zap size={14}/> Importar XML Base</span>
              <select value={documentId} onChange={e => setDocumentId(e.target.value)} required style={{marginTop: '8px', marginBottom: '8px', width: '100%'}}>
                <option value="">Selecione um documento...</option>
                {documents.map(d => <option key={d.id} value={d.id}>NF-e {d.documentNumber || d.fileName} ({money(Number(d.totalAmount))})</option>)}
              </select>
            </label>
          )}

          <div className="sim-field-grid">
            {mode === 'MANUAL' && <label className="sim-label">Faturamento<div className="sim-input-wrap"><input type="number" min="0" step="0.01" value={inputs.revenue} onChange={e => update('revenue', e.target.value)} required/><span>R$</span></div></label>}
            <label className="sim-label">Compras e custos<div className="sim-input-wrap"><input type="number" min="0" step="0.01" value={inputs.purchases} onChange={e => update('purchases', e.target.value)} required/><span>R$</span></div></label>
            <label className="sim-label">{inputs.taxRegime.includes('SIMPLES') ? 'Alíquota DAS Atual' : 'Alíquota Atual Efetiva'}<div className="sim-input-wrap"><input type="number" min="0" max="100" step="0.01" value={inputs.currentRate} onChange={e => update('currentRate', e.target.value)} required/><span>%</span></div></label>
            <label className="sim-label">Compras creditáveis<div className="sim-input-wrap"><input type="number" min="0" max="100" step="0.01" value={inputs.creditablePurchases} onChange={e => update('creditablePurchases', e.target.value)} disabled={inputs.taxRegime === 'SIMPLES_DAS'} required/><span>%</span></div></label>
          </div>
          <button className="btn sim-save" type="submit" disabled={saving || loading || !organizationId || (mode==='DOCUMENT' && !documentId)}><Save size={16}/>Calcular cenário</button>
        </form>

        <div className="sim-results">
          <div className="sim-result-hero"><span>Impacto Final Estimado (Ano vs Reforma)</span><strong className={results.difference > 0 ? 'negative' : 'positive'}>{money(results.difference)}</strong><small>{results.difference > 0 ? 'Aumento estimado no total de impostos' : results.difference < 0 ? 'Redução estimada no total de impostos' : 'Sem diferença no volume financeiro'}</small><div className="sim-delta">{results.difference > 0 ? <TrendingUp size={16}/> : <TrendingDown size={16}/>} {pct(results.differencePercent)}</div></div>
          
          <div className="sim-metrics">
            <article><span>{inputs.taxRegime.includes('SIMPLES') ? 'Imposto Unificado (DAS)' : 'Imposto antigo ajustado'}</span><strong>{money(results.currentTax)}</strong><small>{inputs.taxRegime === 'SIMPLES_POR_FORA' ? 'Reduzido (sem fração de consumo)' : 'Conforme transição do ano'}</small></article>
            <article><span>CBS + IBS brutos</span><strong>{money(results.grossReformTax)}</strong><small>{inputs.taxRegime === 'SIMPLES_DAS' ? 'Isento (Retido no DAS)' : `Alíquota efetiva calculada ${pct(results.effectiveReformRate)}`}</small></article>
            <article><span>Créditos de Entrada</span><strong className="credit">{money(results.estimatedCredits)}</strong><small>{inputs.taxRegime === 'SIMPLES_DAS' ? 'Sem créditos (Regime Unificado)' : `Base: ${pct(Number(inputs.creditablePurchases))}`}</small></article>
            <article><span>CBS + IBS líquidos a pagar</span><strong>{money(results.netReformTax)}</strong><small>Após créditos estimados</small></article>
          </div>

          <div className="sim-card" style={{gridColumn: '1 / -1', background: 'linear-gradient(to right, #fbf7ef, #fff)', border: '1px solid #eaddc0'}}>
            <div className="sim-card-head" style={{padding: '15px'}}><div className="sim-icon" style={{background: '#f5b82e', color: '#fff'}}><Award size={20}/></div>
            <div><h2 style={{color: '#825e07'}}>Competitividade B2B (Crédito Gerado)</h2><p>Este é o valor estimado de créditos que a sua empresa repassará aos seus clientes empresariais na compra.</p></div>
            <div style={{marginLeft: 'auto', fontSize: '24px', fontWeight: 'bold', color: '#a17204'}}>{money(results.creditTransferredToB2B)}</div></div>
          </div>

          {results.isDocumentSimulation && displayItems && displayItems.length > 0 && inputs.taxRegime !== 'SIMPLES_DAS' && (
            <div className="sim-card table-container" style={{gridColumn: '1 / -1'}}>
              <div className="sim-card-head" style={{padding: '0 15px'}}><div className="sim-icon green"><LayoutList size={20}/></div><div><h2>Projeção Item a Item (Por Fora)</h2></div></div>
              <div className="xml-table-wrap" style={{marginTop: 10, borderTop: '1px solid var(--line)'}}>
                <table className="xml-table">
                  <thead><tr><th>Produto</th><th>NCM</th><th>Valor Total</th><th>Imposto Antigo</th><th>CBS + IBS Projetado</th></tr></thead>
                  <tbody>
                    {displayItems.map((item, i) => (
                      <tr key={i}>
                        <td><strong>{item.description}</strong> {item.appliedRules?.isReduced && <span className="rule-tag">Redução</span>}</td>
                        <td>{String(item.ncm).padStart(8, '0')}</td>
                        <td>{money(Number(item.total))}</td>
                        <td style={{color: 'var(--muted)'}}>{money(item.currentTax)}</td>
                        <td><strong style={{color: '#16856b'}}>{money(item.grossReformTax)}</strong> <span style={{fontSize:10, color:'var(--muted)', display:'block'}}>CBS: {money(item.cbsTax)} | IBS: {money(item.ibsTax)}</span></td>
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