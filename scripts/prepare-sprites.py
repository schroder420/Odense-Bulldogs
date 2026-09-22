#!/usr/bin/env python3
"""Klargør genererede spillersprites til spillet. Kræver Pillow: pip3 install pillow

  python3 scripts/prepare-sprites.py

Tre ting sker:
  1. Løsrevne halvgennemsigtige klatter fjernes. Generatoren efterlader af og til en
     grå udtværing ude på isen, som ellers ville følge spilleren rundt.
  2. Billedet centreres på spillerens KROP, ikke på staven. Staven kan række langt ud i
     et hjørne, og uden det her ville spilleren stå forskudt i forhold til sin egen
     position i spillet, så man ville ramme forbi, når man trykker på ham.
  3. Skaleres til 384 x 384 og gemmes som WebP.
"""
from PIL import Image, ImageFilter
from collections import deque
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets-source'          # originalerne, som IKKE bliver deployet
ASSETS = ROOT / 'public' / 'assets'      # det spillet henter
CANVAS = 1440   # plads omkring kroppen, så staven ikke bliver skåret af ved centrering
OUTPUT = 384
NAMES = ['bulldogs-glide', 'bulldogs-stride', 'opponent-glide', 'opponent-stride',
         'bulldogs-glide-v6', 'bulldogs-receive-v6', 'opponent-receive-v6']
# Forfra-billeder bruges ikke i spillet, men i personalepanelet, hvor farverne vælges.
# De beskæres til figuren og fylder rammen ud, så dragten kan ses ordentligt.
FRONTS = ['opponent-front']
FRONT_OUTPUT = 512

def largest_region(alpha, step=6, floor=200):
    """Den største sammenhængende klump af solide pixels, målt på et nedskaleret gitter."""
    w, h = alpha.size
    small = alpha.resize((w // step, h // step))
    px = small.load(); sw, sh = small.size
    seen = [[False] * sh for _ in range(sw)]
    best = []
    for x in range(sw):
        for y in range(sh):
            if seen[x][y] or px[x, y] < floor:
                continue
            q = deque([(x, y)]); seen[x][y] = True; region = []
            while q:
                cx, cy = q.popleft(); region.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < sw and 0 <= ny < sh and not seen[nx][ny] and px[nx, ny] >= floor:
                        seen[nx][ny] = True; q.append((nx, ny))
            if len(region) > len(best):
                best = region
    keep = Image.new('L', (sw, sh), 0)
    kp = keep.load()
    for x, y in best:
        kp[x, y] = 255
    # Udvid, så figurens egen bløde kant og tynde stav overlever oprydningen.
    keep = keep.filter(ImageFilter.MaxFilter(5)).resize((w, h), Image.BILINEAR)
    return keep.point(lambda v: 255 if v > 24 else 0)

def body_centre(alpha):
    """Tyngdepunkt efter kraftig erosion, så tynde ting som staven ikke trækker i det."""
    solid = alpha.point(lambda v: 255 if v > 200 else 0)
    for _ in range(3):
        solid = solid.filter(ImageFilter.MinFilter(9))
    px = solid.load(); w, h = solid.size
    sx = sy = n = 0
    for x in range(0, w, 2):
        for y in range(0, h, 2):
            if px[x, y]:
                sx += x; sy += y; n += 1
    if not n:
        return w / 2, h / 2
    return sx / n, sy / n

def prepare(name):
    source = SOURCE / f'{name}.png'
    if not source.exists():
        print(f'  springer over, mangler {source.name}'); return
    im = Image.open(source).convert('RGBA')
    alpha = im.getchannel('A')
    keep = largest_region(alpha)
    before = sum(1 for v in alpha.getdata() if v > 24)
    im.putalpha(Image.eval(Image.merge('L', [alpha]), lambda v: v).point(lambda v: v))
    cleaned = Image.new('RGBA', im.size, (0, 0, 0, 0))
    cleaned.paste(im, (0, 0), keep)
    removed = before - sum(1 for v in cleaned.getchannel('A').getdata() if v > 24)
    cx, cy = body_centre(cleaned.getchannel('A'))
    # Front-facing sticks extend below the body anchor. Keep the entire blade inside the canvas.
    bounds = cleaned.getchannel('A').getbbox()
    extent = max(cx - bounds[0], bounds[2] - cx, cy - bounds[1], bounds[3] - cy)
    side = max(CANVAS, int(extent * 2) + 24)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(cleaned, (round(side / 2 - cx), round(side / 2 - cy)))
    out = canvas.resize((OUTPUT, OUTPUT), Image.LANCZOS)
    target = ASSETS / f'{name}.webp'
    out.save(target, 'WEBP', quality=82, method=6)
    print(f'  {name:17} kropscentrum ({cx:.0f},{cy:.0f})  fjernet {removed} løse px  ->  {target.name} {target.stat().st_size // 1024} KB')

def prepare_front(name):
    source = SOURCE / f'{name}.png'
    if not source.exists():
        print(f'  springer over, mangler {source.name}'); return
    im = Image.open(source).convert('RGBA')
    keep = largest_region(im.getchannel('A'))
    cleaned = Image.new('RGBA', im.size, (0, 0, 0, 0))
    cleaned.paste(im, (0, 0), keep)
    box = cleaned.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    figure = cleaned.crop(box)
    side = max(figure.size) + 16
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.paste(figure, ((side - figure.width) // 2, (side - figure.height) // 2))
    out = square.resize((FRONT_OUTPUT, FRONT_OUTPUT), Image.LANCZOS)
    target = ASSETS / f'{name}.webp'
    out.save(target, 'WEBP', quality=84, method=6)
    print(f'  {name:17} beskåret til {figure.size}  ->  {target.name} {target.stat().st_size // 1024} KB')

if __name__ == '__main__':
    print('Klargør sprites:')
    for n in NAMES:
        prepare(n)
    for n in FRONTS:
        prepare_front(n)
