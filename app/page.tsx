"use client";

import React, { useState } from "react";
// Simple loading spinner SVG
const Spinner = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import nlp from 'compromise';

/**
 * Represents a matched ingredient from Trader Joe's search,
 * including debug information when needed.
 */
type SearchResult = {
  ingredient: string;
  quantity: string;
  title: string;
  url: string | null;
  thumbnail: string | null;
  price: string | null;
  /** The search query sent to the SERP API */
  debugQuery?: string;
  /** Raw response data from the SERP API */
  debugRaw?: any;
};
// staple ingredient type with optional quantity
type Staple = { name: string; quantity: string };
export default function RecipeToTJs() {
  const [url, setUrl] = useState("");
  const [ingredients, setIngredients] = useState<SearchResult[]>([]);
  const [staples, setStaples] = useState<Staple[]>([]);
  // Instructions may come back as a string or an array of steps
  const [instructions, setInstructions] = useState<string | string[] | null>(null);
  const [recipeImage, setRecipeImage] = useState<string | null>(null);
  const [recipeTitle, setRecipeTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Ingredients to suggest adding beyond the top picks
  type SimpleIngredient = { name: string; quantity: string };
  const [additionalIngredients, setAdditionalIngredients] = useState<SimpleIngredient[]>([]);

  const STAPLE_INGREDIENTS = [
    "salt",
    "pepper",
    "butter",
    "oil",
    "olive oil",
    "vegetable oil",
    "canola oil",
    "sugar",
    "milk",
    "egg",
    // staple: all-purpose flour
    "all-purpose flour",
    "vanilla extract",
    "baking soda",
    "cooking spray",
    "honey",
    "water",
    "basil",
    "oregano",
    "red pepper",
  ];

  const parseForMatching = (
    input: string
  ): { quantity: string; unit: string; name: string } => {
    const regex =
      /^\s*([\d¼½¾.\-\/\s]+)?\s*(cups?|tablespoons?|tbsp|teaspoons?|tsp|pounds?|lbs?|oz|ounces?|grams?|g|ml|liters?|l)?\s+(.*)$/i;

    const match = input.match(regex);
    const rawName = match?.[3]?.trim() || input.trim();

    const cleaned = rawName.toLowerCase().replace(/,.*$/, "").replace(/\(.*?\)/g, "");
    const doc = nlp(cleaned);
    // Remove adjectives like "fresh" or "prepared" to focus on core noun(s)
    doc.delete('#Adjective');
    const nouns = doc.nouns().toSingular().out("array");
    const finalName = nouns.join(" ").trim() || rawName;

    // Remove any leftover quantity or unit tokens at the start of the name
    const unitKeywords = new Set([
      "cup", "cups", "tablespoon", "tablespoons", "tbsp", "teaspoon", "teaspoons",
      "tsp", "pound", "pounds", "lb", "lbs", "ounce", "ounces", "oz",
      "gram", "grams", "g", "ml", "liter", "liters", "l"
    ]);
    const parts = finalName.split(/\s+/);
    while (parts.length > 0) {
      const token = parts[0].toLowerCase().replace(/\.+$/, "");
      if (/^[\d\/¼½¾\.\-]+$/.test(parts[0]) || unitKeywords.has(token)) {
        parts.shift();
      } else {
        break;
      }
    }
    const cleanedName = parts.join(" ") || finalName;

    return {
      quantity: match?.[1]?.trim() || "",
      unit: match?.[2]?.trim() || "",
      name: cleanedName,
    };
  };

  const parseForStapleDetection = (input: string): string => {
    return input
      .toLowerCase()
      .replace(/-/g, " ") // normalize hyphens to spaces
      .replace(/[^a-z\s]/g, "") // remove other punctuation
      .replace(/\b(of|into|small|large|fresh|cut|shredded|cubed|diced|and|or|a|an|the)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const toTitleCase = (str: string) =>
    str.replace(/\w\S*/g, (txt) => txt[0].toUpperCase() + txt.substring(1).toLowerCase());

  const matchToTraderJoesItem = async (
    ingredient: string
  ): Promise<Omit<SearchResult, "ingredient" | "quantity">> => {
    const response = await fetch(`/api/serp-search?q=${encodeURIComponent(ingredient)}`);
    const data = await response.json();
    // Return match with debug info
    return {
      title: data.title || "No match found",
      url: data.link || null,
      thumbnail: data.thumbnail || null,
      price: data.price || null,
      debugQuery: ingredient,
      debugRaw: data,
    };
  };

  const handleFetchIngredients = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.spoonacular.com/recipes/extract?apiKey=${process.env.NEXT_PUBLIC_SPOONACULAR_API_KEY}&url=${encodeURIComponent(
          url
        )}`
      );

      if (!response.ok) throw new Error("Failed to fetch recipe.");

      const data = await response.json();
      setRecipeImage(data.image || null);
      setRecipeTitle(data.title || null);

      const rawIngredients: any[] = data.extendedIngredients || [];
      const matchedIngredients: SearchResult[] = [];
      // Collect staple ingredients with their quantities
      const stapleIngredients: Staple[] = [];

      for (const ing of rawIngredients) {
        const fullName = ing.original || "Unknown ingredient";
        const parsed = parseForMatching(fullName);
        const parsedStapleName = parseForStapleDetection(parsed.name);
        const quantityUnit = `${parsed.quantity} ${parsed.unit}`.trim();

        // Determine if the parsed ingredient matches any staple (allow partial matches)
        const isStaple = STAPLE_INGREDIENTS.some((staple) => {
          const normStaple = parseForStapleDetection(staple);
          return (
            parsedStapleName.includes(normStaple) ||
            normStaple.includes(parsedStapleName)
          );
        });

        if (isStaple) {
          const titleName = toTitleCase(parsed.name);
          // avoid duplicates by name
          if (!stapleIngredients.some((s) => s.name === titleName)) {
            stapleIngredients.push({ name: titleName, quantity: quantityUnit });
          }
          continue;
        }


        try {
          const match = await matchToTraderJoesItem(parsed.name);
          matchedIngredients.push({
            ingredient: toTitleCase(parsed.name),
            quantity: quantityUnit,
            title: match.title,
            url: match.url,
            thumbnail: match.thumbnail,
            price: match.price,
          });
        } catch (error) {
          console.error("Failed to match Trader Joe’s item for:", parsed.name, error);
          matchedIngredients.push({
            ingredient: toTitleCase(parsed.name),
            quantity: quantityUnit,
            title: "Error finding product",
            url: null,
            thumbnail: null,
            price: null,
            debugQuery: parsed.name,
            debugRaw: { error: String(error) },
          });
        }
      }

      // Simplify the recipe: select top 5 ingredients and rewrite instructions via OpenAI
      const rawInstructions = data.instructions || data.summary || "";
      const cleanInstructions = rawInstructions.replace(/<[^>]+>/g, "");
      let simplifiedIngredients = matchedIngredients;
      let simplifiedInstructions = cleanInstructions;
        try {
          // Simplify recipe via API; send staple names only
          const simplifyResponse = await fetch("/api/simplify-recipe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ingredients: matchedIngredients.map((ing) => ({ name: ing.ingredient, quantity: ing.quantity })),
              staples: stapleIngredients.map((s) => s.name),
              instructions: cleanInstructions,
            }),
          });
        if (simplifyResponse.ok) {
          const result = await simplifyResponse.json();
          // Normalize instructions to an array of steps for nicer display
          let instr: any = result.instructions;
          if (typeof instr === 'string') {
            // Attempt to parse JSON string if it's an array literal
            try {
              const parsed = JSON.parse(instr);
              if (Array.isArray(parsed)) {
                instr = parsed;
              }
            } catch {}
            // Split by newlines into steps if still a string
            if (typeof instr === 'string') {
              instr = instr
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line.length > 0);
            }
          }
          simplifiedInstructions = instr;
          // Map simplified names back to matched ingredients with details
          simplifiedIngredients = result.ingredients.map((ing: { name: string; quantity: string }) => {
            const found = matchedIngredients.find((m) => m.ingredient === ing.name);
            return found
              ? { ...found, quantity: ing.quantity }
              : { ingredient: ing.name, quantity: ing.quantity, title: "", url: null, thumbnail: null, price: null };
          });
          // Use API-provided discarded list for additional suggestions
          setAdditionalIngredients(result.discardedIngredients || []);
        } else {
          console.error("Simplify API error:", simplifyResponse.statusText);
        }
      } catch (e) {
        console.error("Error simplifying recipe:", e);
      }
      setIngredients(simplifiedIngredients);
      setStaples(stapleIngredients);
      setInstructions(simplifiedInstructions);
    } catch (err) {
      console.error("Error fetching ingredients:", err);
      setIngredients([]);
      setStaples([]);
      setInstructions(null);
      setAdditionalIngredients([]);
      setRecipeImage(null);
      setRecipeTitle(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Recipe → Trader Joe's</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleFetchIngredients();
        }}
        className="flex gap-2 mb-6"
      >
        <Input
          type="text"
          placeholder="Paste recipe URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button type="submit" disabled={loading} className="flex items-center justify-center">
          {loading && <Spinner />}
          <span className={loading ? "ml-2" : ""}>
            {loading ? "Loading" : "Convert"}
          </span>
        </Button>
      </form>

      {recipeTitle && (
        <div className="mb-4">
          <h2 className="text-4xl font-semibold mb-2 text-center">{recipeTitle}</h2>
        </div>
      )}

      {recipeImage && (
        <div className="mb-6">
          <img
            src={recipeImage}
            alt="Final dish"
            className="w-full max-h-[500px] object-cover rounded-xl shadow-md"
          />
        </div>
      )}

      {/* Instructions above the ingredient table */}
      {instructions && (
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Instructions</h2>
            {Array.isArray(instructions) ? (
              <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                {instructions.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
            ) : (
              <p className="leading-relaxed">{instructions}</p>
            )}
          </CardContent>
        </Card>
      )}
      {/* Ingredient table, with reduced padding (p-2) */}
      {ingredients.length > 0 && (
        <Card>
          <CardContent className="p-4 overflow-auto">
            <table className="min-w-full table-auto border-collapse border border-gray-300">
              <thead>
                <tr>
                  <th className="p-2 border border-gray-300 text-left sticky top-0 bg-gray-100 z-10">Recipe Ingredient</th>
                  <th className="p-2 border border-gray-300 text-left sticky top-0 bg-gray-100 z-10">Quantity</th>
                  <th className="p-2 border border-gray-300 text-left sticky top-0 bg-gray-100 z-10">Trader Joe's Match</th>
                  {ingredients.some((item) => item.price) && (
                    <th className="p-2 border border-gray-300 text-left sticky top-0 bg-gray-100 z-10">Price</th>
                  )}
                  <th className="p-2 border border-gray-300 text-left sticky top-0 bg-gray-100 z-10">Image</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((item, idx) => (
                  <tr key={idx} className="border-t border-gray-300 even:bg-gray-50">
                    <td className="p-2 border border-gray-300">{item.ingredient}</td>
                    <td className="p-2 border border-gray-300">{item.quantity}</td>
                    <td className="p-2 border border-gray-300 whitespace-normal break-words">
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline"
                        >
                          {item.title}
                        </a>
                      ) : (
                        <>
                          <span className="text-gray-500 italic">{item.title}</span>
                          {item.debugQuery && item.debugRaw && (
                            <div className="mt-1 text-xs text-gray-500">
                              <p className="font-medium">Debug:</p>
                              <p>Query: <code>{item.debugQuery}</code></p>
                              <pre className="whitespace-pre-wrap">{JSON.stringify(item.debugRaw, null, 2)}</pre>
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    {ingredients.some((i) => i.price) && (
                      <td className="p-2 border border-gray-300">{item.price || "N/A"}</td>
                    )}
                    <td className="p-2 border border-gray-300">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-24 h-24 object-cover rounded"
                        />
                      ) : (
                        <span className="text-gray-500 italic">No image</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {staples.length > 0 && (
        <div className="mt-4 text-gray-700">
          <p className="mb-2 font-medium">Already in your kitchen:</p>
          <ul className="list-disc list-inside space-y-1">
            {staples.map((item, idx) => (
              <li key={idx}>
                {item.name}
                {item.quantity && ` - ${item.quantity}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      {additionalIngredients.length > 0 && (
        <div className="mt-4 text-gray-700">
          <p className="mb-2 font-medium">Could also try adding:</p>
          <ul className="list-disc list-inside space-y-1">
            {additionalIngredients.map((item, idx) => (
              <li key={idx}>{item.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
