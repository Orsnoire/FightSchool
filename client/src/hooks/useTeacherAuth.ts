import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "./use-toast";

export function useTeacherAuth() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const response = await fetch("/api/teacher/check-session");
      
      if (response.ok) {
        setIsAuthenticated(true);
      } else {
        // Session expired or invalid
        localStorage.removeItem("teacherId");
        localStorage.removeItem("teacherEmail");
        setIsAuthenticated(false);
        toast({
          title: "Session Expired",
          description: "Please log in again",
          variant: "destructive",
        });
        navigate("/teacher");
      }
    } catch (error) {
      console.error("Session check failed:", error);
      setIsAuthenticated(false);
      navigate("/teacher");
    } finally {
      setIsChecking(false);
    }
  }

  return { isAuthenticated, isChecking };
}
