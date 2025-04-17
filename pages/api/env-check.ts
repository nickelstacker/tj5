// pages/api/env-check.ts

import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_: NextApiRequest, res: NextApiResponse) {
  const key = process.env.OPENAI_API_KEY;
  // we'll JSON.stringify to reveal any hidden quotes or stray characters
  res.status(200).json({ key: JSON.stringify(key) });
}
