import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ActivityCard } from "@/components/ActivityCard";
import { BottomNav } from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast.js";
import { AuthGuard } from "@/components/AuthGuard";

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState({ hosted: 0, waiting: 0, accepted: 0 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
    fetchActivities();
  }, []);

  const fetchProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const profileDoc = await getDoc(doc(db, "profiles", user.uid));
      
      if (profileDoc.exists()) {
        setProfile({ id: profileDoc.id, ...profileDoc.data() });
      } else {
        // Fallback to auth display name
        setProfile({ 
          id: user.uid, 
          username: user.displayName || user.email?.split('@')[0] || 'User' 
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const fetchActivities = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Fetch hosted activities
      const hostedQuery = query(
        collection(db, "activities"),
        where("hostId", "==", user.uid),
        where("endedAt", "==", null)
      );
      const hostedSnapshot = await getDocs(hostedQuery);
      const hosted = hostedSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(), 
        badge: "hosted" 
      }));

      // Fetch activity requests
      const requestsQuery = query(
        collection(db, "activityRequests"),
        where("userId", "==", user.uid)
      );
      const requestsSnapshot = await getDocs(requestsQuery);
      
      const waiting = [];
      const accepted = [];
      
      for (const requestDoc of requestsSnapshot.docs) {
        const requestData = requestDoc.data();
        const activityDoc = await getDoc(doc(db, "activities", requestData.activityId));
        
        if (activityDoc.exists()) {
          const activityData = { id: activityDoc.id, ...activityDoc.data() };
          if (requestData.status === "pending") {
            waiting.push({ ...activityData, badge: "waiting" });
          } else if (requestData.status === "accepted") {
            accepted.push({ ...activityData, badge: "accepted" });
          }
        }
      }

      setStats({
        hosted: hosted.length,
        waiting: waiting.length,
        accepted: accepted.length,
      });

      setActivities([...hosted, ...waiting, ...accepted]);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please select an image file.",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
      });
      return;
    }

    setUploading(true);
    try {
      // Convert to base64 for storage
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result;
        
        const user = auth.currentUser;
        if (!user) return;

        // Update profile in Firestore
        const profileRef = doc(db, "profiles", user.uid);
        await setDoc(profileRef, {
          ...profile,
          profileImage: base64String,
        }, { merge: true });

        // Update local state
        setProfile(prev => ({ ...prev, profileImage: base64String }));

        toast({
          title: "Profile picture updated!",
          description: "Your profile picture has been updated successfully.",
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Failed to update profile picture.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    toast({
      title: "Logged out",
      description: "You've been successfully logged out.",
    });
    navigate("/auth");
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-lg mx-auto p-4 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Profile</h1>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>
          <h1><br /></h1>
              {profile && (
                <Card className="p-6 ">
                  <div className="flex space-x-4 items-center">
                  {/* <div className="space-y-4 flex"> */}
                    <div className="text-center">
                      {/* Profile Picture */}
                      <div className="relative inline-block mb-4">
                        <label
                          htmlFor="profile-upload"
                          className="cursor-pointer"
                          title="Click to change profile picture"
                        >
                          <Avatar className="h-12 w-12">
                            <AvatarImage
                              src={profile.profileImage}
                              alt={profile.name || profile.username}
                              className="h-full w-full object-cover rounded-full"
                            />
                            <AvatarFallback className="text-lg">
                              {getInitials(profile.name || profile.username)}
                            </AvatarFallback>
                          </Avatar>
                        </label>
                        <input
                          type="file"
                          id="profile-upload"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          disabled={uploading}
                        />
                      </div>

                      <h2 className="text-xl font-semibold text-foreground">
                        {profile.name || profile.username}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        @{profile.username}
                      </p>
                    </div>

                    <div className = "flex space-x-4">
                    {/* <div className="grid grid-cols-3 gap-4 text-center "> */}
                      <div>
                        <div className="text-2xl font-bold text-accent text-center">{stats.hosted}</div>
                        <div className="text-sm text-muted-foreground">Hosted</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-secondary text-center">{stats.waiting}</div>
                        <div className="text-sm text-muted-foreground">Waiting</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-primary text-center">{stats.accepted}</div>
                        <div className="text-sm text-muted-foreground">Accepted</div>
                      </div>
                    </div>
                  </div>
                </Card>
          )}

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground"><br /><br />My Activities</h2>
            <h2><br /></h2>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading activities...
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No activities yet
              </div>
            ) : (
              <div className="grid gap-4">
                {activities.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    id={activity.id}
                    title={activity.title}
                    imageUrl={activity.imageUrl || undefined}
                    participantCount={0}
                    maxParticipants={activity.maxParticipants}
                    badge={activity.badge}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <BottomNav />
      </div>
    </AuthGuard>
  );
}
