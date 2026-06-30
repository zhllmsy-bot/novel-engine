export type PairwiseReviewItem = {
  runId: string
  chapterId?: string
  repeatIndex: number
  leftSample: string
  rightSample: string
}

export function buildPairwiseJudgePrompt(input: PairwiseReviewItem) {
  return [
    '你是中文长篇小说续写评审。请盲评两个续写样本。',
    '判断维度: 是否自然承接、是否遵守设定、是否自然回收伏笔、是否避免未来剧透。',
    '不要根据长度偏好样本。若差异不明显，选择 tie。',
    '',
    `Run: ${input.runId}`,
    input.chapterId ? `Chapter: ${input.chapterId}` : undefined,
    `Repeat: ${input.repeatIndex}`,
    '',
    '样本 A:',
    input.leftSample,
    '',
    '样本 B:',
    input.rightSample,
    '',
    '请按 JSON 输出: {"choice":"A|B|tie","reason":"一句话理由"}',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')
}
