# Assemble generated blink cells into a registered six-frame looping GIF.
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
sheet=Image.open('generated_images/exec-754b511c-420d-4340-8920-17feb3aa69c6.png').convert('RGBA')
w,h=sheet.size
cells=[sheet.crop((round(i*w/3),0,round((i+1)*w/3),h)).resize((683,683),Image.Resampling.LANCZOS) for i in range(3)]
base=cells[0]
mask=Image.new('L',base.size);d=ImageDraw.Draw(mask)
d.polygon([(245,269),(487,316),(480,387),(252,348)],fill=255)
mask=mask.filter(ImageFilter.GaussianBlur(5))
registered=[base]+[Image.composite(c,base,mask) for c in cells[1:]]
# The generated sheet has a left gutter; trim that gutter so her hand rests on the screen edge.
registered=[c.crop((108,0,683,683)).resize((287,341),Image.Resampling.LANCZOS) for c in registered]
registered[0].save('assets/dragon-peek.png')
palette=registered[0].convert('RGB').quantize(colors=255)
frames=[]
for i in [0,1,2,2,1,0]:
    rgba=registered[i];p=rgba.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE)
    p.paste(255,mask=rgba.getchannel('A').point(lambda a:255 if a<100 else 0))
    p.info['transparency']=255;frames.append(p)
frames[0].save('assets/dragon-peek.gif',save_all=True,append_images=frames[1:],duration=[2860,60,100,50,70,70],loop=0,transparency=255,disposal=2,optimize=False)
print('Assembled peek blink',Image.open('assets/dragon-peek.gif').n_frames,'encoded frames; fixed body')
