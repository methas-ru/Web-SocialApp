import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth, db } from "@/lib/firebase";
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc,
  deleteDoc 
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast.js";
import { AuthGuard } from "@/components/AuthGuard";
import { ArrowLeft, Users, Edit, Trash2, Save, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ActivityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activity, setActivity] = useState(null);
  const [requests, setRequests] = useState([]);
  const [userRequest, setUserRequest] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canAccessChat, setCanAccessChat] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  
  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchActivity();
  }, [id]);

  const fetchActivity = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const activityDoc = await getDoc(doc(db, "activities", id));

      if (!activityDoc.exists()) {
        throw new Error("Activity not found");
      }

      const activityData = { id: activityDoc.id, ...activityDoc.data() };
      setActivity(activityData);
      const userIsHost = activityData.hostId === user.uid;
      setIsHost(userIsHost);
      
      // Set edit form values
      setEditTitle(activityData.title || "");
      setEditDescription(activityData.description || "");
      setEditImageUrl(activityData.imageUrl || "");

      // Check chat access
      if (userIsHost) {
        setCanAccessChat(true);
        // Fetch participant count for chat
        fetchParticipantCount();
      }

      if (userIsHost) {
        // Fetch requests for this activity
        const requestsQuery = query(
          collection(db, "activityRequests"),
          where("activityId", "==", id)
        );
        const requestsSnapshot = await getDocs(requestsQuery);
        
        const requestsData = [];
        for (const requestDoc of requestsSnapshot.docs) {
          const requestData = { id: requestDoc.id, ...requestDoc.data() };
          
          // Fetch profile for each request
          const profileDoc = await getDoc(doc(db, "profiles", requestData.userId));
          if (profileDoc.exists()) {
            requestData.profiles = { id: profileDoc.id, ...profileDoc.data() };
          }
          requestsData.push(requestData);
        }

        // Sort by created date (newest first)
        requestsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setRequests(requestsData);
      } else {
        // Fetch user's request for this activity
        const userRequestQuery = query(
          collection(db, "activityRequests"),
          where("activityId", "==", id),
          where("userId", "==", user.uid)
        );
        const userRequestSnapshot = await getDocs(userRequestQuery);
        
        if (!userRequestSnapshot.empty) {
          const requestDoc = userRequestSnapshot.docs[0];
          const requestData = { id: requestDoc.id, ...requestDoc.data() };
          setUserRequest(requestData);
          
          // User can access chat if their request was accepted
          if (requestData.status === "accepted") {
            setCanAccessChat(true);
            // Fetch participant count for chat
            fetchParticipantCount();
          }
        }
      }
    } catch (error) {
      console.error("Error fetching activity:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load activity details.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRequest = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      await addDoc(collection(db, "activityRequests"), {
        activityId: id,
        userId: user.uid,
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      toast({
        title: "Request sent!",
        description: "Waiting for host approval.",
      });

      fetchActivity();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send request.",
      });
    }
  };

  const handleRequestAction = async (requestId, action) => {
    try {
      // Update the request status
      await updateDoc(doc(db, "activityRequests", requestId), {
        status: action,
      });

      // If accepted, add user to chat participants
      if (action === "accepted") {
        const request = requests.find(r => r.id === requestId);
        if (request) {
          const chatRef = doc(db, "chats", id);
          const chatDoc = await getDoc(chatRef);
          
          if (chatDoc.exists()) {
            const currentParticipants = chatDoc.data().participants || [];
            if (!currentParticipants.includes(request.userId)) {
              await updateDoc(chatRef, {
                participants: [...currentParticipants, request.userId],
              });
            }
          }
        }
      }

      toast({
        title: action === "accepted" ? "Request accepted" : "Request declined",
      });

      fetchActivity();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update request.",
      });
    }
  };

  const fetchParticipantCount = async () => {
    try {
      const chatDoc = await getDoc(doc(db, "chats", id));
      if (chatDoc.exists()) {
        const chatData = chatDoc.data();
        setParticipantCount(chatData.participants?.length || 0);
      }
    } catch (error) {
      console.error("Error fetching participant count:", error);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Reset form if canceling
      setEditTitle(activity.title || "");
      setEditDescription(activity.description || "");
      setEditImageUrl(activity.imageUrl || "");
    }
    setIsEditing(!isEditing);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      if (!editTitle.trim()) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Title cannot be empty.",
        });
        setSaving(false);
        return;
      }

      await updateDoc(doc(db, "activities", id), {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        imageUrl: editImageUrl.trim() || null,
        updatedAt: new Date().toISOString(),
      });

      // Update local state
      setActivity({
        ...activity,
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        imageUrl: editImageUrl.trim() || null,
      });

      toast({
        title: "Activity updated!",
        description: "Your changes have been saved.",
      });

      setIsEditing(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update activity.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEndActivity = async () => {
    try {
      // Delete all activity requests associated with this activity
      const requestsQuery = query(
        collection(db, "activityRequests"),
        where("activityId", "==", id)
      );
      const requestsSnapshot = await getDocs(requestsQuery);

      // Delete all requests
      const deletePromises = requestsSnapshot.docs.map(doc =>
        deleteDoc(doc.ref)
      );
      await Promise.all(deletePromises);

      // Delete all chat messages
      const messagesQuery = query(collection(db, "chats", id, "messages"));
      const messagesSnapshot = await getDocs(messagesQuery);
      const messageDeletePromises = messagesSnapshot.docs.map(doc =>
        deleteDoc(doc.ref)
      );
      await Promise.all(messageDeletePromises);

      // Delete the chat document
      await deleteDoc(doc(db, "chats", id));

      // Delete the activity itself
      await deleteDoc(doc(db, "activities", id));

      toast({
        title: "Activity deleted",
        description: "This activity has been permanently deleted.",
      });

      navigate("/");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete activity.",
      });
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </AuthGuard>
    );
  }

  if (!activity) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-muted-foreground">Activity not found</div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-8">
        <div className="max-w-lg mx-auto">
          <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 p-4 border-b border-border">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back</span>
            </button>
          </div>

          <div className="p-4 space-y-4">
            {isEditing ? (
              // Edit Mode
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-image">Image URL</Label>
                  <Input
                    id="edit-image"
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={editImageUrl}
                    onChange={(e) => setEditImageUrl(e.target.value)}
                  />
                  {editImageUrl && (
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                      <img
                        src={editImageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    type="text"
                    placeholder="Activity title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    placeholder="Activity description..."
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                    maxLength={500}
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleSaveEdit} 
                    disabled={saving}
                    className="flex-1"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button 
                    onClick={handleEditToggle} 
                    variant="outline"
                    disabled={saving}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              // View Mode
              <>
                {activity.imageUrl && (
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    <img
                      src={activity.imageUrl}
                      alt={activity.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-foreground">{activity.title}</h1>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>
                      Max {activity.maxParticipants} participants
                    </span>
                  </div>
                </div>

                {activity.description && (
                  <>
                    <Separator />
                    <p className="text-foreground">{activity.description}</p>
                  </>
                )}
              </>
            )}

            {!isEditing && (
              <>
                {isHost ? (
                  <>
                    <Separator />
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={handleEditToggle}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="flex-1">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Activity
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this activity?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the activity and all associated requests.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleEndActivity} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete Activity
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    {requests.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-4">
                          <h2 className="text-lg font-semibold text-foreground">
                            Join Requests ({requests.length})
                          </h2>
                          {requests.map((request) => (
                            <Card key={request.id} className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-foreground">
                                    {request.profiles?.username}
                                  </p>
                                  <Badge
                                    variant={
                                      request.status === "accepted"
                                        ? "default"
                                        : request.status === "rejected"
                                        ? "destructive"
                                        : "secondary"
                                    }
                                  >
                                    {request.status}
                                  </Badge>
                                </div>
                                {request.status === "pending" && (
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleRequestAction(request.id, "accepted")}
                                    >
                                      Accept
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleRequestAction(request.id, "rejected")}
                                    >
                                      Decline
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </Card>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Separator />
                    {userRequest ? (
                      <Card className="p-4">
                        <div className="text-center space-y-2">
                          <p className="text-foreground">Your request status:</p>
                          <Badge
                            variant={
                              userRequest.status === "accepted"
                                ? "default"
                                : userRequest.status === "rejected"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {userRequest.status}
                          </Badge>
                        </div>
                      </Card>
                    ) : (
                      <Button onClick={handleJoinRequest} className="w-full">
                        Request to Join
                      </Button>
                    )}
                  </>
                )}
              </>
            )}

            {/* Group Chat Box - Only for host and accepted participants */}
            {canAccessChat && !isEditing && (
              <>
                <Separator />
                <Card 
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => navigate(`/chat/${id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">Group Chat</h3>
                        <p className="text-sm text-gray-600">
                          {participantCount} member{participantCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
