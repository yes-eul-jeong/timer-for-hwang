"""앱 아이콘 SVG를 만든다. 확정 시안: https://claude.ai/artifact/8qk6R2QbAWS1Fiky3SpMLD (A3)

검은 바탕 가운데 큰 초록 H, 아래 초록 띠 안에 검은 TIMER.
글자는 Pretendard Black을 가로 65%로 좁힌 모양(숫자 글꼴과 같은 비율)이고,
글꼴 파일 없이 보이도록 외곽선 경로로 바꿔 넣는다.

- public/icon.svg: 일반 아이콘(PNG, 파비콘, 애플 홈 화면 아이콘의 원본)
- scripts/icon-maskable.svg: 안드로이드 마스커블. 원형으로 잘려도 띠 아래 검은 틈이 없게
  띠를 아래 끝까지 채우고, 글자만 가운데 80% 안전 영역 안으로 줄인다.

PNG는 scripts/make-icons.mjs가 이 SVG로 만든다.

사용법 (저장소 루트에서):
  docker run --rm -v "$PWD":/w -v ttaeng_node_modules:/nm:ro -w /w python:3.12-slim sh -c \
    "pip install -q fonttools && python scripts/make-icons.py /nm/pretendard/dist/public/static/Pretendard-Black.otf"
  docker compose -f docker/compose.yml run --rm app node scripts/make-icons.mjs
"""
import sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

SIZE = 512
SCALE_X = 0.65
BG = "#0A0A0A"
ACCENT = "#00FF85"
ON_ACCENT = "#000000"

# 시안은 300px 판에서 잡았다. 512px로 옮길 때 곱한다.
K = SIZE / 300

# (글자 크기 px, 자간 em, 가운데 x, 가운데 y)
NORMAL = {
    "band_top": 208 * K,
    "H": (210 * K, 0, SIZE / 2, 208 * K / 2),
    "TIMER": (80 * K, 0.02, SIZE / 2, (208 + 300) / 2 * K),
}
MASKABLE = {
    "band_top": 196 * K,
    "H": (168 * K, 0, SIZE / 2, 113 * K),
    "TIMER": (64 * K, 0.02, SIZE / 2, 233 * K),
}


def fmt(v: float) -> str:
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s == "-0" else s


def text_path(font: TTFont, text: str, size: float, tracking: float, cx: float, cy: float) -> str:
    """글자 외곽선의 실제 테두리 상자를 (cx, cy)에 맞춰 가운데 놓은 SVG path d."""
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    s = size / font["head"].unitsPerEm

    def layout(dx: float, dy: float):
        x = 0.0
        for i, ch in enumerate(text):
            name = cmap[ord(ch)]
            # 글꼴 좌표(y 위)를 SVG 좌표(y 아래)로, 가로는 65%
            yield name, (s * SCALE_X, 0, 0, -s, dx + x, dy)
            x += hmtx[name][0] * s * SCALE_X
            if i < len(text) - 1:
                x += tracking * size

    bounds = BoundsPen(gs)
    for name, m in layout(0, 0):
        gs[name].draw(TransformPen(bounds, m))
    x0, y0, x1, y1 = bounds.bounds
    dx = cx - (x0 + x1) / 2
    dy = cy - (y0 + y1) / 2

    pen = SVGPathPen(gs, ntos=fmt)
    for name, m in layout(dx, dy):
        gs[name].draw(TransformPen(pen, m))
    return pen.getCommands()


def svg(font: TTFont, spec: dict) -> str:
    top = spec["band_top"]
    h = text_path(font, "H", *spec["H"])
    timer = text_path(font, "TIMER", *spec["TIMER"])
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">\n'
        f'  <rect width="{SIZE}" height="{SIZE}" fill="{BG}"/>\n'
        f'  <rect y="{fmt(top)}" width="{SIZE}" height="{fmt(SIZE - top)}" fill="{ACCENT}"/>\n'
        f'  <path fill="{ACCENT}" d="{h}"/>\n'
        f'  <path fill="{ON_ACCENT}" d="{timer}"/>\n'
        "</svg>\n"
    )


def main(src: str) -> None:
    font = TTFont(src)
    with open("public/icon.svg", "w") as f:
        f.write(svg(font, NORMAL))
    with open("scripts/icon-maskable.svg", "w") as f:
        f.write(svg(font, MASKABLE))


if __name__ == "__main__":
    main(sys.argv[1])
