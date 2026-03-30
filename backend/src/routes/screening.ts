import { Router, Request, Response } from "express";
import multer from "multer";
import FormData from "form-data";
import fs from "fs";
import { supabase } from "../config/supabase";
import { agentOrchestrationService } from "../services/agentOrchestrationService";

const router = Router();
const upload = multer({ dest: "uploads/" });

const PYTHON_API = process.env.PYTHON_API_URL || "http://127.0.0.1:8000";

const nodeFetch = async (...args: Parameters<typeof fetch>) => {
  const mod = await import("node-fetch");
  const fetchFn = mod.default as unknown as typeof fetch;
  return fetchFn(...args);
};

const normalizeRiskLevel = (raw: unknown): "low" | "medium" | "high" | null => {
  if (!raw) return null;
  const value = String(raw).trim().toLowerCase();
  if (value.includes("low")) return "low";
  if (value.includes("med")) return "medium";
  if (value.includes("high")) return "high";
  return null;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const SCREENING_VIDEO_BUCKET = process.env.SCREENING_VIDEO_BUCKET || "screening-videos";


router.post("/screen", upload.single("video"), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "Video file required" });
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

    if (!response.ok) {
      let errorMessage = `Python screening service error (${response.status})`;
      try {
        const errorBody: any = await response.json();
        if (errorBody?.error) {
          errorMessage = errorBody.error;
        }
      } catch {
        try {
          const text = await response.text();
          if (text) {
            errorMessage = text;
          }
        } catch {
          // ignore
        }
      }

      fs.unlinkSync(req.file.path); // cleanup temp file
      return res.status(502).json({ error: errorMessage });
    }

    const data = await response.json();

    fs.unlinkSync(req.file.path); // cleanup temp file

    return res.json(data);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Screening failed";
    return res.status(502).json({ error: message });
  }
});

// Upload screening video for doctor playback (stored in Supabase Storage)
router.post("/results/video", upload.single("video"), async (req: Request, res: Response) => {
  const childId = typeof req.body?.childId === "string" ? req.body.childId.trim() : "";

  if (!childId || !isUuid(childId)) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Valid childId is required" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "Video file is required" });
  }

  try {
    const ext = (req.file.originalname.split(".").pop() || "mp4").toLowerCase();
    const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext : "mp4";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const objectPath = `${childId}/${timestamp}-${req.file.filename}.${safeExt}`;
    const fileBuffer = fs.readFileSync(req.file.path);

    const { error: uploadError } = await supabase.storage
      .from(SCREENING_VIDEO_BUCKET)
      .upload(objectPath, fileBuffer, {
        contentType: req.file.mimetype || "video/mp4",
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({ error: `Failed to upload screening video: ${uploadError.message}` });
    }

    return res.json({
      data: {
        bucket: SCREENING_VIDEO_BUCKET,
        objectPath,
      },
    });
  } catch (err) {
    console.error("[Screening API] Failed to upload screening video", err);
    const message = err instanceof Error ? err.message : "Failed to upload screening video";
    return res.status(500).json({ error: message });
  } finally {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

// Get latest screening video signed URL for a child (no DB dependency)
router.get("/results/:childId/latest-video", async (req: Request, res: Response) => {
  const childId = typeof req.params?.childId === "string" ? req.params.childId.trim() : "";
  if (!childId || !isUuid(childId)) {
    return res.status(400).json({ error: "Invalid childId format. Expected UUID." });
  }

  try {
    const { data: files, error: listError } = await supabase.storage
      .from(SCREENING_VIDEO_BUCKET)
      .list(childId, {
        limit: 100,
        sortBy: { column: "name", order: "desc" },
      });

    if (listError) {
      return res.status(500).json({ error: `Failed to list screening videos: ${listError.message}` });
    }

    if (!files || files.length === 0) {
      return res.status(404).json({ error: "No screening video found for this child" });
    }

    const latestFile = files[0];
    const latestPath = `${childId}/${latestFile.name}`;
    const { data: signedData, error: signedError } = await supabase.storage
      .from(SCREENING_VIDEO_BUCKET)
      .createSignedUrl(latestPath, 3600);

    if (signedError || !signedData?.signedUrl) {
      return res.status(500).json({ error: `Failed to create signed URL: ${signedError?.message || "Unknown error"}` });
    }

    return res.json({
      data: {
        signedUrl: signedData.signedUrl,
        objectPath: latestPath,
        expiresInSeconds: 3600,
      },
    });
  } catch (err) {
    console.error("[Screening API] Failed to fetch latest screening video", err);
    const message = err instanceof Error ? err.message : "Failed to fetch latest screening video";
    return res.status(500).json({ error: message });
  }
});

// Get screening results for a specific child
router.get("/results/:childId", async (req: Request, res: Response) => {
  const { childId } = req.params;

  try {
    const { data, error } = await supabase
      .from("screening_results")
      .select("*")
      .eq("child_id", childId)
      .order("created_at", { ascending: false })
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return res.status(404).json({ error: "No screening results found" });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.json({ data });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Failed to fetch screening results";
    return res.status(500).json({ error: message });
  }
});

// Save screening results
router.post("/results", async (req: Request, res: Response) => {
  const { childId, report, indicators, videoFileName, questionnaireAnswers, riskLevel } = req.body;
  const normalizedChildId = typeof childId === "string" ? childId.trim() : "";

  if (!normalizedChildId || !report) {
    return res.status(400).json({ error: "childId and report are required" });
  }
  if (!isUuid(normalizedChildId)) {
    return res.status(400).json({ error: "Invalid childId format. Expected UUID." });
  }

  try {
    const { data: existingChild, error: childLookupError } = await supabase
      .from("children")
      .select("id")
      .eq("id", normalizedChildId)
      .maybeSingle();

    if (childLookupError) {
      console.error("[Screening API] Failed to verify child before save:", childLookupError.message);
      return res.status(500).json({ error: "Failed to verify child profile before saving screening result" });
    }
    if (!existingChild) {
      return res.status(404).json({ error: "Child not found. Select an existing child profile and retry." });
    }

    const normalizedRiskLevel =
      normalizeRiskLevel(riskLevel) || normalizeRiskLevel(report?.risk_assessment?.level);

    console.log("[Screening API] Saving screening result", {
      childId: normalizedChildId,
      hasReport: Boolean(report),
      riskLevelRaw: report?.risk_assessment?.level ?? riskLevel ?? null,
      riskLevelNormalized: normalizedRiskLevel,
      indicatorsCount: Array.isArray(indicators) ? indicators.length : 0,
      hasAnswers: Boolean(questionnaireAnswers),
    });

    const { data, error } = await supabase
      .from("screening_results")
      .insert({
        child_id: normalizedChildId,
        risk_level: normalizedRiskLevel,
        indicators: indicators || null,
        cv_report: report,
        video_url: videoFileName || null,
        answers: questionnaireAnswers || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[Screening API] Failed to save screening result:", error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log("[Screening API] Saved screening result row", { id: data.id, childId: data.child_id });

    // Non-blocking cache warm-up for clinical summaries.
    // This ensures doctor/parent portals can instantly reuse generated summaries.
    try {
      const childName = await agentOrchestrationService.getChildName(normalizedChildId);
      const summaryResult = await agentOrchestrationService.generateClinicalSummary({
        childName,
        role: "doctor",
        screeningReport: report,
      });

      await agentOrchestrationService.persistClinicalSummary({
        childId: normalizedChildId,
        sourceScreeningId: data.id,
        role: "doctor",
        summaryJson: summaryResult.data,
        generatedBy: summaryResult.meta.generatedBy,
        model: summaryResult.meta.model,
      });

      console.log("[Screening API] Cached clinical summary", {
        childId: normalizedChildId,
        sourceScreeningId: data.id,
        role: "doctor",
        generatedBy: summaryResult.meta.generatedBy,
      });
    } catch (cacheError) {
      console.warn("[Screening API] Failed to warm clinical summary cache:", cacheError);
    }

    return res.json({ data });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Failed to save screening results";
    return res.status(500).json({ error: message });
  }
});

export default router;
