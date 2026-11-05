"""영문 라벨·한글용 고정 굵기 글꼴을 만든다.

SUIT 가변 글꼴을 굵기 400, 700 두 개로 고정해 각각 저장한다. 글자는 전부 남긴다.
SUIT는 Reserved Font Name이 있는 OFL이라 수정본은 다른 이름(TtaengKr)을 쓴다.

사용법 (호스트에 fontTools가 없으므로 일회용 컨테이너에서):
  docker run --rm -v "$PWD":/w -w /w python:3.12-slim sh -c "pip install -q fonttools brotli && python scripts/make-kr-font.py src/assets/fonts/SUIT-Variable.woff2 src/assets/fonts"
SUIT-Variable.woff2는 저장소에서 지웠다. 필요하면 다음으로 꺼낸다.
  git show 4e74af9:src/assets/fonts/SUIT-Variable.woff2 > src/assets/fonts/SUIT-Variable.woff2
"""
import os
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FAMILY = "TtaengKr"
WEIGHTS = {400: "Regular", 700: "Bold"}
# 이 ID들은 원본 저작권·제작자 정보라 SUIT 표기를 그대로 둔다.
KEEP_IDS = {0, 7, 8, 9, 11, 13, 14}
DROP_IDS = {16, 17, 21, 22, 25}


def make(src: str, outdir: str, weight: int, style: str) -> None:
    font = TTFont(src)
    cmap_before = set(font.getBestCmap())
    outline = "CFF2" if "CFF2" in font else "glyf" if "glyf" in font else "?"
    print(f"원본 아웃라인: {outline}")

    axes = {a.axisTag: a.defaultValue for a in font["fvar"].axes}
    axes["wght"] = weight
    font = instancer.instantiateVariableFont(font, axes)

    assert "fvar" not in font and "gvar" not in font, "가변 테이블이 남았다"
    if "STAT" in font:
        del font["STAT"]
    assert set(font.getBestCmap()) == cmap_before, "cmap이 바뀌었다"

    os2 = font["OS/2"]
    os2.usWeightClass = weight
    sel = os2.fsSelection & ~((1 << 0) | (1 << 5) | (1 << 6))
    sel |= (1 << 5) if weight == 700 else (1 << 6)
    os2.fsSelection = sel
    head = font["head"]
    head.macStyle = (head.macStyle & ~1) | (1 if weight == 700 else 0)

    name = font["name"]
    name.names = [r for r in name.names if r.nameID not in DROP_IDS]
    for rec in name.names:
        if rec.nameID == 1:
            rec.string = FAMILY
        elif rec.nameID == 2:
            rec.string = style
        elif rec.nameID == 4:
            rec.string = f"{FAMILY} {style}"
        elif rec.nameID == 6:
            rec.string = f"{FAMILY}-{style}"
        elif rec.nameID == 3:
            rec.string = f"{FAMILY}-{style}-ttaeng"
    for rec in name.names:
        if rec.nameID not in KEEP_IDS:
            assert "SUIT" not in rec.toUnicode(), f"name ID {rec.nameID}에 SUIT가 남았다"

    for tag in ("CFF ", "CFF2"):
        if tag in font:
            cff = font[tag].cff
            top = cff[cff.fontNames[0]]
            cff.fontNames = [f"{FAMILY}-{style}"]
            if hasattr(top, "FullName"):
                top.FullName = f"{FAMILY} {style}"
            if hasattr(top, "FamilyName"):
                top.FamilyName = FAMILY

    out = os.path.join(outdir, f"{FAMILY}-{style}.woff2")
    font.flavor = "woff2"
    font.save(out)
    count = len(TTFont(out).getBestCmap())
    print(f"{out}: {os.path.getsize(out) / 1024:.1f}KB, cmap {count}개 (원본 {len(cmap_before)}개)")


def main(src: str, outdir: str) -> None:
    for weight, style in WEIGHTS.items():
        make(src, outdir, weight, style)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
