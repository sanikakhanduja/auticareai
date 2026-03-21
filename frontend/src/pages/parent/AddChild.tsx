import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Baby, Save } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { childrenService } from "@/services/data";
import { authService } from "@/services/auth";

export default function AddChild() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");

  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear(); 
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return Math.max(0, age);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !dateOfBirth) { 
      toast({
        title: "Missing Information",
        description: "Please enter the child's name and date of birth.",
        variant: "destructive",
      });
      return;
    }

    const newChild = {
      name: name.trim(),
      age: calculateAge(dateOfBirth),
      dateOfBirth,
      gender: gender || undefined,
      screeningStatus: "not-started" as const,
    };

    setIsSaving(true);
    const currentUser = await authService.getCurrentUser();
    if (!currentUser?.id) {
      setIsSaving(false);
      toast({
        title: "Not signed in",
        description: "Please sign in again to add a child profile.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await childrenService.createChild(newChild, currentUser.id);
    if (error) {
      setIsSaving(false);
      toast({
        title: "Failed to create profile",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Child Profile Created",
      description: `${name}'s profile has been added successfully.`,
    });

    setIsSaving(false);
    navigate("/parent/children");
  };

  return (
    <DashboardLayout>
      <Button variant="ghost" onClick={() => navigate("/parent")} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      <div className="max-w-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-8 shadow-card"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="h-14 w-14 rounded-xl bg-secondary/20 flex items-center justify-center">
              <Baby className="h-7 w-7 text-secondary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Add Child Profile</h1>
              <p className="text-muted-foreground">
                Register a new child to begin screening
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Child's Name *</Label>
              <Input
                id="name"
                placeholder="Enter child's full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth *</Label>
              <Input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                required
              />
              {dateOfBirth && (
                <p className="text-sm text-muted-foreground">
                  Age: {calculateAge(dateOfBirth)} years old
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender (Optional)</Label>
              <Select value={gender} onValueChange={(value: "male" | "female" | "other") => setGender(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 flex gap-3">
              <Button type="button" variant="outline" onClick={() => navigate("/parent")} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Creating..." : "Create Profile"}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
