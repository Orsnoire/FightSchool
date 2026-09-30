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
      const response = await fetch("/api/teacher/check-session", {
        credentials: "include"
      });
      
      if (response.ok) {
        // The verified cookie is authoritative. Restore the display cache when
        // local storage was cleared or this browser last used another account.
        const teacher = await response.json();
        localStorage.setItem("teacherId", teacher.id);
        localStorage.setItem("teacherEmail", teacher.email);
        localStorage.setItem("teacherGuildCode", teacher.guildCode);
        setIsAuthenticated(true);
      } else {
        // Session expired or invalid
        localStorage.removeItem("teacherId");
        localStorage.removeItem("teacherEmail");
        localStorage.removeItem("teacherGuildCode");
        setIsAuthenticated(false);
        toast({
          title: "Session Expired",
          description: "Please log in again",
          variant: "destructive",
        });
        navigate("/");
      }
    } catch (error) {
      console.error("Session check failed:", error);
      setIsAuthenticated(false);
      navigate("/");
    } finally {
      setIsChecking(false);
    }
  }

  return { isAuthenticated, isChecking };
}
