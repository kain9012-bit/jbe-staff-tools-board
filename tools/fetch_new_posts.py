"""요약이 아직 없는 게시글의 글과 그림을 모음 — docs/summary-guide.md 4장 1단계.
교직원 제작 도구·교육청 배포 도구 두 게시판을 함께 봄.

사용: 저장소 맨 위 폴더에서  python tools/fetch_new_posts.py                  (두 게시판, 요약 없는 글만)
                              python tools/fetch_new_posts.py --board official  (교육청 배포 도구만)
                              python tools/fetch_new_posts.py 1186819           (지정한 글만 다시)
결과: _probe/sum/new_posts.json  — 글별 본문·첨부파일 이름·링크·그림 파일 목록
      _probe/sum/img/<dataSid>/  — 본문 그림과 그림 첨부파일 (가로 1000px로 줄이고 긴 그림은 1600px씩 나눔)
요약 작성용 자료이며 화면에는 쓰이지 않음. 그림은 Pillow가 있으면 줄이고, 없으면 원본 그대로 둠.
"""
import base64
import csv
import html
import io
import json
import os
import re
import subprocess
import sys
import time

BASE = 'https://www.jbe.go.kr'
SHEET = 'https://docs.google.com/spreadsheets/d/{}/export?format=csv&gid={}'
# 게시판별 수집 시트(도구목록)와 게시글 주소
BOARDS = {
    'staff': (SHEET.format('1Kq9WboOQO-UsxEX24qXruSg_qbS9bfDGk5txXi9Bfs8', '794330143'),
              BASE + '/board/view.jbe?boardId=BBS_0000683&menuCd=DOM_000000106011002002&dataSid={}'),
    'official': (SHEET.format('1bEKHnr9wnqXZSyWRuz18mz76SGDaCuvyQf39er0OWbQ', '1397113268'),
                 BASE + '/board/view.jbe?boardId=BBS_0000649&menuCd=DOM_000000106011002001&dataSid={}'),
}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUMMARIES = os.path.join(ROOT, 'src', 'data', 'summaries.json')
OUTDIR = os.path.join(ROOT, '_probe', 'sum')
IMG_EXT = ('png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp')

try:
    from PIL import Image
except ImportError:  # 그림 줄이기만 건너뜀
    Image = None


def get(url, binary=False):
    """curl로 받음 — 누리집이 파이썬 urllib 요청에는 같은 주소로 되돌림(302)만 반복함. curl은 정상 응답
    (윈도우 10 이상·리눅스 모두 curl 기본 포함)"""
    r = subprocess.run(['curl', '-sL', '--max-time', '60', '-A', 'Mozilla/5.0', url], capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(f'내려받기 실패 ({r.returncode}): {url}')
    return r.stdout if binary else r.stdout.decode('utf-8', 'ignore')


def text(seg):
    seg = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', '', seg)
    seg = re.sub(r'(?i)<br\s*/?>|</p>|</li>|</div>|</h\d>|</tr>', '\n', seg)
    seg = re.sub(r'<[^>]+>', ' ', seg)
    seg = html.unescape(seg)
    seg = re.sub(r'[ \t ]+', ' ', seg)
    return re.sub(r'\n\s*\n+', '\n', seg).strip()


def save_image(data, path_noext):
    """그림 한 장 저장. 반환: 저장한 파일 경로 목록 (긴 그림은 여러 조각)"""
    if Image is None:
        p = path_noext + '.img'
        open(p, 'wb').write(data)
        return [p]
    try:
        im = Image.open(io.BytesIO(data))
        im.seek(0)
        im = im.convert('RGB')
    except Exception:
        return []  # 그림이 아닌 응답(오류 페이지 등)
    w, h = im.size
    if w < 120 or h < 60:
        return []  # 아이콘
    sc = min(1.0, 1000 / w)
    im = im.resize((max(1, int(w * sc)), max(1, int(h * sc))))
    W, H = im.size
    out = []
    for k, y in enumerate(range(0, H, 1600), 1):
        p = f'{path_noext}_{k}.jpg'
        im.crop((0, y, W, min(H, y + 1600))).save(p, quality=70)
        out.append(p)
    return out


def main():
    only = [a for a in sys.argv[1:] if a.isdigit()]
    done = set()
    if not only and os.path.exists(SUMMARIES):
        done = set(json.load(open(SUMMARIES, encoding='utf-8'))['items'])
    pick = sys.argv[sys.argv.index('--board') + 1] if '--board' in sys.argv else None
    rows = []
    for board, (sheet, view) in BOARDS.items():
        if pick and board != pick:
            continue
        for r in csv.DictReader(io.StringIO(get(sheet))):
            if r['게시상태'] == '게시중' and (r['dataSid'] in only if only else r['dataSid'] not in done):
                rows.append((board, view, r))
    out = []
    for board, view, r in rows:
        sid = r['dataSid']
        s = get(view.format(sid))
        i = s.find('class="bbs_con"')
        j = s.find('class="bbs_filedown"')
        seg = s[i:j if j > i else i + 80000] if i >= 0 else ''
        seg = seg.split('class="pagelist"')[0]
        body = text(re.sub(r'<img[^>]*>', ' ', seg))
        fseg = s[j:j + 6000].split('class="pagelist"')[0] if j >= 0 else ''
        files = [t for _, t in re.findall(r'<a href="(/board/download\.jbe[^"]+)" title="([^"]+)"', fseg)]
        links = sorted(set(re.findall(r'href="(https?://(?!www\.jbe\.go\.kr)[^"]+)"', seg)))
        links = [x for x in links if 'kakao.com/_' not in x and 'kogl.or.kr' not in x]

        d = os.path.join(OUTDIR, 'img', sid)
        os.makedirs(d, exist_ok=True)
        imgs = []
        for n, src in enumerate(re.findall(r'<img[^>]+src="([^"]+)"', seg), 1):
            src = html.unescape(src)
            try:
                if src.startswith('data:image'):
                    data = base64.b64decode(src.split(',', 1)[1])
                else:
                    data = get(src if src.startswith('http') else BASE + src, binary=True)
            except Exception:
                continue
            imgs += save_image(data, os.path.join(d, f'b{n:02d}'))
        for k, (href, title) in enumerate(re.findall(r'<a href="(/board/download\.jbe[^"]+)" title="([^"]+)"', fseg), 1):
            if title.lower().endswith(IMG_EXT):
                try:
                    imgs += save_image(get(BASE + html.unescape(href), binary=True), os.path.join(d, f'a{k:02d}'))
                except Exception:
                    pass

        out.append({'sid': sid, 'board': board, 'title': r['도구명'], 'purpose': r.get('사용목적', ''), 'target': r.get('적용기관', ''),
                    'created': r['작성일'], 'files': files, 'links': links[:8], 'body': body[:12000],
                    'images': [os.path.relpath(p, OUTDIR) for p in imgs]})
        time.sleep(0.3)
    os.makedirs(OUTDIR, exist_ok=True)
    json.dump(out, open(os.path.join(OUTDIR, 'new_posts.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'요약 필요 {len(out)}건 → _probe/sum/new_posts.json')
    for o in out:
        print(' ', o['board'], o['sid'], f"그림 {len(o['images'])}장", o['title'])


if __name__ == '__main__':
    main()
