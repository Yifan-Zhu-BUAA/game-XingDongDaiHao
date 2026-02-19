// AI 服务 - 用于生成游戏词汇

interface GenerateWordsResponse {
  words: string[];
  error?: string;
}

// 从环境变量获取配置
const AI_API_URL = process.env.AI_API_URL || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY || 'b69c70c3-cabb-4592-9775-46d0fff16b7f';
const AI_MODEL = process.env.AI_MODEL || 'doubao-seed-1-8-251228';

// 敏感词列表（只检测用户输入的主题）
const SENSITIVE_PATTERNS = [
  '色情', '性爱', '裸体', '裸', '黄', 'av', 'porn', 'sex', 'nude', 'naked',
  '暴力', '血腥', '杀戮', '杀', '死', '毒品', '毒', '赌博', '赌', '恐怖',
  '炸弹', '爆炸', '枪', '武器', '攻击', '邪教', '反动', '政治',
];

// 检查主题是否包含敏感内容
function containsSensitiveContent(theme: string): boolean {
  const lowerTheme = theme.toLowerCase();
  return SENSITIVE_PATTERNS.some(pattern => 
    lowerTheme.includes(pattern.toLowerCase())
  );
}

/**
 * 根据主题描述生成25个相关词汇
 * 一次性请求25个，如果不够则补充生成
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

    // 2. 第一次尝试生成25个词汇
    let allWords: string[] = [];
    let attempts = 0;
    const maxAttempts = 3; // 最多尝试3次

    while (allWords.length < 25 && attempts < maxAttempts) {
      const remainingCount = 25 - allWords.length;
      const batch = await generateBatch(theme, remainingCount, allWords);
      
      if (!batch || batch.length === 0) {
        // 如果某次生成失败，尝试继续
        attempts++;
        continue;
      }

      // 添加新词汇（去重）
      for (const word of batch) {
        if (!allWords.includes(word)) {
          allWords.push(word);
        }
      }

      attempts++;
      console.log(`Attempt ${attempts}: Generated ${batch.length} words, total: ${allWords.length}`);
    }

    // 3. 检查结果
    if (allWords.length === 0) {
      return { 
        words: [], 
        error: '无法根据该主题生成词汇，请尝试其他描述（如：大海、动漫、美食等）' 
      };
    }

    if (allWords.length < 10) {
      return { 
        words: [], 
        error: '该主题生成词汇不足，请尝试使用更具体的描述' 
      };
    }
    
    // 返回前25个（如果超过）
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
 * @param theme 主题
 * @param count 需要生成的数量
 * @param excludeWords 已生成的词汇（避免重复）
 */
async function generateBatch(
  theme: string, 
  count: number, 
  excludeWords: string[] = []
): Promise<string[]> {
  const excludePrompt = excludeWords.length > 0 
    ? `注意：不要与以下词汇重复：${excludeWords.join('、')}` 
    : '';

  const prompt = `请根据主题为"行动代号"游戏生成${count}个中文词汇。

主题："${theme}"${excludePrompt}

要求：
1. 生成${count}个不同的词汇，每个词1-5个字，可以发散一点，抽象一点
2. 词汇以2个字为主，可以有少量1字或4字或5字的词汇
3. 返回JSON数组格式
4. 只返回JSON数组，不要有其他说明文字

请生成${count}个词汇：`;

  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
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
        max_tokens: 800,
        reasoning_effort: 'minimal',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('AI API error:', errorData);
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
