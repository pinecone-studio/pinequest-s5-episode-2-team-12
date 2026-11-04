"""DPO for Suu: teach the model to prefer the good reply of each pair in ai/out/dpo/{train,val}.jsonl.

Runs on Colab (T4) after the SFT training, on top of its LoRA adapter:

    !pip install unsloth
    !python ai/train/dpo.py --adapter suu_v2/lora --pairs ai/out/dpo --out suu_dpo

Policy = base + SFT adapter (trainable). Reference = the same adapter, frozen (TRL's ref_model=None with PEFT
uses the model with the adapter switched off, which would be the *base* model — wrong reference for us, so we
load a frozen copy instead). beta 0.1, 1 epoch, small LR: DPO only nudges the SFT model, it doesn't retrain it.

Before/after it prints the preference accuracy on val: how often the model gives the chosen reply a higher
log-probability than the rejected one. That is the number to report (EVAL.md), next to the live checks.
"""

from __future__ import annotations

import argparse
import json
import os
from collections import Counter


def read_jsonl(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def to_text_rows(pairs: list[dict], tokenizer) -> list[dict]:
    """TRL accepts the conversational format directly, but rendering the chat template ourselves keeps the
    exact prompt format the app sends (system + user) and lets us drop pairs that are too long."""
    rows = []
    for p in pairs:
        prompt = tokenizer.apply_chat_template(p["prompt"], tokenize=False, add_generation_prompt=True)
        chosen = p["chosen"][0]["content"] + tokenizer.eos_token
        rejected = p["rejected"][0]["content"] + tokenizer.eos_token
        rows.append({"prompt": prompt, "chosen": chosen, "rejected": rejected, "kind": p["kind"]})
    return rows


def preference_accuracy(model, tokenizer, rows: list[dict], limit: int = 120) -> dict:
    """Share of pairs where log p(chosen | prompt) > log p(rejected | prompt), overall and per kind."""
    import torch

    model.eval()
    wins, per = Counter(), Counter()

    def logp(prompt: str, reply: str) -> float:
        p_ids = tokenizer(prompt, add_special_tokens=False, return_tensors="pt").input_ids
        r_ids = tokenizer(reply, add_special_tokens=False, return_tensors="pt").input_ids
        ids = torch.cat([p_ids, r_ids], dim=1).to(model.device)
        with torch.no_grad():
            logits = model(ids).logits[0, :-1].float()
        target = ids[0, 1:]
        lp = torch.log_softmax(logits, -1).gather(1, target[:, None])[:, 0]
        return lp[p_ids.shape[1] - 1 :].sum().item()

    for r in rows[:limit]:
        per[r["kind"]] += 1
        if logp(r["prompt"], r["chosen"]) > logp(r["prompt"], r["rejected"]):
            wins[r["kind"]] += 1
    total = sum(per.values())
    out = {"all": round(100 * sum(wins.values()) / max(total, 1), 1)}
    out.update({k: round(100 * wins[k] / per[k], 1) for k in per})
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--adapter", required=True, help="folder with the SFT LoRA (adapter_config.json)")
    ap.add_argument("--pairs", default="ai/out/dpo")
    ap.add_argument("--out", default="suu_dpo")
    ap.add_argument("--beta", type=float, default=0.1)
    ap.add_argument("--lr", type=float, default=5e-6)
    ap.add_argument("--epochs", type=float, default=1.0)
    ap.add_argument("--max-len", type=int, default=2048)
    ap.add_argument("--limit", type=int, default=0, help="use only the first N train pairs (quick check)")
    args = ap.parse_args()

    from datasets import Dataset
    from peft import PeftModel
    from trl import DPOConfig, DPOTrainer
    from unsloth import FastLanguageModel

    cfg = json.load(open(os.path.join(args.adapter, "adapter_config.json")))
    base = cfg["base_model_name_or_path"]
    print("base:", base, "· adapter:", args.adapter)

    model, tokenizer = FastLanguageModel.from_pretrained(model_name=base, max_seq_length=args.max_len, load_in_4bit=True)
    model = PeftModel.from_pretrained(model, args.adapter, is_trainable=True)
    ref, _ = FastLanguageModel.from_pretrained(model_name=base, max_seq_length=args.max_len, load_in_4bit=True)
    ref = PeftModel.from_pretrained(ref, args.adapter, is_trainable=False)
    ref.eval()

    train = to_text_rows(read_jsonl(os.path.join(args.pairs, "train.jsonl")), tokenizer)
    val = to_text_rows(read_jsonl(os.path.join(args.pairs, "val.jsonl")), tokenizer)
    if args.limit:
        train = train[: args.limit]
    print("pairs:", len(train), "train ·", len(val), "val ·", dict(Counter(r["kind"] for r in train)))

    FastLanguageModel.for_inference(model)
    before = preference_accuracy(model, tokenizer, val)
    print("preference accuracy before:", before)
    FastLanguageModel.for_training(model)

    config = DPOConfig(
        output_dir=args.out,
        beta=args.beta,
        learning_rate=args.lr,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=8,
        lr_scheduler_type="cosine",
        warmup_ratio=0.1,
        max_length=args.max_len,
        max_prompt_length=args.max_len // 2,
        logging_steps=10,
        save_strategy="no",
        report_to="none",
        fp16=True,
        remove_unused_columns=False,
    )
    keep = ["prompt", "chosen", "rejected"]
    trainer = DPOTrainer(
        model=model,
        ref_model=ref,
        args=config,
        train_dataset=Dataset.from_list([{k: r[k] for k in keep} for r in train]),
        eval_dataset=Dataset.from_list([{k: r[k] for k in keep} for r in val]),
        processing_class=tokenizer,
    )
    trainer.train()

    FastLanguageModel.for_inference(model)
    after = preference_accuracy(model, tokenizer, val)
    print("preference accuracy after:", after)

    model.save_pretrained(os.path.join(args.out, "lora"))
    tokenizer.save_pretrained(os.path.join(args.out, "lora"))
    with open(os.path.join(args.out, "dpo_report.json"), "w", encoding="utf-8") as f:
        json.dump({"before": before, "after": after, "pairs": len(train), "beta": args.beta, "lr": args.lr}, f, indent=2)
    print("saved:", os.path.join(args.out, "lora"))


if __name__ == "__main__":
    main()
