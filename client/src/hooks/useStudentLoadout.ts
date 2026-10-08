import { useQuery } from '@tanstack/react-query';
import type { Student, StudentJobLevel } from '@shared/schema';

export function useStudentLoadout(studentId:string|null) {
  const student=useQuery<Student>({queryKey:[`/api/student/${studentId}`],enabled:!!studentId,staleTime:0,refetchOnWindowFocus:true});
  const levels=useQuery<StudentJobLevel[]>({queryKey:[`/api/student/${studentId}/job-levels`],enabled:!!studentId,staleTime:0,refetchOnWindowFocus:true});
  return {student:student.data,jobLevels:levels.data || [],isLoading:student.isLoading || levels.isLoading,isFetching:student.isFetching || levels.isFetching,isError:student.isError || levels.isError};
}
