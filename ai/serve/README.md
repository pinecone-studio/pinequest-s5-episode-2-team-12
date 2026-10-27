# ai/serve — Суу-г laptop дээр ажиллуулж вэбсайтад холбох

Вэбсайт Суу-тай `OLLAMA_URL`-аар ярьдаг (`src/server/ai/ollama-client.ts`). Загварын файл (~2 GB) git-д орохгүй —
Colab-ийн `suu_v2.zip`-ээс авна (Google Drive → `suu_training/v2/suu_v2.zip`).

## Нэг удаа

1. Mac-д [Homebrew](https://brew.sh) суулгасан байх.
2. `suu_v2.zip`-ээ **Downloads** дотор задална → `~/Downloads/suu-v2/` (`Modelfile`, `suu.gguf`, `prompts.json`).
3. Mac-ийг унтуулахгүй: System Settings → Battery → Options → *Prevent automatic sleeping on power adapter when
   the display is off*. Цэнэглэгчтэй байлга.

## Асаах

```bash
cd pinequest-s5-episode-2-team-12
bash ai/serve/start.sh            # tunnel-тэй (вэбсайт өөр газар байршсан бол)
bash ai/serve/start.sh --local    # вэбсайт энэ Mac дээр `bun dev`-ээр ажиллаж байвал
```

Скрипт: Ollama, cloudflared, Bun байхгүй бол суулгана → `ollama create suu` → туршилтын асуулт → нууц түлхүүртэй
хаалга (`proxy.ts`) → Cloudflare tunnel → эцэст нь:

```
OLLAMA_URL=https://….trycloudflare.com
OLLAMA_TOKEN=…
OLLAMA_MODEL=suu
```

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
