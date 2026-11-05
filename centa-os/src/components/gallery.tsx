'use client';
import { useActionState, startTransition } from 'react';
import { uploadPropertyImages } from '@/app/actions-upload';
export function UploadForm({ propertyId }: { propertyId: number }) {
  const [s, fn, pending] = useActionState(uploadPropertyImages.bind(null, propertyId), null);
  return <form onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form); startTransition(() => { fn(fd); form.reset(); }); }} className="flex flex-wrap items-end gap-2">
    <label className="text-xs">사진 선택 (JPG·PNG·WEBP, 장당 8MB, 한 번에 10장)<input type="file" name="files" accept="image/jpeg,image/png,image/webp" multiple className="block text-sm" /></label>
    <label className="text-xs">종류<select name="kind" className="input !w-28"><option value="photo">사진</option><option value="drone">드론</option></select></label>
    <button className="btn" disabled={pending}>{pending ? '올리는 중…' : '업로드'}</button>
    {s?.error && <p role="alert" className="w-full rounded-lg bg-red-50 p-2 text-sm text-red-700">{s.error}</p>}{s?.ok && <p role="status" className="w-full text-sm text-green-700">업로드되었습니다.</p>}</form>;
}
