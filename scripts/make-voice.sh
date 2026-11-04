#!/bin/sh
# 사용: VOICE=Yuna sh scripts/make-voice.sh
set -eu
VOICE="${VOICE:-Yuna}"; OUT=public/voice; TMP="$(mktemp -d)"; mkdir -p "$OUT"
gen() { say -v "$VOICE" -r 220 -o "$TMP/$1.aiff" "$2"; afconvert -f m4af -d aac@44100 -b 96000 "$TMP/$1.aiff" "$OUT/$1.m4a"; }
gen count3 "삼"; gen count2 "이"; gen count1 "일"; gen work "시작"; gen rest "휴식"; gen end "끝"
rm -rf "$TMP"; ls -l "$OUT"
