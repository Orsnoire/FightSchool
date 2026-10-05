import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { AvatarAppearance } from '@shared/avatar/appearance';
export function useAvatarAppearance(studentId:string|null) {
  const client=useQueryClient(),key=[`/api/student/${studentId}/avatar`];
  const query=useQuery<AvatarAppearance|null>({queryKey:key,enabled:!!studentId});
  const mutation=useMutation({
    mutationFn:async(appearance:AvatarAppearance)=>{
      const response=await apiRequest(query.data?'PUT':'POST',key[0],appearance);
      return response.json() as Promise<AvatarAppearance>;
    },
    onSuccess:value=>client.setQueryData(key,value),
  });
  return {...query,save:mutation.mutateAsync,saving:mutation.isPending};
}
