import { useMemo } from 'react';

export interface FormProgressResult {
  totalRequired: number;
  filledRequired: number;
  percentage: number;
  isComplete: boolean;
  missingRequiredKeys: string[];
}

export type RequiredFieldValidator<T> = (value: T) => boolean;

export interface FieldDefinition<T = any> {
  key: string;
  label: string;
  value: T;
  required?: boolean;
  validate?: RequiredFieldValidator<T>;
}

/**
 * Custom hook to calculate form completion statistics for required fields.
 * Formula: (filled_required_fields / total_required_fields) * 100
 */
export function useFormProgress(fields: FieldDefinition[]): FormProgressResult {
  return useMemo(() => {
    const requiredFields = fields.filter((f) => f.required !== false);
    const totalRequired = requiredFields.length;

    const missingRequiredKeys: string[] = [];
    let filledRequired = 0;

    for (const field of requiredFields) {
      let isFilled = false;

      if (field.validate) {
        isFilled = field.validate(field.value);
      } else {
        const val = field.value;
        if (typeof val === 'string') {
          isFilled = val.trim().length > 0;
        } else if (typeof val === 'number') {
          isFilled = !isNaN(val);
        } else if (typeof val === 'boolean') {
          isFilled = val === true;
        } else if (Array.isArray(val)) {
          isFilled = val.length > 0;
        } else if (val !== null && val !== undefined) {
          isFilled = true;
        }
      }

      if (isFilled) {
        filledRequired++;
      } else {
        missingRequiredKeys.push(field.key);
      }
    }

    const percentage = totalRequired > 0 ? Math.min(100, Math.max(0, Math.round((filledRequired / totalRequired) * 100))) : 0;
    const isComplete = totalRequired > 0 && filledRequired === totalRequired;

    return {
      totalRequired,
      filledRequired,
      percentage,
      isComplete,
      missingRequiredKeys,
    };
  }, [fields]);
}
