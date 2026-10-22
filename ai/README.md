# ai/ — Section H (TypeScript + Bun, no Python)

Суугийн fine-tune хийх өгөгдөл, сургалт, үнэлгээ. Апп-тай нэг repo, нэг `bun install`.

```
ai/
  schema.ts                zod: SourceQuestion, Dialogue, TuningExample (H2–H4 өргөтгөнө)
  data/sources.json        эх сурвалж + лиценз (H1). Түүхий файл → ai/data/raw/ (git-д орохгүй)
  pipeline/ingest.ts       PDF/HTML/CSV → SourceQuestion[]   (H2: pdfjs-dist, cheerio)
  pipeline/build-dialogues.ts  асуулт → 4–6 монгол яриа         (H3: @google/genai)
  train/export.ts          → ai/out/train.jsonl, val.jsonl    (H4)
  train/tune.ts            Vertex AI supervised tuning job    (H4)
  eval/run.ts              → ai/out/eval_report.md            (H5)
```

**Төлөв:** AI pipeline, fine-tuning болон evaluation хараахан хэрэгжээгүй. `bun run ai:build`, `bun run ai:eval` командууд одоогоор ажиллахгүй.

Математик шалгалт B хэсгийн `src/features/desmos/lib/expr.ts`-ийг шууд import хийнэ (B1 дууссаны дараа).

**Лиценз:** College Board-ын материал (Bluebook practice test, Question Bank) зохиогчийн эрхтэй.
H1 дээр ашиглах нөхцөлийг шалгаж, зөвшөөрөлгүй эх сурвалжийг `allowed: false` болгоно —
`ingest.ts` ийм эх сурвалжийг уншихгүй.
