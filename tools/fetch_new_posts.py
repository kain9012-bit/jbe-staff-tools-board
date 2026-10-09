"""요약이 아직 없는 게시글만 본문을 읽어 모음 — docs/summary-guide.md 4장 1단계.

사용: 저장소 맨 위 폴더에서  python tools/fetch_new_posts.py   (전체 다시 읽기: --all)
결과: _probe/sum/new_posts.json  (요약 작성용 자료. 화면에는 쓰이지 않음)
"""
import csv
import html
import io
import json
import os
import re
import sys
import time
import urllib.request

SHEET = 'https://docs.google.com/spreadsheets/d/1Kq9WboOQO-UsxEX24qXruSg_qbS9bfDGk5txXi9Bfs8/export?format=csv&gid=794330143'
VIEW = 'https://www.jbe.go.kr/board/view.jbe?boardId=BBS_0000683&menuCd=DOM_000000106011002002&dataSid={}'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUMMARIES = os.path.join(ROOT, 'src', 'data', 'summaries.json')
OUT = os.path.join(ROOT, '_probe', 'sum', 'new_posts.json')


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8', 'ignore')


def text(seg):
    seg = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', '', seg)
    seg = re.sub(r'(?i)<br\s*/?>|</p>|</li>|</div>|</h\d>|</tr>', '\n', seg)
    seg = re.sub(r'<[^>]+>', ' ', seg)
    seg = html.unescape(seg)
    seg = re.sub(r'[ \t ]+', ' ', seg)
    return re.sub(r'\n\s*\n+', '\n', seg).strip()


def main():
    done = set()
    if '--all' not in sys.argv and os.path.exists(SUMMARIES):
        done = set(json.load(open(SUMMARIES, encoding='utf-8'))['items'])
    rows = [r for r in csv.DictReader(io.StringIO(get(SHEET))) if r['게시상태'] == '게시중' and r['dataSid'] not in done]
    out = []
    for r in rows:
        s = get(VIEW.format(r['dataSid']))
        i = s.find('class="bbs_con"')
        j = s.find('class="bbs_filedown"')
        body = s[i:j if j > i else i + 60000] if i >= 0 else ''
        body = text(body.split('이전글')[0])
        files = re.findall(r'([^\s<>]+\.[A-Za-z0-9]{2,5})\s*\(\s*[\d.,]+\s*[kKmM]?[bB]\s*\)', text(s[j:j + 4000])) if j >= 0 else []
        links = sorted(set(re.findall(r'href="(https?://(?!www\.jbe\.go\.kr)[^"]+)"', s[i:i + 60000] if i >= 0 else '')))
        links = [x for x in links if 'kakao.com/_' not in x and 'kogl.or.kr' not in x]
        out.append({'sid': r['dataSid'], 'title': r['도구명'], 'purpose': r['사용목적'], 'target': r['적용기관'],
                    'created': r['작성일'], 'files': files, 'links': links[:8], 'body': body[:8000]})
        time.sleep(0.3)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'요약 필요 {len(out)}건 → {OUT}')
    for o in out:
        print(' ', o['sid'], o['title'])


if __name__ == '__main__':
    main()
