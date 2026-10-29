# ai/serve — Суу-г laptop дээр ажиллуулж вэбсайтад холбох

Вэбсайт Суу-тай `OLLAMA_URL`-аар ярьдаг (`src/server/ai/ollama-client.ts`). Загвар git-д байна:
[`ai/models/suu-v1/`](../models/suu-v1/README.md) — сургасан adapter (60 MB). Бүтэн загварыг (`suu.gguf`, ~6.2 GB)
`build-model.sh` анх удаа нэг л удаа угсарна (Qwen-ий албан ёсны файлыг татаад adapter-тай нэгтгэнэ).

## Нэг удаа

1. Xcode Command Line Tools (`xcode-select --install`; `git` ажиллаж байвал бий). Homebrew заавал биш: дундын
   Mac дээр (жишээ нь Pinecone-ийн iMac, Homebrew өөр хэрэглэгчийнх) скрипт Ollama, cloudflared, cmake-ийг албан
   ёсны GitHub release-ээс `~/.suu/tools` руу татна — admin эрх хэрэггүй.
2. Mac-ийг унтуулахгүй: System Settings → Battery → Options → *Prevent automatic sleeping on power adapter when
   the display is off*. Цэнэглэгчтэй байлга.

## Асаах

```bash
cd pinequest-s5-episode-2-team-12 && git pull
bash ai/serve/start.sh                       # git-ийн suu-v1, tunnel-тэй (вэбсайт өөр газар байршсан бол)
bash ai/serve/start.sh --local               # вэбсайт энэ Mac дээр `bun dev`-ээр ажиллаж байвал
bash ai/serve/start.sh ~/Downloads/suu-v1    # Drive-аас татсан бэлэн хавтас (Modelfile + suu.gguf)
```

Скрипт: Ollama, cloudflared, Bun байхгүй бол суулгана → (анх удаа) `build-model.sh`: llama.cpp-ийн merge хэрэгсэл
бүтээх ~2–5 мин, Qwen татах ~3.6 GB, нэгтгэх ~1–3 мин → `ollama create suu` → туршилтын асуулт → нууц түлхүүртэй
хаалга (`proxy.ts`) → Cloudflare tunnel → эцэст нь:

```
OLLAMA_URL=https://….trycloudflare.com
OLLAMA_TOKEN=…
OLLAMA_MODEL=suu
OLLAMA_SKILLS=desmos
```

`OLLAMA_SKILLS` = загварын сурсан чадварууд (`build.env`-ийн `SKILLS`). v1 зөвхөн Desmos хичээл сурсан тул AI багшийн
чат демо хариугаа хэвээр өгнө, Desmos Академи (`/desmos/ai`) Суу-гаар хичээл бичнэ (сурагч зөв хариугаа оруулна).

Эдгээрийг вэбсайтын хостинг дээр (Vercel → Settings → Environment Variables) тавиад **redeploy** хийнэ.
`~/.suu/website.env`-д хадгалагдана. Terminal цонхыг хаавал Суу унтарна, вэбсайт демо хариу руу буцна.

## Аюулгүй байдал

- Tunnel-ийн URL нийтэд нээлттэй тул шууд Ollama биш `proxy.ts`-ээр дамжина: зөвхөн `POST /api/chat`,
  `GET /api/version`, зөвхөн `suu` загвар, зөвхөн `Authorization: Bearer <OLLAMA_TOKEN>`-тэй хүсэлт. `pull`,
  `delete`, `create` гэх мэтийг гаднаас хийх боломжгүй.
- Токен `~/.suu/token`-д (зөвхөн эзэмшигч уншина). Хэзээ ч git, чат руу бүү хуулаарай. Солих бол файлыг устгаад
  скриптийг дахин ажиллуул (вэбсайтын `OLLAMA_TOKEN`-ийг мөн солино).

## Анхаарах

- Cloudflare quick tunnel-ийн URL скриптийг дахин асаах бүрт **өөрчлөгдөнө** → вэбсайтын `OLLAMA_URL`-ийг
  шинэчилнэ. Тогтмол URL хэрэгтэй бол Cloudflare account + домэйнтэй named tunnel ашиглана.
- Хурд: 3B загвар Apple Silicon Mac дээр Desmos хичээлийг ~10–30 секундэд бичнэ (хүсэлт бүр дээд тал нь 55 сек,
  route-ийн `maxDuration = 60`). Олон сурагч зэрэг хэрэглэвэл дараалалд орно (нэг laptop = жижиг демо).
- Desmos хичээлийг сурагчид харуулахаас өмнө `src/features/tutor/lib/desmos-lesson-parse.ts` шалгана (JSON,
  Desmos item-ийн хэлбэр, монгол текст, хариу таарах). Шалгалт унавал хуудас «Жишээ хичээл» / мессеж харуулна.
