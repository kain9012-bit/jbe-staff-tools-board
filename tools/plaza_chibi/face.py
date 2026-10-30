# 얼굴 그림 아틀라스: [눈 뜸 | 눈 감음 | 말하기] 3칸, 각 512×512, 투명 바탕
from PIL import Image, ImageDraw, ImageFilter
S = 512
def px(x, z):  # 머리 좌표(m, 머리 중심 기준) → 그림 좌표
    R = 0.36
    return ((x / R + 1) / 2 * S, (1 - (z / R + 1) / 2) * S)
def frame(kind):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    # 볼터치(흐리게)
    bl = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(bl)
    for sx in (-1, 1):
        cx, cy = px(sx * 0.205, -0.085)
        d.ellipse([cx - 34, cy - 17, cx + 34, cy + 17], fill=(255, 128, 150, 120))
    bl = bl.filter(ImageFilter.GaussianBlur(7)); im.alpha_composite(bl)
    d = ImageDraw.Draw(im)
    for sx in (-1, 1):
        cx, cy = px(sx * 0.122, -0.015)
        if kind == 'blink':
            d.arc([cx - 30, cy - 10, cx + 30, cy + 26], 200, 340, fill=(42, 30, 28, 255), width=8)
        else:
            d.ellipse([cx - 30, cy - 42, cx + 30, cy + 42], fill=(36, 26, 26, 255))
            d.ellipse([cx - 24, cy - 6, cx + 24, cy + 38], fill=(92, 58, 44, 255))   # 홍채 아래 밝게
            d.ellipse([cx - 18, cy + 4, cx + 18, cy + 34], fill=(140, 92, 66, 255))
            d.ellipse([cx - 8 + sx * 2, cy - 4, cx + 8 + sx * 2, cy + 12], fill=(36, 26, 26, 255))  # 동공
            d.ellipse([cx - 4 + 8, cy - 30, cx + 16 + 8, cy - 10], fill=(255, 255, 255, 255))  # 큰 빛
            d.ellipse([cx - 16, cy + 16, cx - 8, cy + 24], fill=(255, 255, 255, 230))
            # 속눈썹
            d.arc([cx - 34, cy - 46, cx + 34, cy + 10], 200, 340, fill=(30, 22, 22, 255), width=6)
        # 눈썹
        bx, by = px(sx * 0.125, 0.09)
        d.arc([bx - 30, by - 8, bx + 30, by + 22], 205, 335, fill=(70, 48, 40, 255), width=7)
    mx, my = px(0, -0.118)
    if kind == 'talk':
        d.chord([mx - 20, my - 12, mx + 20, my + 22], 0, 180, fill=(150, 50, 60, 255))
        d.chord([mx - 12, my + 4, mx + 12, my + 20], 0, 180, fill=(240, 120, 130, 255))
    else:
        d.arc([mx - 18, my - 18, mx + 18, my + 10], 30, 150, fill=(130, 60, 60, 255), width=6)
    return im
atlas = Image.new('RGBA', (S * 3, S), (0, 0, 0, 0))
for i, k in enumerate(['open', 'blink', 'talk']):
    atlas.paste(frame(k), (i * S, 0))
import os
atlas.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'face.png'))
print('ok')
