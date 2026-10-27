import { useToast } from "@/hooks/use-toast";
import { saveStudentLoadout } from "@/lib/studentLoadout";
import { type EquipmentSlot, type Student } from "@shared/schema";
import { crossClassSelections } from '@shared/job-loadouts';
import { useQueryClient } from "@tanstack/react-query";


export function useLoadoutActions(studentId: string | null) {
  const client = useQueryClient();
  const { toast } = useToast();
  const updateEquipment = async (slot: EquipmentSlot, itemId: string | null) => {
    if (!studentId) return;
    try {
      await saveStudentLoadout(client, studentId, 'equipment', { [slot]: itemId });
      toast({ title: 'Equipment updated!' });
    } catch (error) {
      toast({ title: 'Equipment could not be changed', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  };

  const updateCrossClassAbility = async (slotNumber: number, abilityId: string | null) => {
    if (!studentId) return;
    try {
      const student = client.getQueryData<Student>([`/api/student/${studentId}`]);
      if (!student || slotNumber < 1 || slotNumber > 5) return;
      const crossClassAbilities = crossClassSelections(student);
      while (crossClassAbilities.length < slotNumber) crossClassAbilities.push(null);
      crossClassAbilities[slotNumber - 1] = abilityId;
      await saveStudentLoadout(client, studentId, 'equipment', { crossClassAbilities });
      toast({ title: abilityId ? 'Cross-class ability equipped!' : 'Cross-class ability removed!' });
    } catch (error) {
      toast({ title: 'Failed to update ability', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  };

  return { updateEquipment, updateCrossClassAbility };
}
