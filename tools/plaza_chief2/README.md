# 교육감 캐릭터(chief.glb) — 참고영상 10단계 그대로

3D 광장 「천호성 교육감」. 참고영상(3D캐릭터 만들기 영상)의 순서를 따름. 모두 CPU로 돌림(GPU 없음).
닮음 점수 = ArcFace 얼굴 인식 코사인 유사도, 실제 사진 9장 평균(`pipeline/arc.py`). 9장은 만들 때 쓴 사진과 같은 게시물 사진을 뺀 것.

| 단계 | 스크립트 | 결과 |
|---|---|---|
| ① 그림 | `compose.py`(정장 몸 렌더 + 사진 머리 밑그림) → `gen.py`(sd-turbo img2img 18장) | 가장 닮은 1장 0.52 |
| ② 안경 벗기기 | `noglass.py`(테 자국 인페인트) | 0.51 |
| ③ 형상 빚기 | `run_tsg.py`(TripoSG 50단계, 잠재값 저장) → `decode.py`(VAE만 올려 메시로) | 전신 형상 |
| ④ 깎기 | `sculpt.py`(앞모습 윤곽 정렬 + 윤곽선 따라 RBF 변형) | 윤곽 일치 94% → 98% |
| ⑤ 색 입히기 | `uv2.py`(4만 면·UV) → `bake2.py`(정면 그림 투영, 뒤·옆은 머리카락·옷 가장자리 색) | |
| ⑦ 사진 결 | `phototex.py`(실제 사진 안경 지우고 얼굴 특징점 TPS로 그림 얼굴에) | 그림 0.68 |
| ⑤′ 옆·뒤 | `views.py`(옆·뒤·사선 7방향 평면 렌더) → `repaint.py`(같은 그림체로 다시 그림) → `bake_mv.py`(정면+7방향 한 장으로, 얼굴은 정면 사진 결 그대로) | |
| ⑨′ 표정 | `phototex.py` SIM=1(입·눈 모양 살려 닮음 변환) → `bake_mv.py` → `src/plaza/chief_smile.jpg`(눈웃음)·`chief_laugh.jpg`(크게 웃기) | |
| ⑥ 안경 ⑧ 뼈 19개 ⑨ 몸짓 | `chief2.py`(Blender) → `src/plaza/chief.glb` | 최종 정면 0.59 · 좌우 20° 0.57/0.52 |
| ⑩ 360° 점검 | `turn.html`·`turn.js`(1°씩 360장 × 몸짓 8가지) → `turn_check.py`(구멍·깜빡임·하얗게 뜸 자동 점검) | |

- 뼈 19개: hips·spine·chest·neck·head / shoulder·upper_arm·forearm·hand ×2 / thigh·shin·foot ×2 (자동 무게)
- 몸짓 8가지: idle(서기)·walk(걷기)·wave(손 흔들기)·talk(말하기)·bow(손 모아 꾸벅)·point(팔 뻗어 안내)·clap(박수)·cheer(V자 만세)
- 표정 3가지: 기본·눈웃음(꾸벅·손 인사·말하기)·크게 웃기(박수·만세) — `chibi.ts` makeChief 의 face()
- 광장 행동(`engine.ts`): 평소 길목을 오가며 둘러봄 → 다가오면 손 인사 → 말 걸면 꾸벅·인사말·안내·손 인사 → 내 몸짓(인사·박수·좋아요·반가워요)에 손 인사·박수·만세로 반응
- 광장 재질(`chibi.ts` makeChief): 사진 결이 명암을 품고 있어 조명은 조금(0.34)만 받고 나머지는 제 빛(0.72), 톤매핑 끔 — 조명을 그대로 받으면 닮음 0.45로 떨어짐

## 다시 만들 때
- 결과물만: `python chief2.py` (같은 폴더의 body.obj·body.jpg·rig_points.json 사용)
- 처음부터: pipeline/ 순서대로. 경로는 스크립트 안 `/tmp/...` 작업 폴더 기준이라 맞춰 고쳐 씀
- TripoSG(github VAST-AI-Research/TripoSG, 가중치 HF VAST-AI/TripoSG)를 CPU로 돌리려면 고칠 곳
  - `triposg/inference_utils.py`: `diso` 가져오기를 try로, `device='cuda'` → `'cpu'`, `torch.float16` → `torch.float32`, 세분 띠 기준 1.0 → 0.98
  - `pipelines/pipeline_triposg.py`: 디코드 전에 잠재값 저장 후 끝내기(메모리 8GB에서 VAE를 따로 올려야 함)
  - bfloat16으로 불러 단계당 약 15초(50단계 13분), 메시 변환 약 8분

이전 방식(사진 머리만 빚어 기존 몸에 얹은 것)은 `tools/plaza_chief/` — 더 쓰지 않음.
