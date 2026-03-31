import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { screenVideo } from "@/services/screening";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileVideo,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Bot,
  Eye,
  Brain,
  Activity,
  Clock,
  AlertCircle,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { AgentBadge } from "@/components/AgentBadge";
import { Child, useAppStore } from "@/lib/store";
import { childrenService, screeningService } from "@/services/data";

type ScreeningStep = "upload" | "questionnaire" | "processing" | "results";
type ScreeningStatus = "in-progress" | "pending" | "reviewed";

interface QuestionnaireAnswer {
  question: string;
  answer: string;
}

const getQuestions = (t: any) => [
  {
    id: "q1",
    question: t("screeningTest.eyeContact"),
    options: [t("screeningTest.always"), t("screeningTest.sometimes"), t("screeningTest.rarely"), t("screeningTest.never")],
  },
  {
    id: "q2",
    question: t("screeningTest.pointing"),
    options: [t("screeningTest.always"), t("screeningTest.sometimes"), t("screeningTest.rarely"), t("screeningTest.never")],
  },
  {
    id: "q3",
    question: t("screeningTest.pretendPlay"),
    options: [t("screeningTest.always"), t("screeningTest.sometimes"), t("screeningTest.rarely"), t("screeningTest.never")],
  },
  {
    id: "q4",
    question: t("screeningTest.childInterest"),
    options: [t("screeningTest.always"), t("screeningTest.sometimes"), t("screeningTest.rarely"), t("screeningTest.never")],
  },
  {
    id: "q5",
    question: t("screeningTest.instructions"),
    options: [t("screeningTest.always"), t("screeningTest.sometimes"), t("screeningTest.rarely"), t("screeningTest.never")],
  },
];

const getProcessingSteps = (t: any) => [
  { agent: "screening", message: t("screeningTest.analyzeEyeGaze"), duration: 2000 },
  { agent: "screening", message: t("screeningTest.detectJointAttention"), duration: 1500 },
  { agent: "screening", message: t("screeningTest.compareBehavior"), duration: 2000 },
  { agent: "clinical", message: t("screeningTest.extractSignals"), duration: 1500 },
  { agent: "monitoring", message: t("screeningTest.generateRisk"), duration: 2000 },
];

export default function Screening() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedChildId, setSelectedChildId } = useAppStore();
  const [children, setChildren] = useState<Child[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [childrenError, setChildrenError] = useState<string | null>(null);
  const [screeningResult, setScreeningResult] = useState<any>(null);
  const [step, setStep] = useState<ScreeningStep>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [processingStep, setProcessingStep] = useState(0);
  const [riskLevel, setRiskLevel] = useState<"low" | "medium" | "high">("medium");
  const [screeningError, setScreeningError] = useState<string | null>(null);
  const [hasPriorScreening, setHasPriorScreening] = useState(false);
  const [loadingScreeningHistory, setLoadingScreeningHistory] = useState(false);
  const [screeningStatus, setScreeningStatus] = useState<ScreeningStatus>("in-progress");
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    const loadChildren = async () => {
      setLoadingChildren(true);
      setChildrenError(null);

      const { data, error } = await childrenService.getChildren();
      if (error) {
        setChildrenError(error.message || "Failed to load children");
        setLoadingChildren(false);
        return;
      }

      const normalized = (data || []).map((child: any) => ({
        id: child.id,
        name: child.name,
        dateOfBirth: child.date_of_birth,
        age: 0,
        gender: child.gender,
        screeningStatus: child.screening_status,
        riskLevel: child.risk_level,
        assignedDoctorId: child.assigned_doctor_id,
        assignedTherapistId: child.assigned_therapist_id,
        observationEndDate: child.observation_end_date,
      }));

      setChildren(normalized);
      setLoadingChildren(false);
    };

    loadChildren();
  }, []);

  const mappedChildren = useMemo(() => {
    return children.map((child) => {
      const dob = new Date(child.dateOfBirth);
      const age = Number.isNaN(dob.getTime())
        ? child.age
        : Math.max(0, Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
      return { ...child, age };
    });
  }, [children]);

  const visibleChildren = useMemo(
    () => mappedChildren.filter((child) => child.screeningStatus !== "diagnosed"),
    [mappedChildren]
  );

  const isChildSelectable = (child: Child) => child.screeningStatus === "not-started";

  const selectedChild = useMemo(
    () => visibleChildren.find((child) => child.id === selectedChildId) || null,
    [visibleChildren, selectedChildId]
  );

  const selectedChildCanStart = selectedChild ? isChildSelectable(selectedChild) : false;

  const questions = useMemo(() => getQuestions(t), [t]);
  const processingSteps = useMemo(() => getProcessingSteps(t), [t]);

  useEffect(() => {
    if (selectedChildId || visibleChildren.length === 0) return;
    const firstEligible = visibleChildren.find((child) => isChildSelectable(child));
    setSelectedChildId(firstEligible?.id || visibleChildren[0].id);
  }, [visibleChildren, selectedChildId, setSelectedChildId]);

  useEffect(() => {
    if (!selectedChildId || visibleChildren.length === 0) return;
    const exists = visibleChildren.some((child) => child.id === selectedChildId);
    if (!exists) {
      const firstEligible = visibleChildren.find((child) => isChildSelectable(child));
      setSelectedChildId(firstEligible?.id || visibleChildren[0].id);
    }
  }, [visibleChildren, selectedChildId, setSelectedChildId]);

  useEffect(() => {
    const paramChildId = searchParams.get("childId");
    const targetChild = paramChildId ? visibleChildren.find((child) => child.id === paramChildId) : null;
    if (targetChild && paramChildId !== selectedChildId) {
      setSelectedChildId(paramChildId);
    }
  }, [searchParams, selectedChildId, setSelectedChildId, visibleChildren]);

  useEffect(() => {
    const loadScreeningHistory = async () => {
      if (!selectedChildId) {
        setHasPriorScreening(false);
        return;
      }

      setLoadingScreeningHistory(true);
      const { data, error } = await screeningService.getLatestResult(selectedChildId);
      if (error) {
        console.error(error);
        setHasPriorScreening(false);
      } else {
        setHasPriorScreening(Boolean(data));
      }
      setLoadingScreeningHistory(false);
    };

    loadScreeningHistory();
  }, [selectedChildId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleStartQuestionnaire = () => {
    if (!uploadedFile || !selectedChildId) return;
    if (!selectedChildCanStart) {
      setScreeningError(
        "This child is not eligible for new screening right now. Only newly created children can be screened from this page."
      );
      return;
    }
    if (hasPriorScreening) {
      startProcessing();
      return;
    }
    setStep("questionnaire");
  };

  const handleAnswer = (answer: string) => {
    setAnswers({ ...answers, [questions[currentQuestion].id]: answer });
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      startProcessing();
    }
  };

  const startProcessing = async () => {
    if (!uploadedFile || !selectedChildId) return;
    const selectedChildExists = visibleChildren.some((child) => child.id === selectedChildId);
    if (!selectedChildExists) {
      setScreeningError("Selected child profile is invalid or no longer available. Please re-select a child.");
      setStep("upload");
      return;
    }
    if (!selectedChildCanStart) {
      setScreeningError(
        "Selected child is not eligible for new screening. Please pick a newly created child profile."
      );
      setStep("upload");
      return;
    }

    setScreeningError(null);
    setStep("processing");
    setProcessingStep(0);
    setScreeningStatus("in-progress");

    try {
      // Animate steps while backend runs
      let stepIndex = 0;
      const interval = setInterval(() => {
        setProcessingStep((prev) => Math.min(prev + 1, processingSteps.length - 1));
        stepIndex++;
        if (stepIndex >= processingSteps.length) clearInterval(interval);
      }, 1500);

      const result = await screenVideo(uploadedFile);

      clearInterval(interval);

      setScreeningResult(result);

      // Map backend risk → UI risk
      const level = result.risk_assessment?.level?.toLowerCase?.() || "medium";
      const mappedLevel = level.includes("low")
        ? "low"
        : level.includes("medium")
        ? "medium"
        : "high";
      setRiskLevel(mappedLevel);

      const indicators = Object.entries(result.metrics?.behavioral_indicators || {})
        .filter(([, value]) => Boolean(value))
        .map(([key]) => key.replace(/_/g, " "));

      setSavingStatus(true);
      const { error: saveError } = await screeningService.saveResult({
        childId: selectedChildId,
        riskLevel: mappedLevel,
        indicators,
        videoFileName: uploadedFile.name,
        questionnaireAnswers: answers,
        cvReport: result,
      });
      if (saveError) {
        throw new Error(saveError.message || "Failed to save screening result");
      }

      const { error: videoUploadError } = await screeningService.uploadScreeningVideo(selectedChildId, uploadedFile);
      if (videoUploadError) {
        console.warn("[Screening UI] Screening result saved but video upload failed:", videoUploadError.message);
      }

      const { error: childUpdateError } = await childrenService.updateChild(selectedChildId, {
        riskLevel: mappedLevel,
        screeningStatus: "pending-review",
      });
      if (childUpdateError) {
        throw new Error(childUpdateError.message || "Failed to update child status");
      }
      setSavingStatus(false);
      setScreeningStatus("pending");

      setStep("results");
    } catch (err) {
      setSavingStatus(false);
      console.error(err);
      setScreeningError(err instanceof Error ? err.message : "Screening failed. Please try again.");
      setStep("upload");
    }
  };


  const riskConfig = {
    low: {
      color: "text-success",
      bg: "bg-success/10",
      message: "The screening indicates a low likelihood of autism spectrum disorder.",
    },
    medium: {
      color: "text-warning",
      bg: "bg-warning/10",
      message: "The screening indicates some developmental patterns that warrant further observation.",
    },
    high: {
      color: "text-destructive",
      bg: "bg-destructive/10",
      message: "The screening indicates patterns that should be evaluated by a healthcare professional.",
    },
  };

  const objectiveSignals = useMemo(() => {
    const rawSignals = screeningResult?.metrics?.objective_signals || {};
    return Object.entries(rawSignals).map(([key, value]: any) => ({
      label: key.replace(/_/g, " ").replace(/\b\w/g, (m: string) => m.toUpperCase()),
      value: value?.value ?? "-",
      baseline: value?.baseline ?? "-",
      status: value?.status ?? "unknown",
    }));
  }, [screeningResult]);

  const behavioralIndicators = useMemo(() => {
    const rawIndicators = screeningResult?.metrics?.behavioral_indicators || {};
    return Object.entries(rawIndicators)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key.replace(/_/g, " "));
  }, [screeningResult]);

  return (
    <DashboardLayout>
      <AnimatePresence mode="wait">
        {/* Upload Step */}
        {step === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="mb-8">
              <h1 className="text-3xl font-bold">Early Screening</h1>
              <p className="text-muted-foreground mt-2">
                Upload a video and complete the questionnaire for AI-powered screening
              </p>
            </div>

            {screeningError && (
              <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {screeningError}
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Select Child */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h3 className="font-semibold mb-4">Select Child</h3>
                <div className="space-y-3">
                  {childrenError && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                      {childrenError}
                    </div>
                  )}

                  {loadingChildren && (
                    <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                      Loading children...
                    </div>
                  )}

                  {!loadingChildren && visibleChildren.length === 0 && !childrenError && (
                    <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                      No eligible child profiles for screening. Diagnosed children are hidden.
                    </div>
                  )}

                  {!loadingChildren && visibleChildren.length > 0 && (
                    <div className="space-y-3">
                      {visibleChildren.map((child) => {
                        const isDisabled = !isChildSelectable(child);
                        const isSelected = selectedChildId === child.id;
                        const followUpDate = child.observationEndDate ? new Date(child.observationEndDate) : null;
                        return (
                        <button
                          key={child.id}
                          disabled={isDisabled}
                          onClick={() => setSelectedChildId(child.id)}
                          className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : isDisabled
                              ? "border-border bg-muted/40 opacity-70 cursor-not-allowed"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">{child.name}</p>
                            {child.screeningStatus === "under-observation" && (
                              <span className="rounded-full bg-warning/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-warning">
                                Follow-up video to be added
                              </span>
                            )}
                            {child.screeningStatus === "pending-review" && (
                              <span className="rounded-full bg-primary/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                Awaiting doctor review
                              </span>
                            )}
                            {child.screeningStatus === "in-progress" && (
                              <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Screening in progress
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{child.age} years old</p>
                          {child.screeningStatus === "under-observation" && followUpDate && (
                            <p className="mt-1 text-xs text-warning">
                              Follow-up date: {followUpDate.toLocaleDateString()}
                            </p>
                          )}
                        </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Video */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h3 className="font-semibold mb-4">Upload Video</h3>
                <div
                  className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                    uploadedFile ? "border-success bg-success/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileUpload}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  {uploadedFile ? (
                    <div className="flex flex-col items-center">
                      <CheckCircle2 className="h-12 w-12 text-success mb-4" />
                      <p className="font-medium">{uploadedFile.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">Video uploaded successfully</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="font-medium">Drop video here or click to upload</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Any video file showing your child
                      </p>
                    </div>
                  )}
                </div>

                {/* Recording Guidelines */}
                <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-5">
                  <div className="flex items-start gap-3">
                    <FileVideo className="h-6 w-6 text-primary mt-0.5 flex-shrink-0" />
                    <div className="space-y-3">
                      <h4 className="font-semibold text-base text-foreground">Recording Guidelines</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        To help assess early behavioral patterns, parents are encouraged to record short videos of their child during <span className="font-medium" style={{ color: '#d4b800' }}>simple, natural interactions</span> at home. These activities may include:
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside ml-1">
                        <li>Calling the child&apos;s name while they are playing to check <span className="font-medium" style={{ color: '#d4b800' }}>response to name</span></li>
                        <li>Engaging them face-to-face to observe <span className="font-medium" style={{ color: '#d4b800' }}>eye contact</span></li>
                        <li>Showing or pointing at objects to see if they <span className="font-medium" style={{ color: '#d4b800' }}>follow attention</span></li>
                        <li>Recording free play to understand <span className="font-medium" style={{ color: '#d4b800' }}>behavior patterns</span></li>
                        <li>Encouraging <span className="font-medium" style={{ color: '#d4b800' }}>basic imitation tasks</span> (clapping, waving, or blowing bubbles)</li>
                        <li><span className="font-medium" style={{ color: '#d4b800' }}>Simple communication attempts</span> (asking questions or initiating conversation)</li>
                        <li>Mild <span className="font-medium" style={{ color: '#d4b800' }}>sensory interactions</span> (introducing a soft sound to observe responses)</li>
                      </ul>
                      <p className="text-sm text-muted-foreground leading-relaxed pt-1">
                        These activities are designed to capture natural reactions related to <span className="font-medium" style={{ color: '#d4b800' }}>social engagement</span>, <span className="font-medium" style={{ color: '#d4b800' }}>communication</span>, and <span className="font-medium" style={{ color: '#d4b800' }}>behavior</span>.
                      </p>
                      <p className="text-sm text-primary/90 font-medium pt-2">
                        <AlertCircle className="h-4 w-4 inline mr-1.5" />
                        The insights generated are not a medical diagnosis but can help identify early signs that may require further professional evaluation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Agent Info */}
            <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/5 p-6">
              <div className="flex items-center gap-3 mb-4">
                <AgentBadge type="screening" />
              </div>
              <p className="text-sm text-muted-foreground">
                The Screening Agent will analyze the video for behavioral patterns including eye gaze,
                social engagement, and motor behaviors. This is a screening tool, not a diagnostic assessment.
              </p>
            </div>

            <div className="mt-8 flex justify-end">
                <Button
                  size="lg"
                  variant="hero"
                  disabled={!uploadedFile || !selectedChildId || !selectedChildCanStart || loadingScreeningHistory}
                  onClick={handleStartQuestionnaire}
                >
                    {!selectedChildCanStart
                      ? "Select Eligible Child"
                      : hasPriorScreening
                      ? "Start Screening"
                      : "Continue to Questionnaire"}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
            </div>
          </motion.div>
        )}

        {/* Questionnaire Step */}
        {step === "questionnaire" && (
          <motion.div
            key="questionnaire"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-2xl mx-auto"
          >
            <Button variant="ghost" onClick={() => setStep("upload")} className="mb-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <div className="mb-8">
              <h1 className="text-3xl font-bold">Developmental Questionnaire</h1>
              <p className="text-muted-foreground mt-2">
                Question {currentQuestion + 1} of {questions.length}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="h-2 w-full rounded-full bg-muted mb-8">
              <motion.div
                className="h-full rounded-full gradient-primary"
                initial={{ width: 0 }}
                animate={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
              />
            </div>

            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-2xl border border-border bg-card p-8 shadow-elevated"
            >
              <h2 className="text-xl font-semibold mb-6">
                {questions[currentQuestion].question}
              </h2>
              <div className="space-y-3">
                {questions[currentQuestion].options.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleAnswer(option)}
                    className="w-full rounded-xl border-2 border-border p-4 text-left font-medium transition-all hover:border-primary hover:bg-primary/5"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Processing Step */}
        {step === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background"
          >
            <div className="text-center max-w-lg px-6">
              {/* Animated Brain */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="mx-auto mb-8 h-32 w-32 rounded-full gradient-hero flex items-center justify-center"
              >
                <Brain className="h-16 w-16 text-primary-foreground" />
              </motion.div>

              <h2 className="text-2xl font-bold mb-4">AI Screening in Progress</h2>

              {/* Current Processing Step */}
              <motion.div
                key={processingStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
              >
                <AgentBadge
                  type={processingSteps[processingStep]?.agent as any || "screening"}
                  animated
                  size="lg"
                  className="mb-4"
                />
                <p className="text-lg text-muted-foreground">
                  {processingSteps[processingStep]?.message || "Processing..."}
                </p>
              </motion.div>

              {/* Progress Dots */}
              <div className="flex justify-center gap-3">
                {processingSteps.map((_, index) => (
                  <motion.div
                    key={index}
                    className={`h-3 w-3 rounded-full transition-colors ${
                      index <= processingStep ? "bg-primary" : "bg-muted"
                    }`}
                    animate={index === processingStep ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Results Step */}
        {step === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="mb-8">
              <h1 className="text-3xl font-bold">Screening Results</h1>
              <p className="text-muted-foreground mt-2">
                    AI-generated screening summary
              </p>
            </div>

            {/* Status Banner */}
            <div className="mb-6 rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {screeningStatus === "in-progress" && (
                    <>
                      <Clock className="h-6 w-6 text-warning animate-spin" />
                      <div>
                        <p className="font-semibold text-warning">In Progress</p>
                        <p className="text-sm text-muted-foreground">Screening is being processed</p>
                      </div>
                    </>
                  )}
                  {screeningStatus === "pending" && (
                    <>
                      <AlertCircle className="h-6 w-6 text-primary" />
                      <div>
                        <p className="font-semibold text-primary">Pending Review</p>
                        <p className="text-sm text-muted-foreground">Awaiting doctor's clinical review</p>
                      </div>
                    </>
                  )}
                  {screeningStatus === "reviewed" && (
                    <>
                      <CheckCircle2 className="h-6 w-6 text-success" />
                      <div>
                        <p className="font-semibold text-success">Reviewed</p>
                        <p className="text-sm text-muted-foreground">Doctor has reviewed the results</p>
                      </div>
                    </>
                  )}
                </div>
                {savingStatus && (
                  <div className="text-sm text-muted-foreground animate-pulse">
                    Saving status...
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Risk Level */}
              <div className="lg:col-span-2">
                <div className={`rounded-2xl border border-border ${riskConfig[riskLevel].bg} p-8`}>
                  <div className="flex items-center gap-4 mb-6">
                    <AgentBadge type="screening" />
                    <span className="text-sm text-muted-foreground">Generated by Screening Agent</span>
                  </div>

                  <h2 className="text-2xl font-bold mb-2">
                    Risk Assessment:{" "}
                    <span className={riskConfig[riskLevel].color}>
                      {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
                    </span>
                  </h2>
                  <p className="text-muted-foreground mb-6">{riskConfig[riskLevel].message}</p>

                  {/* Objective Signals Panel */}
                  <div className="rounded-xl bg-card p-6 border border-border mb-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      Objective Signals
                    </h3>
                    {objectiveSignals.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {objectiveSignals.map((signal, index) => (
                          <div key={index} className="rounded-lg bg-muted/50 p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{signal.label}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                signal.status === "below_baseline" 
                                  ? "bg-warning/10 text-warning" 
                                  : signal.status === "above_baseline"
                                  ? "bg-success/10 text-success"
                                  : "bg-muted text-muted-foreground"
                              }`}>
                                {signal.status?.replace(/_/g, " ")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold">{signal.value}</span>
                              <span className="text-xs text-muted-foreground">/ baseline: {signal.baseline}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No objective signals available.</p>
                    )}
                  </div>

                  <div className="rounded-xl bg-card p-6 border border-border">
                    <h3 className="font-semibold mb-4">Behavioral Indicators</h3>
                    {behavioralIndicators.length > 0 ? (
                      <ul className="space-y-3">
                        {behavioralIndicators.map((indicator, index) => (
                          <motion.li
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-center gap-3"
                          >
                            <CheckCircle2 className="h-5 w-5 text-success" />
                            <span className="capitalize">{indicator}</span>
                          </motion.li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No behavioral indicators available.</p>
                    )}
                  </div>
                </div>

                {/* Next Steps */}
                <div className="mt-6 rounded-2xl border border-primary bg-primary/5 p-6">
                  <h3 className="font-semibold mb-2">What's Next?</h3>
                  <p className="text-muted-foreground mb-4">
                    Your screening has been saved with a status of <span className="font-semibold text-primary">Pending Review</span>. Your assigned doctor can now review these results from their dashboard. You'll be notified once they complete their clinical review.
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={() => navigate(`/parent/progress?childId=${selectedChildId}`)}>
                      View Progress Dashboard
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/parent")}>
                      Return to Dashboard
                    </Button>
                  </div>
                </div>
              </div>

              {/* AI Agents Sidebar */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                  <h3 className="font-semibold mb-4">Screening Status</h3>
                  <div className="space-y-3">
                    <div className="rounded-lg bg-muted/50 p-3 border border-primary/20">
                      <p className="text-xs font-medium text-muted-foreground mb-1">CURRENT STATUS</p>
                      <p className="text-lg font-bold capitalize text-primary">{screeningStatus}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {screeningStatus === "pending" && "Waiting for doctor review"}
                        {screeningStatus === "in-progress" && "Processing screening data"}
                        {screeningStatus === "reviewed" && "Doctor has reviewed results"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                  <h3 className="font-semibold mb-4">AI Agents Involved</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <AgentBadge type="screening" size="sm" showLabel={false} />
                      <div>
                        <p className="font-medium text-sm">Screening Agent</p>
                        <p className="text-xs text-muted-foreground">Video analysis complete</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <AgentBadge type="clinical" size="sm" showLabel={false} />
                      <div>
                        <p className="font-medium text-sm">Clinical Summary Agent</p>
                        <p className="text-xs text-muted-foreground">Summary generated</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
                  <Bot className="h-8 w-8 text-primary mb-3" />
                  <p className="text-sm font-medium mb-2">Important Notice</p>
                  <p className="text-xs text-muted-foreground">
                    AI supports decisions, humans remain in control. This screening is not a
                    diagnosis. A qualified healthcare professional will review these results.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
