import { useToast } from "@/hooks/use-toast";
import { type Question } from "@shared/schema";
import { useRef, useState } from "react";

import Papa from "papaparse";

import { questionsFromCsvRows } from "./csv";
import { questionImportValidationMessages, validationSummary } from "./validation";

export function useQuestionCsv(questions: Question[], onChange: (questions: Question[]) => void) {
  const { toast } = useToast();
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingCSV(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsedQuestions = questionsFromCsvRows(results.data as Record<string, string | undefined>[]);
          if (parsedQuestions.length === 0) {
            setIsUploadingCSV(false);
            toast({
              title: "No valid questions found",
              description: "Please check your CSV format",
              variant: "destructive"
            });
            return;
          }

          const updatedQuestions = [...questions, ...parsedQuestions];
          const validationMessages = questionImportValidationMessages(updatedQuestions);
          if (validationMessages.length) {
            setIsUploadingCSV(false);
            toast({
              title: "CSV could not be imported",
              description: "No questions were added. " + validationSummary(validationMessages),
              variant: "destructive",
            });
            if (csvInputRef.current) csvInputRef.current.value = "";
            return;
          }

          // Use setTimeout to allow the browser to process the parsed questions
          // This prevents blocking the main thread with large CSV files
          setTimeout(() => {
            try {
              onChange(updatedQuestions);

              setIsUploadingCSV(false);
              toast({
                title: `Successfully imported ${parsedQuestions.length} questions`,
                variant: "default"
              });

              if (csvInputRef.current) {
                csvInputRef.current.value = "";
              }
            } catch (error) {
              setIsUploadingCSV(false);
              toast({
                title: "Failed to add questions",
                description: error instanceof Error ? error.message : "Unknown error",
                variant: "destructive"
              });
            }
          }, 0);
        } catch (error) {
          setIsUploadingCSV(false);
          toast({
            title: "Failed to parse CSV",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive"
          });
        }
      },
      error: (error) => {
        setIsUploadingCSV(false);
        toast({
          title: "Failed to read CSV file",
          description: error.message,
          variant: "destructive"
        });
      }
    });
  };

  return { isUploadingCSV, csvInputRef, handleCSVUpload };
}
