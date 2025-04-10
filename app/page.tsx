"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type SearchResult = {
  ingredient: string;
  quantity: string;
  title: string;
  url: string | null;
  thumbnail: string | null;
  price: string | null;
};

export default function RecipeToTJs() {
  const [url, setUrl] = useState("https://www.allrecipes.com/recipe/223042/chicken-parmesan/");
  const [ingredients, setIngredients] = useState<SearchResult[]>([]);
  const [staples, setStaples] = useState<string[]>([]);
  const [instructions, setInstructions] = useState<string | null>(null);
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
    "all-purpose flour",
    "vanilla extract",
    "baking soda",
    "cooking spray",
  ];

  const parseForMatching = (
    input: string
  ): { quantity: string; unit: string; name: string } => {
    const regex =
      /^\s*([\d¼½¾.\-\/\s]+)?\s*(cups?|tablespoons?|tbsp|teaspoons?|tsp|pounds?|lbs?|oz|ounces?|grams?|g|ml|liters?|l)?\s+(.*)$/i;

    const match = input.match(regex);
    return {
      quantity: match?.[1]?.trim() || "",
      unit: match?.[2]?.trim() || "",
      name: match?.[3]?.trim() || input.trim(),
    };
  };

  const parseForStapleDetection = (input: string): string => {
    return input
      .toLowerCase()
      .replace(/[^a-z\s]/g, "") // remove punctuation
      .replace(/\b(of|into|small|large|fresh|cut|shredded|cubed|diced|and|or|a|an|the)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const toTitleCase = (str: string) =>
    str.replace(/\w\S*/g, (txt) => txt[0].toUpperCase() + txt.substring(1).toLowerCase());

  const matchToTraderJoesItem = async (
    ingredient: string
  ): Promise<Omit<SearchResult, "ingredient" | "quantity">> => {
    try {
      const response = await fetch(`/api/serp-search?q=${encodeURIComponent(ingredient)}`);
      const data = await response.json();

      return {
        title: data.title || "No match found",
        url: data.link || null,
        thumbnail: data.thumbnail || null,
        price: data.price || null,
      };
    } catch (err) {
      console.error("Error searching Trader Joe's for:", ingredient, err);
      return {
        title: "Error finding product",
        url: null,
        thumbnail: null,
        price: null,
      };
    }
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
      const stapleIngredients: string[] = [];

      for (const ing of rawIngredients) {
        const fullName = ing.original || "Unknown ingredient";
        const parsed = parseForMatching(fullName);
        const parsedStapleName = parseForStapleDetection(parsed.name);
        const quantityUnit = `${parsed.quantity} ${parsed.unit}`.trim();

        const isStaple = STAPLE_INGREDIENTS.some((staple) =>
          parsedStapleName.includes(staple)
        );

        if (isStaple) {
          stapleIngredients.push(toTitleCase(parsed.name));
          continue;
        }

        const match = await matchToTraderJoesItem(parsed.name);

        matchedIngredients.push({
          ingredient: toTitleCase(parsed.name),
          quantity: quantityUnit,
          title: match.title,
          url: match.url,
          thumbnail: match.thumbnail,
          price: match.price,
        });
      }

      setIngredients(matchedIngredients);
      setStaples(stapleIngredients);

      const rawInstructions = data.instructions || data.summary || null;
      setInstructions(rawInstructions?.replace(/<[^>]+>/g, "") || null);
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
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {instructions && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-2">Instructions</h2>
          <p className="whitespace-pre-wrap leading-relaxed">{instructions}</p>
        </div>
      )}
    </div>
  );
}
