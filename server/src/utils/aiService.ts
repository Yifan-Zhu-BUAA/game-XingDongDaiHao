// AI 服务 - 用于生成游戏词汇

interface GenerateWordsResponse {
  words: string[];
  error?: string;
}

// 从环境变量获取配置
const AI_API_URL = process.env.AI_API_URL || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY || 'b69c70c3-cabb-4592-9775-46d0fff16b7f';
const AI_MODEL = process.env.AI_MODEL || 'doubao-seed-1-8-251228';

// 敏感词列表（简单示例，可根据需要扩展）
const SENSITIVE_PATTERNS = [
  '色情', '性爱', '性', '裸体', '裸', '黄', 'av', 'porn', 'sex', 'nude', 'naked',
  '暴力', '血腥', '杀戮', '杀', '死', '毒品', '毒', '赌博', '赌', '恐怖', '恐怖',
];

// 检查主题是否包含敏感内容
function containsSensitiveContent(theme: string): boolean {
  const lowerTheme = theme.toLowerCase();
  return SENSITIVE_PATTERNS.some(pattern => 
    lowerTheme.includes(pattern.toLowerCase())
  );
}

// 注：AI 模型已经对输出进行了内容过滤，返回的词汇是健康的
// 因此不再对返回的词汇进行二次检测，避免误判（如"血腥"列表中的"血"字会误判正常词汇）

/**
 * 根据主题描述生成25个相关词汇
 * 由于模型限制单次只能生成约15个，采用分批生成策略
 * @param theme 主题描述，如"大海和天空"
 * @returns 生成的25个词汇列表
 */
export async function generateWordsByTheme(theme: string): Promise<GenerateWordsResponse> {
  try {
    // 1. 先进行敏感词检查
    if (containsSensitiveContent(theme)) {
      return { 
        words: [], 
        error: '主题描述包含不适当内容，请重新描述' 
      };
    }

    // 2. 第一批：生成核心词汇（15个）
    const batch1 = await generateBatch(theme, "核心概念", 15);
    
    // 检查第一批是否生成成功
    if (!batch1 || batch1.length === 0) {
      return { 
        words: [], 
        error: '无法根据该主题生成词汇，请尝试其他描述（如：大海、动漫、美食等）' 
      };
    }

    // 如果第一批生成的词少于 5 个，可能是模型拒绝了不当内容
    if (batch1.length < 5) {
      return { 
        words: [], 
        error: '主题描述可能包含不适当内容或过于抽象，请重新描述' 
      };
    }

    // 3. 第二批：生成相关词汇（10个不同角度的）
    const batch2 = await generateBatch(theme, "相关事物、场景、动作", 10, batch1);
    
    // 合并结果
    const allWords = [...batch1];
    if (batch2 && batch2.length > 0) {
      // 过滤掉重复的
      for (const word of batch2) {
        if (!allWords.includes(word)) {
          allWords.push(word);
        }
      }
    }
    
    // 如果最终生成的词太少，提示用户
    if (allWords.length < 10) {
      return { 
        words: [], 
        error: '该主题生成词汇不足，请尝试使用更具体、更健康的描述' 
      };
    }
    
    return { words: allWords.slice(0, 25) };
  } catch (error) {
    console.error('Generate words error:', error);
    return { 
      words: [], 
      error: '生成词汇时出错，请稍后重试' 
    };
  }
}

/**
 * 生成一批词汇
 */
async function generateBatch(
  theme: string, 
  aspect: string, 
  count: number, 
  excludeWords?: string[]
): Promise<string[]> {
  const excludePrompt = excludeWords && excludeWords.length > 0 
    ? `注意：不要与以下词汇重复：${excludeWords.join('、')}` 
    : '';

  const prompt = `请根据主题为"行动代号"游戏生成${count}个中文词汇。

主题："${theme}"
角度：${aspect}
${excludePrompt}

要求：
1. 生成${count}个不同的词汇，每个词1-5个字
2. 词汇应该是名词或具体概念，或者是动作等，可以略微抽象
3. 不要生成任何色情、暴力、血腥或不适当的内容
4. 返回JSON数组格式
5. 只返回JSON数组，不要有其他说明文字

请生成${count}个词汇：`;

  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AI_API_KEY && { 'Authorization': `Bearer ${AI_API_KEY}` }),
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 600,
        reasoning_effort: 'minimal',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('AI API error:', errorData);
      
      // 检查是否是内容审核错误
      if (errorData.error?.message?.includes('content') || 
          errorData.error?.message?.includes('safety') ||
          errorData.error?.message?.includes('inappropriate') ||
          response.status === 400) {
        return []; // 返回空数组表示内容被拒绝
      }
      
      return [];
    }

    const data = await response.json();
    
    // 检查是否有内容过滤标记
    if (data.choices?.[0]?.finish_reason === 'content_filter') {
      console.log('Content filtered by AI');
      return [];
    }
    
    const content = data.choices?.[0]?.message?.content || '';

    // 解析返回的 JSON
    return parseWordsFromResponse(content);
  } catch (error) {
    console.error('Batch generation error:', error);
    return [];
  }
}

/**
 * 从 AI 响应中解析词汇列表
 */
function parseWordsFromResponse(content: string): string[] {
  try {
    // 尝试直接解析整个内容
    const words = JSON.parse(content);
    if (Array.isArray(words)) {
      return words.filter(w => typeof w === 'string' && w.trim());
    }
  } catch {
    // 如果失败，尝试从文本中提取 JSON 数组
    const match = content.match(/\[[\s\S]*?\]/);
    if (match) {
      try {
        const words = JSON.parse(match[0]);
        if (Array.isArray(words)) {
          return words.filter(w => typeof w === 'string' && w.trim());
        }
      } catch {
        // 继续尝试其他方法
      }
    }
  }

  // 最后尝试按行分割
  const lines = content
    .split(/[\n,，]/)
    .map(line => line.trim())
    .filter(line => line && !line.match(/^\d+[.、\s]/));

  // 清理数字前缀和引号
  return lines
    .map(line => line.replace(/^\d+[.、\s]+/, '').replace(/^["']|["']$/g, '').trim())
    .filter(line => line && line.length <= 10);
}
