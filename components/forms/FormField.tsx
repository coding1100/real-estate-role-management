"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { FormFieldConfig } from "@/lib/types/form";
import { wrapLegalSignsHtml } from "@/lib/richTextSigns";

type FormStyle = "default" | "questionnaire" | "detailed-perspective";

// Pragmatic email check (aligned with typical HTML5 email input behavior).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormFieldProps {
  field: FormFieldConfig;
  register: UseFormRegister<Record<string, any>>;
  errors: FieldErrors<Record<string, any>>;
  formStyle?: FormStyle;
}

export function FormField({ field, register, errors, formStyle = "default" }: FormFieldProps) {
  const {
    id,
    type,
    label,
    placeholder,
    required,
    options,
    helperText,
    optionalSection,
    boxedStyle,
  } = field;
  // Some saved form schemas reuse the same id for multiple different field types
  // (e.g. `id: "p"` for both a radio and a phone input). react-hook-form treats
  // identical ids as the same field key, which causes duplicate/misplaced
  // validation errors.
  //
  // Convention: use single-letter ids by input type when collisions happen:
  // - radio => "r"
  // - phone => "p"
  // (email commonly already uses "e" in working schemas)
  const effectiveId =
    id === "p"
      ? type === "radio"
        ? "r"
        : // phone stays "p"; other types keep their original id.
          id
      : id;

  const error = errors[effectiveId]?.message as string | undefined;
  // Phone validation should apply ONLY to fields explicitly configured as type="phone".
  // This prevents accidental validation of other fields whose ids may contain "phone".
  const looksLikePhone = type === "phone";
  const looksLikeEmail = type === "email";

  function sanitizePhoneInput(value: string): string {
    // Allow only digits + common separators (spaces, +, -, parentheses).
    let v = value.replace(/[^0-9+\-()\s]/g, "");

    // Keep '+' only at the beginning (ignoring leading spaces).
    const leading = v.match(/^\s*/)?.[0] ?? "";
    const rest = v.slice(leading.length);
    if (rest.includes("+")) {
      if (rest[0] !== "+") {
        v = leading + rest.replace(/\+/g, "");
      } else {
        v = leading + "+" + rest.slice(1).replace(/\+/g, "");
      }
    }

    // Do NOT truncate digits. Let validation decide based on exact
    // US length (10 digits or 11 starting with "1").
    return v;
  }


  if (type === "hidden") {
    return <input type="hidden" {...register(effectiveId)} />;
  }

  const baseClass =
    formStyle === "detailed-perspective"
      ? "block w-full !rounded-md border border-zinc-300 px-3 py-2.5 text-md shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 font-serif bg-white"
      : "block w-full rounded-md border border-zinc-300 px-3 py-2 text-md shadow-sm text-[#453d3d] focus:outline-none focus:ring-1 focus:ring-zinc-900 font-serif";
  const labelClass = "block text-md font-medium text-zinc-800 font-serif";

  const radioCheckClass =
    "form-radio-check h-4 w-4 min-w-4 rounded-sm border border-zinc-400 bg-white appearance-none cursor-pointer -mt-[2px] " +
    "checked:bg-transparent checked:border-zinc-400 focus:ring-2 focus:ring-zinc-900 focus:ring-offset-0";

  const fieldContent =
    type === "textarea" ? (
      <textarea
            id={effectiveId}
        rows={1}
        placeholder={placeholder}
        className={baseClass}
            {...register(effectiveId, { required })}
      />
    ) : type === "select" ? (
      <select
        id={effectiveId}
        className={baseClass}
        {...register(effectiveId, { required })}
        defaultValue=""
      >
        <option value="" disabled>
          {placeholder ?? "Select an option"}
        </option>
        {options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    ) : type === "radio" ? (
      (boxedStyle === true ||
        (boxedStyle === undefined && formStyle === "detailed-perspective")) ? (
        <ul className="space-y-3 pt-2 text-md text-zinc-800 font-serif detailed-perspective-radio-list">
          {options?.map((opt) => (
            <li key={opt.value} className="relative pl-5">
              <label className="flex items-start cursor-pointer group">
                <input
                  type="radio"
                  value={opt.value}
                  className="form-radio-check-detailed-hidden sr-only peer"
                  {...register(effectiveId, { required })}
                />
                <span className="flex-1 leading-relaxed peer-checked:font-medium">{opt.label}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-wrap gap-x-6 gap-y-1 pt-1 max-[768px]:gap-x-3 min-w-0">
          {options?.map((opt) => (
            <label
              key={opt.value}
              className="inline-flex items-center gap-2 text-md text-zinc-800 font-serif cursor-pointer min-w-0"
            >
              <input
                type="radio"
                value={opt.value}
                className={radioCheckClass}
                  {...register(effectiveId, { required })}
              />
              <span className="min-w-0 break-words">{opt.label}</span>
            </label>
          ))}
        </div>
      )
    ) : type === "checkbox" ? (
      (boxedStyle === true ||
        (boxedStyle === undefined && formStyle === "detailed-perspective")) ? (
        <ul className="space-y-3 pt-2 text-md text-zinc-800 font-serif">
          {options?.map((opt) => (
            <li key={opt.value}>
              <label className="flex cursor-pointer">
                <input
                  type="checkbox"
                  value={opt.value}
                  className="peer sr-only"
                  {...register(effectiveId, { required })}
                />
                <span className="flex-1 !rounded-md border border-zinc-300 bg-white px-3 py-2 leading-relaxed shadow-sm transition peer-checked:border-amber-800 peer-checked:bg-amber-50">
                  {opt.label}
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-wrap gap-x-6 gap-y-1 pt-1 max-[768px]:gap-x-3 min-w-0">
          {options?.map((opt) => (
            <label
              key={opt.value}
              className="inline-flex items-start items-center gap-2 text-md text-zinc-800 font-serif cursor-pointer min-w-0"
            >
              <input
                type="checkbox"
                value={opt.value}
                className={radioCheckClass}
                  {...register(effectiveId, { required })}
              />
              <span className="min-w-0 break-words">{opt.label}</span>
            </label>
          ))}
        </div>
      )
    ) : (
      (() => {
        const commonRequired = required ? "This field is required" : false;
        const reg = (() => {
          if (looksLikePhone) {
            return register(effectiveId, {
              required: commonRequired,
              validate: (value) => {
                const raw = typeof value === "string" ? value : String(value ?? "");
                const trimmed = raw.trim();
                if (!trimmed) return true; // let `required` handle empty values

                // Only allow typical phone characters: digits, spaces, +, -, parentheses
                if (!/^[0-9+\-()\s]+$/.test(trimmed)) {
                  return "Phone number can only include digits, spaces, +, -, and parentheses.";
                }
                if (trimmed.includes("+") && !trimmed.startsWith("+")) {
                  return "If using country code, '+' must be at the beginning (e.g., +1 202 555 0132).";
                }

                const digits = trimmed.replace(/\D/g, "");
                // US formats:
                // - 10 digits: 2025550132
                // - optional country code 1: 12025550132
                if (digits.length === 10) return true;
                if (digits.length === 11 && digits.startsWith("1")) return true;
                return "Please enter a valid phone number (e.g., 202-555-0132 or +1 202 555 0132).";
              },
            });
          }

          if (looksLikeEmail) {
            return register(effectiveId, {
              required: commonRequired,
              validate: (value) => {
                const raw = typeof value === "string" ? value : String(value ?? "");
                const trimmed = raw.trim();
                if (!trimmed) return true;
                if (!EMAIL_PATTERN.test(trimmed)) {
                  return "Please enter a valid email address.";
                }
                return true;
              },
            });
          }

          return register(effectiveId, { required });
        })();

        const { onChange: rhfOnChange, ...regRest } = reg;
        const inputType = looksLikePhone ? "tel" : looksLikeEmail ? "email" : "text";

        return (
          <input
            id={effectiveId}
            type={inputType}
            placeholder={placeholder}
            className={baseClass}
            {...regRest}
            onChange={(e) => {
              if (looksLikePhone) {
                e.target.value = sanitizePhoneInput(e.target.value);
              }
              rhfOnChange?.(e);
            }}
          />
        );
      })()
    );

  const wrapperClass = type === "radio" || type === "checkbox" ? "space-y-1" : "space-y-0.5";
  const outerClass = 
    formStyle === "detailed-perspective" && type === "radio"
      ? "space-y-0"
      : type === "radio" || type === "textarea"
      ? "space-y-1.5"
      : "space-y-1";

  if (type === "textarea" && optionalSection) {
    return (
      <div className={outerClass}>
        <div className="rounded-lg bg-[#fef6f6] backdrop-blur-sm border border-zinc-200/80 shadow-sm p-3 space-y-2">
          {label && (
            <p className="text-md font-semibold text-zinc-800 font-serif" dangerouslySetInnerHTML={{ __html: wrapLegalSignsHtml(label) }} />
          )}
          {helperText && (
            <p className="text-md text-zinc-700 font-serif" dangerouslySetInnerHTML={{ __html: wrapLegalSignsHtml(helperText) }} />
          )}
          <textarea
            id={id}
            rows={3}
            placeholder={placeholder}
            className={baseClass}
            {...register(id, { required })}
          />
        </div>
        {error && <p className="text-md text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className={outerClass}>
      <div className={wrapperClass}>
        {label && (
          <label htmlFor={effectiveId} className={labelClass}>
            <span dangerouslySetInnerHTML={{ __html: wrapLegalSignsHtml(label) }} />
          </label>
        )}
        {fieldContent}
      </div>
      {helperText && !error && (
        <p className="text-md text-zinc-500 font-serif" dangerouslySetInnerHTML={{ __html: wrapLegalSignsHtml(helperText) }} />
      )}
      {error && <p className="text-md text-red-500">{error}</p>}
    </div>
  );
}

