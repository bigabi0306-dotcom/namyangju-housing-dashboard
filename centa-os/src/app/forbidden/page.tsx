import Link from 'next/link';
export default function Forbidden() { return <div className="p-10 text-center"><h1 className="text-lg font-bold">접근 권한이 없습니다</h1><p className="mt-2 text-sm text-gray-500">이 메뉴는 허용된 역할만 사용할 수 있습니다.</p><Link href="/" className="btn mt-4">홈으로</Link></div>; }
