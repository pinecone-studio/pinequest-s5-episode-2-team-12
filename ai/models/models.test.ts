import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CHAT_PROMPT, DESMOS_PROMPT } from '../../src/server/ai/prompts';

// Every trained model kept in git must rebuild exactly (ai/serve/build-model.sh) and use the app's prompts.
const MODELS = readdirSync(import.meta.dir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => join(import.meta.dir, d.name));

function readEnv(text: string) {
  const env: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

test('there is at least one model', () => {
  expect(MODELS.length).toBeGreaterThan(0);
});

for (const dir of MODELS) {
  describe(dir.split('/').pop() ?? dir, () => {
    test('build.env pins everything build-model.sh needs', async () => {
      const env = readEnv(await Bun.file(join(dir, 'build.env')).text());
      expect(env.BASE_URL).toStartWith('https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/');
      expect(env.BASE_SHA256).toMatch(/^[0-9a-f]{64}$/);
      expect(env.ADAPTER_SHA256).toMatch(/^[0-9a-f]{64}$/);
      expect(env.LLAMA_CPP_COMMIT).toMatch(/^[0-9a-f]{40}$/);
      for (const s of (env.SKILLS ?? '').split(',').filter(Boolean))
        expect(['chat', 'desmos', 'planner', 'analyze']).toContain(s);
    });

    test('the adapter in git is the exact file that was tested', async () => {
      const env = readEnv(await Bun.file(join(dir, 'build.env')).text());
      const bytes = await Bun.file(join(dir, env.ADAPTER)).arrayBuffer();
      expect(createHash('sha256').update(new Uint8Array(bytes)).digest('hex')).toBe(env.ADAPTER_SHA256);
    });

    test('Modelfile loads the locally built suu.gguf with the Qwen chat template and the chat prompt', async () => {
      const mf = await Bun.file(join(dir, 'Modelfile')).text();
      expect(mf.split('\n')[0]).toBe('FROM ./suu.gguf');
      expect(mf).not.toContain('ADAPTER');
      expect(mf).toContain('<|im_start|>');
      expect(mf).toContain(`SYSTEM "${CHAT_PROMPT.replaceAll('"', '\\"')}"`);
    });

    test('prompts.json is the same as the app prompts', async () => {
      const p = await Bun.file(join(dir, 'prompts.json')).json();
      expect(p.chat).toBe(CHAT_PROMPT);
      expect(p.desmos).toBe(DESMOS_PROMPT);
    });
  });
}
