import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { relatedOptions } from '@/lib/options';
import { ContractForm } from '@/components/contract-form';
import { saveContract } from '@/app/actions-contract';
export default async function NewContract() {
  const me = await requireUser('contract.write');
  return <div><h1 className="mb-3 text-xl font-bold">계약 등록</h1><ContractForm action={saveContract.bind(null, null)} opts={await relatedOptions()} canFee={can(me.role, 'settlement.write')} /></div>;
}
