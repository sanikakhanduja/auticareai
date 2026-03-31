import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Stethoscope,
  HeartPulse,
  Star,
  MapPin,
  CheckCircle2,
  Lock,
  AlertCircle,
  Search,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Child } from "@/lib/store";
import { authService } from "@/services/auth";
import { childrenService, doctorFeedbackService, profilesService, therapistFeedbackService } from "@/services/data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Doctor {
  id: string;
  name: string;
  qualification: string;
  specialization: string;
  rating: number;
  reviews: number;
  location: string;
  available: boolean;
  state?: string | null;
  district?: string | null;
  patientCount?: number;
  canAcceptPatients?: boolean;
}

interface Therapist {
  id: string;
  name: string;
  qualification: string;
  specialization: string;
  rating: number;
  reviews: number;
  location: string;
  available: boolean;
  therapyTypes: string[];
  state?: string | null;
  district?: string | null;
}

interface DoctorChangeRequest {
  childId: string;
  requestedDoctorId: string;
  reason: string;
  status: "pending";
}

const indiaStates = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

export default function FindProfessionals() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === "therapists" ? "therapists" : "doctors";
  const [activeTab, setActiveTab] = useState<"doctors" | "therapists">(initialTab);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [selectedTherapist, setSelectedTherapist] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [districtQuery, setDistrictQuery] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loadingTherapists, setLoadingTherapists] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState("5");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [doctorFeedbackAlreadySubmitted, setDoctorFeedbackAlreadySubmitted] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [showChangeDoctorModal, setShowChangeDoctorModal] = useState(false);
  const [showChangeTherapistModal, setShowChangeTherapistModal] = useState(false);
  const [doctorChangeReason, setDoctorChangeReason] = useState("");
  const [doctorChangeReasonSubmitted, setDoctorChangeReasonSubmitted] = useState(false);
  const [doctorChangeRequests, setDoctorChangeRequests] = useState<Record<string, DoctorChangeRequest>>({});

  const child = children.find((c) => c.id === selectedChild);
  const isDiagnosed = child?.screeningStatus === "diagnosed";
  const normalize = (value?: string | null) => (value || "").trim().toLowerCase();

  const loadDoctorsWithRatings = async () => {
    setLoadingDoctors(true);
    setLoadError(null);

    const { data, error } = await profilesService.getAllDoctorsWithStats();
    if (error) {
      setLoadError(error.message || "Failed to load doctors");
      setLoadingDoctors(false);
      return;
    }

    const doctorIds = (data || []).map((profile: any) => profile.id);
    const { data: feedbackData, error: feedbackError } =
      await doctorFeedbackService.getFeedbackForDoctors(doctorIds);

    if (feedbackError) {
      console.warn("Failed to load doctor ratings:", feedbackError.message);
    }

    const ratingMap: Record<string, { total: number; count: number }> = {};
    (feedbackData || []).forEach((row: any) => {
      const current = ratingMap[row.doctor_id] || { total: 0, count: 0 };
      ratingMap[row.doctor_id] = {
        total: current.total + (row.rating || 0),
        count: current.count + 1,
      };
    });

    const mapped = (data || []).map((profile: any) => {
      const district = profile.district || "";
      const state = profile.state || "";
      const locationLabel = district && state ? `${district}, ${state}` : state || district || "Location not set";
      const ratingStats = ratingMap[profile.id];
      const average = ratingStats ? ratingStats.total / ratingStats.count : 0;
      return {
        id: profile.id,
        name: profile.full_name || "Doctor",
        qualification: "Licensed Doctor",
        specialization: profile.specialty || "General Medicine",
        rating: Number(average.toFixed(1)),
        reviews: ratingStats?.count || 0,
        location: locationLabel,
        available: true,
        state: profile.state,
        district: profile.district,
        patientCount: profile.patientCount || 0,
        canAcceptPatients: profile.canAcceptPatients ?? true,
      } as Doctor;
    });

    setDoctors(mapped);
    setLoadingDoctors(false);
  };

  const handleSelectDoctor = async (doctorId: string) => {
    if (!child) return;
    
    // Check if doctor can accept patients
    const doctor = doctors.find(d => d.id === doctorId);
    if (doctor && !doctor.canAcceptPatients) {
      setAssignError("This doctor is at capacity (5 patients maximum) and cannot accept new patients");
      return;
    }

    setAssignError(null);
    const { error } = await childrenService.updateChild(child.id, { assignedDoctorId: doctorId });
    if (error) {
      setAssignError(error.message || "Failed to assign doctor");
      return;
    }
    setSelectedDoctor(doctorId);
    setChildren((prev) =>
      prev.map((entry) => (entry.id === child.id ? { ...entry, assignedDoctorId: doctorId } : entry))
    );
  };

  const handleSelectTherapist = async (therapistId: string) => {
    if (!isDiagnosed || !child) return;
    setAssignError(null);
    const { error } = await childrenService.updateChild(child.id, { assignedTherapistId: therapistId });
    if (error) {
      setAssignError(error.message || "Failed to assign therapist");
      return;
    }
    setSelectedTherapist(therapistId);
    setChildren((prev) =>
      prev.map((entry) => (entry.id === child.id ? { ...entry, assignedTherapistId: therapistId } : entry))
    );
  };

  const filteredDoctors = doctors.filter((doc) => {
    const query = normalize(searchQuery);
    const matchesSearch =
      normalize(doc.name).includes(query) ||
      normalize(doc.specialization).includes(query) ||
      normalize(doc.id).includes(query) ||
      normalize(doc.state).includes(query) ||
      normalize(doc.district).includes(query);
    const matchesState =
      selectedState !== "all" ? normalize(doc.state) === normalize(selectedState) : true;
    const matchesDistrict = districtQuery
      ? normalize(doc.district) === normalize(districtQuery)
      : true;
    return matchesSearch && matchesState && matchesDistrict;
  });

  const filteredTherapists = therapists.filter((ther) => {
    const query = normalize(searchQuery);
    const matchesSearch =
      normalize(ther.name).includes(query) ||
      normalize(ther.specialization).includes(query) ||
      normalize(ther.id).includes(query) ||
      normalize(ther.state).includes(query) ||
      normalize(ther.district).includes(query);
    const matchesState =
      selectedState !== "all" ? normalize(ther.state) === normalize(selectedState) : true;
    const matchesDistrict = districtQuery
      ? normalize(ther.district) === normalize(districtQuery)
      : true;
    return matchesSearch && matchesState && matchesDistrict;
  });

  const assignedTherapist = child?.assignedTherapistId
    ? therapists.find((therapist) => therapist.id === child.assignedTherapistId)
    : null;

  const assignedDoctor = child?.assignedDoctorId
    ? doctors.find((doctor) => doctor.id === child.assignedDoctorId)
    : null;

  const pendingDoctorRequest = child ? doctorChangeRequests[child.id] : null;
  const pendingDoctor = pendingDoctorRequest
    ? doctors.find((doctor) => doctor.id === pendingDoctorRequest.requestedDoctorId)
    : null;

  const availableDoctorsForChange = filteredDoctors.filter(
    (doctor) =>
      doctor.canAcceptPatients &&
      doctor.available &&
      doctor.id !== selectedDoctor
  );

  const openChangeDoctorModal = () => {
    setAssignError(null);
    setDoctorChangeReason("");
    setDoctorChangeReasonSubmitted(false);
    setShowChangeDoctorModal(true);
  };

  const handleProceedToDoctorList = () => {
    if (!doctorChangeReason.trim()) {
      setAssignError("Please enter a reason for changing doctor");
      return;
    }
    setAssignError(null);
    setDoctorChangeReasonSubmitted(true);
  };

  const handleRequestDoctorChange = (doctorId: string) => {
    if (!child || !doctorChangeReason.trim()) return;
    setDoctorChangeRequests((prev) => ({
      ...prev,
      [child.id]: {
        childId: child.id,
        requestedDoctorId: doctorId,
        reason: doctorChangeReason.trim(),
        status: "pending",
      },
    }));
    setShowChangeDoctorModal(false);
    setDoctorChangeReason("");
    setDoctorChangeReasonSubmitted(false);
  };

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "therapists") {
      setActiveTab("therapists");
      return;
    }
    if (tab === "doctors") {
      setActiveTab("doctors");
    }
  }, [searchParams]);

  useEffect(() => {
    const loadUser = async () => {
      const user = await authService.getCurrentUser();
      setCurrentUserId(user?.id || null);
    };
    loadUser();
  }, []);

  useEffect(() => {
    const loadChildren = async () => {
      setLoadError(null);
      const { data, error } = await childrenService.getChildren();
      if (error) {
        setLoadError(error.message || "Failed to load children");
        return;
      }

      const normalized = (data || []).map((entry: any) => ({
        id: entry.id,
        name: entry.name,
        dateOfBirth: entry.date_of_birth,
        age: 0,
        gender: entry.gender,
        screeningStatus: entry.screening_status,
        riskLevel: entry.risk_level,
        assignedDoctorId: entry.assigned_doctor_id,
        assignedTherapistId: entry.assigned_therapist_id,
        observationEndDate: entry.observation_end_date,
      }));

      setChildren(normalized);
      if (normalized.length > 0) {
        const first = normalized[0];
        setSelectedChild((current) => current || first.id);
        setSelectedDoctor(first.assignedDoctorId || null);
        setSelectedTherapist(first.assignedTherapistId || null);
      }
    };

    loadChildren();
  }, []);

  useEffect(() => {
    loadDoctorsWithRatings();
  }, []);

  useEffect(() => {
    const current = children.find((entry) => entry.id === selectedChild);
    setSelectedDoctor(current?.assignedDoctorId || null);
    setSelectedTherapist(current?.assignedTherapistId || null);
  }, [children, selectedChild]);

  useEffect(() => {
    const checkDoctorFeedbackStatus = async () => {
      if (!child?.assignedDoctorId || !currentUserId || !child?.id) {
        setDoctorFeedbackAlreadySubmitted(false);
        return;
      }
      const { data, error } = await doctorFeedbackService.hasFeedbackForDoctorAndChild({
        doctorId: child.assignedDoctorId,
        parentId: currentUserId,
        childId: child.id,
      });
      if (error) {
        setDoctorFeedbackAlreadySubmitted(false);
        return;
      }
      setDoctorFeedbackAlreadySubmitted(data);
    };

    checkDoctorFeedbackStatus();
  }, [child?.id, child?.assignedDoctorId, currentUserId]);

  const refreshTherapists = async () => {
    setLoadingTherapists(true);
    setLoadError(null);

    const { data: therapistProfiles, error } = await profilesService.getTherapists();
    if (error) {
      setLoadError(error.message || "Failed to load therapists");
      setLoadingTherapists(false);
      return;
    }

    const therapistIds = (therapistProfiles || []).map((profile: any) => profile.id);
    const { data: feedbackData, error: feedbackError } =
      await therapistFeedbackService.getFeedbackForTherapists(therapistIds);

    if (feedbackError) {
      setLoadError(feedbackError.message || "Failed to load therapist ratings");
    }

    const ratingMap: Record<string, { total: number; count: number }> = {};
    (feedbackData || []).forEach((row: any) => {
      const current = ratingMap[row.therapist_id] || { total: 0, count: 0 };
      ratingMap[row.therapist_id] = {
        total: current.total + (row.rating || 0),
        count: current.count + 1,
      };
    });

    const mapped = (therapistProfiles || []).map((profile: any) => {
      const ratingStats = ratingMap[profile.id];
      const average = ratingStats ? ratingStats.total / ratingStats.count : 0;
      const specialty = profile.specialty || "General Therapy";
      const district = profile.district || "";
      const state = profile.state || "";
      const locationLabel = district && state ? `${district}, ${state}` : state || district || "Location not set";
      return {
        id: profile.id,
        name: profile.full_name || "Therapist",
        qualification: "Licensed Therapist",
        specialization: specialty,
        rating: Number(average.toFixed(1)),
        reviews: ratingStats?.count || 0,
        location: locationLabel,
        available: true,
        therapyTypes: specialty ? [specialty] : [],
        state: profile.state,
        district: profile.district,
      } as Therapist;
    });

    setTherapists(mapped);
    setLoadingTherapists(false);
  };

  useEffect(() => {
    refreshTherapists();
  }, []);

  const handleSubmitDoctorFeedback = async () => {
    if (!child || !child.assignedDoctorId || !currentUserId) return;
    if (doctorFeedbackAlreadySubmitted) {
      setFeedbackError("Feedback has already been submitted for this doctor and child.");
      setFeedbackSuccess(null);
      return;
    }
    setFeedbackError(null);
    setFeedbackSuccess(null);

    const { error } = await doctorFeedbackService.createFeedback({
      doctorId: child.assignedDoctorId,
      parentId: currentUserId,
      childId: child.id,
      rating: Number(feedbackRating),
      comment: feedbackComment.trim() ? feedbackComment.trim() : null,
    });

    if (error) {
      setFeedbackError(error.message || "Failed to submit feedback");
      return;
    }

    setFeedbackSuccess("Feedback submitted. Thank you!");
    setDoctorFeedbackAlreadySubmitted(true);
    setFeedbackComment("");
    setFeedbackRating("5");
    await loadDoctorsWithRatings();
  };

  const handleSubmitTherapistFeedback = async () => {
    if (!child || !child.assignedTherapistId || !currentUserId) return;
    setFeedbackError(null);
    setFeedbackSuccess(null);

    const { error } = await therapistFeedbackService.createFeedback({
      therapistId: child.assignedTherapistId,
      parentId: currentUserId,
      childId: child.id,
      rating: Number(feedbackRating),
      comment: feedbackComment.trim() ? feedbackComment.trim() : null,
    });

    if (error) {
      setFeedbackError(error.message || "Failed to submit feedback");
      return;
    }

    setFeedbackSuccess("Feedback submitted. Thank you!");
    setFeedbackComment("");
    setFeedbackRating("5");
    refreshTherapists();
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Find Doctors & Therapists</h1>
        <p className="text-muted-foreground mt-2">
          Connect with qualified healthcare professionals near you
        </p>
      </div>

      {/* Child Selection */}
      <div className="mb-6">
        <label className="text-sm font-medium mb-2 block">Select Child</label>
        <Select value={selectedChild} onValueChange={setSelectedChild}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Select a child" />
          </SelectTrigger>
          <SelectContent>
            {children.map((child) => (
              <SelectItem key={child.id} value={child.id}>
                {child.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Child Status Display */}
      {child && (
        <div className={`mb-6 rounded-xl border p-4 ${
          isDiagnosed 
            ? "border-success/30 bg-success/5" 
            : "border-warning/30 bg-warning/5"
        }`}>
          <div className="flex items-center gap-3">
            {isDiagnosed ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-success" />
                <div>
                  <p className="font-medium text-sm">Diagnosis Completed</p>
                  <p className="text-xs text-muted-foreground">
                    Full access to doctor and therapist selection
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-warning" />
                <div>
                  <p className="font-medium text-sm">
                    {child.screeningStatus === "under-observation" 
                      ? "Child Under Observation" 
                      : "Diagnosis Pending"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Therapist selection will be available after diagnosis is completed
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {loadError && (
        <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {assignError && (
        <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {assignError}
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6 flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, specialization, ID, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedState} onValueChange={setSelectedState}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {indiaStates.map((state) => (
              <SelectItem key={state} value={state}>
                {state}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="District (exact)"
          value={districtQuery}
          onChange={(e) => setDistrictQuery(e.target.value)}
          className="w-[200px]"
        />
      </div>

      {/* Tabs for Doctors and Therapists */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "doctors" | "therapists")} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="doctors" className="gap-2">
            <Stethoscope className="h-4 w-4" />
            Doctors
          </TabsTrigger>
          <TabsTrigger value="therapists" className="gap-2">
            <HeartPulse className="h-4 w-4" />
            Therapists
          </TabsTrigger>
        </TabsList>

        <TabsContent value="doctors" className="space-y-4">
          {loadingDoctors && (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Loading doctors...
            </div>
          )}
          
          {/* Show only assigned doctor when one is selected */}
          {!loadingDoctors && selectedDoctor && !showChangeDoctorModal && (() => {
            const assignedDoctor = doctors.find(d => d.id === selectedDoctor);
            if (!assignedDoctor) return null;
            
            return (
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-primary ring-2 ring-primary/20 bg-card p-6 shadow-card"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Stethoscope className="h-7 w-7 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{assignedDoctor.name}</h3>
                        <p className="text-sm text-muted-foreground">{assignedDoctor.qualification}</p>
                        <p className="text-sm text-primary mt-1">{assignedDoctor.specialization}</p>
                        
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-warning fill-warning" />
                            <span className="text-sm font-medium">{assignedDoctor.rating || "-"}</span>
                            <span className="text-xs text-muted-foreground">
                              ({assignedDoctor.reviews} reviews)
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span className="text-xs">{assignedDoctor.location}</span>
                          </div>
                          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                            <span>{assignedDoctor.patientCount || 0}/5 Patients</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-success">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="text-sm font-medium">Selected</span>
                    </div>
                  </div>
                </motion.div>

                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={openChangeDoctorModal}
                    className="gap-2"
                  >
                    <Stethoscope className="h-4 w-4" />
                    Change Doctor
                  </Button>
                </div>

                {pendingDoctorRequest && pendingDoctor && (
                  <div className="rounded-xl border border-success/30 bg-success/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-success">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-sm font-medium">Requested to change the doctor</span>
                      </div>
                      <span className="text-xs bg-warning/20 px-3 py-1 rounded-full text-warning font-medium">
                        Pending
                      </span>
                    </div>
                    <p className="text-sm mt-2">
                      {pendingDoctor.name}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Show full list when no doctor is selected or in change modal */}
          {!loadingDoctors && !selectedDoctor && filteredDoctors.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No doctors match the selected filters.
            </div>
          )}
          {!loadingDoctors && !selectedDoctor && filteredDoctors.map((doctor, index) => (
            <motion.div
              key={doctor.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-2xl border bg-card p-6 shadow-card transition-all ${
                selectedDoctor === doctor.id
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Stethoscope className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{doctor.name}</h3>
                    <p className="text-sm text-muted-foreground">{doctor.qualification}</p>
                    <p className="text-sm text-primary mt-1">{doctor.specialization}</p>
                    
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-warning fill-warning" />
                        <span className="text-sm font-medium">{doctor.rating || "-"}</span>
                        <span className="text-xs text-muted-foreground">
                          ({doctor.reviews} reviews)
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="text-xs">{doctor.location}</span>
                      </div>                    <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      <span>{doctor.patientCount || 0}/5 Patients</span>
                    </div>                    </div>
                  </div>
                </div>

                <div className="text-right">
                  {!doctor.canAcceptPatients ? (
                    <span className="text-xs bg-destructive/20 px-3 py-2 rounded-full text-destructive font-medium">
                      At Capacity
                    </span>
                  ) : !doctor.available ? (
                    <span className="text-xs bg-muted px-3 py-2 rounded-full text-muted-foreground">
                      Unavailable
                    </span>
                  ) : selectedDoctor === doctor.id ? (
                    <div className="flex items-center gap-2 text-success">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="text-sm font-medium">Selected</span>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectDoctor(doctor.id)}
                    >
                      Select Doctor
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {/* Doctor Feedback Section */}
          {child?.assignedDoctorId && selectedDoctor && (
            <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                Doctor Feedback
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Share feedback for {assignedDoctor?.name || "your doctor"} to help improve care quality.
              </p>

              <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                <div>
                  <label className="text-sm font-medium mb-2 block">Rating</label>
                  <Select
                    value={feedbackRating}
                    onValueChange={setFeedbackRating}
                    disabled={doctorFeedbackAlreadySubmitted}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {["5", "4", "3", "2", "1"].map((value) => (
                        <SelectItem key={value} value={value}>
                          {value} Star{value === "1" ? "" : "s"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Comment (optional)</label>
                  <Textarea
                    value={feedbackComment}
                    onChange={(event) => setFeedbackComment(event.target.value)}
                    placeholder="Share what went well and what could improve"
                    className="min-h-[90px]"
                    disabled={doctorFeedbackAlreadySubmitted}
                  />
                </div>
              </div>

              {doctorFeedbackAlreadySubmitted && (
                <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
                  Feedback has already been submitted for this doctor and child.
                </div>
              )}

              {feedbackError && (
                <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {feedbackError}
                </div>
              )}

              {feedbackSuccess && (
                <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
                  {feedbackSuccess}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <Button onClick={handleSubmitDoctorFeedback} disabled={doctorFeedbackAlreadySubmitted}>
                  Submit Feedback
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="therapists" className="space-y-4">
          {/* Lock message for therapists */}
          {!isDiagnosed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-8 text-center"
            >
              <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Therapist Selection Locked</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Therapist selection is available only after diagnosis is completed.
                Please complete the screening and clinical review process first.
              </p>
            </motion.div>
          )}

          {loadingTherapists && (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Loading therapists...
            </div>
          )}

          {/* Show only assigned therapist when one is selected */}
          {!loadingTherapists && isDiagnosed && selectedTherapist && !showChangeTherapistModal && (() => {
            const assignedTherapist = therapists.find(t => t.id === selectedTherapist);
            if (!assignedTherapist) return null;
            
            return (
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-secondary ring-2 ring-secondary/20 bg-card p-6 shadow-card"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className="h-14 w-14 rounded-xl bg-secondary/10 flex items-center justify-center">
                        <HeartPulse className="h-7 w-7 text-secondary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{assignedTherapist.name}</h3>
                        <p className="text-sm text-muted-foreground">{assignedTherapist.qualification}</p>
                        <p className="text-sm text-secondary mt-1">{assignedTherapist.specialization}</p>
                        
                        <div className="flex flex-wrap gap-2 mt-2">
                          {assignedTherapist.therapyTypes.map((type) => (
                            <span
                              key={type}
                              className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full"
                            >
                              {type}
                            </span>
                          ))}
                        </div>
                        
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-warning fill-warning" />
                            <span className="text-sm font-medium">{assignedTherapist.rating || "-"}</span>
                            <span className="text-xs text-muted-foreground">
                              ({assignedTherapist.reviews} reviews)
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span className="text-xs">{assignedTherapist.location}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-secondary">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="text-sm font-medium">Selected</span>
                    </div>
                  </div>
                </motion.div>

                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setShowChangeTherapistModal(true)}
                    className="gap-2 border-secondary text-secondary hover:bg-secondary/10"
                  >
                    <HeartPulse className="h-4 w-4" />
                    Change Therapist
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* Show full list when no therapist is selected or in change modal */}
          {!loadingTherapists && isDiagnosed && !selectedTherapist && filteredTherapists.map((therapist, index) => (
            <motion.div
              key={therapist.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-2xl border bg-card p-6 shadow-card transition-all ${
                selectedTherapist === therapist.id
                  ? "border-secondary ring-2 ring-secondary/20"
                  : "border-border hover:border-secondary/50"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="h-14 w-14 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <HeartPulse className="h-7 w-7 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{therapist.name}</h3>
                    <p className="text-sm text-muted-foreground">{therapist.qualification}</p>
                    <p className="text-sm text-secondary mt-1">{therapist.specialization}</p>
                    
                    <div className="flex flex-wrap gap-2 mt-2">
                      {therapist.therapyTypes.map((type) => (
                        <span
                          key={type}
                          className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                    
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-warning fill-warning" />
                        <span className="text-sm font-medium">{therapist.rating || "-"}</span>
                        <span className="text-xs text-muted-foreground">
                          ({therapist.reviews} reviews)
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="text-xs">{therapist.location}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  {selectedTherapist === therapist.id ? (
                    <div className="flex items-center gap-2 text-secondary">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="text-sm font-medium">Selected</span>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectTherapist(therapist.id)}
                      className="border-secondary text-secondary hover:bg-secondary/10"
                    >
                      Select Therapist
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {/* Therapist Feedback Section */}
          {child?.assignedTherapistId && isDiagnosed && selectedTherapist && (
            <div className="mt-6 rounded-2xl border border-secondary/30 bg-secondary/5 p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <HeartPulse className="h-5 w-5 text-secondary" />
                Therapist Feedback
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Share feedback for {assignedTherapist?.name || "your therapist"} to help improve care quality.
              </p>

              <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                <div>
                  <label className="text-sm font-medium mb-2 block">Rating</label>
                  <Select value={feedbackRating} onValueChange={setFeedbackRating}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {["5", "4", "3", "2", "1"].map((value) => (
                        <SelectItem key={value} value={value}>
                          {value} Star{value === "1" ? "" : "s"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Comment (optional)</label>
                  <Textarea
                    value={feedbackComment}
                    onChange={(event) => setFeedbackComment(event.target.value)}
                    placeholder="Share what went well and what could improve"
                    className="min-h-[90px]"
                  />
                </div>
              </div>

              {feedbackError && (
                <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {feedbackError}
                </div>
              )}

              {feedbackSuccess && (
                <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
                  {feedbackSuccess}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <Button onClick={handleSubmitTherapistFeedback}>
                  Submit Feedback
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Guidance Text */}
      <div className="mt-8 rounded-xl bg-muted/50 border border-border p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Selected professionals will have access to your child's screening data and videos
          to provide appropriate care and recommendations.
        </p>
      </div>

      {/* Change Doctor Modal */}
      <Dialog
        open={showChangeDoctorModal}
        onOpenChange={(open) => {
          setShowChangeDoctorModal(open);
          if (!open) {
            setDoctorChangeReason("");
            setDoctorChangeReasonSubmitted(false);
            setAssignError(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              Change Doctor
            </DialogTitle>
            <DialogDescription>
              Share a reason for changing the doctor, then select an available doctor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {assignError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {assignError}
              </div>
            )}

            {!doctorChangeReasonSubmitted && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reason for changing doctor</label>
                  <Textarea
                    value={doctorChangeReason}
                    onChange={(event) => setDoctorChangeReason(event.target.value)}
                    placeholder="Please tell us why you want to change your doctor"
                    className="min-h-[110px]"
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleProceedToDoctorList}>
                    Continue
                  </Button>
                </div>
              </>
            )}

            {doctorChangeReasonSubmitted && loadingDoctors && (
              <div className="text-center py-8 text-muted-foreground">
                Loading available doctors...
              </div>
            )}

            {doctorChangeReasonSubmitted && !loadingDoctors && availableDoctorsForChange.length === 0 && (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No available doctors right now</p>
              </div>
            )}

            {doctorChangeReasonSubmitted && !loadingDoctors && availableDoctorsForChange.length > 0 && (
              <div className="space-y-3">
                {availableDoctorsForChange.map((doctor) => (
                  <motion.div
                    key={doctor.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border bg-card p-4 transition-all hover:border-primary/50 cursor-pointer"
                    onClick={() => {
                      handleRequestDoctorChange(doctor.id);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex gap-3">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Stethoscope className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{doctor.name}</h4>
                          <p className="text-sm text-primary mt-0.5">
                            {doctor.specialization}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {doctor.location}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                              {doctor.patientCount || 0}/5 Patients
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Button size="sm" variant="outline">
                          Request Change
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Therapist Modal */}
      <Dialog open={showChangeTherapistModal} onOpenChange={setShowChangeTherapistModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-secondary" />
              Change Therapist
            </DialogTitle>
            <DialogDescription>
              Select a new therapist to assign to your child. They will provide therapy sessions and support.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {assignError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {assignError}
              </div>
            )}

            {loadingTherapists && (
              <div className="text-center py-8 text-muted-foreground">
                Loading available therapists...
              </div>
            )}

            {!loadingTherapists && filteredTherapists.length === 0 && (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No therapists available</p>
              </div>
            )}

            {!loadingTherapists && filteredTherapists.length > 0 && (
              <div className="space-y-3">
                {filteredTherapists.map((therapist) => (
                  <motion.div
                    key={therapist.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl border bg-card p-4 transition-all hover:border-secondary/50 cursor-pointer ${
                      selectedTherapist === therapist.id ? 'border-secondary ring-2 ring-secondary/20' : ''
                    }`}
                    onClick={() => {
                      if (isDiagnosed) {
                        handleSelectTherapist(therapist.id);
                        setShowChangeTherapistModal(false);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex gap-3">
                        <div className="h-12 w-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                          <HeartPulse className="h-6 w-6 text-secondary" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{therapist.name}</h4>
                          <p className="text-sm text-secondary mt-0.5">
                            {therapist.specialization}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {therapist.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-warning fill-warning" />
                              {therapist.rating || "-"} ({therapist.reviews})
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>
                        {selectedTherapist === therapist.id ? (
                          <div className="flex items-center gap-2 text-secondary">
                            <CheckCircle2 className="h-5 w-5" />
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="border-secondary text-secondary">
                            Select
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
