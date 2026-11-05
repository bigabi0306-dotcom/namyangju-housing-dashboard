import { requireUser } from '@/lib/auth';
import { CLIENT_TEMPLATE } from '@/lib/import-clients';
export async function GET() {
  await requireUser('client.write');
  return new Response(CLIENT_TEMPLATE, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="centa_clients_template.csv"' } });
}
