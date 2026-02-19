import { Router } from "express";
import multer from "multer";
import FormData from "form-data";
import fs from "fs";

const router = Router();
const upload = multer({ dest: "uploads/" });

const PYTHON_API = process.env.PYTHON_API_URL || "http://127.0.0.1:8000";

const nodeFetch = async (...args: Parameters<typeof fetch>) => {
  const mod = await import("node-fetch");
  const fetchFn = mod.default as unknown as typeof fetch;
  return fetchFn(...args);
};

router.post("/screen", upload.single("video"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Video file is required" });
  }

  try {
    const formData = new FormData();
    formData.append(
      "video",
      fs.createReadStream(req.file.path),
      req.file.originalname
    );

    const response = await nodeFetch(`${PYTHON_API}/api/screen`, {
      method: "POST",
      body: formData,
      headers: formData.getHeaders(),
    });

    const data = await response.json();

    fs.unlinkSync(req.file.path); // cleanup temp file

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Screening failed" });
  }
});

export default router;
