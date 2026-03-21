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

  if (!childId || !report) {
    return res.status(400).json({ error: "childId and report are required" });
  }

  try {
    const normalizedRiskLevel =
      normalizeRiskLevel(riskLevel) || normalizeRiskLevel(report?.risk_assessment?.level);

    console.log("[Screening API] Saving screening result", {
      childId,
      hasReport: Boolean(report),
      riskLevelRaw: report?.risk_assessment?.level ?? riskLevel ?? null,
      riskLevelNormalized: normalizedRiskLevel,
      indicatorsCount: Array.isArray(indicators) ? indicators.length : 0,
      hasAnswers: Boolean(questionnaireAnswers),
    });

    const { data, error } = await supabase
      .from("screening_results")
      .insert({
        child_id: childId,
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
      const childName = await agentOrchestrationService.getChildName(childId);
      const summaryResult = await agentOrchestrationService.generateClinicalSummary({
        childName,
        role: "doctor",
        screeningReport: report,
      });

      await agentOrchestrationService.persistClinicalSummary({
        childId,
        sourceScreeningId: data.id,
        role: "doctor",
        summaryJson: summaryResult.data,
        generatedBy: summaryResult.meta.generatedBy,
        model: summaryResult.meta.model,
      });

      console.log("[Screening API] Cached clinical summary", {
        childId,
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
