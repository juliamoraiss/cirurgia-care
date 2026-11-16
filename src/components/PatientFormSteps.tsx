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
  onStepClick?: (index: number) => void;
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
  onStepClick,
  isSubmitting,
  isEditMode,
}: PatientFormStepsProps) {
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  // Na edição dá para pular para qualquer etapa; no cadastro novo, só voltar.
  const canClickStep = (index: number) =>
    !!onStepClick && !isSubmitting && index !== currentStep && (isEditMode || index < currentStep);

  const submitLabel = isSubmitting
    ? "Salvando..."
    : isEditMode
    ? "Salvar alterações"
    : "Cadastrar Paciente";

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, index) => {
            const clickable = canClickStep(index);
            return (
              <div key={index} className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => clickable && onStepClick?.(index)}
                  disabled={!clickable}
                  title={clickable ? `Ir para "${step.title}"` : step.title}
                  aria-label={`Etapa ${index + 1}: ${step.title}`}
                  aria-current={index === currentStep ? "step" : undefined}
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all shrink-0",
                    index < currentStep
                      ? "bg-primary border-primary text-primary-foreground"
                      : index === currentStep
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground",
                    clickable ? "cursor-pointer hover:ring-2 hover:ring-primary/30" : "cursor-default"
                  )}
                >
                  {index < currentStep ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="font-semibold">{index + 1}</span>
                  )}
                </button>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 mx-2 transition-all",
                      index < currentStep ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="text-center mt-4">
          <h3 className="text-lg font-semibold">{steps[currentStep].title}</h3>
          <p className="text-sm text-muted-foreground">
            {steps[currentStep].description}
          </p>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-wrap justify-between gap-2 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onPrevious}
          disabled={isFirstStep || isSubmitting}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Anterior
        </Button>
        <div className="flex gap-2 ml-auto">
          {!isLastStep && (
            <Button
              type="button"
              variant={isEditMode ? "outline" : "default"}
              onClick={onNext}
              disabled={isSubmitting}
            >
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
          {(isLastStep || isEditMode) && (
            <Button type="button" onClick={(e) => onSubmit(e)} disabled={isSubmitting}>
              {submitLabel}
              <Check className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
