import { db } from './db';
import { parseCSV } from './csv';
import { normPhone } from './format';
import { tmpCode, codeFor } from './codes';
import { CLIENT_KINDS, STAGES } from './constants';

const ALIAS: Record<string, string> = { 고객명: 'name', 이름: 'name', 연락처: 'phone', 전화번호: 'phone', 휴대폰: 'phone', 구분: 'kind', 고객구분: 'kind', 회사명: 'company', 회사: 'company', 희망지역: 'wantRegion', 유입경로: 'channel', 메모: 'memo', 단계: 'stage', 상담상태: 'stage' };
export type ClientImportResult = { added: number; duplicates: number; errors: string[] };
/** 고객 CSV 이전. 이미 있는 연락처는 덮어쓰지 않고 건너뛴다(내부 메모·상담이력 보호). 파일 내 중복도 1건만 등록. */
export async function importClients(csv: string, userId: number, dryRun: boolean): Promise<ClientImportResult> {
  const res: ClientImportResult = { added: 0, duplicates: 0, errors: [] };
  const rows = parseCSV(csv).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [ALIAS[k.replace(/\s/g, '')] ?? k, v])));
  const seen = new Set<string>();
  for (const [i, r] of rows.entries()) {
    const line = `${i + 2}행`;
    const phoneNorm = normPhone(r.phone ?? '');
    if (!r.name) { res.errors.push(`${line}: 고객명이 없습니다`); continue; }
    if (phoneNorm.length < 9 || phoneNorm.length > 11) { res.errors.push(`${line}: 연락처가 올바르지 않습니다 (${r.phone ?? ''})`); continue; }
    if (r.kind && !CLIENT_KINDS.includes(r.kind)) { res.errors.push(`${line}: 구분은 ${CLIENT_KINDS.join('/')} 중 하나여야 합니다 (${r.kind})`); continue; }
    if (r.stage && !STAGES.includes(r.stage)) { res.errors.push(`${line}: 단계는 ${STAGES.join('/')} 중 하나여야 합니다 (${r.stage})`); continue; }
    if (seen.has(phoneNorm) || (await db.client.findFirst({ where: { phoneNorm }, select: { id: true } }))) { res.duplicates++; seen.add(phoneNorm); continue; }
    seen.add(phoneNorm);
    if (!dryRun) { const c = await db.client.create({ data: { code: tmpCode(), name: r.name, phone: r.phone, phoneNorm, kind: r.kind || '매수', company: r.company || null, wantRegion: r.wantRegion || null, channel: r.channel || null, stage: r.stage || '신규 문의', memo: r.memo || null, assigneeId: userId, createdById: userId } }); await db.client.update({ where: { id: c.id }, data: { code: codeFor('CL', c.id) } }); }
    res.added++;
  }
  return res;
}
export const CLIENT_TEMPLATE = '﻿고객명,연락처,구분,회사명,희망지역,유입경로,단계,메모\r\n홍길동,010-1234-5678,매수,예시상사,남양주시,블로그,상담,공장 부지 문의\r\n';
