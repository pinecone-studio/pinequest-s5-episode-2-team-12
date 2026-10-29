"""python -m pytest ai/train/nf4_merge_test.py  (or: python ai/train/nf4_merge_test.py)"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from nf4_merge import dequant, unpack_nibbles  # noqa: E402

# the 16 NF4 code values bitsandbytes uses
NF4 = np.array([-1.0, -0.6961928, -0.52507305, -0.39491749, -0.28444138, -0.18477343, -0.09105004, 0.0,
                0.0795803, 0.1609302, 0.2461123, 0.33791524, 0.44070983, 0.562617, 0.72295684, 1.0], dtype=np.float32)


def quantize(w, bs=64):
    """Reference NF4 quantizer (nearest code per block, absmax scale), packing high nibble first."""
    flat = w.reshape(-1)
    absmax = np.abs(flat.reshape(-1, bs)).max(axis=1)
    norm = flat / np.repeat(absmax, bs)
    idx = np.abs(norm[:, None] - NF4[None, :]).argmin(axis=1).astype(np.uint8)
    packed = (idx[0::2] << 4) | idx[1::2]
    return packed.astype(np.uint8), absmax.astype(np.float32)


def test_nibble_order():
    assert unpack_nibbles(np.array([0x1F], dtype=np.uint8)).tolist() == [1, 15]


def test_round_trip_is_close():
    rng = np.random.default_rng(0)
    w = rng.normal(0, 0.02, size=(32, 128)).astype(np.float32)
    packed, absmax = quantize(w)
    d = dequant(packed, NF4, absmax, list(w.shape), 64)
    rel = np.abs(d - w).mean() / np.abs(w).mean()
    assert d.shape == w.shape and rel < 0.15, rel


def test_double_quantized_scales():
    rng = np.random.default_rng(1)
    w = rng.normal(0, 0.02, size=(16, 512)).astype(np.float32)
    packed, absmax = quantize(w)
    offset = float(absmax.mean())
    n_map = np.linspace(-1, 1, 256).astype(np.float32)
    n_absmax = np.array([np.abs(absmax - offset).max()], dtype=np.float32)
    a8 = np.abs((absmax - offset)[:, None] / n_absmax[0] - n_map[None, :]).argmin(axis=1).astype(np.uint8)
    d = dequant(packed, NF4, a8, list(w.shape), 64, nested=(n_absmax, n_map, 256, offset))
    assert np.abs(d - w).mean() / np.abs(w).mean() < 0.2


if __name__ == "__main__":
    for f in (test_nibble_order, test_round_trip_is_close, test_double_quantized_scales):
        f()
    print("ok")
