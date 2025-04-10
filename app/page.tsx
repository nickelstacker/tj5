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
  const [instructions, setInstructions] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      const ingredientData = data.extendedIngredients?.[0]; // just the first ingredient

      const fullName = ingredientData?.original || "Unknown ingredient";
      const quantityUnit = `${ingredientData?.amount || ""} ${ingredientData?.unit || ""}`.trim();

      const parsedIngredient = parseIngredient(fullName);

      const result = await matchToTraderJoesItem(parsedIngredient.name);
      setIngredients([
        {
          ingredient: toTitleCase(parsedIngredient.name),
          quantity: quantityUnit,
          title: result.title,
          url: result.url,
          thumbnail: result.thumbnail,
          price: result.price,
        },
      ]);

      const rawInstructions = data.instructions || data.summary || null;
      setInstructions(rawInstructions?.replace(/<[^>]+>/g, "") || null);
    } catch (err) {
      console.error("Error fetching ingredients:", err);
      setIngredients([
        {
          ingredient: "Error fetching ingredients",
          quantity: "",
          title: "N/A",
          url: null,
          thumbnail: null,
          price: null,
        },
      ]);
      setInstructions(null);
    } finally {
      setLoading(false);
    }
  };

  const parseIngredient = (
    input: string
  ): { quantity: string; unit: string; name: string } => {
    const regex =
      /^\s*(\d+\s*\d*\/?\d*)?\s*(cups?|cup|tablespoons?|tbsp|teaspoons?|tsp|pounds?|lbs?|oz|ounces?|grams?|g|ml|liters?|l)?\s*(.*)/i;

    const match = input.match(regex);
    return {
      quantity: match?.[1]?.trim() || "",
      unit: match?.[2]?.trim() || "",
      name: match?.[3]?.trim() || input,
    };
  };

  const toTitleCase = (str: string) =>
    str.replace(/\w\S*/g, (txt) => txt[0].toUpperCase() + txt.substring(1).toLowerCase());

  const matchToTraderJoesItem = async (
    ingredient: string
  ): Promise<Omit<SearchResult, "ingredient" | "quantity">> => {
    try {
      const response = await fetch(
        `/api/serp-search?q=${encodeURIComponent(ingredient)}`
      );
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

      {ingredients.length > 0 && (
        <Card>
          <CardContent className="p-6 overflow-auto">
            <table className="min-w-full table-auto border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-3 border border-gray-300 text-left">Recipe Ingredient</th>
                  <th className="p-3 border border-gray-300 text-left">Quantity</th>
                  <th className="p-3 border border-gray-300 text-left">Trader Joe's Match</th>
                  {ingredients.some(item => item.price) && (
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
                    {ingredients.some(i => i.price) && (
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

      {instructions && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-2">Instructions</h2>
          <p className="whitespace-pre-wrap leading-relaxed">{instructions}</p>
        </div>
      )}
    </div>
  );
}
