import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bot, Shield, Users, Brain, ArrowRight, CheckCircle2, HeartPulse, Activity } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function Index() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const scrollToLogin = () => {
    document.getElementById("login-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const features = [
    {
      icon: Brain,
      title: t("features.aiScreening.title"),
      description: t("features.aiScreening.description"),
    },
    {
      icon: Users,
      title: t("features.multiRole.title"),
      description: t("features.multiRole.description"),
    },
    {
      icon: Shield,
      title: t("features.humanLoop.title"),
      description: t("features.humanLoop.description"),
    },
  ];

  const agents = [
    {
      name: t("agents.screening.name"),
      color: "bg-agent-screening",
      icon: Bot,
      description: t("agents.screening.description"),
    },
    {
      name: t("agents.clinical.name"),
      color: "bg-agent-clinical",
      icon: Brain,
      description: t("agents.clinical.description"),
    },
    {
      name: t("agents.therapy.name"),
      color: "bg-agent-therapy",
      icon: HeartPulse,
      description: t("agents.therapy.description"),
    },
    {
      name: t("agents.monitoring.name"),
      color: "bg-agent-monitoring",
      icon: Activity,
      description: t("agents.monitoring.description"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-md transition-all duration-300">
        <div className="container flex h-20 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight">{t("header.title")}</span>
              <span className="text-primary ml-1 font-bold">{t("header.subtitle")}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
            <Button onClick={scrollToLogin} variant="default" className="rounded-full px-6">
              {t("header.getStarted")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Hero Background */}
        <div className="absolute inset-0 z-0">
          <img
            src="/login.png"
            alt="Compassionate Care"
            className="w-full h-full object-cover object-center scale-105 animate-subtle-zoom"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent md:bg-gradient-to-r dark:from-background/95 dark:via-background/70" />
          <div className="absolute inset-0 bg-black/5 md:hidden" />
        </div>

        <div className="container relative z-10 px-6 py-32 md:py-48">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-semibold text-primary mb-8 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                {t("hero.badge")}
              </div>
              
              <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-[1.1] tracking-tight text-foreground">
                {t("hero.title")} <br />
                <span className="text-primary">{t("hero.titleHighlight")}</span>
                <p className="text-3xl md:text-4xl mt-2 font-medium opacity-90">{t("hero.subtitle")}</p>
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground/90 max-w-xl mb-12 leading-relaxed">
                {t("hero.description")}
              </p>
              
              <div className="flex flex-wrap gap-5">
                <Button 
                  size="xl" 
                  variant="default" 
                  onClick={scrollToLogin}
                  className="rounded-full px-10 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
                >
                  {t("header.getStarted")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="xl" 
                  variant="outline" 
                  onClick={() => navigate("/auth")}
                  className="rounded-full px-10 border-2 hover:bg-primary/5 transition-all"
                >
                  {t("header.learnMore")}
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Agents Section */}
      <section className="py-24 bg-background">
        <div className="container max-w-6xl mx-auto px-6">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div className="lg:pr-12">
              <h2 className="text-4xl md:text-5xl font-bold mb-8 text-foreground tracking-tight leading-tight">{t("agents.title")}</h2>
              <p className="text-xl text-muted-foreground leading-relaxed">
                {t("agents.description")}
              </p>
            </div>
            
            <div className="relative">
              <div className="absolute -inset-4 bg-primary/5 rounded-[2rem] blur-2xl" />
              <div className="relative grid gap-6 md:grid-cols-2">
                {agents.map((agent, index) => (
                  <motion.div
                    key={agent.name}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className={`h-12 w-12 rounded-xl ${agent.color} flex items-center justify-center mb-4`}>
                      <agent.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="font-semibold mb-2">{agent.name}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{agent.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-muted/30">
        <div className="container max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">{t("features.title")}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {t("features.description")}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="rounded-3xl border border-border bg-card p-8 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3 tracking-tight">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24">
        <div className="container max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="rounded-[3rem] bg-foreground p-10 md:p-16 text-white text-center shadow-2xl overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
            
            <Shield className="h-20 w-20 mx-auto mb-8 text-primary" />
            <h2 className="text-4xl font-bold mb-6 tracking-tight">
              {t("features.humanLoop.title")}
            </h2>
            <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed">
              {t("features.humanLoop.description")}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {[
                "HIPAA Compliant",
                "Board-Certified Doctors",
                "Evidence-Based Screening",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full px-6 py-2.5"
                >
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="login-section" className="py-32 bg-muted/30">
        <div className="container max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary mb-6">
            Begin Your Journey
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Ready to Take the First Step?</h2>
          <p className="text-xl text-muted-foreground mb-12 leading-relaxed">
            {t("hero.description")}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="xl" variant="default" onClick={() => navigate("/auth")} className="rounded-full px-12 shadow-lg shadow-primary/20">
              {t("auth.signUpButton")}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="xl" variant="outline" onClick={() => navigate("/auth")} className="rounded-full px-12 border-2">
              {t("auth.signInButton")}
            </Button>
          </div>
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
