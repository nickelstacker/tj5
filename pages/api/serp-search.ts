import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = req.query.q as string;

  if (!query) {
    return res.status(400).json({ error: "Missing query param `q`" });
  }

  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;

  if (!apiKey || !cx) {
    return res.status(500).json({ error: "Missing GOOGLE_CSE_API_KEY or GOOGLE_CSE_CX in environment" });
  }

  try {
    const apiUrl = `https://www.googleapis.com/customsearch/v1?q=site:traderjoes.com+${encodeURIComponent(
      query
    )}&key=${apiKey}&cx=${cx}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to fetch from Google CSE" });
    }

    const data = await response.json();
    const firstItem = data.items?.[0];

    const title = firstItem?.title || "No match found";
    const link = firstItem?.link || null;

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({ title, link });
  } catch (error: any) {
    console.error("CSE Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
