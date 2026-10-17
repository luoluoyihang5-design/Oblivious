"""Encode generated, articulated keyframes. Never rotate/scale a whole sprite to fake an action."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import json

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'wave': ('exec-e6d3c12d-9f50-4ad9-90ce-d5e5d14cf569.png', 4, [300] * 8),
    'tilt': ('exec-1e2d87d9-faeb-4d32-ba7b-3a1fcc46cb4b.png', 3, [350, 350, 700, 650, 350, 400]),
    'stretch': ('exec-8306e70c-8f16-4172-8ef1-380573b32a41.png', 3, [350, 400, 450, 1250, 500, 450]),
}
SIZE = (384, 512)
report = {}
for name, (filename, cols, durations) in SOURCES.items():
    sheet = Image.open(ROOT / 'generated_images' / filename).convert('RGBA')
    cw, ch = sheet.width // cols, sheet.height // 2
    raw = [sheet.crop((i % cols * cw, i // cols * ch, (i % cols + 1) * cw, (i // cols + 1) * ch)) for i in range(cols * 2)]
    # One scale for the entire sequence; fixed bottom/torso anchors, not per-frame zoom.
    factor = 450 / (ch * .96)
    cells = []
    for cell in raw:
        solid = cell.getchannel('A').point(lambda a: 255 if a >= 100 else 0)
        lower = solid.crop((0, round(ch * .7), cw, ch))
        box = lower.getbbox()
        if not box:
            raise ValueError('Missing character lower-body anchor')
        cx = (box[0] + box[2]) / 2
        bottom = ch * .7 + box[3]
        resized = cell.resize((round(cw * factor), round(ch * factor)), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', SIZE)
        canvas.alpha_composite(resized, (round(192 - cx * factor), round(500 - bottom * factor)))
        cells.append(canvas)
    base = cells[0]
    if name in ('wave', 'tilt'):
        mask = Image.new('L', SIZE)
        draw = ImageDraw.Draw(mask)
        if name == 'wave':
            # Only the raised hand and forearm change. Face, torso, feet and wings are identical pixels.
            draw.rectangle((55, 130, 145, 255), fill=255)
        else:
            # Head/neck articulation only; keep the upright lower torso and skirt fixed.
            draw.rectangle((0, 0, 383, 212), fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(3))
        cells = [base] + [Image.composite(cell, base, mask) for cell in cells[1:]]
    # Shared palette prevents color shimmer. Binary alpha is a GIF format constraint.
    contact = Image.new('RGB', (384 * cols, 512 * 2))
    for i, cell in enumerate(cells):
        contact.paste(cell.convert('RGB'), (i % cols * 384, i // cols * 512))
    palette = contact.quantize(colors=255)
    frames = []
    for cell in cells:
        frame = cell.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE)
        frame.paste(255, mask=cell.getchannel('A').point(lambda a: 255 if a < 100 else 0))
        frame.info['transparency'] = 255
        frames.append(frame)
    target = ROOT / 'assets' / f'dragon-{name}.gif'
    frames[0].save(target, save_all=True, append_images=frames[1:], duration=durations, loop=0, transparency=255, disposal=2, optimize=False)
    check = Image.open(target)
    assert check.n_frames >= 4, f'{name} must animate'
    if name == 'wave':
        fixed = cells[0].crop((160, 260, 384, 512)).tobytes()
        assert all(fixed == c.crop((160, 260, 384, 512)).tobytes() for c in cells)
    preview = Image.new('RGBA', (384 * cols, 512 * 2), '#e8e2ef')
    for i, cell in enumerate(cells):
        preview.alpha_composite(cell, (i % cols * 384, i // cols * 512))
    preview.save(ROOT / 'generated_images' / f'{name}-review.png')
    report[name] = {'frames': check.n_frames, 'durationMs': sum(durations), 'size': SIZE, 'bytes': target.stat().st_size}
print(json.dumps(report, indent=2))
