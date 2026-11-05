import { requireUser } from '@/lib/auth';
import { ClientForm } from '@/components/client-form';
import { saveClient } from '@/app/actions';
export default async function NewClient() { await requireUser('client.write'); return <div><h1 className="mb-3 text-xl font-bold">고객 등록</h1><ClientForm action={saveClient.bind(null, null)} /></div>; }
