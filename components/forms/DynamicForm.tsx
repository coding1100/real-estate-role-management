"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { FormSchema } from "@/lib/types/form";
import { type CtaForwardingRule } from "@/lib/types/ctaForwarding";
import {
  resolveCtaRuleForSubmission,
} from "@/lib/ctaForwardingValidation";
import { wrapLegalSignsHtml } from "@/lib/richTextSigns";
import { FormField } from "./FormField";
import { useRecaptcha } from "./Captcha";
import { useToast } from "@/components/ui/use-toast";
import { trackDataLayerEvent } from "@/lib/tracking";

type FormStyle = "default" | "questionnaire" | "detailed-perspective";

interface DynamicFormProps {
  schema: FormSchema;
  submitUrl?: string;
  extraHiddenFields?: Record<string, string | undefined>;
  ctaText: string;
  successMessage: string;
  textSize?: string;
  ctaBgColor?: string;
  formStyle?: FormStyle;
  helperText?: string;
  postCtaText?: string;
  onNextStep?: (values: Record<string, unknown>) => void | Promise<void>;
  skipValidationForNextStep?: boolean;
  ctaForwardingRules?: CtaForwardingRule[];
}

export function DynamicForm({
  schema,
  submitUrl = "/api/leads",
  extraHiddenFields,
  ctaText,
  successMessage,
  textSize,
  ctaBgColor,
  formStyle = "default",
  helperText,
  postCtaText,
  onNextStep,
  skipValidationForNextStep,
  ctaForwardingRules,
}: DynamicFormProps) {
  const parseSubmissionErrorMessage = async (res: Response): Promise<string> => {
    try {
      const data = (await res.json()) as { error?: unknown };
      if (typeof data?.error === "string" && data.error.trim()) {
        return data.error.trim();
      }
    } catch {
      // Ignore JSON parsing errors and use generic fallback.
    }
    return "Something went wrong. Please try again.";
  };

  const isCaptchaFailure = (status: number, message: string): boolean =>
    status === 400 && /captcha/i.test(message);

  const {
    register,
    handleSubmit,
    getValues,
    control,
    formState: { errors },
    reset,
  } = useForm<Record<string, any>>({
    // When fields are hidden via conditional logic, unregister them so they
    // don't keep stale values/required-validation errors.
    shouldUnregister: true,
  });

  const [isPending, startTransition] = useTransition();
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [submittingDotCount, setSubmittingDotCount] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { execute } = useRecaptcha();
  const { toast } = useToast();
  const watchedValues = useWatch({ control }) as Record<string, unknown>;

  useEffect(() => {
    const isSubmitting = isPending || isAdvancing;
    if (!isSubmitting) {
      setSubmittingDotCount(1);
      return;
    }
    const timer = setInterval(() => {
      setSubmittingDotCount((count) => (count % 3) + 1);
    }, 380);
    return () => clearInterval(timer);
  }, [isPending, isAdvancing]);

  const handleNextClick = async () => {
    if (!onNextStep) return;
    const values = getValues();
    const honeypot = (values as any).website as string | undefined;
    if (honeypot) {
      setSubmitted(true);
      reset();
      return;
    }
    try {
      setIsAdvancing(true);
      await onNextStep(values as Record<string, unknown>);
    } finally {
      setIsAdvancing(false);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const honeypot = (values as any).website as string | undefined;
    if (honeypot) {
      setSubmitted(true);
      reset();
      return;
    }
    if (onNextStep) {
      try {
        setIsAdvancing(true);
        await onNextStep(values as Record<string, unknown>);
      } finally {
        setIsAdvancing(false);
      }
      return;
    }
    startTransition(async () => {
      try {
        const buildPayload = (token: string | null) => ({
          ...values,
          ...extraHiddenFields,
          _ctaText: ctaText,
          recaptchaToken: token,
        });
        const firstToken = await execute("lead_submit");
        let res = await fetch(submitUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(firstToken)),
        });
        let failureMessage = "";
        if (!res.ok) {
          failureMessage = await parseSubmissionErrorMessage(res);
          if (isCaptchaFailure(res.status, failureMessage)) {
            const retryToken = await execute("lead_submit");
            res = await fetch(submitUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(buildPayload(retryToken)),
            });
            if (!res.ok) {
              failureMessage = await parseSubmissionErrorMessage(res);
            }
          }
        }
        if (!res.ok) {
          throw new Error(failureMessage || "Something went wrong. Please try again.");
        }
        setSubmitted(true);
        reset();
        toast({
          title: "Success",
          description:
            (successMessage &&
              successMessage.replace(/<[^>]+>/g, "").trim()) ||
            "Thank you! We'll be in touch shortly.",
          variant: "default",
        });
        trackDataLayerEvent("generate_lead", {
          entry_slug: String(extraHiddenFields?.slug ?? ""),
          step_slug: String(
            extraHiddenFields?._stepSlug ?? extraHiddenFields?.slug ?? "",
          ),
          step_index: 0,
          is_last_step: true,
          flow_type:
            typeof extraHiddenFields?._multistepData === "string"
              ? "multistep"
              : "single",
          page_type: String(extraHiddenFields?.type ?? ""),
          domain_host: String(extraHiddenFields?.domain ?? ""),
          cta_title: ctaText ?? "",
        });
        const redirectRule = resolveCtaRuleForSubmission(
          ctaForwardingRules,
          ctaText,
        ).rule;
        if (redirectRule?.forwardEnabled !== false && redirectRule?.forwardUrl) {
          window.location.assign(redirectRule.forwardUrl);
        }
      } catch (e) {
        console.error(e);
        const msg =
          e instanceof Error && e.message.trim()
            ? e.message.trim()
            : "Something went wrong. Please try again.";
        setError(msg);
        toast({
          title: "Submission failed",
          description: msg,
          variant: "destructive",
        });
      }
    });
  });

  if (!schema?.fields?.length) {
    return null;
  }

  const sortedFields = [...schema.fields].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  function isFieldVisible(field: (typeof sortedFields)[number]): boolean {
    const rule = field.visibility;
    if (!rule) return true;
    const raw = watchedValues?.[rule.whenFieldId];
    if (Array.isArray(raw)) {
      return raw.map(String).includes(String(rule.equals));
    }
    return String(raw ?? "") === String(rule.equals);
  }

  const visibleFields = sortedFields.filter(isFieldVisible);

  const formInlineStyle = textSize ? { fontSize: textSize } : undefined;
  const buttonStyle = ctaBgColor ? { backgroundColor: ctaBgColor } : undefined;
  const isQuestionnaire = formStyle === "questionnaire";
  const isDetailedPerspective = formStyle === "detailed-perspective";
  const buttonClass = isDetailedPerspective && !ctaBgColor
    ? "inline-flex w-full items-center justify-center !rounded-md bg-amber-800 px-4 py-2.5 text-md font-medium text-amber-50 shadow-md hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60 font-serif"
    : isQuestionnaire && !ctaBgColor
    ? "inline-flex w-full items-center justify-center !rounded-md bg-amber-800 px-4 py-2.5 text-md font-medium text-amber-50 shadow-md hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60 font-serif"
    : "inline-flex w-full items-center justify-center bg-zinc-900 px-4 py-2 text-md font-medium text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <>
      <form
        onSubmit={onSubmit}
        className={`${isDetailedPerspective ? "space-y-3" : "space-y-3"} text-md ${isQuestionnaire || isDetailedPerspective ? "font-serif" : ""}`}
        style={formInlineStyle}
      >
        {/* Honeypot field for bots */}
        <input
          type="text"
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          {...register("website")}
        />

        {visibleFields.map((field, index) => (
          <FormField
            key={`${field.id}-${index}`}
            field={field}
            register={register}
            errors={errors}
            formStyle={formStyle}
          />
        ))}

        {error && <p className="text-md text-red-500">{error}</p>}

        <button
          type={onNextStep && skipValidationForNextStep ? "button" : "submit"}
          disabled={isPending || isAdvancing}
          className={buttonClass}
          style={buttonStyle}
          onClick={
            onNextStep && skipValidationForNextStep ? handleNextClick : undefined
          }
        >
          {isPending || isAdvancing ? (
            `Submitting${".".repeat(submittingDotCount)}`
          ) : (
            <span
              className="cta-text"
              dangerouslySetInnerHTML={{ __html: wrapLegalSignsHtml(ctaText) }}
            />
          )}
        </button>
        {helperText && (
          <p
            className={`${isDetailedPerspective ? "mt-2 text-md" : "mt-2 text-md"} text-zinc-600 font-serif text-center leading-relaxed`}
            dangerouslySetInnerHTML={{ __html: wrapLegalSignsHtml(helperText) }}
          />
        )}
        {postCtaText && (
          <div
            className="text-md text-zinc-700 font-serif leading-relaxed"
            dangerouslySetInnerHTML={{ __html: wrapLegalSignsHtml(postCtaText) }}
          />
        )}
      </form>
    </>
  );
}

