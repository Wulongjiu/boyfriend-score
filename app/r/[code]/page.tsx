import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import ResultView from '../../../components/ResultView';
import { QUESTIONS } from '../../../content/questions';
import { isValidCode } from '../../../lib/quiz';

/**
 * 结果页 /r/[code]
 *
 * code 是 7 字符的答案编码（见 lib/quiz.ts），在服务端校验后才渲染。
 * 注意 Next.js 16：params 是 Promise，必须 await。
 * 结果页不进搜索引擎（含分数与称号，属于个人内容）。
 */
export const metadata: Metadata = {
  title: '测评结果',
  robots: { index: false, follow: false },
};

export default async function ResultPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  if (!isValidCode(QUESTIONS, code)) {
    notFound();
  }

  return <ResultView code={code} />;
}
