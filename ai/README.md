# ai/ — Section H

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

## Суу fine-tune (жижиг модель) — одоо ажиллаж байгаа зам

**Qwen2.5-1.5B-Instruct + LoRA**, Colab T4 дээр сургаж, Ollama-аар ажиллуулна.

1. `bun ai/train/export.ts` → `ai/data/tuning/train.jsonl` (~2,460), `val.jsonl` (~370), `eval.jsonl` (81).
   Эх сурвалж: манай 32 асуулт + `ai/pipeline/generate.ts`-ийн 24 загвар (alg, adv, psda, geo — тоонууд санамсаргүй,
   хариуг код тооцоолно, hint-д хариу орвол хасна) + `ai/pipeline/general.ts` (42 англи үг, SAT формат, мэндчилгээ, сэдвээс гадуур).
   Яриан төрлүүд: hint, explain, multi (hint → гацсан → бүтэн тайлбар), wrong (буруу хариуг "зөв" гэхгүй), check,
   similar, translate, mistake, desmos, general. Train / val / eval нэг ч асуулт хуваалцахгүй (тест шалгана).
2. `ai/train/suu_finetune.ipynb`-ийг Colab-д нээж (T4 GPU) **Run all** → base vs fine-tuned үнэлгээ
   (`eval_report.md`: хариу зөв %, hint leak %, false praise %, монгол % — гараар бичсэн ба загварын асуултаар тусад нь) → `suu.zip` (GGUF + Modelfile) татна.
3. Laptop дээр: `cd suu && ollama create suu -f Modelfile`
4. `.env.local`: `OLLAMA_URL=http://localhost:11434`, `OLLAMA_MODEL=suu` → `/api/tutor` Суу-г ашиглана
   (`model: 'suu'`). Ollama унтарсан үед 503 буцааж, чат «Суу одоогоор холбогдохгүй байна» гэж харуулна.

Сургалтын system prompt (`export.ts`) ба апп-ийн prompt (`src/server/tutor/ollama.ts`) ижил байх ёстой — тест шалгана.
Notebook нь цорын ганц Python хэсэг (GPU сургалтад Unsloth хэрэгтэй).

Ажиллуулах: `bun run ai:build` · `bun run ai:eval` · тест `bun test ai`.

Математик шалгалт B хэсгийн `src/features/desmos/lib/expr.ts`-ийг шууд import хийнэ (B1 дууссаны дараа).

**Лиценз:** College Board-ын материал (Bluebook practice test, Question Bank) зохиогчийн эрхтэй.
H1 дээр ашиглах нөхцөлийг шалгаж, зөвшөөрөлгүй эх сурвалжийг `allowed: false` болгоно —
`ingest.ts` ийм эх сурвалжийг уншихгүй.

## Хэрэглэгчээс суралцах (аюулгүй)

Сурагчийн бичсэн зүйл **шууд** сургалтад орохгүй — сурагч алдаатай тайлбар бичиж болно.

1. Апп: `FeedbackButtons` (👍/👎 + "илүү зөв тайлбар") → `POST /api/tutor/feedback` → Supabase `tutor_feedback`
   (migration `0003`, RLS: сурагч зөвхөн нэмнэ) эсвэл dev үед `ai/data/feedback/inbox.jsonl` (git-д орохгүй).
2. Автомат шалгалт — `bun ai/pipeline/feedback.ts`: мэдэгдэх асуултад зөв хариу байгаа эсэх, hint-д хариу орсон эсэх,
   монгол эсэх, хувийн мэдээлэл (утас, имэйл, регистр, URL), заавар өөрчлөх оролдлого, давхардал.
3. Хүн батална — `approve <id>` / `reject <id> --note "…"` (шалгалт унасан бол `--force` хэрэгтэй).
4. `export` → `ai/data/tuning/feedback.jsonl` → notebook-д `MODE = "update"`: өмнөх Суу (`suu_lora.zip`)-аас үргэлжлүүлж,
   шинэ санал + хуучин 300 жишээгээр ~5–10 минут сургана. 👎 бөгөөд тайлбаргүй саналууд багшид "хэцүү тохиолдол" болж үлдэнэ.

## Суу-г вэбсайтад холбох

`/api/tutor` (чат) ба `/api/desmos/lesson` (Desmos Академи, `/desmos/ai`) нь `src/server/ai/ollama-client.ts`-ээр
Ollama-тай ярьна. Чадвар бүр өөрийн system prompt-той (`src/server/ai/prompts.ts` = сургалтын prompt, тест шалгана).
Desmos хичээлийг сурагчид харуулахаас өмнө `desmos-lesson-parse.ts` шалгана. Laptop дээр ажиллуулж tunnel-ээр
холбох: [`ai/serve/README.md`](serve/README.md) — `bash ai/serve/start.sh`. Сургасан загварууд git-д:
[`ai/models/`](models/suu-v1/README.md) (adapter + угсрах заавар; бүтэн файл нь `build-model.sh`-ээр угсрагдана).

## Апп дахь бүх AI = Суу

| Хэсэг | Чадвар | Endpoint | Суу унтарсан/алдсан үед |
| --- | --- | --- | --- |
| AI багш Суу (`/tutor`) — чөлөөт чат | `chat` (Суу) эсвэл **Gemini** | `/api/tutor` | Gemini (`GEMINI_API_KEY`) → 503 «Суу одоогоор холбогдохгүй байна» |
| Desmos Академи, бодлогын хажуугийн Desmos самбар | `desmos` | `/api/desmos/lesson` | жишээ хичээл / гараар бичсэн Desmos мөр |
| AI төлөвлөгөө (`/planner`) | `planner` | `/api/suu/planner` | дүрмийн төлөвлөгөө (kit-ийн алтан хариуг гаргадаг дүрэм) |
| Алдааны дэвтэр · «Суугийн дүгнэлт» | `analyze` | `/api/suu/analyze` | дүрмийн дүгнэлт |

Төлөвлөгөө ба дүгнэлт сурагчийн **өөрийн** өгөгдлөөс: `problem_attempts` (сэдэв, зөв/буруу, хугацаа) ба алдааны
дэвтэр — нэвтэрсэн бол сервер Supabase-ээс уншина (RLS), демо бол хөтөч localStorage-оо илгээнэ
(`src/server/ai/student-input.ts` нь яг kit-ийн оролт болгоно). Суугийн JSON-г kit-ийн өөрийн шалгагчаар
(`scorePlan`, `scoreAnalysis`) шалгаж, давсан үед л харуулна. Аль чадварыг асуухыг `OLLAMA_SKILLS` шийднэ
(v1: `desmos`; v2: хоосон = бүгд).

**Чат = Gemini, Desmos = Суу.** Суу-гийн чат чадвар тестээ давахгүй байгаа тул (`OLLAMA_SKILLS`-д `chat` байхгүй) AI багшийн
чөлөөт чатыг Gemini хариулна (`src/server/ai/gemini-chat.ts`). Gemini өөрөө баримт шийддэггүй: сервер асуултын сангаас
бодлогыг олж, сурагчийн хариуг **кодоор** шалгаад ("ЗӨВ"/"БУРУУ") Gemini-д хэлнэ; Desmos самбарт Суу-гийн бичсэн
алхмуудыг (түгжээтэй алхмаас бусад) дамжуулна; зөв хариуг сурагч хариулсан/нээсэн эсвэл бүтэн тайлбар асуусан үед л
өгнө — тэгэхээр hint хариуг задлах боломжгүй. Бөмбөлөг бүр хэн бичснийг шошготой ("Суу (манай загвар)" / "Gemini чат").

## Суу v2 — хоёр дахь сургалт

Апп-ын хэсэг бүрт (AI багш, AI төлөвлөгөө, Алдааны дэвтэр, Desmos Академи) хэрэгтэй чадваруудыг нэг загварт сургана:
`chat`, `stepcheck`, `planner`, `analyze`, `desmos`. Дэлгэрэнгүй: [`ai/v2/README.md`](v2/README.md) · notebook:
`ai/train/suu_v2.ipynb`.
