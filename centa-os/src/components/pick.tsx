export function Pick({ name, label, items, def, empty = '선택 안 함' }: { name: string; label: string; items: { id: number; label: string }[]; def?: number | null; empty?: string }) {
  return <label className="block"><span className="label">{label}</span><select name={name} defaultValue={def ?? ''} className="input"><option value="">{empty}</option>{items.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</select></label>;
}
