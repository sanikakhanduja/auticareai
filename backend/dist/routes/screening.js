"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const form_data_1 = __importDefault(require("form-data"));
const fs_1 = __importDefault(require("fs"));
const supabase_1 = require("../config/supabase");
const agentOrchestrationService_1 = require("../services/agentOrchestrationService");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ dest: "uploads/" });
const PYTHON_API = process.env.PYTHON_API_URL || "http://127.0.0.1:8000";
const nodeFetch = async (...args) => {
    const mod = await Promise.resolve().then(() => __importStar(require("node-fetch")));
    const fetchFn = mod.default;
    return fetchFn(...args);
};
const normalizeRiskLevel = (raw) => {
    if (!raw)
        return null;
    const value = String(raw).trim().toLowerCase();
    if (value.includes("low"))
        return "low";
    if (value.includes("med"))
        return "medium";
    if (value.includes("high"))
        return "high";
    return null;
};
router.post("/screen", upload.single("video"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Video file required" });
    }
    try {
        const formData = new form_data_1.default();
        formData.append("video", fs_1.default.createReadStream(req.file.path), req.file.originalname);
        const response = await nodeFetch(`${PYTHON_API}/api/screen`, {
            method: "POST",
            body: formData,
            headers: formData.getHeaders(),
        });
        if (!response.ok) {
            let errorMessage = `Python screening service error (${response.status})`;
            try {
                const errorBody = await response.json();
                if (errorBody?.error) {
                    errorMessage = errorBody.error;
                }
            }
            catch {
                try {
                    const text = await response.text();
                    if (text) {
                        errorMessage = text;
                    }
                }
                catch {
                    // ignore
                }
            }
            fs_1.default.unlinkSync(req.file.path); // cleanup temp file
            return res.status(502).json({ error: errorMessage });
        }
        const data = await response.json();
        fs_1.default.unlinkSync(req.file.path); // cleanup temp file
        return res.json(data);
    }
    catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : "Screening failed";
        return res.status(502).json({ error: message });
    }
});
// Get screening results for a specific child
router.get("/results/:childId", async (req, res) => {
    const { childId } = req.params;
    try {
        const { data, error } = await supabase_1.supabase
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
    }
    catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : "Failed to fetch screening results";
        return res.status(500).json({ error: message });
    }
});
// Save screening results
router.post("/results", async (req, res) => {
    const { childId, report, indicators, videoFileName, questionnaireAnswers, riskLevel } = req.body;
    if (!childId || !report) {
        return res.status(400).json({ error: "childId and report are required" });
    }
    try {
        const normalizedRiskLevel = normalizeRiskLevel(riskLevel) || normalizeRiskLevel(report?.risk_assessment?.level);
        console.log("[Screening API] Saving screening result", {
            childId,
            hasReport: Boolean(report),
            riskLevelRaw: report?.risk_assessment?.level ?? riskLevel ?? null,
            riskLevelNormalized: normalizedRiskLevel,
            indicatorsCount: Array.isArray(indicators) ? indicators.length : 0,
            hasAnswers: Boolean(questionnaireAnswers),
        });
        const { data, error } = await supabase_1.supabase
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
            const childName = await agentOrchestrationService_1.agentOrchestrationService.getChildName(childId);
            const summaryResult = await agentOrchestrationService_1.agentOrchestrationService.generateClinicalSummary({
                childName,
                role: "doctor",
                screeningReport: report,
            });
            await agentOrchestrationService_1.agentOrchestrationService.persistClinicalSummary({
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
        }
        catch (cacheError) {
            console.warn("[Screening API] Failed to warm clinical summary cache:", cacheError);
        }
        return res.json({ data });
    }
    catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : "Failed to save screening results";
        return res.status(500).json({ error: message });
    }
});
exports.default = router;
