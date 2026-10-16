"""Build our small original grid display alphabet. Body text uses system fonts."""
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from pathlib import Path
patterns={
'A':'01110 11011 11011 11111 11011 11011 11011','B':'11110 11011 11011 11110 11011 11011 11110','C':'01111 11000 11000 11000 11000 11000 01111','D':'11110 11011 11011 11011 11011 11011 11110','E':'11111 11000 11000 11110 11000 11000 11111','F':'11111 11000 11000 11110 11000 11000 11000','G':'01111 11000 11000 11011 11011 11011 01111','H':'11011 11011 11011 11111 11011 11011 11011','I':'11111 00100 00100 00100 00100 00100 11111','J':'00111 00011 00011 00011 11011 11011 01110','K':'11011 11011 11110 11100 11110 11011 11011','L':'11000 11000 11000 11000 11000 11000 11111','M':'11011 11111 11111 11011 11011 11011 11011','N':'11011 11111 11111 11111 11011 11011 11011','O':'01110 11011 11011 11011 11011 11011 01110','P':'11110 11011 11011 11110 11000 11000 11000','Q':'01110 11011 11011 11011 11011 11110 00111','R':'11110 11011 11011 11110 11100 11011 11011','S':'01111 11000 11000 01110 00011 00011 11110','T':'11111 00100 00100 00100 00100 00100 00100','U':'11011 11011 11011 11011 11011 11011 01110','V':'11011 11011 11011 11011 11011 01110 00100','W':'11011 11011 11011 11011 11111 11111 01010','X':'11011 11011 01110 00100 01110 11011 11011','Y':'11011 11011 01110 00100 00100 00100 00100','Z':'11111 00011 00110 01100 11000 11000 11111','.':'00000 00000 00000 00000 00000 00110 00110','?':'01110 11011 00011 00110 00100 00000 00100','!':'00100 00100 00100 00100 00100 00000 00100',' ':'00000 00000 00000 00000 00000 00000 00000'}
fb=FontBuilder(1000,isTTF=True)
names=['.notdef']+[f'g{i}' for i in range(len(patterns))]
fb.setupGlyphOrder(names);glyphs={};metrics={};cmap={}
pen=TTGlyphPen(None);glyphs['.notdef']=pen.glyph();metrics['.notdef']=(600,0)
for i,(char,pattern) in enumerate(patterns.items()):
 name=f'g{i}';pen=TTGlyphPen(None)
 for y,row in enumerate(pattern.split()):
  for x,c in enumerate(row):
   if c=='1':
    xx=x*100;yy=(6-y)*100
    pen.moveTo((xx,yy));pen.lineTo((xx+100,yy));pen.lineTo((xx+100,yy+100));pen.lineTo((xx,yy+100));pen.closePath()
 glyphs[name]=pen.glyph();metrics[name]=(350 if char==' ' else 600,0);cmap[ord(char)]=name
 if char.isalpha():cmap[ord(char.lower())]=name
fb.setupCharacterMap(cmap);fb.setupGlyf(glyphs);fb.setupHorizontalMetrics(metrics);fb.setupHorizontalHeader(ascent=850,descent=-150)
fb.setupNameTable({'familyName':'Harbor Pixel','styleName':'Regular','uniqueFontIdentifier':'MULTIGAME Harbor Pixel 1','fullName':'Harbor Pixel','psName':'HarborPixel','version':'Version 1.0'})
fb.setupOS2(sTypoAscender=850,sTypoDescender=-150,usWinAscent=850,usWinDescent=150);fb.setupPost();fb.setupMaxp();fb.save(Path(__file__).resolve().parent.parent/'public/fonts/harbor-pixel.ttf')
