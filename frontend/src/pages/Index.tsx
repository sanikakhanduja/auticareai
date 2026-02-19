import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bot, Shield, Users, Brain, ArrowRight, CheckCircle2, HeartPulse, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Index() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Screening",
      description: "Advanced behavioral analysis using video and questionnaires",
    },
    {
      icon: Users,
      title: "Multi-Role Platform",
      description: "Dedicated interfaces for parents, doctors, and therapists",
    },
    {
      icon: Shield,
      title: "Human-in-the-Loop",
      description: "AI supports decisions, professionals remain in control",
    },
  ];

  const agents = [
    {
      name: "Screening Agent",
      color: "bg-agent-screening",
      icon: Bot,
      description: "Analyzes behavior patterns from screening inputs.",
    },
    {
      name: "Clinical Summary Agent",
      color: "bg-agent-clinical",
      icon: Brain,
      description: "Builds structured clinical summaries for doctors.",
    },
    {
      name: "Therapy Planning Agent",
      color: "bg-agent-therapy",
      icon: HeartPulse,
      description: "Suggests therapy direction and session focus.",
    },
    {
      name: "Monitoring Agent",
      color: "bg-agent-monitoring",
      icon: Activity,
      description: "Tracks child progress and trend indicators.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
              <Bot className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-xl">AutiCare</span>
              <span className="text-primary ml-1">AI</span>
            </div>
          </div>
          <Button onClick={() => navigate("/auth")} variant="hero">
            Get Started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary mb-6">
              <Bot className="h-4 w-4" />
              AI-Enabled Early Intervention
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Early Autism Screening
              <br />
              <span className="text-primary">Powered by AI</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              A comprehensive care platform connecting parents, doctors, and therapists
              through intelligent AI agents for early detection and personalized care.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="xl" variant="hero" onClick={() => navigate("/auth")}>
                Start Screening
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="xl" variant="outline" onClick={() => navigate("/auth")}>
                Learn More
              </Button>
            </div>
          </motion.div>

          {/* Hero Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-16 rounded-3xl border border-border bg-card p-8 shadow-elevated"
          >
            <div className="grid gap-6 md:grid-cols-4">
              {agents.map((agent, index) => (
                <motion.div
                  key={agent.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="flex flex-col items-center"
                >
                  <div
                    className={`h-16 w-16 rounded-2xl ${agent.color} flex items-center justify-center mb-3 animate-float`}
                    style={{ animationDelay: `${index * 0.5}s` }}
                  >
                    <agent.icon className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-sm font-medium text-center">{agent.name}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Agents Section */}
      <section className="py-16">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">All 4 AI Agents</h2>
            <p className="text-muted-foreground">
              The platform runs all four agents together during screening and care workflows.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {agents.map((agent, index) => (
              <motion.div
                key={agent.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="rounded-2xl border border-border bg-card p-5 shadow-card"
              >
                <div className="flex items-start gap-4">
                  <div className={`h-12 w-12 rounded-xl ${agent.color} flex items-center justify-center shrink-0`}>
                    <agent.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{agent.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{agent.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Our multi-agent AI system works alongside healthcare professionals
              to provide comprehensive early screening and care.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="rounded-2xl border border-border bg-card p-6 shadow-card"
              >
                <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20">
        <div className="container max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="rounded-3xl gradient-hero p-8 md:p-12 text-primary-foreground text-center"
          >
            <Shield className="h-16 w-16 mx-auto mb-6 opacity-90" />
            <h2 className="text-3xl font-bold mb-4">
              AI Supports, Humans Decide
            </h2>
            <p className="text-lg opacity-90 max-w-2xl mx-auto mb-8">
              Our AI agents provide intelligent insights and recommendations,
              but final clinical decisions are always made by qualified healthcare
              professionals. Your child's care is in expert hands.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {[
                "HIPAA Compliant",
                "Board-Certified Doctors",
                "Evidence-Based Screening",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/30">
        <div className="container max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-8">
            Create your account and begin your child's developmental screening journey.
          </p>
          <Button size="xl" variant="hero" onClick={() => navigate("/auth")}>
            Create Account
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© 2024 AutiCare AI. All rights reserved.</p>
          <p className="mt-2">
            This is a prototype demonstration. Not for clinical use.
          </p>
        </div>
      </footer>
    </div>
  );
}
