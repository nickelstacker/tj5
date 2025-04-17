import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = req.query.q as string;

  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  // Ensure environment variables are set
  if (!apiKey || !cx) {
    console.error("Missing GOOGLE_CSE_API_KEY or GOOGLE_CSE_CX environment variables");
    return res
      .status(500)
      .json({ error: "Missing Google CSE API key or CSE ID" });
  }

  // Construct Google Custom Search API URL
  const apiUrl = `https://www.googleapis.com/customsearch/v1?q=site:traderjoes.com+${encodeURIComponent(
    query
  )}&key=${apiKey}&cx=${cx}`;
  console.log("Google CSE request URL:", apiUrl);

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    // Handle API-level errors
    if (data.error) {
      console.error("Google CSE API error:", data.error);
      return res
        .status(data.error.code || 500)
        .json({ error: data.error.message });
    }

    const firstItem = data.items?.[0];

    const title = firstItem?.title || "No match found";
    const link = firstItem?.link || null;
    const thumbnail =
      firstItem?.pagemap?.cse_image?.[0]?.src ||
      firstItem?.pagemap?.cse_thumbnail?.[0]?.src ||
      null;

    const price = null; // placeholder

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({ title, link, thumbnail, price });
  } catch (err: any) {
    console.error("CSE error:", err);
    res.status(500).json({ error: "Search failed" });
  }
}
