import { useToast } from "@/hooks/use-toast";
import { useAvatarAppearance } from '@/hooks/useAvatarAppearance';
import { saveStudentLoadout } from "@/lib/studentLoadout";
import { initialAppearance, type AvatarJob } from '@shared/avatar/appearance';
import { type CharacterClass, type Student } from "@shared/schema";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";


/** Appearance writes finish before class/loadout writes; failed edits retain the draft. */
export function useClassAppearance(studentId: string | null, student: Student | undefined) {
  const client = useQueryClient();
  const { toast } = useToast();
  const [showClassModal, setShowClassModal] = useState(false);
  const savedAppearance = useAvatarAppearance(studentId);
  const [appearanceDraft, setAppearanceDraft] = useState(() => initialAppearance());
  const [previewJob, setPreviewJob] = useState<AvatarJob>('warrior');
  useEffect(() => {
    if (savedAppearance.data) setAppearanceDraft({ ...savedAppearance.data });
    else if (student?.gender) setAppearanceDraft(previous => ({ ...previous, modelId: student.gender === 'B' ? 'human-female-v1' : 'human-male-v1' }));
  }, [savedAppearance.data, student?.gender]);

  const handleClassChange = async (newClass: CharacterClass) => {
    if (!student?.gender) return;
    if (savedAppearance.isLoading || savedAppearance.isError || savedAppearance.saving) return;
    try { await savedAppearance.save(appearanceDraft); }
    catch { toast({ title: 'Your appearance could not be saved. Please try again.', variant: 'destructive' }); return; }
    if (newClass === student.characterClass) {
      setShowClassModal(false);
      return;
    }

    try {
      await saveStudentLoadout(client, studentId!, 'character', { characterClass: newClass, gender: student.gender });
      setShowClassModal(false);
      toast({ title: 'Class changed!', description: `You are now a ${newClass}` });
    } catch (error) {
      toast({ title: 'Failed to change class', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  };

  const openClassModal = () => {
    if (!student) return;
    if (savedAppearance.data) setAppearanceDraft({ ...savedAppearance.data });
    setPreviewJob(student.characterClass || 'warrior');
    setShowClassModal(true);
  };
  return { savedAppearance, appearanceDraft, setAppearanceDraft, previewJob, setPreviewJob, showClassModal, setShowClassModal, openClassModal, handleClassChange };
}
