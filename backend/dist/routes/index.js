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
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ dest: "uploads/" });
const PYTHON_API = process.env.PYTHON_API_URL || "http://127.0.0.1:8000";
const nodeFetch = async (...args) => {
    const mod = await Promise.resolve().then(() => __importStar(require("node-fetch")));
    const fetchFn = mod.default;
    return fetchFn(...args);
};
router.post("/screen", upload.single("video"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Video file is required" });
    }
    try {
        const formData = new form_data_1.default();
        formData.append("video", fs_1.default.createReadStream(req.file.path), req.file.originalname);
        const response = await nodeFetch(`${PYTHON_API}/api/screen`, {
            method: "POST",
            body: formData,
            headers: formData.getHeaders(),
        });
        const data = await response.json();
        fs_1.default.unlinkSync(req.file.path); // cleanup temp file
        return res.json(data);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Screening failed" });
    }
});
exports.default = router;
