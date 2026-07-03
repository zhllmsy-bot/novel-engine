/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CallAIApiParams {
  content: string;
  prompt?: string;
  context?: {
    l0?: string;
    l1?: string;
  };
  selectedText?: string;
  title?: string;
}

export async function callAIApi(
  action: 'continue' | 'polish' | 'summarize' | 'extract' | 'diagnostic',
  params: CallAIApiParams
): Promise<any> {
  try {
    const response = await fetch("/api/ai/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        content: params.content,
        prompt: params.prompt,
        context: params.context,
        selectedText: params.selectedText,
        title: params.title,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.error === "API_KEY_MISSING") {
        throw new Error("请在右上角设置中配置您的 Gemini API Key 才能启用 AI 功能。");
      }
      throw new Error(errorData.message || `请求失败，状态码: ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    console.error("callAIApi Error:", err);
    throw err;
  }
}
