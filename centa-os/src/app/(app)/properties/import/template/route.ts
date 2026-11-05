import { requireUser } from '../../../../../lib/auth';
import { TEMPLATE_CSV } from '../../../../../lib/import';
export async function GET() {
  await requireUser('property.write');
  return new Response(TEMPLATE_CSV, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="centa_import_template.csv"' } });
}
