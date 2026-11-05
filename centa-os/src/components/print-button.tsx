'use client';
export function PrintButton() { return <button className="btn no-print" onClick={() => window.print()}>PDF로 저장 / 인쇄</button>; }
