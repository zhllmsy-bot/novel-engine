/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Shared lazy-loaded Gemini AI client
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please set it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "15mb" }));

  // API Route: AI Content Generation (Continuation, Polishing, Summarization, and Extraction)
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const { action, content, prompt, context, selectedText, title } = req.body;
      
      let client;
      try {
        client = getAiClient();
      } catch (err: any) {
        return res.status(400).json({ 
          error: "API_KEY_MISSING", 
          message: err.message || "Missing Gemini API Key." 
        });
      }

      let systemInstruction = "";
      let userPrompt = "";
      let responseMimeType = "text/plain";
      let responseSchema: any = undefined;

      // Select system instruction and prompt based on the author's intent
      if (action === "continue") {
        systemInstruction = `你是一位顶尖的网文、轻小说及严肃文学编辑，专门帮助作者进行小说“续写”。
你必须深刻理解作者提供的前置故事脉络（L1大纲摘要）、世界观角色设定（L0设定）以及当前章节的上文（L2小说内容）。
续写原则：
1. 延续上文的文笔风格、行文节奏、语气、词汇和情感色彩。
2. 续写部分必须合情合理地顺接上文，符合L0设定中人物的当前状态和性格，决不能出现逻辑脱节、世界观吃设定或剧情穿帮。
3. 续写输出应当是纯净的小说正文，不需要任何多余的解释、寒暄或回复，直接从上文断开的地方往下书写。
4. 长度控制在 300-800 字。`;

        userPrompt = `【项目世界观与角色设定 (L0)】:
${context?.l0 || "无"}

【历史章节大纲摘要 (L1)】:
${context?.l1 || "无"}

【当前章节标题】: ${title || "无"}
【当前章节上文内容 (L2)】:
\"\"\"
${content}
\"\"\"

【作者给出的后续情节指示或方向 (如果为空，请根据情节走向顺理成章地续写)】:
${prompt || "无"}

请直接开始续写：`;
      } 
      else if (action === "polish") {
        systemInstruction = `你是一位殿堂级的小说打磨润色大师，能够将粗糙、平淡的草稿转换成极具画面感、节奏感和情感共鸣的优秀 prose。
你必须对作者提供的上下文、行文风格和设定有清晰把握。
润色原则：
1. 仅仅针对作者选中的段落（Selected Text）进行语言优化，不要大范围修改未选中的上下文。
2. 根据作者提供的【改进指示】（如：更富有诗意、增强打斗张力、细腻化心理描写等）进行打磨。
3. 保持原作的人设与情节，仅仅在遣词造句、修辞手法、长短句交替、环境烘托上进行升华。
4. 只返回润色打磨后的替换文本，绝对不要带有任何旁白、‘好的，以下是润色结果’、注释等，直接返回修改后的正文。`;

        userPrompt = `【项目世界观与角色设定 (L0)】:
${context?.l0 || "无"}

【小说上下文】:
\"\"\"
${content}
\"\"\"

【作者选中的、需要润色的原段落 (Selected Text)】:
\"\"\"
${selectedText}
\"\"\"

【作者的改进要求或偏好 (如：增加动作细节、悬疑感、情绪渲染等)】:
${prompt || "无"}

请直接输出润色打磨后的替换正文：`;
      } 
      else if (action === "summarize") {
        systemInstruction = `你是一位高效率、善于把握主线的图书编辑，专门负责为长篇小说章节生成高质量、高准确度的“大纲与状态快照”。
你必须提炼核心，排除细枝末节。
生成大纲摘要的要求：
1. 【章节摘要 (Summary)】：用一段 150-300 字的精炼文字，概述本章发生的物理事件、心理冲突和剧情拐点。
2. 【核心事件 (Key Events)】：列出本章最重要的 3-5 个具体情节进展（如抢夺了什么、受了什么伤、前往了何处）。
3. 【登场人物角色状态变动 (Character Involved & State Changes)】：列出本章涉及的所有角色，并明确分析他们的状态变化（如：位置变动、情感破裂、受伤、获得道具等）。
必须返回格式为 JSON 的数据。`;

        responseMimeType = "application/json";
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "一两句话精炼概括本章物理事件及剧情拐点，150-300字。"
            },
            keyEvents: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "本章核心进展列表，3到5条。"
            },
            characterStates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  characterId: { type: Type.STRING, description: "对应的角色ID，如 char_luchen" },
                  characterName: { type: Type.STRING, description: "对应的角色名字" },
                  stateChange: { type: Type.STRING, description: "在本章内具体发生的状态、位置或属性变更" }
                },
                required: ["characterId", "characterName", "stateChange"]
              },
              description: "本章登场角色及他们的动态状态更新快照"
            }
          },
          required: ["summary", "keyEvents", "characterStates"]
        };

        userPrompt = `【当前章节标题】: ${title || "未命名章节"}
【当前章节小说正文】:
\"\"\"
${content}
\"\"\"

请根据以上章节正文，严格提炼出章节摘要、核心进展事件和角色状态变更：`;
      } 
      else if (action === "extract") {
        systemInstruction = `你是一位敏锐的小说实体挖掘专家，能分析小说文本并自动挖掘出其中提到的新角色、新道具、新场景设定，或者对已有设定更新。
这能够帮助作者自动化沉淀他们的 Codex（设定集）。
要求：
1. 仔细扫描本章正文。
2. 发现新出现的具有代表性的【人物（Character）】、【道具（Item）】或【地点场景（Location）】。
3. 提取它们的名字、可能的别名/关键词（用于记忆联想召回）、详细设定描述，并给出一个优雅的avatarColor背景色。
必须返回格式为 JSON 的数据。`;

        responseMimeType = "application/json";
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            extractedEntities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "实体名称" },
                  type: { type: Type.STRING, description: "实体类型，可选: character, item, location, faction" },
                  aliases: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: "此实体的同义词、别名或检索关键词列表，用于在小说正文中出现时触发高亮。通常包括它的缩写、称号或专有武器名" 
                  },
                  description: { type: Type.STRING, description: "实体的详细介绍、背景或初次登场的特质" },
                  currentState: { type: Type.STRING, description: "如果是角色，他/她/它的当前初始属性、负面状态或装备" }
                },
                required: ["name", "type", "aliases", "description"]
              },
              description: "挖掘出的设定实体列表"
            }
          },
          required: ["extractedEntities"]
        };

        userPrompt = `【已有设定实体库 (用于避免重复提取)】:
${context?.l0 || "无"}

【当前章节小说正文】:
\"\"\"
${content}
\"\"\"

请分析上文，提取出新出现的角色、道具、势力或场景地点：`;
      }
      else if (action === "diagnostic") {
        systemInstruction = `你是一位冷酷而深刻的文学评论家与长篇 continuity（连续性）质检专家。
你负责对小说当前章节进行“叙事健壮性诊断”，指出潜在的问题。
需要诊断并指出的指标：
1. 【设定吃设定 (Setting Violations)】：有没有违反 L0 设定中人物的当前状态（例如：手断了却能御剑，中毒虚弱却能大战三百回合，已经死亡的角色突然现身等）。
2. 【逻辑吃书/时间线矛盾 (Consistency Violations)】：与 L1 历史章节摘要发生的物理事实是否相冲突。
3. 【未来信息泄露 (Future Leaks)】：人物突然知道了后面章节才知道的绝密信息（即违反时空先后顺序）。
4. 【节奏与水准诊断 (Pacing & Style Diagnostics)】：描写是否冗长、对话是否机械、AI风过浓或注水问题。
必须返回格式为 JSON 的数据。`;

        responseMimeType = "application/json";
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            pacingScore: { type: Type.INTEGER, description: "节奏与笔力评分 (1-100)" },
            violations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "冲突类型: '设定违背', '逻辑矛盾', '前瞻泄密', '行文节奏'" },
                  severity: { type: Type.STRING, description: "严重度: '高风险', '中等警告', '优化建议'" },
                  description: { type: Type.STRING, description: "具体问题描述及对应的矛盾细节" },
                  suggestion: { type: Type.STRING, description: "具体的修复或重写建议" }
                },
                required: ["type", "severity", "description", "suggestion"]
              },
              description: "发现的违背和冲突列表"
            },
            generalReview: { type: Type.STRING, description: "整体综合文学诊断点评" }
          },
          required: ["pacingScore", "violations", "generalReview"]
        };

        userPrompt = `【项目世界观与角色设定集 (L0)】:
${context?.l0 || "无"}

【历史前置章节摘要列表 (L1)】:
${context?.l1 || "无"}

【当前诊断章节正文】:
\"\"\"
${content}
\"\"\"

请对本章进行深度诊断，输出违背诊断列表与评分：`;
      }

      // Query Gemini API using recommended SDK formats
      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType,
          responseSchema,
          temperature: action === "continue" ? 0.75 : 0.3, // Higher creativity for drafting
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response generated from Gemini AI.");
      }

      if (responseMimeType === "application/json") {
        try {
          const parsed = JSON.parse(responseText.trim());
          return res.json(parsed);
        } catch (jsonErr) {
          console.error("JSON parse failure for response:", responseText);
          return res.json({ rawText: responseText });
        }
      }

      return res.json({ text: responseText });

    } catch (err: any) {
      console.error("AI Generation error:", err);
      res.status(500).json({ error: "SERVER_ERROR", message: err.message || "Internal server error during AI generation." });
    }
  });

  // Integrated Vite Middleware for smooth client development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Novel Workspace Backend] Listening on http://localhost:${PORT}`);
  });
}

startServer();
