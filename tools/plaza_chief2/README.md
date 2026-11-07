# 교육감 캐릭터(chief.glb) — 참고영상 10단계 그대로

3D 광장 「천호성 교육감」. 참고영상(3D캐릭터 만들기 영상)의 순서를 따름. 모두 CPU로 돌림(GPU 없음).
닮음 점수 = ArcFace 얼굴 인식 코사인 유사도, 실제 사진 9장 평균(`pipeline/arc.py`).

| 단계 | 스크립트 | 결과 |
|---|---|---|
| ① 그림 | `compose.py`(정장 몸 렌더 + 사진 머리 밑그림) → `gen.py`(sd-turbo img2img 18장) | 가장 닮은 1장 0.53 |
| ② 안경 벗기기 | `noglass.py`(테 자국 인페인트) | 0.52 |
| ③ 형상 빚기 | `run_tsg.py`(TripoSG 50단계, 잠재값 저장) → `decode.py`(VAE만 올려 메시로) | 전신 형상 |
| ④ 깎기 | `sculpt.py`(앞모습 윤곽 정렬 + 윤곽선 따라 RBF 변형) | 윤곽 일치 94% → 98% |
| ⑤ 색 입히기 | `uv2.py`(4만 면·UV) → `bake2.py`(정면 그림 투영, 뒤·옆은 머리카락·옷 가장자리 색) | |
| ⑦ 사진 결 | `phototex.py`(실제 사진 안경 지우고 얼굴 특징점 TPS로 그림 얼굴에) → `bake2.py` 다시 | |
| ⑥ 안경 ⑧ 뼈 19개 ⑨ 몸짓 7가지 | `chief2.py`(Blender) → `src/plaza/chief.glb` | 최종 0.61 |
| ⑩ 360° 점검 | 광장·뷰어 렌더 | |

- 뼈 19개: hips·spine·chest·neck·head / shoulder·upper_arm·forearm·hand ×2 / thigh·shin·foot ×2 (자동 무게)
- 몸짓 7가지: idle·walk·wave·talk·bow(꾸벅)·clap(박수)·cheer(만세) — 엔진 `animChibi` 이름 그대로
- 광장 재질(`chibi.ts` makeChief): 사진 결이 명암을 품고 있어 조명은 조금(0.34)만 받고 나머지는 제 빛(0.72), 톤매핑 끔 — 조명을 그대로 받으면 닮음 0.45로 떨어짐

## 다시 만들 때
- 결과물만: `python chief2.py` (같은 폴더의 body.obj·body.jpg·rig_points.json 사용)
- 처음부터: pipeline/ 순서대로. 경로는 스크립트 안 `/tmp/...` 작업 폴더 기준이라 맞춰 고쳐 씀
- TripoSG(github VAST-AI-Research/TripoSG, 가중치 HF VAST-AI/TripoSG)를 CPU로 돌리려면 고칠 곳
  - `triposg/inference_utils.py`: `diso` 가져오기를 try로, `device='cuda'` → `'cpu'`, `torch.float16` → `torch.float32`, 세분 띠 기준 1.0 → 0.98
  - `pipelines/pipeline_triposg.py`: 디코드 전에 잠재값 저장 후 끝내기(메모리 8GB에서 VAE를 따로 올려야 함)
  - bfloat16으로 불러 단계당 약 15초(50단계 13분), 메시 변환 약 8분

