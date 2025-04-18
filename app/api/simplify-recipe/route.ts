import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ingredients, staples, instructions } = body;

    const systemMessage =
      "You are an assistant that simplifies recipes. Select the 5 most important non-staple ingredients, and rewrite the instructions accordingly using only those ingredients and the staples provided. Make sure the instructions do not include any ingredients other than staples and the 5 you chose.";

    const messages = [
      { role: 'system', content: systemMessage },
      {
        role: 'user',
        content:
          `Ingredients:\n${ingredients
            .map((ing: { name: string; quantity: string }) => `- ${ing.quantity} ${ing.name}`)
            .join('\n')}\n` +
          `Staples:\n${staples.map((s: string) => `- ${s}`).join('\n')}\n` +
          `Instructions:\n${instructions}\n` +
          `\nRespond with a JSON object containing these three fields exactly:\n` +
          `1. \"ingredients\": an array of objects with \"name\" and \"quantity\" for the top 5 ingredients you selected.\n` +
          `2. \"discardedIngredients\": an array of objects with \"name\" and \"quantity\" for the remaining non-staple ingredients you did not choose.\n` +
          `3. \"instructions\": the rewritten instructions using only the chosen ingredients and staples.\n` +
          `No additional text or fields.`,
      },
    ] as ChatCompletionMessageParam[];

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.7,
    });

    // Extract and clean the assistant's reply, stripping any markdown fences
    const raw = completion.choices[0].message?.content || '';
    let content = raw.trim();
    // Remove triple-backtick fences (```json or ```)
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
    }
    // Attempt to parse JSON
    try {
      const json = JSON.parse(content);
      return NextResponse.json(json);
    } catch (e) {
      // Fallback if JSON parsing fails: split into kept and discarded lists
      const fallback = {
        ingredients: ingredients.slice(0, 5),
        discardedIngredients: ingredients.slice(5),
        instructions: content,
      };
      return NextResponse.json(fallback);
    }
  } catch (error) {
    console.error('Simplify recipe error:', error);
    return NextResponse.json({ ingredients: [], instructions: '' }, { status: 500 });
  }
}