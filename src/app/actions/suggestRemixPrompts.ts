'use server';

import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface SuggestedPrompt {
  prompt: string;
  description: string;
}

export async function suggestRemixPrompts(
  originalPrompt: string,
  originalCode: string,
  promptHistory: string[] = []
): Promise<SuggestedPrompt[]> {
  try {
    console.log(`[Server Action] Generating remix prompt suggestions for: "${originalPrompt}"`);
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Format the prompt history for inclusion in the request
    const formattedPromptHistory = promptHistory.length > 1
      ? `Previous prompts in this visualization's history:\n${promptHistory.map((p, i) => `${i+1}. "${p}"`).join('\n')}`
      : '';

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `You are an expert in creative coding and audio visualization. Your task is to suggest interesting remix prompts for an existing audio-reactive visualization.

The suggestions should:
1. Maintain the same general theme or feel as the original, but with creative variations
2. Use specific, descriptive language that will guide the visualization
3. Suggest contrasting or complementary visual styles
4. Provide a mix of simple tweaks and more dramatic changes
5. Be varied in terms of the visual approach

Each suggested prompt should be accompanied by a brief description of what kind of changes it might inspire.`
        },
        {
          role: "user",
          content: `Original Prompt: "${originalPrompt}"
${formattedPromptHistory}

Here is the original visualization code:
\`\`\`javascript
${originalCode}
\`\`\`

Please suggest 3 different prompts that could be used to remix this visualization. Make them creative, varied and specific.

Return a JSON array with objects that have these properties:
- prompt (string): The suggested remix prompt
- description (string): A brief description of what changes this prompt might inspire`
        }
      ],
      response_format: { type: "json_object" }
    });

    // Parse the response to get the suggestions
    const assistantResponse = JSON.parse(response.choices[0].message.content || '{}');
    
    // Ensure we have an array of suggestions, even if API returns a different format
    const suggestions = Array.isArray(assistantResponse) 
      ? assistantResponse 
      : Array.isArray(assistantResponse.suggestions) 
        ? assistantResponse.suggestions 
        : [];
    
    return suggestions.slice(0, 3); // Limit to 3 suggestions
  } catch (error) {
    console.error('[Server Action] Error generating remix suggestions:', error);
    // Return empty array rather than throwing on error
    return [];
  }
} 