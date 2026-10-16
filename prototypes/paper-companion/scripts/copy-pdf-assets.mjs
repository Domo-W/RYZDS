import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = dirname(require.resolve("pdfjs-dist/package.json"));
await mkdir("public", { recursive: true });
for (const asset of ["cmaps", "standard_fonts", "wasm"])
  await cp(resolve(root, asset), resolve("public", asset), { recursive: true });
await cp(
  resolve(root, "build/pdf.worker.min.mjs"),
  "public/pdf.worker.min.mjs",
);
await cp(resolve(root, "LICENSE"), "public/PDFJS-LICENSE.txt");
