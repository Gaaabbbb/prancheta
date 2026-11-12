"""Gera os ícones do Prancheta (tela inicial do celular): campo verde com linhas brancas sobre fundo escuro."""
import math
import struct
import sys
import zlib


def png(path, n):
    bg = (10, 18, 32)
    grass = (31, 122, 69)
    grass2 = (27, 110, 62)
    line = (236, 241, 236)
    yellow = (255, 210, 63)
    px = [[bg] * n for _ in range(n)]
    m = n * 0.14  # margem até o campo
    x0, x1, y0, y1 = m, n - m, n * 0.08, n - n * 0.08
    w = max(2, round(n * 0.018))  # espessura das linhas
    cx, cy = n / 2, n / 2
    r = n * 0.13
    for y in range(n):
        for x in range(n):
            if x0 <= x <= x1 and y0 <= y <= y1:
                stripe = int((y - y0) / ((y1 - y0) / 8)) % 2
                c = grass if stripe == 0 else grass2
                on_border = min(x - x0, x1 - x, y - y0, y1 - y) < w
                mid = abs(y - cy) < w / 2
                circ = abs(math.hypot(x - cx, y - cy) - r) < w / 2
                # grandes áreas
                bw, bh = (x1 - x0) * 0.5, (y1 - y0) * 0.16
                ax0, ax1 = cx - bw / 2, cx + bw / 2
                area_top = (ax0 <= x <= ax1 and abs(y - (y0 + bh)) < w / 2) or (
                    abs(x - ax0) < w / 2 or abs(x - ax1) < w / 2
                ) and y0 <= y <= y0 + bh
                area_bot = (ax0 <= x <= ax1 and abs(y - (y1 - bh)) < w / 2) or (
                    abs(x - ax0) < w / 2 or abs(x - ax1) < w / 2
                ) and y1 - bh <= y <= y1
                if on_border or mid or circ or area_top or area_bot:
                    c = line
                # bola amarela no centro
                if math.hypot(x - cx, y - cy) < n * 0.045:
                    c = yellow
                px[y][x] = c
    raw = b''.join(b'\x00' + bytes(v for p in row for v in p) for row in px)

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)

    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', n, n, 8, 2, 0, 0, 0))
    data += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(data)


out = sys.argv[1] if len(sys.argv) > 1 else 'public'
for size in (180, 192, 512):
    png(f'{out}/icon-{size}.png', size)
print('ok')
