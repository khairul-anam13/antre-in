// Membuat src/app/tokens.css dari design/tokens.json (iOS Design System).
// Jalankan ulang bila token berubah: npm run tokens
import { readFileSync, writeFileSync } from "node:fs";

const t = JSON.parse(readFileSync("design/tokens.json", "utf8"));
const alias = (v) => v.replace(/\{([\w.-]+)\}/g, "var(--$1)");
const light = [];
const dark = [];

for (const c of t.color.tokens) {
  const v = typeof c.value === "string" ? { light: c.value } : c.value;
  light.push(`  --${c.name}: ${alias(v.light)};`);
  if (v.dark && v.dark !== v.light) dark.push(`  --${c.name}: ${alias(v.dark)};`);
}
for (const fam of ["spacing", "radius", "size", "opacity", "shadow"]) {
  for (const s of t[fam]?.tokens ?? []) {
    const v = typeof s.value === "string" ? { light: s.value } : s.value;
    light.push(`  --${s.name}: ${v.light};`);
    if (v.dark && v.dark !== v.light) dark.push(`  --${s.name}: ${v.dark};`);
  }
}
for (const [k, v] of Object.entries(t.type.families)) light.push(`  --font-${k}: ${v};`);

const css = `/* GENERATED dari design/tokens.json oleh scripts/gen-tokens.mjs — jangan diedit manual. */
:root {
  color-scheme: light dark;
${light.join("\n")}
}
@media (prefers-color-scheme: dark) {
  :root {
${dark.map((l) => "  " + l).join("\n")}
  }
}
`;
writeFileSync("src/app/tokens.css", css);
console.log(`tokens.css: ${light.length} light, ${dark.length} dark`);
