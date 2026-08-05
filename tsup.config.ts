import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['ts/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node18',
  // The wasm-pack glue loads the .wasm from its own directory — it must
  // stay an external runtime require/import, never be bundled.
  external: [/\.\.\/pkg\/canboat_wasm\.js$/, '@canboat/ts-pgns']
})
