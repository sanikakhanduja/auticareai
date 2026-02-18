"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const form_data_1 = __importDefault(require("form-data"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ dest: "uploads/" });
const PYTHON_API = process.env.PYTHON_API_URL || "http://127.0.0.1:8000";
router.post("/screen", upload.single("video"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Video file required" });
    }
    try {
        const formData = new form_data_1.default();
        formData.append("video", fs_1.default.createReadStream(req.file.path), req.file.originalname);
        const response = await (0, node_fetch_1.default)(`${PYTHON_API}/api/screen`, {
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
exports.default = router;
