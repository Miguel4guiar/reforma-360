'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calculator, CheckCircle2, Clock3, FileText, Info, Save, TrendingDown, TrendingUp } from 'lucide-react';

type Organization = { id: string; name: string };
type Inputs = { revenue: string; purchases: string; currentRate: string; cbsRate: string; ibsRate: string; reduction: string; creditablePurchases: string };
type Simulation = { id: string; name: string; inputs: Inputs; results: Results; createdAt: string };
type Results = { currentTax: number; nominalReformRate: number; effectiveReformRate: number; grossReformTax: number; eligiblePurchaseBase: number; estimatedCredits: number; netReformTax: number; difference: number; differencePercent: number | null; estimatedMarginBeforeTax: number; estimatedMarginAfterCurrentTax: number; estimatedMarginAfterReformTax: number; methodology: string };
const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const defaults: Inputs = { revenue: '100000', purchases: '45000', currentRate: '12', cbsRate: '8.8', ibsRate: '17.7', reduction: '0', creditablePurchases: '80' };
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n: number | null) => n === null ? '—' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('reforma360_access_token') : null;
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'Não foi possível concluir a operação.');
  return body as T;
}
function estimate(v: Inputs): Results {
  const revenue = Math.max(0, Number(v.revenue) || 0), purchases = Math.max(0, Number(v.purchases) || 0);
  const currentRate = Math.max(0, Number(v.currentRate) || 0), cbs = Math.max(0, Number(v.cbsRate) || 0), ibs = Math.max(0, Number(v.ibsRate) || 0);
  const reduction = Math.min(100, Math.max(0, Number(v.reduction) || 0)), creditable = Math.min(100, Math.max(0, Number(v.creditablePurchases) || 0));
  const currentTax = revenue * currentRate / 100, effectiveReformRate = (cbs + ibs) * (1 - reduction / 100);
  const grossReformTax = revenue * effectiveReformRate / 100, eligiblePurchaseBase = purchases * creditable / 100;
  const estimatedCredits = eligiblePurchaseBase * effectiveReformRate / 100, netReformTax = Math.max(0, grossReformTax - estimatedCredits), difference = netReformTax - currentTax;
  return { currentTax, nominalReformRate: cbs + ibs, effectiveReformRate, grossReformTax, eligiblePurchaseBase, estimatedCredits, netReformTax, difference, differencePercent: currentTax ? difference / currentTax * 100 : null, estimatedMarginBeforeTax: revenue - purchases, estimatedMarginAfterCurrentTax: revenue - purchases - currentTax, estimatedMarginAfterReformTax: revenue - purchases - netReformTax, methodology: 'Estimativa simplificada. Não contempla todas as regras, exceções, regimes, limitações de crédito ou particularidades da operação.' };
}
export default function SimulatorPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [name, setName] = useState('Cenário base');
  const [inputs, setInputs] = useState<Inputs>(defaults);
  const [history, setHistory] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const results = useMemo(() => estimate(inputs), [inputs]);
  const load = useCallback(async (preferred?: string) => {
    setLoading(true); setError('');
    try {
      const orgs = await request<Organization[]>('/organizations');
      setOrganizations(orgs);
      const active = orgs.find(o => o.id === (preferred || organizationId))?.id || orgs[0]?.id || '';
      setOrganizationId(active);
      setHistory(active ? await request<Simulation[]>(`/tax-simulations?organizationId=${encodeURIComponent(active)}`) : []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar simulações.'); }
    finally { setLoading(false); }
  }, [organizationId]);
  useEffect(() => { if (!window.localStorage.getItem('reforma360_access_token')) { window.location.href = '/'; return; } void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const update = (key: keyof Inputs, value: string) => setInputs(prev => ({ ...prev, [key]: value }));
  async function save(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    if (!organizationId) { setError('Cadastre ou selecione uma organização antes de salvar.'); return; }
    setSaving(true);
    try {
      await request<Simulation>('/tax-simulations', { method: 'POST', body: JSON.stringify({ organizationId, name, inputs: Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, Number(v)])) }) });
      setNotice('Simulação calculada e salva no histórico da organização.');
      await load(organizationId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar a simulação.'); }
    finally { setSaving(false); }
  }
  function openScenario(item: Simulation) {
    setName(item.name); setInputs(Object.fromEntries(Object.entries(item.inputs).map(([k, v]) => [k, String(v)])) as Inputs);
    setNotice(`Cenário “${item.name}” carregado para consulta e edição.`);
  }
  const fields: { key: keyof Inputs; label: string; suffix?: string; help: string }[] = [
    { key: 'revenue', label: 'Faturamento / vendas', help: 'Valor de vendas considerado no período.' },
    { key: 'purchases', label: 'Compras e custos', help: 'Base aproximada de compras para estimar créditos e margem.' },
    { key: 'currentRate', label: 'Carga tributária atual estimada', suffix: '%', help: 'Percentual efetivo aproximado do cenário atual.' },
    { key: 'cbsRate', label: 'Alíquota CBS de referência', suffix: '%', help: 'Premissa editável; confirme a alíquota aplicável ao período.' },
    { key: 'ibsRate', label: 'Alíquota IBS de referência', suffix: '%', help: 'Premissa editável; confirme a alíquota aplicável ao período.' },
    { key: 'reduction', label: 'Redução aplicada à alíquota', suffix: '%', help: 'Use somente se houver hipótese de redução aplicável à operação.' },
    { key: 'creditablePurchases', label: 'Percentual de compras potencialmente creditáveis', suffix: '%', help: 'Estimativa manual; não significa direito automático a crédito.' },
  ];
  return <main className="dashboard-shell sim-page">
    <header className="topbar"><Link href="/" className="brand"><span className="brand-mark">R</span><span>Reforma <b>360</b></span></Link><Link href="/" className="btn btn-light"><ArrowLeft size={16}/> Voltar ao painel</Link></header>
    <section className="page-content sim-content">
      <div className="sim-heading"><div><span className="eyebrow">ETAPA 4 · PLANEJAMENTO TRIBUTÁRIO</span><h1>Simulador CBS / IBS</h1><p>Compare premissas tributárias e visualize impactos estimados no caixa e na margem.</p></div><div className="sim-live"><span></span> Cálculo instantâneo</div></div>
      {error && <div className="sim-alert error">{error}</div>}{notice && <div className="sim-alert success"><CheckCircle2 size={17}/>{notice}</div>}
      <div className="sim-warning"><Info size={19}/><div><strong>Simulação gerencial preliminar</strong><p>Os resultados usam fórmulas simplificadas e alíquotas informadas por você. Não substituem apuração fiscal, enquadramento tributário nem validação das regras vigentes. A transição, regimes específicos, destino, natureza da operação e limites de crédito podem alterar o resultado real.</p></div></div>
      <div className="sim-layout">
        <form className="sim-card sim-form" onSubmit={save}>
          <div className="sim-card-head"><div className="sim-icon"><Calculator size={20}/></div><div><h2>Premissas do cenário</h2><p>Altere os campos para atualizar os resultados.</p></div></div>
          <label className="sim-label">Organização<select value={organizationId} onChange={e => { setOrganizationId(e.target.value); void load(e.target.value); }}><option value="">Selecione uma organização</option>{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          <label className="sim-label">Nome do cenário<input value={name} onChange={e => setName(e.target.value)} maxLength={120} required /></label>
          <div className="sim-field-grid">{fields.map(f => <label className="sim-label" key={f.key}>{f.label}<div className="sim-input-wrap"><input type="number" min="0" max={f.suffix ? '100' : undefined} step="0.01" value={inputs[f.key]} onChange={e => update(f.key, e.target.value)} required/><span>{f.suffix || 'R$'}</span></div><small>{f.help}</small></label>)}</div>
          <button className="btn sim-save" type="submit" disabled={saving || loading || !organizationId}><Save size={16}/>{saving ? 'Salvando...' : 'Calcular e salvar cenário'}</button>
        </form>
        <div className="sim-results">
          <div className="sim-result-hero"><span>Diferença estimada de tributos</span><strong className={results.difference > 0 ? 'negative' : 'positive'}>{money(results.difference)}</strong><small>{results.difference > 0 ? 'Aumento estimado em relação ao cenário atual' : results.difference < 0 ? 'Redução estimada em relação ao cenário atual' : 'Sem diferença entre as premissas'}</small><div className="sim-delta">{results.difference > 0 ? <TrendingUp size={16}/> : <TrendingDown size={16}/>} {pct(results.differencePercent)} vs. atual</div></div>
          <div className="sim-metrics">
            <article><span>Tributo atual estimado</span><strong>{money(results.currentTax)}</strong><small>Alíquota de {pct(Number(inputs.currentRate))}</small></article>
            <article><span>CBS + IBS brutos</span><strong>{money(results.grossReformTax)}</strong><small>Alíquota efetiva {pct(results.effectiveReformRate)}</small></article>
            <article><span>Créditos estimados</span><strong className="credit">{money(results.estimatedCredits)}</strong><small>Compras potencialmente creditáveis</small></article>
            <article><span>CBS + IBS líquidos</span><strong>{money(results.netReformTax)}</strong><small>Após créditos estimados</small></article>
          </div>
          <div className="sim-card sim-margin"><div className="sim-card-head"><div className="sim-icon green"><TrendingUp size={20}/></div><div><h2>Impacto na margem</h2><p>Visão simplificada: faturamento menos compras e tributos estimados.</p></div></div>
            <div className="sim-bar-row"><span>Atual</span><div className="sim-bar"><i style={{width: `${Math.max(0, Math.min(100, results.estimatedMarginAfterCurrentTax / Math.max(1, Number(inputs.revenue) || 1) * 100))}%`}}/></div><strong>{money(results.estimatedMarginAfterCurrentTax)}</strong></div>
            <div className="sim-bar-row"><span>CBS / IBS</span><div className="sim-bar reform"><i style={{width: `${Math.max(0, Math.min(100, results.estimatedMarginAfterReformTax / Math.max(1, Number(inputs.revenue) || 1) * 100))}%`}}/></div><strong>{money(results.estimatedMarginAfterReformTax)}</strong></div>
          </div>
          <div className="sim-card sim-memory"><div className="sim-card-head"><div className="sim-icon"><FileText size={20}/></div><div><h2>Memória de cálculo</h2><p>Premissas usadas na estimativa exibida.</p></div></div>
            <div className="sim-formula"><span>Tributo atual</span><code>Faturamento × alíquota atual</code><strong>{money(results.currentTax)}</strong></div>
            <div className="sim-formula"><span>CBS + IBS brutos</span><code>Faturamento × alíquota efetiva</code><strong>{money(results.grossReformTax)}</strong></div>
            <div className="sim-formula"><span>Créditos estimados</span><code>Compras × % creditável × alíquota efetiva</code><strong>− {money(results.estimatedCredits)}</strong></div>
            <div className="sim-formula total"><span>CBS + IBS líquidos</span><code>Tributo bruto − créditos estimados (mínimo zero)</code><strong>{money(results.netReformTax)}</strong></div>
          </div>
        </div>
      </div>
      <div className="sim-card sim-history"><div className="sim-card-head"><div className="sim-icon"><Clock3 size={20}/></div><div><h2>Histórico de cenários</h2><p>Simulações salvas nesta organização. Selecione uma para carregar suas premissas.</p></div></div>
        {loading ? <p className="sim-muted">Carregando histórico...</p> : history.length ? <div className="sim-history-list">{history.map(item => <button className="sim-history-item" key={item.id} onClick={() => openScenario(item)} type="button"><span><strong>{item.name}</strong><small>{new Date(item.createdAt).toLocaleString('pt-BR')}</small></span><span><small>CBS/IBS líquidos</small><strong>{money(Number(item.results.netReformTax || 0))}</strong></span><span className={Number(item.results.difference) > 0 ? 'negative' : 'positive'}>{money(Number(item.results.difference || 0))}</span></button>)}</div> : <div className="sim-empty">Nenhum cenário salvo ainda. Preencha as premissas e salve a primeira simulação.</div>}
      </div>
    </section>
  </main>;
}
