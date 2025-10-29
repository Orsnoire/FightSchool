import 'express-session';

declare module 'express-session' {
  interface SessionData {
    teacherId?: string;
    teacherEmail?: string;
  }
}
