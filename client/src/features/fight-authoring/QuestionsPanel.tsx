import { QuestionPreview } from "@/components/QuestionPreview";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup,RadioGroupItem } from "@/components/ui/radio-group";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { type Question } from "@shared/schema";
import { Edit,PlusCircle,Trash2,Upload } from "lucide-react";


import type { useQuestionAuthoring } from "./useQuestionAuthoring";

interface QuestionsPanelProps {
  questions: Question[];
  onChange: (questions: Question[]) => void;
  editor: ReturnType<typeof useQuestionAuthoring>;
}
export function QuestionsPanel({ questions, onChange, editor }: QuestionsPanelProps) {
  const { toast } = useToast();
  const { editingQuestionId, currentQuestion, setCurrentQuestion, selectedOptionIndex, setSelectedOptionIndex, questionEditorRef, addQuestion, cancelQuestionEdit, editQuestion, isUploadingCSV, csvInputRef, handleCSVUpload } = editor;
  return (
              <TabsContent value="questions" className="space-y-4"><div ref={questionEditorRef} className="scroll-mt-24" />
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{editingQuestionId ? "Edit Question" : "Add Question"}</CardTitle>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          ref={csvInputRef}
                          accept=".csv"
                          onChange={handleCSVUpload}
                          className="hidden"
                          data-testid="input-csv-upload"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => csvInputRef.current?.click()}
                          disabled={isUploadingCSV}
                          data-testid="button-upload-csv"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          {isUploadingCSV ? "Importing..." : "Import CSV"}
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      CSV format: "question text", "question type", "timer", "answer1", "answer2", "answer3", "answer4"<br />
                      Question types: multiple_choice/MC, true_false/TF, short_answer/SA (case-insensitive)<br />
                      Timer: seconds (5-120), defaults to 30 if omitted
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Question Type</label>
                      <Select
                        value={currentQuestion.type}
                        onValueChange={(value: any) => {
                          setCurrentQuestion({ ...currentQuestion, type: value, correctAnswer: "" });
                          setSelectedOptionIndex(null);
                        }}
                      >
                        <SelectTrigger data-testid="select-question-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                          <SelectItem value="true_false">True/False</SelectItem>
                          <SelectItem value="short_answer">Short Answer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Question</label>
                      <Textarea
                        value={currentQuestion.question || ""}
                        onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
                        placeholder="Enter your question text"
                        className="min-h-[100px]"
                        data-testid="textarea-question"
                      />
                    </div>

                    {currentQuestion.type === "multiple_choice" && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Options (select the correct answer)</label>
                        <RadioGroup
                          value={selectedOptionIndex !== null ? String(selectedOptionIndex) : ""}
                          onValueChange={(value) => {
                            const index = parseInt(value);
                            setSelectedOptionIndex(index);
                          }}
                        >
                          {currentQuestion.options?.map((opt, i) => (
                            <div key={i} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <RadioGroupItem
                                  value={String(i)}
                                  id={`option-${i}`}
                                  data-testid={`radio-option-${i}`}
                                  disabled={!opt}
                                />
                                <Label htmlFor={`option-${i}`} className="text-sm">Option {i + 1} (Click to mark as correct)</Label>
                              </div>
                              <Textarea
                                value={opt}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setCurrentQuestion((prev) => {
                                    const newOpts = [...(prev.options || [])];
                                    newOpts[i] = value;
                                    return { ...prev, options: newOpts };
                                  });
                                  if (selectedOptionIndex === i && !value) {
                                    setSelectedOptionIndex(null);
                                    toast({ 
                                      title: "Selection cleared", 
                                      description: "Please select a valid answer option",
                                      variant: "default"
                                    });
                                  }
                                }}
                                placeholder={`Enter option ${i + 1} text`}
                                className="min-h-[60px]"
                                data-testid={`textarea-option-${i}`}
                              />
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    )}

                    {currentQuestion.type === "true_false" && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Correct Answer</label>
                        <RadioGroup
                          value={currentQuestion.correctAnswer || ""}
                          onValueChange={(value) => setCurrentQuestion({ ...currentQuestion, correctAnswer: value })}
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="true" id="true" data-testid="radio-true" />
                            <Label htmlFor="true">True</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="false" id="false" data-testid="radio-false" />
                            <Label htmlFor="false">False</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    )}

                    {currentQuestion.type === "short_answer" && (
                      <div>
                        <label className="text-sm font-medium">Correct Answer</label>
                        <Input
                          value={currentQuestion.correctAnswer || ""}
                          onChange={(e) => setCurrentQuestion({ ...currentQuestion, correctAnswer: e.target.value })}
                          placeholder="Enter the correct answer"
                          data-testid="input-correct-answer"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium">Time Limit: {currentQuestion.timeLimit}s</label>
                      <Slider
                        value={[currentQuestion.timeLimit || 30]}
                        onValueChange={([value]) => setCurrentQuestion({ ...currentQuestion, timeLimit: value })}
                        min={5}
                        max={120}
                        step={5}
                        data-testid="slider-time-limit"
                      />
                    </div>

                    {currentQuestion.question?.trim() && (
                      <section aria-label="Student preview" className="space-y-2">
                        <h3 className="text-sm font-medium">Student preview</h3>
                        <QuestionPreview question={currentQuestion} />
                      </section>
                    )}

                    {editingQuestionId && <p role="status">Editing question {questions.findIndex(q => q.id === editingQuestionId) + 1}</p>}
                    <Button type="button" onClick={addQuestion} className="w-full" data-testid={editingQuestionId ? "button-save-question" : "button-add-question"}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      {editingQuestionId ? "Save question changes" : "Add Question"}
                    </Button>
                    {editingQuestionId && <Button type="button" variant="outline" onClick={cancelQuestionEdit}>Cancel</Button>}
                  </CardContent>
                </Card>

                {questions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Questions ({questions.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {questions.map((q, i) => (
                        <div key={q.id} className="flex items-start gap-3 p-3 border border-border rounded-md" data-testid={`question-item-${i}`}>
                          <div className="min-w-0 flex-1 space-y-3">
                            <p className="font-medium">Question {i + 1} <span className="text-sm font-normal text-muted-foreground">• {q.timeLimit}s</span></p>
                            <QuestionPreview question={q} />
                            <details className="text-sm">
                              <summary className="cursor-pointer text-muted-foreground">View source</summary>
                              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3">{q.question}</pre>
                            </details>
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={() => editQuestion(q)} aria-label={`Edit question ${i + 1}`} data-testid={`button-edit-question-${i}`}><Edit className="mr-1 h-4 w-4" />Edit</Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (editingQuestionId === q.id) cancelQuestionEdit();
                              const updated = questions.filter((_, idx) => idx !== i);
                              onChange(updated);
                            }}
                            data-testid={`button-delete-question-${i}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

  );
}
