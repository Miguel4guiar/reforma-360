import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { PrismaService } from '../prisma/prisma.service';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: true, trimValues: true });
const asObject = (v: any): any => v && typeof v === 'object' ? v : {};
const text = (v: any): string | null => v === undefined || v === null || typeof v === 'object' ? null : String(v).trim() || null;
const digits = (v: any): string | null => { const t = text(v); return t ? t.replace(/\D/g, '') || null : null; };
const money = (v: any): string | null => { const n = Number(v); return Number.isFinite(n) ? n.toFixed(2) : null; };

@Injectable()
export class FiscalDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMember(userId: string, organizationId: string) {
    if (!organizationId) throw new NotFoundException('Selecione uma organização.');
    const membership = await this.prisma.membership.findUnique({ where: { userId_organizationId: { userId, organizationId } } });
    if (!membership) throw new ForbiddenException('Você não tem acesso a esta organização.');
  }

  async list(userId: string, organizationId: string) {
    await this.assertMember(userId, organizationId);
    return this.prisma.fiscalDocument.findMany({
      where: { organizationId }, orderBy: { createdAt: 'desc' },
      select: { id: true, organizationId: true, fileName: true, accessKey: true, documentNumber: true, series: true, documentType: true, issuerName: true, issuerTaxId: true, recipientName: true, recipientTaxId: true, issuedAt: true, totalAmount: true, status: true, warnings: true, items: true, createdAt: true },
    });
  }

  async importXml(userId: string, organizationId: string, fileName: string, xml: string) {
    await this.assertMember(userId, organizationId);
    if (!fileName || !/\.(xml|txt)$/i.test(fileName)) throw new BadRequestException('Selecione um arquivo com extensão .xml ou .txt.');
    if (typeof xml !== 'string' || !xml.trim()) throw new BadRequestException('O arquivo está vazio.');
    if (Buffer.byteLength(xml, 'utf8') > 5_000_000) throw new BadRequestException('O arquivo excede o limite de 5 MB.');
    if (fileName.toLowerCase().endsWith('.txt')) {
      const duplicateText = await this.prisma.fiscalDocument.findFirst({ where: { organizationId, fileName: fileName.slice(0, 255), documentType: 'TEXT' }, select: { id: true } });
      if (duplicateText) throw new ConflictException('Já existe um arquivo TXT com este nome nesta organização.');
      return this.prisma.fiscalDocument.create({ data: {
        organizationId, fileName: fileName.slice(0, 255), accessKey: null, documentType: 'TEXT',
        status: 'REVIEW', warnings: ['Arquivo de texto anexado como material de apoio.', 'A extração automática de campos fiscais está disponível nesta etapa para XML de NF-e. Revise o conteúdo deste TXT manualmente.'],
        items: [], rawXml: xml,
      }, select: { id: true, organizationId: true, fileName: true, accessKey: true, documentNumber: true, series: true, documentType: true, issuerName: true, issuerTaxId: true, recipientName: true, recipientTaxId: true, issuedAt: true, totalAmount: true, status: true, warnings: true, items: true, createdAt: true } });
    }
    const valid = XMLValidator.validate(xml);
    if (valid !== true) throw new BadRequestException('XML inválido: verifique a estrutura do arquivo.');
    let root: any;
    try { root = asObject(parser.parse(xml)); } catch { throw new BadRequestException('Não foi possível interpretar o XML.'); }
    const nfe = asObject(root.nfeProc).NFe || root.NFe || root.nfeProc?.NFe;
    const inf = asObject(asObject(nfe).infNFe);
    if (!Object.keys(inf).length) throw new BadRequestException('O XML não parece ser uma NF-e reconhecida. Envie um XML de NF-e (modelo 55).');
    const ide = asObject(inf.ide), emit = asObject(inf.emit), dest = asObject(inf.dest), total = asObject(asObject(inf.total).ICMSTot);
    const keyFromId = text(inf['@_Id'])?.replace(/^NFe/, '') || null;
    const protocol = asObject(asObject(root.nfeProc).protNFe);
    const protocolInfo = asObject(protocol.infProt);
    const accessKey = text(protocolInfo.chNFe) || keyFromId;
    const itemsRaw = inf.det === undefined ? [] : Array.isArray(inf.det) ? inf.det : [inf.det];
    const items = itemsRaw.map((row: any) => {
      const detail = asObject(row), prod = asObject(detail.prod), taxes = asObject(detail.imposto);
      return { itemNumber: text(detail['@_nItem']), code: text(prod.cProd), description: text(prod.xProd), ncm: text(prod.NCM), cfop: text(prod.CFOP), unit: text(prod.uCom), quantity: text(prod.qCom), unitPrice: money(prod.vUnCom), total: money(prod.vProd), taxes: Object.keys(taxes) };
    });
    const warnings: string[] = [];
    if (!accessKey) warnings.push('Chave de acesso não identificada no XML.');
    if (!emit.CNPJ && !emit.CPF) warnings.push('CNPJ/CPF do emitente não identificado.');
    if (!items.length) warnings.push('Nenhum item de produto foi identificado.');
    if (items.some((item: any) => !item.ncm)) warnings.push('Um ou mais itens estão sem NCM.');
    if (!total.vNF) warnings.push('Valor total da NF-e não identificado.');
    if (accessKey) {
      const duplicate = await this.prisma.fiscalDocument.findFirst({ where: { organizationId, accessKey }, select: { id: true, fileName: true } });
      if (duplicate) throw new ConflictException(`Este documento já foi importado nesta organização (arquivo: ${duplicate.fileName}).`);
    }
    const issuedAtRaw = text(ide.dhEmi) || text(ide.dEmi);
    const issuedAt = issuedAtRaw ? new Date(issuedAtRaw) : null;
    return this.prisma.fiscalDocument.create({ data: {
      organizationId, fileName: fileName.slice(0, 255), accessKey,
      documentNumber: text(ide.nNF), series: text(ide.serie), documentType: 'NFE',
      issuerName: text(emit.xNome), issuerTaxId: digits(emit.CNPJ || emit.CPF),
      recipientName: text(dest.xNome), recipientTaxId: digits(dest.CNPJ || dest.CPF),
      issuedAt: issuedAt && !Number.isNaN(issuedAt.getTime()) ? issuedAt : null,
      totalAmount: total.vNF !== undefined && Number.isFinite(Number(total.vNF)) ? Number(total.vNF).toFixed(2) : null,
      status: warnings.length ? 'REVIEW' : 'PROCESSED', warnings, items, rawXml: xml,
    }, select: { id: true, organizationId: true, fileName: true, accessKey: true, documentNumber: true, series: true, documentType: true, issuerName: true, issuerTaxId: true, recipientName: true, recipientTaxId: true, issuedAt: true, totalAmount: true, status: true, warnings: true, items: true, createdAt: true } });
  }
}
