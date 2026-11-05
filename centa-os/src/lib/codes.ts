import { randomUUID } from 'node:crypto';
// 업무 번호(CT-000123, CL-000045)는 DB가 부여하는 고유 id에서 만든다.
// '건수+1' 방식은 삭제·동시 등록·가져오기가 섞이면 번호가 중복되므로 쓰지 않는다.
export const tmpCode = () => 'TMP-' + randomUUID();
export const codeFor = (prefix: 'CT' | 'CL', id: number) => `${prefix}-${String(id).padStart(6, '0')}`;
