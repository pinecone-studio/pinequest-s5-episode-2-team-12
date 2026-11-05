"""python ai/train/dpo_test.py  — CPU check of dpo.py's helpers (no GPU, no unsloth/trl needed).

Uses a tiny random GPT-2 so it runs in seconds: checks the chat-template rendering and that preference accuracy
really compares log p(chosen) with log p(rejected) (a pair whose two replies are equal can never be a win).
"""

import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(__file__))
from dpo import preference_accuracy, read_jsonl, to_text_rows  # noqa: E402


class FakeTok:
    eos_token = "</s>"

    def apply_chat_template(self, messages, tokenize=False, add_generation_prompt=False):
        text = "".join(f"<{m['role']}>{m['content']}" for m in messages)
        return text + ("<assistant>" if add_generation_prompt else "")


PAIR = {
    "id": "x",
    "kind": "verdict-wrong",
    "prompt": [{"role": "system", "content": "S"}, {"role": "user", "content": "Q (Шалгагч: буруу)"}],
    "chosen": [{"role": "assistant", "content": "Яг биш."}],
    "rejected": [{"role": "assistant", "content": "Зөв байна!"}],
}


def test_read_and_render():
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "t.jsonl")
        with open(p, "w", encoding="utf-8") as f:
            f.write(json.dumps(PAIR, ensure_ascii=False) + "\n\n")
        rows = read_jsonl(p)
    assert len(rows) == 1
    [r] = to_text_rows(rows, FakeTok())
    assert r["prompt"] == "<system>S<user>Q (Шалгагч: буруу)<assistant>"
    assert r["chosen"] == "Яг биш.</s>" and r["rejected"] == "Зөв байна!</s>"
    assert r["kind"] == "verdict-wrong"


def test_preference_accuracy_on_tiny_model():
    import torch
    from transformers import GPT2Config, GPT2LMHeadModel, GPT2TokenizerFast

    torch.manual_seed(0)
    model = GPT2LMHeadModel(GPT2Config(n_layer=1, n_head=2, n_embd=32, vocab_size=300, n_positions=128))

    class Tok:
        """Byte-level ids in [0, 256): enough for a random model."""

        def __call__(self, text, add_special_tokens=False, return_tensors="pt"):
            ids = list(text.encode("utf-8"))[:100] or [0]

            class Out:
                input_ids = torch.tensor([ids])

            return Out()

    same = {"prompt": "<user>Q<assistant>", "chosen": "abc", "rejected": "abc", "kind": "k"}
    acc = preference_accuracy(model, Tok(), [same] * 3)
    assert acc == {"all": 0.0, "k": 0.0}, acc  # equal replies are never a strict win

    # a reply that is a strict prefix-extension has lower total log-prob (each token adds a negative term)
    longer = {"prompt": "<user>Q<assistant>", "chosen": "ab", "rejected": "ab" + "z" * 40, "kind": "k"}
    assert preference_accuracy(model, Tok(), [longer])["all"] == 100.0
    _ = GPT2TokenizerFast  # imported to make sure transformers is the real package


if __name__ == "__main__":
    test_read_and_render()
    test_preference_accuracy_on_tiny_model()
    print("ok")
