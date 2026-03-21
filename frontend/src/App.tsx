import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./pages/AuthProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import ParentDashboard from "./pages/parent/ParentDashboard";
import ChildrenList from "./pages/parent/ChildrenList";
import AddChild from "./pages/parent/AddChild";
import ChildProfile from "./pages/parent/ChildProfile";
import Screening from "./pages/parent/Screening";
import Progress from "./pages/parent/Progress";
import AutismAwareness from "./pages/parent/AutismAwareness";
import FindProfessionals from "./pages/parent/FindProfessionals";
import Reports from "./pages/parent/Reports";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import DoctorReview from "./pages/doctor/DoctorReview";
import TherapistDashboard from "./pages/therapist/TherapistDashboard";
import TherapyPlan from "./pages/therapist/TherapyPlan";
import CreateSession from "./pages/therapist/CreateSession";
import SessionNotes from "./pages/therapist/SessionNotes";
import TherapistPatients from "./pages/therapist/TherapistPatients";
import TherapistSessions from "./pages/therapist/TherapistSessions";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          
          {/* Parent Routes */}
          <Route path="/parent" element={<ParentDashboard />} />
          <Route path="/parent/children" element={<ChildrenList />} />
          <Route path="/parent/children/add" element={<AddChild />} />
          <Route path="/parent/children/:childId" element={<ChildProfile />} />
          <Route path="/parent/screening" element={<Screening />} />
          <Route path="/parent/progress" element={<Progress />} />
          <Route path="/parent/checkins" element={<Progress />} />
          <Route path="/parent/awareness" element={<AutismAwareness />} />
          <Route path="/parent/find" element={<FindProfessionals />} />
          <Route path="/parent/reports" element={<Reports />} />
          
          {/* Doctor Routes */}
          <Route path="/doctor" element={<DoctorDashboard />} />
          <Route path="/doctor/patients" element={<DoctorDashboard />} />
          <Route path="/doctor/reviews" element={<DoctorDashboard />} />
          <Route path="/doctor/reports" element={<Reports />} />
          <Route path="/doctor/review/:childId" element={<DoctorReview />} />
          
          {/* Therapist Routes */}
          <Route path="/therapist" element={<TherapistDashboard />} />
          <Route path="/therapist/patients" element={<TherapistPatients />} />
          <Route path="/therapist/sessions" element={<TherapistSessions />} />
          <Route path="/therapist/plan/:childId" element={<TherapyPlan />} />
          <Route path="/therapist/plan/:childId/create-session" element={<CreateSession />} />
          <Route path="/therapist/sessions/:sessionId/notes" element={<SessionNotes />} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;