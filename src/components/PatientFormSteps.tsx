import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Step {
  title: string;
  description: string;
}

interface PatientFormStepsProps {
  currentStep: number;
  totalSteps: number;
  steps: Step[];
  onNext: () => void;
  onPrevious: () => void;
  onSubmit: (e: any) => void;
  isSubmitting: boolean;
  isEditMode: boolean;
}

export function PatientFormSteps({
  currentStep,
  totalSteps,
  steps,
  onNext,
  onPrevious,
  onSubmit,
  isSubmitting,
  isEditMode,
}: PatientFormStepsProps) {
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center flex-1">
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                  index < currentStep
                    ? "bg-primary border-primary text-primary-foreground"
                    : index === currentStep
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground"
                )}
              >
                {index < currentStep ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span className="font-semibold">{index + 1}</span>
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 transition-all",
                    index < currentStep ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <div className="text-center mt-4">
          <h3 className="text-lg font-semibold">{steps[currentStep].title}</h3>
          <p className="text-sm text-muted-foreground">
            {steps[currentStep].description}
          </p>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onPrevious}
          disabled={isFirstStep || isSubmitting}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Anterior
        </Button>
        {!isLastStep ? (
          <Button type="button" onClick={onNext} disabled={isSubmitting}>
            Próximo
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button type="button" onClick={(e) => onSubmit(e)} disabled={isSubmitting}>
            {isSubmitting
              ? "Salvando..."
              : isEditMode
              ? "Atualizar Paciente"
              : "Cadastrar Paciente"}
            <Check className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
