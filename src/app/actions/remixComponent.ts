'use server';

import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface RemixResponse {
  componentCode: string;
  description: string;
}

export async function remixComponent(
  originalPrompt: string,
  newPrompt: string,
  originalCode: string,
  promptHistory: string[] = []
): Promise<RemixResponse> {
  try {
    console.log(`[Server Action] Remixing component from "${originalPrompt}" to "${newPrompt}"`);
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Format the prompt history for inclusion in the request
    const formattedPromptHistory = promptHistory.length 
      ? `Previous prompts in this visualization's history:\n${promptHistory.map((p, i) => `${i+1}. "${p}"`).join('\n')}`
      : '';

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `You are an expert in creative coding and audio visualization. Your task is to update an existing audio-reactive visualization based on a new prompt while maintaining the core structure of the original code.

Important Guidelines for Audio-Reactive Visualization Code:
1. Maintain the same technology (Canvas or Three.js) as the original code
2. Use the existing code structure as a starting point and make targeted modifications
3. Keep the same MODE comment at the start (either "// MODE: CANVAS" or "// MODE: THREE.JS")
4. Focus on modifying visual elements, colors, shapes, and behaviors to match the new prompt
5. Preserve any well-functioning audio reactivity from the original code
6. Make sure to retain the overall architecture while updating visual elements

When making your changes:
- Add comments to explain significant modifications
- Ensure the visualization remains performant
- Keep any essential helper functions or variables from the original
- Make sure the visualization is highly responsive to audio input`
        },
        {
          role: "user",
          content: `Original Prompt: "${originalPrompt}"
New Prompt: "${newPrompt}"
${formattedPromptHistory}

Here is the original visualization code:
\`\`\`javascript
${originalCode}
\`\`\`

Please update this code to create a new visualization that matches the new prompt while maintaining the core structure and audio reactivity of the original.

Return a JSON object with two properties:
- componentCode (string): Your updated JavaScript code for the visualization
- description (string): A brief description of what you changed and how it relates to the new prompt`
        }
      ],
      response_format: { type: "json_object" }
    });

    // Parse the response to get the code
    const assistantResponse = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      componentCode: assistantResponse.componentCode || '',
      description: assistantResponse.description || 'Updated visualization'
    };
  } catch (error) {
    console.error('[Server Action] Error remixing component:', error);
    throw new Error('Failed to remix visualization component');
  }
} 