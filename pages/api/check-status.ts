// pages/api/check-status.ts
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const SHOTSTACK_DEV_API_KEY = process.env.SHOTSTACK_DEV_API_KEY || "";
const SHOTSTACK_API_STATUS_URL = "https://api.shotstack.io/stage/render/";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing or invalid ID" });
  }

  try {
    const response = await axios.get(`${SHOTSTACK_API_STATUS_URL}${id}`, {
      headers: {
        "x-api-key": SHOTSTACK_DEV_API_KEY,
      },
    });

    const status = response.data.response.status;

    if (status === "done") {
      const url = response.data.response.url;
      return res.status(200).json({ status: "done", url });
    } else if (status === "failed") {
      return res.status(200).json({ status: "failed" });
    } else {
      return res.status(200).json({ status: "processing" });
    }
  } catch (err) {
    console.error("Status check error:", err);
    return res.status(500).json({ error: "Unable to check render status" });
  }
}