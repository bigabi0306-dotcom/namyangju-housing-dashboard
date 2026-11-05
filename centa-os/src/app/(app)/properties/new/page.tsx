import { requireUser } from '@/lib/auth';
import { PropertyForm } from '@/components/property-form';
import { saveProperty } from '@/app/actions';
export default async function NewProperty() {
  const me = await requireUser('property.write');
  return <div><h1 className="mb-3 text-xl font-bold">매물 등록</h1><PropertyForm action={saveProperty.bind(null, null)} canOwner={me.role === 'OWNER' || me.role === 'AGENT'} /></div>;
}
