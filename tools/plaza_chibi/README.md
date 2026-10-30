# 3D 광장 캐릭터 만들기

`src/plaza/chibi.glb`(교직원 캐릭터)를 블렌더 파이썬으로 만드는 스크립트.

1. `python face.py` — 얼굴 그림(눈 뜸·감음·말하기 3칸) `face.png`
2. 블렌더 5.x 파이썬(bpy)으로 `chibi.py` 실행 → `src/plaza/chibi.glb`
   - 예: `pip install bpy` 한 가상환경에서 `python chibi.py`
   - 또는 블렌더에서 `blender -b -P chibi.py`

들어 있는 것: 몸(스킨+서브디비전), 머리 모양 6종(short·bob·pony·bun·curly·side), 안경, 조리모·모자,
넥타이·공무원증, 뼈대, 동작(idle·walk·wave·talk). 색은 3D 광장에서 재질 이름별로 바꿈.
