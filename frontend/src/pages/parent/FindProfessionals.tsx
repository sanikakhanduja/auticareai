import { useEffect, useState } from "react";
import { useLoadScript } from "@react-google-maps/api";
import { LocationSearch } from "@/components/LocationSearch";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { careDoctorsService, childrenService } from "@/services/data";

interface Doctor {
  id: string;
  name: string;
  assigned_patients: number;
  max_patients: number;
  available: boolean;
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
}

const libraries: ("places")[] = ["places"];

const mockTherapists: Therapist[] = [
  {
    id: "ther1",
    name: "Jennifer Adams",
    qualification: "M.S., CCC-SLP",
    specialization: "Speech-Language Pathology",
    rating: 4.9,
    reviews: 89,
    location: "Therapy Solutions Center, 1.8 miles",
    available: true,
    therapyTypes: ["Speech", "Communication"],
  },
  {
    id: "ther2",
    name: "Michael Torres",
    qualification: "OTR/L",
    specialization: "Pediatric Occupational Therapy",
    rating: 4.8,
    reviews: 112,
    location: "Kids Development Center, 2.5 miles",
    available: true,
    therapyTypes: ["Motor", "Sensory"],
  },
  {
    id: "ther3",
    name: "Lisa Park",
    qualification: "BCBA",
    specialization: "Applied Behavior Analysis",
    rating: 4.9,
    reviews: 145,
    location: "Behavioral Health Partners, 3.2 miles",
    available: true,
    therapyTypes: ["Social", "Behavioral"],
  },
];

export default function FindProfessionals() {
  const { selectedChildId, setSelectedChildId } = useAppStore();
  const [children, setChildren] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorAssignmentsByChild, setDoctorAssignmentsByChild] = useState<Record<string, string>>({});
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [doctorError, setDoctorError] = useState<string | null>(null);
  const [currentChild, setCurrentChild] = useState<any>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [selectedTherapist, setSelectedTherapist] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);

  useEffect(() => {
    const loadChildren = async () => {
      setLoadingChildren(true);
      const { data, error } = await childrenService.getChildren();
      if (error) {
        console.error("Error loading children:", error);
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

      if (selectedChildId) {
        const selected = normalized.find((c) => c.id === selectedChildId);
        if (selected) {
          setCurrentChild(selected);
        } else if (normalized.length > 0) {
          setCurrentChild(normalized[0]);
          setSelectedChildId(normalized[0].id);
        }
      } else if (normalized.length > 0) {
        setCurrentChild(normalized[0]);
        setSelectedChildId(normalized[0].id);
      }

      setLoadingChildren(false);
    };

    loadChildren();
  }, []);

  const loadDoctorData = async () => {
    setLoadingDoctors(true);
    setDoctorError(null);

    const [{ data: doctorsData, error: doctorsError }, { data: assignmentsData, error: assignmentsError }] = await Promise.all([
      careDoctorsService.getCareDoctorsWithCapacity(),
      careDoctorsService.getMyChildDoctorAssignments(),
    ]);

    if (doctorsError) {
      console.error("Error loading doctors:", doctorsError);
      setDoctorError("Could not load doctors right now.");
    }

    if (assignmentsError) {
      console.error("Error loading doctor assignments:", assignmentsError);
      setDoctorError("Could not load saved doctor selections.");
    }

    setDoctors((doctorsData as Doctor[]) || []);

    const assignmentsMap: Record<string, string> = {};
    for (const row of assignmentsData || []) {
      assignmentsMap[row.child_id] = row.doctor_id;
    }
    setDoctorAssignmentsByChild(assignmentsMap);
    setLoadingDoctors(false);
  };

  useEffect(() => {
    loadDoctorData();
  }, []);

  useEffect(() => {
    if (!currentChild) {
      setSelectedDoctor(null);
      setSelectedTherapist(null);
      return;
    }

    setSelectedDoctor(doctorAssignmentsByChild[currentChild.id] || null);
    setSelectedTherapist(currentChild.assignedTherapistId || null);
  }, [currentChild, doctorAssignmentsByChild]);

  const handleChildChange = (childId: string) => {
    setSelectedChildId(childId);
    const selected = children.find((c) => c.id === childId);
    if (selected) {
      setCurrentChild(selected);
    }
  };

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const isDiagnosed = currentChild?.screeningStatus === "diagnosed";

  const handleSelectDoctor = async (doctorId: string) => {
    if (!currentChild) return;

    setDoctorError(null);
    const { data, error } = await careDoctorsService.assignDoctorToChild(currentChild.id, doctorId);
    const rpcResult = Array.isArray(data) ? data[0] : data;

    if (error || !rpcResult?.success) {
      setDoctorError(rpcResult?.error || error?.message || "Unable to assign doctor right now.");
      await loadDoctorData();
      return;
    }

    setSelectedDoctor(doctorId);
    setDoctorAssignmentsByChild((prev) => ({ ...prev, [currentChild.id]: doctorId }));
    await loadDoctorData();
  };

  const handleSelectTherapist = async (therapistId: string) => {
    if (!isDiagnosed) return;
    setSelectedTherapist(therapistId);
    if (currentChild) {
      await childrenService.updateChild(currentChild.id, { assignedTherapistId: therapistId });
    }
  };

  const filteredDoctors = doctors.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTherapists = mockTherapists.filter((ther) =>
    ther.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ther.specialization.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        {loadingChildren ? (
          <div className="w-full max-w-xs h-10 bg-muted animate-pulse rounded-lg" />
        ) : children.length === 0 ? (
          <div className="text-sm text-muted-foreground">No children found. Please add a child first.</div>
        ) : (
          <Select value={selectedChildId || ""} onValueChange={handleChildChange}>
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
        )}
      </div>

      {/* Child Status Display */}
      {currentChild && (
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
                    {currentChild.screeningStatus === "under-observation" 
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

      {/* Search Bar */}
      <div className="mb-6 flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by doctor id or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {isLoaded ? (
          <LocationSearch 
            onSelectLocation={(lat, lng, address) => setLocation({ lat, lng, address })} 
            className="w-[300px]"
          />
        ) : (
          <div className="w-[300px] h-10 bg-muted animate-pulse rounded-md" />
        )}
      </div>

      {/* Location Filter Status */}
      {location && (
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>Showing results near: <span className="font-medium text-foreground">{location.address}</span></span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-auto p-0 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => setLocation(null)}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Tabs for Doctors and Therapists */}
      <Tabs defaultValue="doctors" className="space-y-6">
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
          {doctorError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {doctorError}
            </div>
          )}

          {loadingDoctors && (
            <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
              Loading doctors...
            </div>
          )}

          {filteredDoctors.map((doctor, index) => (
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
                    <p className="text-sm text-muted-foreground">Doctor ID: {doctor.id}</p>
                    <p className="text-sm text-primary mt-1">
                      Assigned: {doctor.assigned_patients}/{doctor.max_patients}
                    </p>
                    
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span className="text-xs">
                          {doctor.max_patients - doctor.assigned_patients} slot(s) left
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  {!doctor.available && selectedDoctor !== doctor.id ? (
                    <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
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
                      disabled={!doctor.available}
                    >
                      Select Doctor
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
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

          {filteredTherapists.map((therapist, index) => (
            <motion.div
              key={therapist.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-2xl border bg-card p-6 shadow-card transition-all ${
                !isDiagnosed 
                  ? "opacity-50 cursor-not-allowed" 
                  : selectedTherapist === therapist.id
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
                        <span className="text-sm font-medium">{therapist.rating}</span>
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
                  {!isDiagnosed ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Lock className="h-4 w-4" />
                      <span className="text-xs">Locked</span>
                    </div>
                  ) : selectedTherapist === therapist.id ? (
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
        </TabsContent>
      </Tabs>

      {/* Guidance Text */}
      <div className="mt-8 rounded-xl bg-muted/50 border border-border p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Selected professionals will have access to your child's screening data and videos
          to provide appropriate care and recommendations.
        </p>
      </div>
    </DashboardLayout>
  );
}
