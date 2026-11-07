/* eslint-disable @next/next/no-img-element */
// 센타부동산 / 땅폴레옹 로고. 파일은 public/brand/logo.png (로그인 전에도 보이도록 미들웨어에서 허용)
export function BrandMark({ size = 56 }: { size?: number }) {
  return <img src="/brand/logo.png" alt="땅폴레옹 센타부동산 로고" width={Math.round(size * 453 / 458)} height={size} style={{ height: size, width: 'auto' }} />;
}
export function Brand() {
  return (
    <div className="mb-4 flex items-center gap-2 px-1">
      <BrandMark size={56} />
      <div className="leading-tight"><div className="text-base font-extrabold text-brand-ink">센타부동산</div><div className="text-[0.75rem] text-gray-500">땅폴레옹 · REALTY OS</div></div>
    </div>
  );
}
