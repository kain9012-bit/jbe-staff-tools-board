import React from 'react';
import { Card, SectionTitle } from '../components/Ui';
import { dayLabel, type Model } from '../lib/stats';

const Row: React.FC<{ term: string; children: React.ReactNode }> = ({ term, children }) => (
  <div className="grid gap-1 sm:grid-cols-[10rem_1fr] px-4 py-3 border-t border-slate-100 first:border-t-0">
    <dt className="font-bold text-slate-900">{term}</dt>
    <dd className="text-slate-700">{children}</dd>
  </div>
);

export const About: React.FC<{ m?: Model }> = ({ m }) => (
  <div className="max-w-4xl">
    <SectionTitle desc="숫자를 읽기 전에 확인할 것">집계 기준과 한계</SectionTitle>

    <h3 className="mt-6 text-base font-bold text-slate-900">자료 출처</h3>
    <Card className="mt-2">
      <dl>
        <Row term="수집 대상">데이터 도구실 「교직원 제작 도구」 게시판 목록 전체 페이지. 공지 게시글은 제외</Row>
        <Row term="수집 주기">약 1시간마다. 하루에 여러 번 수집해도 그날의 마지막 값 하나만 남김</Row>
        <Row term="수집 시작">{m ? dayLabel(m.start) : '-'}</Row>
        <Row term="제작자">게시판 작성자 표기 그대로, 소속(이름). 표기가 다르면 다른 제작자로 셈</Row>
        <Row term="내려간 글">목록에서 사라진 글은 집계에서 제외</Row>
      </dl>
    </Card>

    <h3 className="mt-6 text-base font-bold text-slate-900">조회수 계산</h3>
    <Card className="mt-2">
      <dl>
        <Row term="누적 조회수">게시판 목록에 보이는 조회수 그대로</Row>
        <Row term="일별 조회수">그날 누적 조회수에서 직전 수집일 누적 조회수를 뺀 값</Row>
        <Row term="수집이 빠진 날">0으로 처리. 그 사이 늘어난 조회수는 다음 수집일에 한꺼번에 잡힘</Row>
        <Row term="수집 전 누적">
          수집 시작 전에 게시된 도구는 첫 수집값을 날짜별로 나눌 수 없어 따로 표시. 누적 조회수에는 포함, 추이 그래프에는 미포함
        </Row>
        <Row term="수집 시작 후 게시">첫 수집값을 첫 수집일의 조회수로 셈</Row>
        <Row term="주간 · 월간">주간은 월요일~일요일, 월간은 달력 월. 덜 찬 구간은 옅은 막대로 표시</Row>
        <Row term="그래프 기간">일별은 최근 30일, 주별·월별은 전체 기간이 기본. 기간 단추나 날짜 칸으로 바꾸면 일·주·월을 바꿔도 그 기간 유지</Row>
        <Row term="최근 7일">오늘(수집 중)을 포함한 최근 7일 증가량</Row>
        <Row term="이번 주">이번 주 월요일부터 마지막 수집 시점까지 증가량</Row>
      </dl>
    </Card>

    <h3 className="mt-6 text-base font-bold text-slate-900">댓글</h3>
    <Card className="mt-2">
      <dl>
        <Row term="댓글 수">게시판 목록 제목 옆 '(댓글 : N)' 값. 제작자 답글 포함</Row>
        <Row term="댓글 내용">
          댓글 수가 바뀐 글만 게시글을 열어 최신 댓글을 모음. 게시판은 2쪽(11번째) 이후 댓글을 로그인해야 보여 줘서,
          수집 시작 전에 이미 10개를 넘은 글은 앞부분 댓글이 빠져 있음
        </Row>
        <Row term="제작자 답글">댓글 작성자 이름이 도구 작성자 괄호 안 이름과 같으면 제작자 답글로 봄. 동명이인은 가리지 못함</Row>
        <Row term="답글 없음">그 도구에서 제작자의 마지막 답글보다 뒤에 달린 댓글</Row>
      </dl>
    </Card>

    <h3 className="mt-6 text-base font-bold text-slate-900">한계</h3>
    <ul className="mt-2 list-disc pl-5 space-y-1 text-slate-700">
      <li>조회수는 게시글을 연 횟수. 실제 내려받기·사용 횟수와 다름</li>
      <li>같은 사람이 여러 번 열어도 게시판 방식대로 셈</li>
      <li>도구가 새 글로 다시 올라오면 별개의 도구로 셈</li>
    </ul>
  </div>
);
