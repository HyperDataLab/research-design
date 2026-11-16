import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

function modules(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? modules(path) : path.endsWith('.module.css') ? [path] : [];
  });
}

it('design system: CSS modules use tokens', () => {
  const violations: string[] = [];
  for (const file of modules(join(process.cwd(), 'src'))) {
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\s*\(/i.test(css)) violations.push(`${file}: colour`);
    for (const match of css.matchAll(
      /\b(font-size|(?:padding|margin)(?:-[\w-]+)?|(?:column-|row-)?gap|border-radius)\s*:\s*([^;{}]+)/g,
    )) {
      const [, property, value = ''] = match;
      const withoutVariables = value.replace(/var\([^)]*\)/g, '');
      if (
        property === 'font-size'
          ? !/^var\(--[\w-]+\)$/.test(value.trim())
          : /(?:^|[^\w.])(?:-?(?:[4-9]|\d{2,})\d*(?:\.\d+)?|\d+\.\d+)px\b|\d+(?:\.\d+)?(?:rem|em)\b/.test(
              withoutVariables,
            )
      )
        violations.push(`${file}: ${property}: ${value}`);
    }
  }
  expect(violations).toEqual([]);
});
