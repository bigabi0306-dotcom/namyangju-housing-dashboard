import Link from 'next/link';
export default function NotFound() {
  return <div className="mx-auto mt-20 max-w-md space-y-3 rounded-xl border bg-white p-6 text-center"><h1 className="text-lg font-bold">찾을 수 없는 페이지입니다</h1><p className="text-sm text-gray-600">주소가 바뀌었거나 삭제된 항목일 수 있습니다.</p><Link href="/" className="btn">홈으로</Link></div>;
}
