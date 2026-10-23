"""Google encoded polyline format (precision 5), compact and trivially decoded in the app."""

import numpy as np

PRECISION = 1e5


def encode(lonlat: np.ndarray) -> str:
    """Encode (lon, lat) points; the format stores (lat, lon) pairs."""
    scaled = np.round(lonlat[:, ::-1] * PRECISION).astype(np.int64)
    deltas = np.diff(scaled, axis=0, prepend=np.zeros((1, 2), dtype=np.int64))
    return "".join(_encode_value(int(value)) for value in deltas.ravel())


def decode(encoded: str) -> np.ndarray:
    values, index = [], 0
    while index < len(encoded):
        value, index = _decode_value(encoded, index)
        values.append(value)
    latlon = np.cumsum(np.array(values, dtype=np.int64).reshape(-1, 2), axis=0) / PRECISION
    return latlon[:, ::-1]


def _encode_value(value: int) -> str:
    value = ~(value << 1) if value < 0 else value << 1
    chunks = []
    while value >= 0x20:
        chunks.append(chr((0x20 | (value & 0x1F)) + 63))
        value >>= 5
    chunks.append(chr(value + 63))
    return "".join(chunks)


def _decode_value(encoded: str, index: int) -> tuple[int, int]:
    result, shift = 0, 0
    while True:
        byte = ord(encoded[index]) - 63
        index += 1
        result |= (byte & 0x1F) << shift
        shift += 5
        if byte < 0x20:
            break
    return (~(result >> 1) if result & 1 else result >> 1), index
