import { motion } from "framer-motion";
import {
  BookOpen,
  Eye,
  MessageSquare,
  Baby,
  Brain,
  Volume2,
  Hand,
  Repeat,
  Sparkles,
  PlayCircle,
  ExternalLink,
  AlertTriangle,
  Info,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const earlySigns = [
  {
    icon: Eye,
    title: "Reduced Eye Contact",
    description: "Difficulty making or maintaining eye contact during interactions with caregivers and others.",
    ageRange: "6-12 months",
  },
  {
    icon: MessageSquare,
    title: "Limited Response to Name",
    description: "May not consistently respond when their name is called, even when hearing is normal.",
    ageRange: "9-12 months",
  },
  {
    icon: Volume2,
    title: "Delayed Speech or Babbling",
    description: "Reduced or absent babbling, fewer first words, or regression in language skills.",
    ageRange: "12-18 months",
  },
  {
    icon: Repeat,
    title: "Repetitive Behaviors",
    description: "Engaging in repetitive movements like hand flapping, rocking, or lining up objects.",
    ageRange: "12-24 months",
  },
  {
    icon: Sparkles,
    title: "Sensory Sensitivities",
    description: "Unusual reactions to sounds, textures, lights, or other sensory experiences.",
    ageRange: "Any age",
  },
  {
    icon: Hand,
    title: "Limited Pointing or Gestures",
    description: "Less likely to point at objects to share interest or use gestures to communicate.",
    ageRange: "12-18 months",
  },
];

const educationalVideos = [
  {
    title: "Understanding Autism Spectrum Disorder",
    description: "A comprehensive introduction to ASD for parents and caregivers.",
    placeholder: "https://youtu.be/gyuP7Q1fk9g?si=FM-doR6gNqlIUd2U",
    duration: "20 min",
  },
  {
    title: "ADOS Assessment Explained",
    description: "Learn about the Autism Diagnostic Observation Schedule and what to expect.",
    placeholder: "https://youtu.be/So05QaAjkKw?si=sDg59d1JnHqAk9Vv",
    duration: "6 min",
  },
  {
    title: "Early Intervention Strategies",
    description: "Practical techniques for supporting your child's development at home.",
    placeholder: "https://youtu.be/7ywGRqdrmkU?si=xKAA5USU4f1aIpgi",
    duration: "23 min",
  },
];

const getYouTubeVideoId = (url: string) => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "");

    if (host === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] || "";
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v") || "";
      }
      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.replace("/embed/", "").split("/")[0] || "";
      }
      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.replace("/shorts/", "").split("/")[0] || "";
      }
    }
  } catch {
    return "";
  }

  return "";
};

const getYouTubeThumbnailUrl = (url: string) => {
  const id = getYouTubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
};

const getYouTubeWatchUrl = (url: string) => {
  const id = getYouTubeVideoId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : url;
};

const faqItems = [
  {
    question: "What is Autism Spectrum Disorder (ASD)?",
    answer: "Autism Spectrum Disorder is a developmental condition that affects how a person perceives, interacts with, and experiences the world. It's called a 'spectrum' because it manifests differently in each individual. ASD is characterized by differences in social communication, sensory processing, and patterns of behavior or interests.",
  },
  {
    question: "Why is early detection important?",
    answer: "Early detection, ideally between 6-12 months of age, allows for earlier intervention. Research shows that early intervention can significantly improve outcomes for children with autism, helping them develop communication skills, social skills, and adaptive behaviors during critical developmental periods when the brain is most adaptable.",
  },
  {
    question: "Can autism be diagnosed in infants?",
    answer: "While a formal diagnosis is typically made around age 2-3, signs of autism can sometimes be observed as early as 6-12 months. Our AI-powered screening tool helps identify early behavioral patterns that may warrant further professional evaluation. Remember, screening is not diagnosis—only trained healthcare professionals can diagnose autism.",
  },
  {
    question: "What should I do if I notice signs?",
    answer: "If you notice any early signs, don't panic. Many children show some of these behaviors without having autism. The important step is to discuss your observations with your pediatrician or use our screening tool to get a preliminary assessment. Early screening helps ensure children who need support get it as early as possible.",
  },
];

export default function AutismAwareness() {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Autism Awareness & Early Signs</h1>
        <p className="text-muted-foreground mt-2">
          Educational resources to help you understand autism and recognize early signs
        </p>
      </div>

      {/* Disclaimer Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 rounded-2xl border border-accent/30 bg-accent/5 p-6"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20">
            <Info className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">Educational Content Only</h3>
            <p className="text-sm text-muted-foreground">
              This information is provided for educational purposes only and is not intended to replace
              professional medical advice. Always consult with qualified healthcare professionals
              for diagnosis and treatment decisions.
            </p>
          </div>
        </div>
      </motion.div>

      {/* What is ASD Section */}
      <section className="mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-8 shadow-card"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
              <Brain className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">What is Autism Spectrum Disorder?</h2>
              <p className="text-sm text-muted-foreground">Understanding the basics</p>
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-foreground">
            <p className="text-muted-foreground leading-relaxed">
              Autism Spectrum Disorder (ASD) is a neurodevelopmental condition that affects how individuals 
              perceive, interact with, and experience the world around them. The term "spectrum" reflects 
              the wide variation in challenges and strengths possessed by each person with autism.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              While autism is a lifelong condition, early identification and appropriate support can 
              significantly improve outcomes. Many individuals with autism lead fulfilling, successful 
              lives with the right understanding and accommodations.
            </p>
          </div>
        </motion.div>
      </section>

      {/* Why Early Detection Matters */}
      <section className="mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
              <Baby className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Why Early Detection (6-12 months) Matters</h2>
              <p className="text-sm text-muted-foreground">The critical window of opportunity</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-card p-6 border border-border">
              <div className="text-3xl font-bold text-primary mb-2">85%</div>
              <p className="text-sm text-muted-foreground">
                of brain development occurs by age 3, making early intervention crucial
              </p>
            </div>
            <div className="rounded-xl bg-card p-6 border border-border">
              <div className="text-3xl font-bold text-primary mb-2">2x</div>
              <p className="text-sm text-muted-foreground">
                better outcomes reported with early intervention compared to later intervention
              </p>
            </div>
            <div className="rounded-xl bg-card p-6 border border-border">
              <div className="text-3xl font-bold text-primary mb-2">6-12mo</div>
              <p className="text-sm text-muted-foreground">
                earliest signs can be observed, allowing for proactive support
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Common Early Signs */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Common Early Signs & Symptoms</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {earlySigns.map((sign, index) => (
            <motion.div
              key={sign.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-2xl border border-border bg-card p-6 shadow-card hover:shadow-elevated transition-shadow"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/20">
                  <sign.icon className="h-5 w-5 text-secondary" />
                </div>
                <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                  {sign.ageRange}
                </span>
              </div>
              <h3 className="font-semibold mb-2">{sign.title}</h3>
              <p className="text-sm text-muted-foreground">{sign.description}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 rounded-xl bg-warning/10 border border-warning/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
            <p className="text-sm text-muted-foreground">
              <strong>Important:</strong> Many children display some of these behaviors without having autism. 
              These signs are meant to prompt conversation with healthcare professionals, not to cause alarm.
            </p>
          </div>
        </div>
      </section>

      {/* Educational Videos */}
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Learn More (Educational Resources)</h2>
        </div>
        <p className="text-muted-foreground mb-6">
          Watch these educational videos to learn more about autism and early intervention
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {educationalVideos.map((video, index) => {
            const thumbnailUrl = getYouTubeThumbnailUrl(video.placeholder);
            const watchUrl = getYouTubeWatchUrl(video.placeholder);

            return (
            <motion.a
              key={video.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-border bg-card overflow-hidden shadow-card block hover:shadow-elevated transition-shadow"
            >
              <div className="aspect-video bg-muted flex items-center justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10" />
                {thumbnailUrl ? (
                  <>
                    <img
                      src={thumbnailUrl}
                      alt={video.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/25" />
                  </>
                ) : (
                  <div className="text-center z-10">
                    <PlayCircle className="h-12 w-12 text-muted-foreground mb-2 mx-auto" />
                    <span className="text-xs text-muted-foreground">Video</span>
                  </div>
                )}
                <div className="z-10">
                  <PlayCircle className="h-12 w-12 text-white drop-shadow" />
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">{video.title}</h3>
                  <span className="text-xs text-muted-foreground">{video.duration}</span>
                </div>
                <p className="text-xs text-muted-foreground">{video.description}</p>
              </div>
            </motion.a>
          )})}
        </div>

        <div className="mt-6 rounded-xl bg-muted/50 border border-border p-4">
          <p className="text-sm text-muted-foreground text-center">
            <Info className="inline-block h-4 w-4 mr-2" />
            Educational content only – not diagnostic. Always consult healthcare professionals for medical advice.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="space-y-2">
          {faqItems.map((item, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="rounded-xl border border-border bg-card px-4"
            >
              <AccordionTrigger className="text-left font-medium py-4 hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* External Resources */}
      <section>
        <h2 className="text-xl font-semibold mb-4">External Resources</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <a
            href="https://www.cdc.gov/autism/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-border bg-card p-4 hover:shadow-elevated transition-shadow flex items-center gap-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <ExternalLink className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm">CDC Autism Resources</p>
              <p className="text-xs text-muted-foreground">Official CDC information on ASD</p>
            </div>
          </a>
          <a
            href="https://www.autismspeaks.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-border bg-card p-4 hover:shadow-elevated transition-shadow flex items-center gap-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <ExternalLink className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm">Autism Speaks</p>
              <p className="text-xs text-muted-foreground">Resources and support for families</p>
            </div>
          </a>
        </div>
      </section>
    </DashboardLayout>
  );
}
