// Direct HTTP caller for Gemini API to avoid library dependency overhead
const callGemini = async (prompt: string): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Invalid response structure from Gemini API');
    }
    return text.trim();
  } catch (error) {
    console.error('Gemini API call failed:', error);
    throw error;
  }
};

// 1. Generate Meeting Summary
export const generateMeetingSummary = async (transcriptText: string): Promise<string> => {
  try {
    const prompt = `Summarize the following support session transcript in detail. Highlight the customer's problem, the resolution steps taken by the agent, and the final status of the issue. Use bullet points.\n\nTranscript:\n${transcriptText}`;
    return await callGemini(prompt);
  } catch (error) {
    console.log('Falling back to local NLP for meeting summary');
    // Local NLP Fallback
    const lines = transcriptText.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return 'Empty meeting transcript. No summary available.';
    
    return `**VisionSupport Session Summary (Offline Local NLP)**\n- Total messages exchanged: ${lines.length}\n- Discussion segments recorded:\n${lines.slice(0, 5).map(l => `  * ${l}`).join('\n')}\n- End of conversation logged successfully.`;
  }
};

// 2. Sentiment Analysis
export const analyzeSentiment = async (transcriptText: string): Promise<{ sentiment: 'positive' | 'neutral' | 'negative'; score: number }> => {
  try {
    const prompt = `Analyze the sentiment of the following support session transcript. Respond with ONLY a single JSON object containing "sentiment" (value can be: positive, neutral, negative) and "score" (number from -1.0 to 1.0 representing sentiment polarity). Do not wrap in markdown.\n\nTranscript:\n${transcriptText}`;
    const result = await callGemini(prompt);
    // Strip markdown blocks if any
    const jsonStr = result.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    return {
      sentiment: parsed.sentiment || 'neutral',
      score: Number(parsed.score) || 0.0,
    };
  } catch (error) {
    console.log('Falling back to local NLP for sentiment analysis');
    // Local NLP dictionary score fallback
    const posWords = ['great', 'good', 'happy', 'solved', 'thanks', 'thank', 'perfect', 'excellent', 'amazing', 'yes'];
    const negWords = ['bad', 'error', 'broken', 'fail', 'angry', 'slow', 'frustrated', 'unhappy', 'cannot', 'issue', 'problem', 'no'];
    
    const words = transcriptText.toLowerCase().split(/\s+/);
    let score = 0;
    
    for (const w of words) {
      if (posWords.some(p => w.includes(p))) score += 0.1;
      if (negWords.some(n => w.includes(n))) score -= 0.15;
    }
    
    // Clamp
    score = Math.max(-1.0, Math.min(1.0, score));
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (score > 0.15) sentiment = 'positive';
    else if (score < -0.15) sentiment = 'negative';

    return { sentiment, score };
  }
};

// 3. Action Item Extraction
export const extractActionItems = async (transcriptText: string): Promise<string[]> => {
  try {
    const prompt = `Extract all follow-up action items, promises, tasks, or todo actions mentioned in this support session. Format your response as a simple JSON array of strings, e.g. ["Action 1", "Action 2"]. Do not wrap in markdown.\n\nTranscript:\n${transcriptText}`;
    const result = await callGemini(prompt);
    const jsonStr = result.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.log('Falling back to local NLP for action item extraction');
    // Local NLP Regex Extraction
    const lines = transcriptText.split('\n');
    const items: string[] = [];
    
    const markers = ['todo', 'will send', 'will check', 'action', 'we need to', 'please do', 'follow up'];
    for (const line of lines) {
      if (markers.some(m => line.toLowerCase().includes(m))) {
        items.push(line.trim());
      }
    }
    if (items.length === 0) {
      items.push('No explicit action items detected in transcript.');
    }
    return items;
  }
};

// 4. Support Ticket Generation
export const generateSupportTicket = async (transcriptText: string): Promise<{ ticketId: string; title: string; description: string; priority: 'Low' | 'Medium' | 'High' }> => {
  try {
    const prompt = `Generate a support ticket based on this transcript. Respond with ONLY a single JSON object containing "title" (short description), "description" (detailed symptom), and "priority" (Low, Medium, or High). Do not wrap in markdown.\n\nTranscript:\n${transcriptText}`;
    const result = await callGemini(prompt);
    const jsonStr = result.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    
    const ticketId = `VS-${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      ticketId,
      title: parsed.title || 'General Customer Inquiry',
      description: parsed.description || 'Customer initiated a support request.',
      priority: parsed.priority || 'Medium',
    };
  } catch (error) {
    console.log('Falling back to local NLP for ticket generation');
    const ticketId = `VS-${Math.floor(1000 + Math.random() * 9000)}`;
    const lines = transcriptText.split('\n').filter(l => l.trim().length > 0);
    const firstLine = lines[0] || 'VisionSupport AI Ticket';
    
    return {
      ticketId,
      title: firstLine.substring(0, 50),
      description: transcriptText.substring(0, 500) || 'Customer call log transcript available in dashboard.',
      priority: transcriptText.toLowerCase().includes('critical') || transcriptText.toLowerCase().includes('broken') ? 'High' : 'Medium',
    };
  }
};

// 5. Multi-language Translation
export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
  try {
    const prompt = `Translate the following text to ${targetLanguage}. Return ONLY the translated text, do not add explanations:\n\n${text}`;
    return await callGemini(prompt);
  } catch (error) {
    // Local simulated translation fallback
    console.log('Falling back to simulated translation');
    if (targetLanguage.toLowerCase() === 'spanish') {
      if (text.toLowerCase().includes('hello')) return 'Hola (Translated)';
      if (text.toLowerCase().includes('thank you')) return 'Gracias (Translated)';
    }
    return `${text} [Tr: ${targetLanguage}]`;
  }
};

// 6. AI Chatbot Assistant inside Session
export const chatBotAssistant = async (sessionHistory: Array<{ role: string; text: string }>, userMessage: string): Promise<string> => {
  try {
    const conversation = sessionHistory.map(h => `${h.role}: ${h.text}`).join('\n');
    const prompt = `You are a helpful VisionSupport AI Assistant in a real-time support session. Answer the user request briefly and professionally. Use the context of the chat conversation if relevant.\n\nConversation History:\n${conversation}\n\nUser Message: ${userMessage}\nAssistant:`;
    return await callGemini(prompt);
  } catch (error) {
    console.log('Falling back to local chatbot answer');
    const lowerMsg = userMessage.toLowerCase();
    if (lowerMsg.includes('help')) {
      return 'I can assist you with sharing files, running drawing tools on the whiteboard, or reviewing dashboard statistics. What do you need help with?';
    }
    if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
      return 'Hello! I am your virtual support assistant. How can I help you in this call?';
    }
    return `I received: "${userMessage}". (Offline Mode: please configure GEMINI_API_KEY to activate full AI assistance).`;
  }
};
