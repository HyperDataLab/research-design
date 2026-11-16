import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';

type Params = Record<string, string | number | boolean>;
export function ParamsEditor({ value, onChange }: { value: Params; onChange: (value: Params) => void }) {
  const [rows, setRows] = useState<[string, string][]>(() =>
    Object.entries(value).map(([key, item]) => [key, String(item)]),
  );
  const update = (next: [string, string][]) => {
    setRows(next);
    const convert = (s: string): string | number | boolean =>
      s === 'true' ? true : s === 'false' ? false : s.trim() && Number.isFinite(Number(s)) ? Number(s) : s;
    onChange(
      Object.fromEntries(next.filter(([key]) => key.trim()).map(([key, item]) => [key, convert(item)])),
    );
  };
  return (
    <>
      {rows.map(([key, item], i) => (
        <div key={i}>
          <TextField
            label="Tên tham số"
            value={key}
            onChange={(e) => update(rows.map((row, n) => (n === i ? [e.target.value, row[1]] : row)))}
          />
          <TextField
            label="Giá trị"
            value={item}
            onChange={(e) => update(rows.map((row, n) => (n === i ? [row[0], e.target.value] : row)))}
          />
          <Button onClick={() => update(rows.filter((_, n) => n !== i))}>Xoá tham số</Button>
        </div>
      ))}
      <Button onClick={() => update([...rows, ['', '']])}>Thêm tham số</Button>
    </>
  );
}
