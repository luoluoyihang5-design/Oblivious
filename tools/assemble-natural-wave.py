"""Assemble eight generated waving inbetweens, retaining natural upper-body motion."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import json

ROOT = Path(__file__).resolve().parents[1]
sheet = Image.open(ROOT/'generated_images/wave-natural-sheet.png').convert('RGBA')
cw,ch = sheet.width//4,sheet.height//2
gutter=round(cw*.04)
raw = [sheet.crop((i%4*cw+gutter,i//4*ch,(i%4+1)*cw+gutter,(i//4+1)*ch)) for i in range(8)]
box=(int(cw*.32),int(ch*.78),int(cw*.68),int(ch*.98))
def features(im):
    v=np.asarray(im).astype(np.float32)
    a=v[...,3:4]/255
    return v[...,:3]*a+238*(1-a)
ref=features(raw[0].crop(box))
aligned=[raw[0]]
for frame in raw[1:]:
    best=(float('inf'),0)
    for dx in range(-40,41):
        candidate=features(frame.crop((box[0]-dx,box[1],box[2]-dx,box[3])))
        error=float(np.mean(np.abs(ref-candidate)))
        if error<best[0]: best=(error,dx)
    shifted=Image.new('RGBA',(cw,ch))
    shifted.alpha_composite(frame,(best[1],0))
    aligned.append(shifted)
# Anchor the feet/skirt hem only. Shoulders, head, hair and waving arm retain their generated motion.
mask=Image.new('L',(cw,ch))
ImageDraw.Draw(mask).rectangle((0,0,cw,int(ch*.77)),fill=255)
mask=mask.filter(ImageFilter.GaussianBlur(6))
frames=[]
factor=min(352/cw,476/ch)
size=(round(cw*factor),round(ch*factor))
for frame in aligned:
    registered=Image.composite(frame,aligned[0],mask)
    canvas=Image.new('RGBA',(384,512))
    canvas.alpha_composite(registered.resize(size,Image.Resampling.LANCZOS),((384-size[0])//2,512-size[1]-16))
    frames.append(canvas)
atlas=Image.new('RGBA',(384*4,512*2),'#eee8f4')
for i,frame in enumerate(frames): atlas.alpha_composite(frame,(i%4*384,i//4*512))
atlas.save(ROOT/'generated_images/wave-natural-review.png')
palette=atlas.convert('RGB').quantize(colors=255)
encoded=[]
for frame in frames:
    p=frame.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE)
    p.paste(255,mask=frame.getchannel('A').point(lambda a:255 if a<100 else 0))
    p.info['transparency']=255
    encoded.append(p)
durations=[100]*8
target=ROOT/'assets/dragon-wave.gif'
encoded[0].save(target,save_all=True,append_images=encoded[1:],duration=durations,loop=0,transparency=255,disposal=2,optimize=False)
check=Image.open(target)
assert check.n_frames==8
assert len(set(f.tobytes() for f in frames))==8
for i in range(8):
    check.seek(i)
    assert check.info['duration']==100
print(json.dumps({'frames':8,'frameMs':100,'cycleMs':800,'actionMs':2400,'size':[384,512],'bytes':target.stat().st_size}))
