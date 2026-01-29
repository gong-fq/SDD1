export async function handler(event, context) {
  console.log('=== SDD AI助手函数调用开始 ===');
  console.log('HTTP方法:', event.httpMethod);
  console.log('路径:', event.path);
  console.log('查询参数:', event.queryStringParameters);
  console.log('请求头:', event.headers);
  console.log('环境变量检查:', process.env.DEEPSEEK_API_KEY ? 'API密钥已设置' : 'API密钥未设置');
  
  // 1. 处理CORS预检请求
  if (event.httpMethod === 'OPTIONS') {
    console.log('处理OPTIONS预检请求');
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, PUT, DELETE',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin'
      },
      body: ''
    };
  }

  // 2. 验证HTTP方法
  if (event.httpMethod !== 'POST') {
    console.log('❌ 错误的HTTP方法:', event.httpMethod);
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Allow': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        error: '方法不允许',
        message: '只支持POST请求'
      })
    };
  }

  try {
    // 3. 解析请求体
    let requestBody;
    let message = '';
    
    try {
      if (!event.body) {
        console.log('❌ 请求体为空');
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: '请求体为空',
            message: '请提供问题内容'
          })
        };
      }
      
      requestBody = JSON.parse(event.body);
      message = requestBody.message || '';
      console.log('收到消息:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
    } catch (parseError) {
      console.error('JSON解析错误:', parseError);
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'JSON解析错误',
          message: '请求体必须是有效的JSON格式'
        })
      };
    }

    // 4. 验证消息内容
    if (!message.trim()) {
      console.log('❌ 消息内容为空');
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: '消息内容为空',
          message: '请输入要咨询的问题'
        })
      };
    }

    // 5. 检测语言
    const hasChinese = /[\u4e00-\u9fa5]/.test(message);
    const language = hasChinese ? 'zh' : 'en';
    console.log('检测到语言:', language, '消息长度:', message.length);

    // 6. 检查API密钥
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || apiKey === 'required' || apiKey === 'your_deepseek_api_key_here') {
      console.error('❌ API密钥未正确配置');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          reply: language === 'zh' 
            ? 'AI服务配置错误：API密钥未设置。\n\n请按以下步骤操作：\n1. 登录DeepSeek平台获取API密钥\n2. 在Netlify Dashboard中设置环境变量DEEPSEEK_API_KEY\n3. 重新部署项目'
            : 'AI service configuration error: API key not set.\n\nPlease follow these steps:\n1. Get API key from DeepSeek platform\n2. Set DEEPSEEK_API_KEY environment variable in Netlify Dashboard\n3. Redeploy the project',
          language,
          error: 'API_KEY_NOT_SET',
          timestamp: new Date().toISOString()
        })
      };
    }

    // 7. 准备系统提示
    const systemPrompt = language === 'zh' 
      ? `你是SDD（规格驱动开发）教学助手。请用中文回答所有问题。

你的职责：
1. 帮助学习者理解SDD核心概念和方法论
2. 解答关于规格文档编写、测试、API设计等问题
3. 对比SDD与Vibe Coding的差异
4. 提供实战案例和最佳实践建议
5. 解释并发、性能、数据模型等高级话题

回答要求：
- 回答必须使用中文
- 清晰、准确、务实
- 使用代码示例说明
- 避免空洞理论，注重实用性
- 鼓励学习者动手实践
- 如果问题超出SDD范围，友好地引导回主题

格式要求：
- 重要的概念用**加粗**强调
- 代码示例用\`代码块\`包裹
- 列表使用项目符号
- 保持段落简洁`
      : `You are an SDD (Spec-Driven Development) teaching assistant. Answer ALL questions in English.

Your responsibilities:
1. Help learners understand SDD core concepts and methodologies
2. Answer questions about spec documentation, testing, API design, etc.
3. Compare differences between SDD and Vibe Coding
4. Provide practical case studies and best practice recommendations
5. Explain advanced topics like concurrency, performance, data models

Response requirements:
- Answers must be in English
- Clear, accurate, and pragmatic
- Use code examples for illustration
- Avoid empty theories, focus on practicality
- Encourage learners to practice hands-on
- If questions go beyond SDD, gently guide back to topic

Formatting:
- Important concepts in **bold**
- Code examples in \`code blocks\`
- Use bullet points for lists
- Keep paragraphs concise`;

    console.log('准备调用DeepSeek API...');

    // 8. 调用DeepSeek API
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      console.log('API调用超时');
      controller.abort();
    }, 55000); // 55秒超时

    try {
      console.log('发送请求到DeepSeek API...');
      const startTime = Date.now();
      
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
          ],
          max_tokens: 2000,
          temperature: 0.7,
          top_p: 0.9,
          stream: false,
          presence_penalty: 0.1,
          frequency_penalty: 0.1
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);
      const endTime = Date.now();
      console.log(`API响应时间: ${endTime - startTime}ms`);
      console.log('API响应状态:', response.status, response.statusText);

      // 检查响应状态
      if (!response.ok) {
        let errorText;
        try {
          errorText = await response.text();
        } catch (textError) {
          errorText = '无法读取错误信息';
        }
        
        console.error(`DeepSeek API错误 ${response.status}:`, errorText.substring(0, 500));
        
        // 处理不同的错误状态
        let userMessage;
        if (response.status === 401) {
          userMessage = language === 'zh'
            ? '🔐 API认证失败：\n• API密钥无效或已过期\n• 请检查DeepSeek账户和API密钥设置'
            : '🔐 API authentication failed:\n• API key is invalid or expired\n• Please check DeepSeek account and API key settings';
        } else if (response.status === 429) {
          userMessage = language === 'zh'
            ? '⏰ API调用频率超限：\n• 请求过于频繁\n• 请稍后再试或检查API配额'
            : '⏰ API rate limit exceeded:\n• Too many requests\n• Please try again later or check API quota';
        } else if (response.status >= 500) {
          userMessage = language === 'zh'
            ? '🛠️ DeepSeek服务暂时不可用：\n• 服务器内部错误\n• 请稍后重试'
            : '🛠️ DeepSeek service temporarily unavailable:\n• Server internal error\n• Please try again later';
        } else {
          userMessage = language === 'zh'
            ? `API错误 ${response.status}: ${errorText.substring(0, 200)}`
            : `API error ${response.status}: ${errorText.substring(0, 200)}`;
        }
        
        return {
          statusCode: 200, // 返回200以便前端显示错误信息
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          },
          body: JSON.stringify({
            reply: userMessage,
            language,
            error: `API_${response.status}`,
            isError: true,
            timestamp: new Date().toISOString()
          })
        };
      }

      // 解析成功响应
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('响应JSON解析错误:', jsonError);
        throw new Error('API返回了无效的JSON数据');
      }

      console.log('API返回数据有效:', data.choices ? '有choices' : '无choices');

      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error('无效的API响应结构:', data);
        throw new Error('API返回了无效的数据结构');
      }

      const choice = data.choices[0];
      if (!choice || !choice.message || !choice.message.content) {
        console.error('无效的choice结构:', choice);
        throw new Error('API返回了无效的消息内容');
      }

      const reply = choice.message.content.trim();
      console.log('成功获取回复，长度:', reply.length, '字符');

      // 9. 返回成功响应
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Response-Time': `${endTime - startTime}ms`,
          'Content-Language': language
        },
        body: JSON.stringify({
          reply: reply,
          language: language,
          usage: data.usage || {},
          timestamp: new Date().toISOString(),
          model: data.model || 'deepseek-chat'
        })
      };

    } catch (fetchError) {
      clearTimeout(timeout);
      console.error('DeepSeek API调用错误:', fetchError);
      throw fetchError;
    }

  } catch (error) {
    console.error('=== 函数执行错误 ===', error);
    
    // 10. 错误处理
    let language = 'zh';
    try {
      if (event.body) {
        const parsed = JSON.parse(event.body);
        const message = parsed.message || '';
        const hasChinese = /[\u4e00-\u9fa5]/.test(message);
        language = hasChinese ? 'zh' : 'en';
      }
    } catch (parseError) {
      console.error('检测语言时解析错误:', parseError);
    }
    
    let userMessage;
    if (error.name === 'AbortError') {
      userMessage = language === 'zh'
        ? '⏱️ **AI响应超时**\n\n可能原因：\n• 问题较复杂，需要更多时间思考\n• 网络连接不稳定\n• AI服务当前繁忙\n\n**建议操作：**\n1. 简化问题或分成几个小问题\n2. 检查网络连接\n3. 稍等几分钟后重试\n4. 确保API密钥有效且未过期'
        : '⏱️ **AI Response Timeout**\n\nPossible reasons:\n• Question is complex, needs more thinking time\n• Unstable network connection\n• AI service is currently busy\n\n**Suggested actions:**\n1. Simplify your question or break it down\n2. Check network connection\n3. Wait a few minutes and try again\n4. Ensure API key is valid and not expired';
    } else if (error.message.includes('network') || error.message.includes('Network')) {
      userMessage = language === 'zh'
        ? '🌐 **网络连接问题**\n\n无法连接到AI服务。请检查：\n1. 您的网络连接是否正常\n2. 代理或防火墙设置\n3. 尝试刷新页面\n\n**本地测试：**\n如果本地开发，请运行 `netlify dev` 启动开发服务器'
        : '🌐 **Network Connection Issue**\n\nCannot connect to AI service. Please check:\n1. Your internet connection\n2. Proxy or firewall settings\n3. Try refreshing the page\n\n**Local testing:**\nIf developing locally, run `netlify dev` to start dev server';
    } else if (error.message.includes('API_KEY')) {
      userMessage = language === 'zh'
        ? '🔑 **API密钥配置错误**\n\n**步骤检查：**\n1. DeepSeek平台获取有效API密钥\n2. Netlify中设置环境变量：DEEPSEEK_API_KEY\n3. 重新部署项目\n4. 确认账户有足够余额\n\n**部署帮助：**\n访问项目README查看详细部署指南'
        : '🔑 **API Key Configuration Error**\n\n**Checklist:**\n1. Get valid API key from DeepSeek platform\n2. Set environment variable in Netlify: DEEPSEEK_API_KEY\n3. Redeploy the project\n4. Confirm account has sufficient balance\n\n**Deployment help:**\nSee project README for detailed deployment guide';
    } else {
      userMessage = language === 'zh'
        ? `❌ **服务暂时不可用**\n\n错误详情：${error.message.substring(0, 200)}\n\n**故障排除：**\n1. 查看浏览器控制台错误信息\n2. 检查Netlify函数日志\n3. 联系系统管理员\n4. 临时问题，请稍后重试`
        : `❌ **Service Temporarily Unavailable**\n\nError details: ${error.message.substring(0, 200)}\n\n**Troubleshooting:**\n1. Check browser console for errors\n2. Check Netlify function logs\n3. Contact system administrator\n4. Temporary issue, please try again later`;
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify({
        reply: userMessage,
        language: language,
        error: error.name || 'UNKNOWN_ERROR',
        message: error.message,
        isError: true,
        timestamp: new Date().toISOString(),
        help: language === 'zh' 
          ? '如需更多帮助，请查看项目README中的故障排除章节'
          : 'For more help, see troubleshooting section in project README'
      })
    };
  }
}