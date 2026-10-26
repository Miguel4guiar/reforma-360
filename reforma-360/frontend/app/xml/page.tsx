'use client';

import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import JSZip from 'jszip';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock3, FileCode2, FileSearch,
  FileText, FileUp, RefreshCw, Search, ShieldCheck, UploadCloud, X,
} from 'lucide-react';

type Organization = { id: string; name: string };
type FiscalItem = { description?: string; ncm?: string | null; cfop?: string | null; total?: string | null };
type FiscalDocument = {
  id: string; fileName: string; accessKey: string | null; documentNumber: string | null;
  series: string | null; documentType?: string; issuerName: string | null; issuerTaxId: string | null;
  recipientName: string | null; recipientTaxId: string | null; issuedAt: string | null;
  totalAmount: string | number | null; status: string; warnings: string[] | null;
  items: FiscalItem[] | null; createdAt: string;
};
type ImportResult = { name: string; ok: boolean; message: string };

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const MAX_FILE_SIZE = 5 * 1024 * 1024;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('reforma360_access_token') : null;
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options?.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Não foi possível concluir a operação.');
  return data as T;
}

const currency = (value: string | number | null) => value == null ? '—' : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('pt-BR') : '—';
const isTextFile = (fileName: string) => fileName.toLowerCase().endsWith('.txt');

export default function XmlPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<FiscalDocument | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [results, setResults] = useState<ImportResult[]>([]);

  const load = useCallback(async (orgId?: string) => {
    setLoading(true); setError('');
    try {
      const orgs = await request<Organization[]>('/organizations');
      setOrganizations(orgs);
      const active = orgs.find(o => o.id === (orgId || organizationId))?.id || orgs[0]?.id || '';
      setOrganizationId(active);
      setDocuments(active ? await request<FiscalDocument[]>(`/fiscal-documents?organizationId=${encodeURIComponent(active)}`) : []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar documentos.'); }
    finally { setLoading(false); }
  }, [organizationId]);

  useEffect(() => { if (!window.localStorage.getItem('reforma360_access_token')) { window.location.href = '/'; return; } void load(); }, [load]);

  const importFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    if (!organizationId) { setError('Selecione uma organização antes de importar.'); return; }
    
    setBusy(true); setError(''); setNotice('');
    
    const initialResults: ImportResult[] = [];
    const filesToProcess: { name: string; content: string }[] = [];
    
    // Fase 1: Ler e extrair ficheiros (lidando com .xml, .txt e descompactando .zip)
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      
      if (ext === 'zip') {
        try {
          const zip = new JSZip();
          const loadedZip = await zip.loadAsync(file);
          const zipEntries = Object.values(loadedZip.files);
          
          let extractedCount = 0;
          for (const entry of zipEntries) {
            // Ignorar pastas e ficheiros ocultos do macOS
            if (entry.dir || entry.name.includes('__MACOSX') || entry.name.startsWith('.')) continue;
            
            const entryExt = entry.name.split('.').pop()?.toLowerCase();
            if (entryExt === 'xml' || entryExt === 'txt') {
              const content = await entry.async('string');
              // Guardar apenas o nome do ficheiro, ignorando a estrutura de pastas do zip
              const cleanName = entry.name.split('/').pop() || entry.name;
              filesToProcess.push({ name: cleanName, content });
              extractedCount++;
            }
          }
          if (extractedCount === 0) {
            initialResults.push({ name: file.name, ok: false, message: 'Nenhum XML ou TXT encontrado dentro do ZIP.' });
          }
        } catch (e) {
          initialResults.push({ name: file.name, ok: false, message: 'Erro ao descompactar o ficheiro ZIP.' });
        }
      } else if (ext === 'xml' || ext === 'txt') {
        if (file.size > MAX_FILE_SIZE) {
          initialResults.push({ name: file.name, ok: false, message: 'Arquivo maior que 5 MB.' });
        } else {
          const content = await file.text();
          filesToProcess.push({ name: file.name, content });
        }
      } else {
        initialResults.push({ name: file.name, ok: false, message: 'Formato não suportado. Use XML, TXT ou ZIP.' });
      }
    }

    setResults([...initialResults]);

    // Fase 2: Enviar todos os ficheiros processados para a API (em sequência para não sobrecarregar)
    let succeeded = 0;
    for (const fileObj of filesToProcess) {
      try {
        const result = await request<FiscalDocument>('/fiscal-documents/import', {
          method: 'POST', body: JSON.stringify({ organizationId, fileName: fileObj.name, xml: fileObj.content }),
        });
        succeeded++;
        initialResults.push({ name: fileObj.name, ok: true, message: isTextFile(fileObj.name) ? 'Texto anexado para revisão.' : result.status === 'REVIEW' ? 'Importado com pontos para revisar.' : 'XML processado.' });
      } catch (e) {
        initialResults.push({ name: fileObj.name, ok: false, message: e instanceof Error ? e.message : 'Falha ao importar arquivo.' });
      }
      setResults([...initialResults]);
    }

    setBusy(false);
    if (succeeded) setNotice(`${succeeded} arquivo(s) importado(s) com sucesso.`);
    if (filesToProcess.length === 0 && initialResults.length > 0) setError('Nenhum ficheiro processado. Verifique os resultados.');
    await load(organizationId);
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) void importFiles(files);
    event.target.value = '';
  };
  
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragging(false);
    if (event.dataTransfer.files.length) void importFiles(event.dataTransfer.files);
  };
  
  const filteredDocuments = documents.filter(doc => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    const matchesTerm = !term || [doc.fileName, doc.documentNumber, doc.issuerName, doc.issuerTaxId, doc.recipientName].some(v => v?.toLocaleLowerCase('pt-BR').includes(term));
    const matchesFilter = filter === 'ALL' || (filter === 'REVIEW' ? doc.status === 'REVIEW' : filter === 'PROCESSED' ? doc.status !== 'REVIEW' : filter === 'TEXT' ? doc.documentType === 'TEXT' : doc.documentType !== 'TEXT');
    return matchesTerm && matchesFilter;
  });
  
  const totalValue = documents.reduce((sum, doc) => sum + (doc.documentType === 'TEXT' ? 0 : Number(doc.totalAmount || 0)), 0);
  const reviewCount = documents.filter(doc => doc.status === 'REVIEW').length;
  const xmlCount = documents.filter(doc => doc.documentType !== 'TEXT').length;
  const textCount = documents.filter(doc => doc.documentType === 'TEXT').length;

  return <main className="dashboard-shell xml-page">
    <header className="topbar"><Link href="/" className="brand"><span className="brand-mark">R</span><span>Reforma <b>360</b></span></Link><Link href="/" className="btn btn-light"><ArrowLeft size={16}/> Voltar ao painel</Link></header>
    <section className="page-content xml-content">
      <div className="xml-heading"><div><span className="eyebrow">ETAPA 3 · DOCUMENTOS FISCAIS</span><h1>Análise de XML</h1><p>Centralize documentos fiscais, extraia informações da NF-e e organize arquivos de apoio para revisão.</p></div><button className="btn btn-light" onClick={() => void load(organizationId)} disabled={loading || busy}><RefreshCw size={15} className={loading ? 'xml-spin' : ''}/> Atualizar</button></div>
      {error && <div className="xml-alert xml-alert-error" role="alert"><AlertTriangle size={18}/><span>{error}</span><button aria-label="Fechar aviso" onClick={() => setError('')}><X size={16}/></button></div>}
      {notice && <div className="xml-alert xml-alert-success" role="status"><CheckCircle2 size={18}/><span>{notice}</span><button aria-label="Fechar aviso" onClick={() => setNotice('')}><X size={16}/></button></div>}

      <div className="xml-orgbar"><div><label htmlFor="xml-org">Organização ativa</label><p>Os documentos são vinculados à organização selecionada.</p></div><select id="xml-org" value={organizationId} onChange={e => { setOrganizationId(e.target.value); void load(e.target.value); }} disabled={busy}><option value="">Selecione uma organização</option>{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>

      <div className="xml-stat-grid">
        <article className="xml-stat-card"><span className="xml-stat-icon xml-icon-blue"><FileSearch size={19}/></span><div><span>Documentos fiscais</span><strong>{xmlCount}</strong><small>XML importados</small></div></article>
        <article className="xml-stat-card"><span className="xml-stat-icon xml-icon-violet"><FileText size={19}/></span><div><span>Arquivos de texto</span><strong>{textCount}</strong><small>TXT anexados</small></div></article>
        <article className="xml-stat-card"><span className="xml-stat-icon xml-icon-amber"><Clock3 size={19}/></span><div><span>Precisam de revisão</span><strong>{reviewCount}</strong><small>Com avisos ou análise manual</small></div></article>
        <article className="xml-stat-card"><span className="xml-stat-icon xml-icon-green"><ShieldCheck size={19}/></span><div><span>Total dos XML</span><strong>{currency(totalValue)}</strong><small>Soma dos valores importados</small></div></article>
      </div>

      <section className="xml-upload-card">
        <div className="xml-section-heading"><div><span className="xml-section-kicker">CENTRAL DE IMPORTAÇÃO</span><h2>Adicione seus arquivos</h2><p>Arraste arquivos ou ficheiros ZIP para a área abaixo.</p></div><span className="xml-heading-file-icon"><UploadCloud size={23}/></span></div>
        <div className={`xml-dropzone ${dragging ? 'is-dragging' : ''} ${busy ? 'is-busy' : ''}`} onDragEnter={e => { e.preventDefault(); setDragging(true); }} onDragOver={e => e.preventDefault()} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }} onDrop={onDrop}>
          <div className="xml-upload-symbol"><UploadCloud size={29}/></div><h3>{busy ? 'Processando os seus arquivos… (Aguarde)' : dragging ? 'Solte os arquivos aqui' : 'Arraste e solte seus arquivos ou ZIP aqui'}</h3><p>Formatos aceitos: <b>.XML</b>, <b>.TXT</b> ou pastas compactadas <b>.ZIP</b> com centenas de notas.</p>
          <button type="button" className="btn btn-primary xml-select-button" onClick={() => fileInput.current?.click()} disabled={busy || !organizationId}><FileUp size={16}/>{busy ? 'Extraindo e importando...' : 'Selecionar arquivos'}</button>
          <input ref={fileInput} type="file" multiple accept=".xml,.txt,.zip,application/zip,application/x-zip-compressed,text/xml,application/xml,text/plain" onChange={onFileChange} disabled={busy || !organizationId} className="xml-hidden-input" />
          <div className="xml-upload-hints"><span><CheckCircle2 size={14}/> Extração automática de Lotes (ZIP)</span><span><ShieldCheck size={14}/> Acesso por organização</span><span><FileCode2 size={14}/> XML de NF-e modelo 55</span></div>
        </div>
        {!organizationId && <p className="xml-inline-help">Selecione uma organização para habilitar a importação.</p>}
        {results.length > 0 && <div className="xml-import-results"><div className="xml-results-title"><strong>Resultado da importação</strong><button className="xml-clear-results" onClick={() => setResults([])}>Limpar</button></div><div style={{maxHeight: '300px', overflowY: 'auto'}}>{results.map((item, index) => <div className="xml-result-row" key={`${item.name}-${index}`}><span className={`xml-result-mark ${item.ok ? 'ok' : 'fail'}`}>{item.ok ? <CheckCircle2 size={16}/> : <AlertTriangle size={16}/>}</span><div className="xml-result-copy"><strong>{item.name}</strong><span>{item.message}</span></div></div>)}</div></div>}
        <div className="xml-format-note"><FileText size={17}/><p><b>Dica de Produtividade:</b> Para centenas de notas, coloque todos os XMLs numa pasta, comprima-a num ficheiro `.zip` e arraste para aqui. O sistema extrai e importa todos de uma só vez.</p></div>
      </section>

      <section className="xml-documents-card">
        <div className="xml-section-heading xml-documents-heading"><div><span className="xml-section-kicker">ACERVO DA ORGANIZAÇÃO</span><h2>Documentos importados</h2><p>{filteredDocuments.length} de {documents.length} arquivo(s)</p></div><span className="xml-heading-file-icon"><FileSearch size={22}/></span></div>
        <div className="xml-toolbar"><label className="xml-search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por arquivo, número ou emitente…" /></label><select aria-label="Filtrar documentos" value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">Todos os arquivos</option><option value="XML">Somente XML</option><option value="TEXT">Somente TXT</option><option value="REVIEW">Precisam de revisão</option><option value="PROCESSED">Processados</option></select></div>
        {loading ? <div className="xml-empty-state"><RefreshCw size={25} className="xml-spin"/><p>Carregando documentos…</p></div> : !filteredDocuments.length ? <div className="xml-empty-state"><span><FileSearch size={28}/></span><h3>{documents.length ? 'Nenhum resultado encontrado' : 'Sua área de documentos está vazia'}</h3><p>{documents.length ? 'Tente alterar a busca ou o filtro selecionado.' : 'Importe seu primeiro XML ou anexe um arquivo TXT para começar.'}</p></div> : <div className="xml-table-wrap"><table className="xml-table"><thead><tr><th>Arquivo / documento</th><th>Emitente</th><th>Emissão</th><th>Valor</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{filteredDocuments.map(doc => <tr key={doc.id}><td><div className="xml-file-cell"><span className={`xml-file-type ${doc.documentType === 'TEXT' ? 'txt' : 'xml'}`}>{doc.documentType === 'TEXT' ? <FileText size={17}/> : <FileCode2 size={17}/>}</span><div><strong>{doc.documentType === 'TEXT' ? doc.fileName : doc.documentNumber ? `NF-e ${doc.documentNumber}` : doc.fileName}</strong><span>{doc.fileName}</span></div></div></td><td><div className="xml-issuer-cell"><strong>{doc.issuerName || (doc.documentType === 'TEXT' ? 'Arquivo de texto' : 'Não identificado')}</strong><span>{doc.issuerTaxId || (doc.documentType === 'TEXT' ? 'Revisão manual' : 'CNPJ/CPF não identificado')}</span></div></td><td>{date(doc.issuedAt)}</td><td className="xml-value-cell">{doc.documentType === 'TEXT' ? '—' : currency(doc.totalAmount)}</td><td><span className={`xml-status ${doc.status === 'REVIEW' ? 'review' : 'processed'}`}><span/>{doc.status === 'REVIEW' ? 'Revisar' : 'Processado'}</span></td><td><button className="xml-detail-button" onClick={() => setSelected(doc)}>Detalhes <span>→</span></button></td></tr>)}</tbody></table></div>}
      </section>
      <p className="xml-disclaimer">A leitura de XML e os avisos são verificações iniciais; não substituem auditoria fiscal nem representam cálculo definitivo de CBS/IBS. Arquivos TXT são anexos para revisão manual.</p>
    </section>

    {selected && <div className="xml-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}><section role="dialog" aria-modal="true" aria-label="Detalhes do documento" className="xml-detail-modal"><div className="xml-modal-heading"><div><span className="xml-section-kicker">VISUALIZAÇÃO DO ARQUIVO</span><h2>Detalhes do documento</h2><p>{selected.fileName}</p></div><button className="xml-modal-close" onClick={() => setSelected(null)} aria-label="Fechar detalhes"><X size={19}/></button></div><div className="xml-detail-grid"><div><span>Tipo de arquivo</span><strong>{selected.documentType === 'TEXT' ? 'Texto (TXT)' : 'NF-e (XML)'}</strong></div><div><span>Situação</span><strong>{selected.status === 'REVIEW' ? 'Revisão necessária' : 'Processado'}</strong></div><div><span>Número</span><strong>{selected.documentNumber || '—'}</strong></div><div><span>Valor total</span><strong>{selected.documentType === 'TEXT' ? '—' : currency(selected.totalAmount)}</strong></div><div className="wide"><span>Chave de acesso</span><strong className="xml-break-word">{selected.accessKey || 'Não identificada'}</strong></div><div><span>Emitente</span><strong>{selected.issuerName || '—'}</strong></div><div><span>Destinatário</span><strong>{selected.recipientName || '—'}</strong></div></div>{selected.warnings?.length ? <div className="xml-warnings"><h3><AlertTriangle size={17}/> Pontos para revisar</h3><ul>{selected.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div> : <div className="xml-no-warnings"><CheckCircle2 size={17}/> Nenhum aviso básico registrado na leitura.</div>}{selected.documentType !== 'TEXT' && <div className="xml-items-section"><h3>Itens extraídos <span>{selected.items?.length || 0}</span></h3><div className="xml-table-wrap"><table className="xml-table"><thead><tr><th>Produto</th><th>NCM</th><th>CFOP</th><th>Total</th></tr></thead><tbody>{(selected.items || []).map((item, index) => <tr key={index}><td>{item.description || '—'}</td><td>{item.ncm || '—'}</td><td>{item.cfop || '—'}</td><td>{currency(item.total || null)}</td></tr>)}</tbody></table></div></div>}<div className="xml-modal-footer"><button className="btn btn-primary" onClick={() => setSelected(null)}>Concluído</button></div></section></div>}
  </main>;
}