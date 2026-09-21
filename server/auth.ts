import type { NextFunction, Request, Response } from "express";

export function isTeacherAuthorized(
  sessionTeacherId: string | number | undefined,
  resourceTeacherId: string | number,
): boolean {
  return sessionTeacherId !== undefined && String(sessionTeacherId) === String(resourceTeacherId);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.teacherId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export function requireTeacherParamOwnership(paramName: "id" | "teacherId") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isTeacherAuthorized(req.session.teacherId, req.params[paramName])) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
