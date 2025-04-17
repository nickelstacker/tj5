"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import nlp from 'compromise';

type SearchResult = {
  ingredient: string;
  quantity: string;
  title: string;
  url: string | null;
  thumbnail: string | null;
  price: string | null;
};
// staple ingredient type with optional quantity
type Staple = { name: string; quantity: string };
export default function RecipeToTJs() {
  const [url, setUrl] = useState("https://www.allrecipes.com/recipe/223042/chicken-parmesan/");
  const [ingredients, setIngredients] = useState<SearchResult[]>([]);
  const [staples, setStaples] = useState<Staple[]>([]);
  // Instructions may come back as a string or an array of steps
  const [instructions, setInstructions] = useState<string | string[] | null>(null);
  const [recipeImage, setRecipeImage] = useState<string | null>(null);
  const [recipeTitle, setRecipeTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    "red pepper"
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
    const nouns = doc.nouns().toSingular().out("array");
    const finalName = nouns.join(" ").trim() || rawName;

    return {
      quantity: match?.[1]?.trim() || "",
      unit: match?.[2]?.trim() || "",
      name: finalName,
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

    return {
      title: data.title || "No match found",
      url: data.link || null,
      thumbnail: data.thumbnail || null,
      price: data.price || null,
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
          simplifiedInstructions = result.instructions;
          // Map simplified names back to matched ingredients with details
          simplifiedIngredients = result.ingredients.map((ing: { name: string; quantity: string }) => {
            const found = matchedIngredients.find((m) => m.ingredient === ing.name);
            return found
              ? { ...found, quantity: ing.quantity }
              : { ingredient: ing.name, quantity: ing.quantity, title: "", url: null, thumbnail: null, price: null };
          });
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
        <Button type="submit" disabled={loading}>
          {loading ? "Loading..." : "Convert"}
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

      {ingredients.length > 0 && (
        <Card>
          <CardContent className="p-6 overflow-auto">
            <table className="min-w-full table-auto border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-3 border border-gray-300 text-left">Recipe Ingredient</th>
                  <th className="p-3 border border-gray-300 text-left">Quantity</th>
                  <th className="p-3 border border-gray-300 text-left">Trader Joe's Match</th>
                  {ingredients.some((item) => item.price) && (
                    <th className="p-3 border border-gray-300 text-left">Price</th>
                  )}
                  <th className="p-3 border border-gray-300 text-left">Image</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((item, idx) => (
                  <tr key={idx} className="border-t border-gray-300">
                    <td className="p-3 border border-gray-300">{item.ingredient}</td>
                    <td className="p-3 border border-gray-300">{item.quantity}</td>
                    <td className="p-3 border border-gray-300 whitespace-normal break-words">
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
                        <span className="text-gray-500 italic">{item.title}</span>
                      )}
                    </td>
                    {ingredients.some((i) => i.price) && (
                      <td className="p-3 border border-gray-300">{item.price || "N/A"}</td>
                    )}
                    <td className="p-3 border border-gray-300">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-40 h-40 object-cover rounded"
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
          <p className="mb-2 font-medium">You probably already have:</p>
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

      {instructions && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-2">Instructions</h2>
          
          {Array.isArray(instructions) ? (
            <ol className="list-decimal list-inside space-y-2">
              {instructions.map((step, idx) => (
                <li key={idx} className="whitespace-pre-wrap leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>
          ) : (
            <p className="whitespace-pre-wrap leading-relaxed">{instructions}</p>
          )}
        </div>
      )}
    </div>
  );
}
