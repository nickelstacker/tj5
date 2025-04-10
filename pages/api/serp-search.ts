import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = req.query.q as string;

  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;

  const apiUrl = `https://www.googleapis.com/customsearch/v1?q=site:traderjoes.com+${encodeURIComponent(
    query
  )}&key=${apiKey}&cx=${cx}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

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
