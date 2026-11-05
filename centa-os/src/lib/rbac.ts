export const ROLES = {
  OWNER: '대표 관리자', AGENT: '공인중개사', ASSISTANT: '중개보조 업무 담당자', CONTENT: '콘텐츠 담당자', VIEWER: '조회 전용 사용자',
} as const;
export type RoleKey = keyof typeof ROLES;
const ALL = ['property.read','property.write','property.owner_info','client.read','client.write','work.read','work.write','calendar.read','calendar.write','contract.read','contract.write','settlement.read','settlement.write','content.read','content.write','analysis.read','analysis.write','stats.read','settings.write','audit.read','export'];
export const ROLE_PERMS: Record<RoleKey, string[]> = {
  OWNER: ALL,
  AGENT: ['property.read','property.write','property.owner_info','client.read','client.write','work.read','work.write','calendar.read','calendar.write','contract.read','contract.write','content.read','content.write','analysis.read','analysis.write','stats.read','export'],
  ASSISTANT: ['property.read','property.write','client.read','client.write','work.read','work.write','calendar.read','calendar.write','analysis.read'],
  CONTENT: ['property.read','content.read','content.write','calendar.read','analysis.read','work.read'],
  VIEWER: ['property.read','client.read','work.read','calendar.read','content.read','analysis.read','stats.read'],
};
export const can = (role: string, perm: string) => (ROLE_PERMS[role as RoleKey] ?? []).includes(perm);
