# Суу v1 — Desmos багш (git дэх загвар)

Qwen2.5-3B-Instruct дээр LoRA-аар сургасан анхны Суу. Сургалтын өгөгдөл: `sat_desmos_kit` (16 Desmos арга, монгол
хэлээр алхам алхмаар хичээл, JSON). Чадвар: **Desmos хичээл** (`/desmos/ai`). Чат, төлөвлөгөө зэрэг бусад чадварыг
v1 сураагүй — тэр нь v2 (`ai/v2/`).

| Файл | Юу вэ |
| --- | --- |
| `suu-v1-lora.gguf` | Сургасан хэсэг (LoRA adapter, f16, 60 MB) |
| `build.env` | Бүтэн загварыг юунаас угсрах: Qwen-ий албан ёсны GGUF (sha256), llama.cpp commit, adapter-ийн sha256 |
| `Modelfile` | Ollama-ийн тохиргоо: Qwen chat template, чатын system prompt, temperature 0.3, `num_ctx 4096` |
| `prompts.json` | Сургалтын prompt-ууд (`chat`, `desmos`) — `src/server/ai/prompts.ts`-тэй яг ижил |

## Яагаад бүтэн загвар git-д байхгүй вэ

Бүтэн загвар 3.3 GB (Drive дахь Q8_0) эсвэл 6.2 GB (энд угсарсан: нэгтгэсэн давхаргууд f16). GitHub 100 MB-аас
том файл хүлээж авдаггүй, Ollama ч LoRA adapter ачаалахаа больсон ("LoRA adapters are no longer supported").
Тиймээс git-д зөвхөн сургасан хэсэг байна, бүтэн загварыг `ai/serve/build-model.sh` компьютер бүр дээр **нэг удаа**
угсарна (Qwen татах ~3.6 GB + нэгтгэх 1–3 мин, ~10 GB сул зай):

```bash
bash ai/serve/start.sh               # угсарна (анх удаа) → Ollama → tunnel; эсвэл:
bash ai/serve/build-model.sh         # зөвхөн угсрах → ~/.suu/models/suu-v1/suu.gguf
```

Drive-д бэлэн угсарсан хувилбар бий (`suu_training/suu-v1/`: `suu.gguf`, `Modelfile`): тэр хавтсыг татсан бол
`bash ai/serve/start.sh ~/Downloads/suu-v1` — угсрах шаардлагагүй.

## Хэрхэн бүтээсэн

1. Colab (T4) дээр QLoRA (4-bit): r=16, alpha=32, бүх linear давхарга, 2 epoch, lr 2e-4 (kit-ийн `train_and_test.ipynb`).
2. Adapter-ийг bf16 base-тэй нэгтгэж → `convert_hf_to_gguf.py --outtype q8_0` → Drive дахь `suu.gguf`.
3. Adapter-ийг `convert_lora_to_gguf.py --outtype f16` → энэ хавтсын `suu-v1-lora.gguf`.
4. `llama-export-lora` (Qwen-ий албан ёсны Q8_0 + adapter) → Ollama → тест. Энэ нь Mac дээр яг давтагдах зам.

## Тест (сургалтад ороогүй асуултууд)

Нэг асуулт (exponential regression, test #24), Colab CPU дээр нэгтгэсэн загвар:

| Шалгалт | Үр дүн |
| --- | --- |
| JSON, бүтэц, арга (technique), монгол текст | ✓ |
| Эцсийн хариу (96) | ✓ |
| Desmos-д ажиллах эсэх | ✗ — хүснэгтийг `D₁, D₂` гэж нэрлээд регрессийг `y₁ ~ a·b^{D₁}` гэж бичсэн (зөв нь `D₂ ~ …`) |

Нэг асуултаар дүгнэхгүй: арга бүрээс нэг (17 асуулт) Ollama дээрх тест явагдаж байна, дүнг энд нэмнэ.
Мэдэгдэж буй сул тал: v1 зөвхөн Desmos хичээл сурсан — энгийн чатад утгагүй хариулдаг ("Сайн уу" → томьёо), тиймээс
вэбсайтад `OLLAMA_SKILLS=desmos` (AI багшийн чат демо хариугаа хэвээр өгнө).
