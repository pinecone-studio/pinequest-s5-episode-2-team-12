# prototype/ — зөвхөн лавлагаа

Дизайны prototype-ийн ажилладаг код (https://claude.ai/artifact/Qa2ruJcMEp3fZ38jzed8AP).
Энд засвар хийхгүй, import хийхгүй — хэрэгтэй хэсгээ өөрийн `src/features/<хэсэг>/` руу хуулж, тест бичээд шилжүүлнэ.

Гол файлууд:
- `src/lib/expr.ts`, `src/lib/graph.ts` — графикийн хөдөлгүүр (B1, B2)
- `src/components/GraphCalc.tsx` — Desmos-маягийн тооцоолуур (B3, B4)
- `src/components/CardArt.tsx`, `src/pages/Cards.tsx` — картууд (E3–E5)
- `src/lib/store.tsx` — XP, streak, Leitner, алдааны давталтын логик (F, E, D)
- `src/services/tutor.ts` — TutorService (G1)
- `src/pages/*` — дэлгэц бүр
