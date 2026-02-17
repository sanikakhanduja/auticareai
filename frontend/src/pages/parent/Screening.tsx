import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { AgentBadge } from "@/components/AgentBadge";
import { Child } from "@/lib/store";
import { childrenService } from "@/services/data";

type ScreeningStep = "upload" | "questionnaire" | "processing" | "results";

interface QuestionnaireAnswer {
  question: string;
  answer: string;
}

const questions = [
  {
    id: "q1",
    question: "Does your child make eye contact when you call their name?",
    options: ["Always", "Sometimes", "Rarely", "Never"],
  },
  {
    id: "q2",
    question: "Does your child point at objects to show interest?",
    options: ["Always", "Sometimes", "Rarely", "Never"],
  },
  {
    id: "q3",
    question: "Does your child engage in pretend play?",
    options: ["Always", "Sometimes", "Rarely", "Never"],
  },
  {
    id: "q4",
    question: "Does your child show interest in other children?",
    options: ["Always", "Sometimes", "Rarely", "Never"],
  },
  {
    id: "q5",
    question: "Does your child respond to simple instructions?",
    options: ["Always", "Sometimes", "Rarely", "Never"],
  },
];

const processingSteps = [
  { agent: "screening", message: "Screening Agent analyzing eye gaze patterns...", duration: 2000 },
  { agent: "screening", message: "Detecting joint attention patterns...", duration: 1500 },
  { agent: "screening", message: "Comparing behavior to age baseline...", duration: 2000 },
  { agent: "clinical", message: "Extracting behavioral signals...", duration: 1500 },
  { agent: "monitoring", message: "Generating risk assessment...", duration: 2000 },
];

const objectiveSignals = [
  { label: "Eye Contact Duration", value: "68%", baseline: "75%", status: "below" },
  { label: "Attention Shifts", value: "12/min", baseline: "8/min", status: "above" },
  { label: "Gesture Frequency", value: "4/min", baseline: "6/min", status: "below" },
  { label: "Social Gaze", value: "45%", baseline: "60%", status: "below" },
  { label: "Response Latency", value: "2.3s", baseline: "1.5s", status: "above" },
];

export default function Screening() {
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [childrenError, setChildrenError] = useState<string | null>(null);
  const [screeningResult, setScreeningResult] = useState<any>(null);
  const [step, setStep] = useState<ScreeningStep>("upload");
  const [selectedChild, setSelectedChild] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [processingStep, setProcessingStep] = useState(0);
  const [riskLevel, setRiskLevel] = useState<"low" | "medium" | "high">("medium");
  const [screeningError, setScreeningError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!selectedChild && mappedChildren.length > 0) {
      setSelectedChild(mappedChildren[0].id);
    }
  }, [mappedChildren, selectedChild]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleStartQuestionnaire = () => {
    if (uploadedFile && selectedChild) {
      setStep("questionnaire");
    }
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
  if (!uploadedFile) return;

  setScreeningError(null);
  setStep("processing");
  setProcessingStep(0);

  try {
    // Animate fake steps WHILE backend runs
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
    const level = result.risk_assessment.level.toLowerCase();
    setRiskLevel(level === "low risk" ? "low" : level === "medium risk" ? "medium" : "high");

    setStep("results");
  } catch (err) {
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

  const mockIndicators = [
    "Eye gaze patterns analyzed from video",
    "Social engagement behaviors observed",
    "Response to environmental stimuli noted",
    "Repetitive behavior patterns assessed",
    "Communication patterns evaluated",
  ];

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

                  {!loadingChildren && mappedChildren.length === 0 && !childrenError && (
                    <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                      No child profiles found. Please add a child to start screening.
                    </div>
                  )}

                  {!loadingChildren && mappedChildren.length > 0 && (
                    <div className="space-y-3">
                      {mappedChildren.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => setSelectedChild(child.id)}
                          className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                            selectedChild === child.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <p className="font-medium">{child.name}</p>
                          <p className="text-sm text-muted-foreground">{child.age} years old</p>
                        </button>
                      ))}
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
                disabled={!uploadedFile || !selectedChild}
                onClick={handleStartQuestionnaire}
              >
                Continue to Questionnaire
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

              <p className="mt-8 text-sm text-muted-foreground">
                Simulated AI analysis for demonstration purposes
              </p>
              <p className="mt-2 text-xs text-muted-foreground/70 italic">
                Please wait while our AI agents analyze the data...
              </p>
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

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Risk Level */}
              <div className="lg:col-span-2">
                <div className={`rounded-2xl border border-border ${riskConfig[riskLevel].bg} p-8`}>
                  <div className="flex items-center gap-4 mb-6">
                    <AgentBadge type="screening" />
                    <span className="text-sm text-muted-foreground">Generated by Screening Agent (Simulated)</span>
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
                      Objective Signal Simulation
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Demonstration of how objective behavioral signals COULD be integrated
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {objectiveSignals.map((signal, index) => (
                        <div key={index} className="rounded-lg bg-muted/50 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{signal.label}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              signal.status === "below" 
                                ? "bg-warning/10 text-warning" 
                                : "bg-muted text-muted-foreground"
                            }`}>
                              {signal.status === "below" ? "Below baseline" : "Above baseline"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold">{signal.value}</span>
                            <span className="text-xs text-muted-foreground">/ baseline: {signal.baseline}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-card p-6 border border-border">
                    <h3 className="font-semibold mb-4">Behavioral Indicators Analyzed</h3>
                    <ul className="space-y-3">
                      {mockIndicators.map((indicator, index) => (
                        <motion.li
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center gap-3"
                        >
                          <CheckCircle2 className="h-5 w-5 text-success" />
                          <span>{indicator}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Next Steps */}
                <div className="mt-6 rounded-2xl border border-primary bg-primary/5 p-6">
                  <h3 className="font-semibold mb-2">Next Steps</h3>
                  <p className="text-muted-foreground mb-4">
                    These results have been shared with your assigned doctor for clinical review.
                    You will be notified once the review is complete.
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={() => navigate("/parent/progress")}>
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

                <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6">
                  <Bot className="h-8 w-8 text-accent mb-3" />
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
