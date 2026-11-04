"""실행 화면 숫자용 장체 글꼴을 만든다.

Pretendard SemiBold(600)에서 숫자와 시간 표기에 쓰는 글자만 남기고,
모든 글자를 가로 60%로 좁힌다. 느좋체와 같은 방식이다.
Pretendard는 Reserved Font Name이 있는 OFL이라 수정본은 다른 이름(TtaengNum)을 쓴다.

사용법 (fonttools, brotli 필요):
  python3 scripts/make-num-font.py <Pretendard-SemiBold.otf> src/assets/fonts/TtaengNum.woff2
Pretendard-SemiBold.otf는 node_modules/pretendard/dist/public/static/ 에 있다.
"""
import sys

from fontTools import subset
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

SCALE_X = 0.6
TEXT = "0123456789:/.- "
FAMILY = "TtaengNum"


def main(src: str, out: str) -> None:
    font = TTFont(src)

    opts = subset.Options()
    opts.layout_features = ["tnum"]  # 고정폭 숫자만 남긴다. 커닝은 좁힌 폭과 맞지 않아 뺀다.
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(text=TEXT)
    sub.subset(font)

    cff = font["CFF "].cff
    top = cff[cff.fontNames[0]]
    charstrings = top.CharStrings
    hmtx = font["hmtx"]
    glyphset = font.getGlyphSet()
    for name in font.getGlyphOrder():
        width, _ = hmtx[name]
        new_w = round(width * SCALE_X)
        pen = T2CharStringPen(new_w, glyphset)
        glyphset[name].draw(TransformPen(pen, (SCALE_X, 0, 0, 1, 0, 0)))
        cs = pen.getCharString(private=charstrings[name].private, globalSubrs=charstrings[name].globalSubrs)
        charstrings[name] = cs
        hmtx[name] = (new_w, 0)
    top.FontBBox = None  # 저장할 때 다시 계산되도록

    for rec in font["name"].names:
        if rec.nameID in (1, 16):
            rec.string = FAMILY
        elif rec.nameID == 4:
            rec.string = f"{FAMILY} SemiBold"
        elif rec.nameID == 6:
            rec.string = f"{FAMILY}-SemiBold"
        elif rec.nameID == 3:
            rec.string = f"{FAMILY}-SemiBold-ttaeng"
    cff.fontNames = [f"{FAMILY}-SemiBold"]
    top.FullName = f"{FAMILY} SemiBold"
    top.FamilyName = FAMILY

    font.recalcBBoxes = True
    font.flavor = "woff2"
    font.save(out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
