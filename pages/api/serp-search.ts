import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const query = req.query.q as string;

  if (!query) {
    return res.status(400).json({ error: "Missing query param `q`" });
  }

  try {
    const serpApiKey = process.env.SERPAPI_KEY;
    if (!serpApiKey) {
      return res
        .status(500)
        .json({ error: "Missing SERPAPI_KEY in environment" });
    }

    const response = await fetch(
      `https://serpapi.com/search.json?q=site:traderjoes.com ${encodeURIComponent(
        query
      )}&api_key=${serpApiKey}`
    );

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: "Failed to fetch from SerpApi" });
    }

    const data = await response.json();
    const firstResult = data.organic_results?.[0];

    const title = firstResult?.title || "No match found";
    const link = firstResult?.link || null;
    const thumbnail =
      firstResult?.rich_snippet?.top?.detected_extensions?.image ||
      firstResult?.thumbnail ||
      null;
    const price =
      firstResult?.rich_snippet?.top?.detected_extensions?.price || "N/A";

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({ title, link, thumbnail, price });
  } catch (error: any) {
    console.error("SerpApi Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
