"""Build Suu's full model from the exact weights it was trained on.

Suu is trained with QLoRA: the LoRA learns on top of the 4-bit (NF4) Qwen
`unsloth/Qwen2.5-3B-Instruct-unsloth-bnb-4bit`, and the Colab test scores that model. Merging the LoRA into the
ordinary 16-bit Qwen instead gives a different model: through Ollama v2's Desmos lessons fell from 81% to 62.5%
(25% with the Q8_0 base that ai/serve/build-model.sh uses). See ai/models/EVAL.md.

This script dequantizes the NF4 base with numpy (no GPU, no bitsandbytes), adds the LoRA, writes fp16
safetensors one tensor at a time (low RAM) and converts them to GGUF with llama.cpp.

    python ai/train/nf4_merge.py --lora path/to/suu-v2-lora --out suu-v2-nf4 --llama-cpp path/to/llama.cpp

Checks itself: every dequantized matrix is compared with the original 16-bit weights (median relative error must
be small, as NF4 is ~4-bit), and every LoRA target must be merged exactly once.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import shutil
import subprocess

import numpy as np

NF4_STATE = ".quant_state.bitsandbytes__nf4"


def unpack_nibbles(packed: np.ndarray) -> np.ndarray:
    """bitsandbytes packs two 4-bit codes per byte, the first in the high nibble."""
    p = packed.reshape(-1).astype(np.uint8)
    out = np.empty(p.size * 2, dtype=np.uint8)
    out[0::2] = p >> 4
    out[1::2] = p & 0x0F
    return out


def dequant(packed, quant_map, absmax, shape, blocksize, nested=None) -> np.ndarray:
    """NF4 → float32. `nested` = (nested_absmax, nested_quant_map, nested_blocksize, nested_offset) when the
    block scales are themselves 8-bit quantized (double quantization)."""
    if nested is not None:
        n_absmax, n_map, n_bs, offset = nested
        a8 = np.asarray(absmax).astype(np.int64)
        absmax = n_map[a8] * np.repeat(n_absmax, n_bs)[: a8.size] + offset
    n = int(np.prod(shape))
    idx = unpack_nibbles(packed)[:n]
    return (quant_map[idx] * np.repeat(absmax, blocksize)[:n]).reshape(shape).astype(np.float32)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lora", required=True, help="PEFT LoRA folder (adapter_config.json + adapter_model.safetensors)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--base-4bit", default="unsloth/Qwen2.5-3B-Instruct-unsloth-bnb-4bit")
    ap.add_argument("--base", default="Qwen/Qwen2.5-3B-Instruct", help="16-bit original: config, tokenizer, other tensors")
    ap.add_argument("--llama-cpp", help="llama.cpp checkout; when given, also writes GGUF files")
    ap.add_argument("--gguf", default="q8_0,f16")
    a = ap.parse_args()

    import torch
    from huggingface_hub import snapshot_download
    from safetensors import safe_open
    from safetensors.torch import load_file, save_file

    q4 = snapshot_download(a.base_4bit)
    hf = snapshot_download(a.base, allow_patterns=["*.json", "*.txt", "tokenizer*", "*.safetensors"])

    def index(d):
        where = {}
        for f in sorted(glob.glob(f"{d}/*.safetensors")):
            with safe_open(f, "pt") as s:
                for k in s.keys():
                    where[k] = f
        return where

    qi, hi = index(q4), index(hf)

    def get(where, k):
        with safe_open(where[k], "pt") as s:
            return s.get_tensor(k)

    def nf4(prefix):
        st = json.loads(bytes(get(qi, prefix + NF4_STATE).numpy().tolist()).decode())
        nested = None
        if prefix + ".nested_absmax" in qi:
            nested = (get(qi, prefix + ".nested_absmax").float().numpy(), get(qi, prefix + ".nested_quant_map").float().numpy(),
                      st["nested_blocksize"], st["nested_offset"])
            absmax = get(qi, prefix + ".absmax").numpy()
        else:
            absmax = get(qi, prefix + ".absmax").float().numpy()
        return dequant(get(qi, prefix).numpy(), get(qi, prefix + ".quant_map").float().numpy(), absmax, st["shape"],
                       st["blocksize"], nested)

    quant = {k[: -len(NF4_STATE)] for k in qi if k.endswith(NF4_STATE)}
    cfg = json.load(open(os.path.join(a.lora, "adapter_config.json")))
    scale = cfg["lora_alpha"] / cfg["r"]
    lw = load_file(os.path.join(a.lora, "adapter_model.safetensors"))
    lora = {k.split("base_model.model.", 1)[-1].replace(".lora_A.weight", ".weight"): (lw[k], lw[k.replace(".lora_A.", ".lora_B.")])
            for k in lw if ".lora_A." in k}
    print(f"4-bit matrices {len(quant)} · LoRA targets {len(lora)} · scale {scale}", flush=True)
    assert set(lora) <= set(hi), sorted(set(lora) - set(hi))[:3]

    merged_dir = os.path.join(a.out, "hf")
    shutil.rmtree(merged_dir, ignore_errors=True)
    os.makedirs(merged_dir)
    shard, size, n, wmap, errs, merged = {}, 0, 0, {}, [], 0

    def flush():
        nonlocal shard, size, n
        if not shard:
            return
        n += 1
        name = f"model-{n:05d}.safetensors"
        save_file(shard, os.path.join(merged_dir, name), metadata={"format": "pt"})
        for k in shard:
            wmap[k] = name
        shard, size = {}, 0

    for k in sorted(hi):
        ref = get(hi, k)
        if k in quant:
            w = nf4(k)
            r = ref.float().numpy()
            errs.append(float(np.abs(w - r).mean() / (np.abs(r).mean() + 1e-12)))
        else:
            w = ref.float().numpy()
        if k in lora:
            A, B = lora[k]
            w = w + (B.float().numpy() @ A.float().numpy()) * scale
            merged += 1
        t = torch.from_numpy(w).to(torch.float16)
        shard[k] = t
        size += t.numel() * 2
        if size > 2e9:
            flush()
    flush()
    print(f"NF4 vs 16-bit originals, mean relative error: median {np.median(errs):.4f} max {max(errs):.4f}", flush=True)
    assert len(errs) == len(quant) and np.median(errs) < 0.2, "dequantization looks wrong"
    assert merged == len(lora), (merged, len(lora))
    json.dump({"metadata": {}, "weight_map": wmap}, open(os.path.join(merged_dir, "model.safetensors.index.json"), "w"))
    for f in glob.glob(f"{hf}/*.json") + glob.glob(f"{hf}/*.txt"):
        if not f.endswith("model.safetensors.index.json"):
            shutil.copy(f, merged_dir)
    c = json.load(open(os.path.join(merged_dir, "config.json")))
    c["torch_dtype"] = "float16"
    json.dump(c, open(os.path.join(merged_dir, "config.json"), "w"), indent=1)
    print("merged →", merged_dir, flush=True)

    if a.llama_cpp:
        for t in a.gguf.split(","):
            out = os.path.join(a.out, f"suu-{t}.gguf")
            subprocess.run(["python", os.path.join(a.llama_cpp, "convert_hf_to_gguf.py"), merged_dir, "--outtype", t, "--outfile", out], check=True)
            print(t, os.path.getsize(out), "bytes →", out, flush=True)


if __name__ == "__main__":
    main()
