'use client';
import Link from 'next/link';
// 예상치 못한 서버 오류 화면. 내부 정보는 보여주지 않고, 로그를 찾을 수 있는 오류 번호(digest)만 안내한다.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-3 rounded-xl border bg-white p-6 text-center">
      <h1 className="text-lg font-bold">문제가 발생했습니다</h1>
      <p className="text-sm text-gray-600">요청을 처리하는 중 오류가 생겼습니다. 입력하신 내용은 저장되지 않았을 수 있으니 확인해 주세요. 같은 문제가 반복되면 아래 오류 번호를 관리자에게 알려주세요.</p>
      {error.digest && <p className="rounded bg-gray-100 p-2 font-mono text-xs">오류 번호: {error.digest}</p>}
      <div className="flex justify-center gap-2"><button className="btn" onClick={() => reset()}>다시 시도</button><Link href="/" className="btn-ghost">홈으로</Link></div>
    </div>
  );
}
