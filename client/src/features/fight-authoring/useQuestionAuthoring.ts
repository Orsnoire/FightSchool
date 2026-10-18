import { useToast } from "@/hooks/use-toast";
import { type Question } from "@shared/schema";
import { useRef,useState } from "react";


import { useQuestionCsv } from "./useQuestionCsv";

/** Route-owned draft lifecycle; saving a question preserves its identity and order. */
export function useQuestionAuthoring(questions: Question[], onChange: (questions: Question[]) => void) {
  const { toast } = useToast();
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const questionEditorRef = useRef<HTMLDivElement>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Partial<Question>>({
    type: "multiple_choice",
    timeLimit: 30,
    options: ["", "", "", ""],
  });
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const addQuestion = () => {
    let correctAnswer = currentQuestion.correctAnswer;
    
    if (currentQuestion.type === "multiple_choice") {
      if (selectedOptionIndex === null || !currentQuestion.options?.[selectedOptionIndex]) {
        toast({ title: "Please select a correct answer option", variant: "destructive" });
        return;
      }
      correctAnswer = currentQuestion.options[selectedOptionIndex];
    }
    
    if (!currentQuestion.question || !correctAnswer) {
      toast({ title: "Please fill in question and correct answer", variant: "destructive" });
      return;
    }
    
    const newQuestion: Question = {
      id: editingQuestionId || crypto.randomUUID(),
      type: currentQuestion.type as any,
      question: currentQuestion.question,
      options: currentQuestion.options,
      correctAnswer: correctAnswer,
      timeLimit: currentQuestion.timeLimit || 30,
    };
    const updatedQuestions = editingQuestionId
      ? questions.map(q => q.id === editingQuestionId ? newQuestion : q)
      : [...questions, newQuestion];
    onChange(updatedQuestions);
    setCurrentQuestion({
      type: "multiple_choice",
      timeLimit: 30,
      options: ["", "", "", ""],
    });
    setSelectedOptionIndex(null);
    setEditingQuestionId(null);
  };

  const cancelQuestionEdit = () => {
    setEditingQuestionId(null);
    setCurrentQuestion({ type: "multiple_choice", timeLimit: 30, options: ["", "", "", ""] });
    setSelectedOptionIndex(null);
  };

  const editQuestion = (question: Question) => {
    setEditingQuestionId(question.id);
    setCurrentQuestion(structuredClone(question));
    const selected = question.options?.indexOf(question.correctAnswer) ?? -1;
    setSelectedOptionIndex(selected < 0 ? null : selected);
    questionEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const csv = useQuestionCsv(questions, onChange);
  return { editingQuestionId, currentQuestion, setCurrentQuestion, selectedOptionIndex, setSelectedOptionIndex, questionEditorRef, addQuestion, cancelQuestionEdit, editQuestion, ...csv };
}
