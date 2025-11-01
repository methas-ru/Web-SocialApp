import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Send, Users, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast.js";
import { AuthGuard } from "@/components/AuthGuard";

export default function Chat() {
  const { activityId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [participants, setParticipants] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [activityTitle, setActivityTitle] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchActivityDetails();
    fetchUserProfile();
    const unsubscribe = subscribeToMessages();
    const unsubscribeParticipants = subscribeToParticipants();
    return () => {
      unsubscribe && unsubscribe();
      unsubscribeParticipants && unsubscribeParticipants();
    };
  }, [activityId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchActivityDetails = async () => {
    try {
      const activityDoc = await getDoc(doc(db, "activities", activityId));
      if (activityDoc.exists()) {
        setActivityTitle(activityDoc.data().title || "Group Chat");
      }
    } catch (error) {
      console.error("Error fetching activity details:", error);
    }
  };

  const fetchUserProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const profileDoc = await getDoc(doc(db, "profiles", user.uid));
      if (profileDoc.exists()) {
        const profileData = profileDoc.data();
        setUsername(profileData.username || user.displayName || "User");
        setProfileImage(profileData.profileImage || "");
      } else {
        setUsername(user.displayName || user.email?.split("@")[0] || "User");
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setUsername(user.displayName || user.email?.split("@")[0] || "User");
    }
  };

  const subscribeToParticipants = () => {
    try {
      const chatDoc = doc(db, "chats", activityId);
      const unsubscribe = onSnapshot(chatDoc, async (snapshot) => {
        if (snapshot.exists()) {
          const chatData = snapshot.data();
          const participantIds = chatData.participants || [];
          setParticipantCount(participantIds.length);

          // Fetch profile data for each participant
          const participantsData = [];
          for (const userId of participantIds) {
            try {
              const profileDoc = await getDoc(doc(db, "profiles", userId));
              if (profileDoc.exists()) {
                const profileData = profileDoc.data();
                participantsData.push({
                  id: userId,
                  username: profileData.username || "User",
                  name: profileData.name || profileData.username || "User",
                  profileImage: profileData.profileImage || "",
                });
              } else {
                participantsData.push({
                  id: userId,
                  username: "User",
                  name: "User",
                  profileImage: "",
                });
              }
            } catch (error) {
              console.error("Error fetching participant profile:", error);
              participantsData.push({
                id: userId,
                username: "User",
                name: "User",
                profileImage: "",
              });
            }
          }
          setParticipants(participantsData);
        }
      });
      return unsubscribe;
    } catch (error) {
      console.error("Error subscribing to participants:", error);
      return null;
    }
  };

  const subscribeToMessages = () => {
    try {
      const messagesRef = collection(db, "chats", activityId, "messages");
      const q = query(messagesRef, orderBy("createdAt", "asc"));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messagesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMessages(messagesData);
      });

      return unsubscribe;
    } catch (error) {
      console.error("Error subscribing to messages:", error);
      return null;
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const messagesRef = collection(db, "chats", activityId, "messages");
      await addDoc(messagesRef, {
        userId: user.uid,
        username: username,
        message: newMessage.trim(),
        createdAt: serverTimestamp(),
      });

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message.",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <AuthGuard>
      <div style={{ minHeight: '100vh', backgroundColor: 'hsl(213, 35%, 15%)' }}>
        {/* Header */}
        <div style={{ 
          position: 'sticky', 
          top: 0, 
          zIndex: 10, 
          backgroundColor: 'hsl(217, 33%, 18%)', 
          borderBottom: '1px solid hsl(215, 20%, 30%)',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                onClick={() => navigate(-1)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  color: 'hsl(210, 15%, 70%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <ArrowLeft style={{ height: '1.25rem', width: '1.25rem' }} />
                <span>Back</span>
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                <Users style={{ height: '1.25rem', width: '1.25rem', color: 'hsl(210, 15%, 70%)' }} />
                <div>
                  <h1 style={{ fontWeight: '600', color: 'hsl(180, 20%, 96%)' }}>{activityTitle}</h1>
                  <button
                    onClick={() => setShowParticipants(true)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.25rem', 
                      fontSize: '0.875rem', 
                      color: 'hsl(210, 15%, 70%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {participantCount} member{participantCount !== 1 ? "s" : ""}
                    <ChevronDown style={{ height: '0.75rem', width: '0.75rem' }} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '1.5rem 1rem' }}>
          <div style={{ minHeight: 'calc(100vh - 200px)' }}>
            {messages.length === 0 ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '24rem', 
                color: 'hsl(210, 15%, 70%)', 
                textAlign: 'center' 
              }}>
                <div>
                  <Users style={{ height: '3rem', width: '3rem', margin: '0 auto 1rem', color: 'hsl(215, 25%, 25%)' }} />
                  <p style={{ fontSize: '1.125rem', fontWeight: '500' }}>No messages yet</p>
                  <p style={{ fontSize: '0.875rem' }}>Start the conversation!</p>
                </div>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isCurrentUser = msg.userId === auth.currentUser?.uid;
                return (
                  <div
                    key={msg.id}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'flex-end', 
                      gap: '0.75rem', 
                      marginBottom: '1.5rem',
                      justifyContent: isCurrentUser ? 'flex-end' : 'flex-start'
                    }}
                  >
                    {/* Other users' messages - Left side */}
                    {!isCurrentUser && (
                      <>
                        <Avatar style={{ height: '2rem', width: '2rem', flexShrink: 0 }}>
                          <AvatarImage src={msg.profileImage} alt={msg.username} />
                          <AvatarFallback style={{ fontSize: '0.75rem' }}>
                            {getInitials(msg.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '70%' }}>
                          <p style={{ fontSize: '0.75rem', fontWeight: '500', color: 'hsl(210, 15%, 70%)', marginBottom: '0.25rem' }}>
                            {msg.username}
                          </p>
                          <div style={{ 
                            backgroundColor: 'hsl(217, 33%, 18%)', 
                            color: 'hsl(180, 20%, 96%)', 
                            border: '1px solid hsl(215, 20%, 30%)', 
                            borderRadius: '1rem', 
                            padding: '0.5rem 1rem', 
                            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                            position: 'relative'
                          }}>
                            <div style={{ 
                              position: 'absolute', 
                              left: '-0.25rem', 
                              bottom: '0', 
                              width: '0.75rem', 
                              height: '0.75rem', 
                              backgroundColor: 'hsl(217, 33%, 18%)', 
                              borderLeft: '1px solid hsl(215, 20%, 30%)', 
                              borderBottom: '1px solid hsl(215, 20%, 30%)', 
                              transform: 'rotate(45deg)' 
                            }}></div>
                            <p style={{ fontSize: '0.875rem', wordBreak: 'break-word', margin: 0 }}>{msg.message}</p>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'hsl(210, 15%, 70%)', marginTop: '0.25rem' }}>
                            {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Current user's messages - Right side */}
                    {isCurrentUser && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', maxWidth: '70%' }}>
                          <div style={{ 
                            backgroundColor: '#22c55e', 
                            color: 'white', 
                            borderRadius: '1rem', 
                            padding: '0.5rem 1rem',
                            position: 'relative'
                          }}>
                            <div style={{ 
                              position: 'absolute', 
                              right: '-0.25rem', 
                              bottom: '0', 
                              width: '0.75rem', 
                              height: '0.75rem', 
                              backgroundColor: '#22c55e', 
                              transform: 'rotate(45deg)' 
                            }}></div>
                            <p style={{ fontSize: '0.875rem', wordBreak: 'break-word', margin: 0 }}>{msg.message}</p>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'hsl(210, 15%, 70%)', marginTop: '0.25rem' }}>
                            {formatTime(msg.createdAt)}
                          </p>
                        </div>
                        <Avatar style={{ height: '2rem', width: '2rem', flexShrink: 0 }}>
                          <AvatarImage src={profileImage} alt={username} />
                          <AvatarFallback style={{ fontSize: '0.75rem' }}>
                            {getInitials(username)}
                          </AvatarFallback>
                        </Avatar>
                      </>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input - Fixed at bottom */}
        <div style={{ 
          position: 'sticky', 
          bottom: 0, 
          backgroundColor: 'hsl(217, 33%, 18%)', 
          borderTop: '1px solid hsl(215, 20%, 30%)', 
          boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)' 
        }}>
          <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '1rem' }}>
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="Type a new message"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={loading}
                maxLength={500}
                style={{ 
                  flex: 1, 
                  border: '1px solid hsl(215, 20%, 30%)', 
                  borderRadius: '9999px', 
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  outline: 'none',
                  backgroundColor: 'hsl(215, 25%, 25%)',
                  color: 'hsl(180, 20%, 96%)'
                }}
              />
              <button 
                type="submit" 
                disabled={loading || !newMessage.trim()}
                style={{ 
                  backgroundColor: '#22c55e', 
                  color: 'white', 
                  padding: '0.75rem 1.5rem', 
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Send style={{ height: '1rem', width: '1rem' }} />
              </button>
            </form>
          </div>
        </div>

        {/* Participants Modal */}
        <Dialog open={showParticipants} onOpenChange={setShowParticipants}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Group Members ({participantCount})
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {participants.map((participant) => (
                <div key={participant.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={participant.profileImage} alt={participant.name} />
                    <AvatarFallback>
                      {getInitials(participant.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-gray-900">{participant.name}</p>
                    <p className="text-sm text-gray-600">@{participant.username}</p>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AuthGuard>
  );
}
