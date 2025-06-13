import {
  useEffect,
  useRef,
  useMemo,
  useState,
  useContext,
  createContext,
} from "react";
import { getFormData, setFormData } from "./formHelper";
import { asyncDelay } from "~/lib/utils";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { toast } from "sonner";
import { patch, post, put } from "~/lib/fetchWrapper";
import { queryClient } from "~/providers/queryClient";
import { getObjVal, setObjVal } from "./objectFromPathString";

// Define types
export interface FormSubmitOptions {
  originalData: Record<string, any>;
  dataHasChanged: boolean;
}

export type FormSubmitResult =
  | void
  | Promise<void>
  | false
  | "revert"
  | Promise<false | "revert" | undefined>;

export type FormSubmitHandler = (
  data: any,
  options: FormSubmitOptions,
) => FormSubmitResult;

interface FormProps {
  onSubmit?: FormSubmitHandler;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  method?: string;
  action?: string;
  fRef?: React.RefObject<HTMLFormElement | null>;
  originalData?: Record<string, any>;
  validateOnSubmit?: boolean;
}

export function Form(props: FormProps) {
  const validateOnSubmit = props.validateOnSubmit ?? true;
  const submitFunc = (ev: React.FormEvent<HTMLFormElement>) => {
    if (!props.onSubmit) return;
    ev.preventDefault();
    const frm = ev.currentTarget;
    if (!frm) return;
    if (validateOnSubmit && !frm.checkValidity()) return;
    const data = getFormData(frm);
    const result = props.onSubmit(data, {
      originalData: props.originalData || {},
      dataHasChanged: !recursivelyCompareObjects(
        data,
        props.originalData ?? {},
      ),
    });
    if (result instanceof Promise) {
      result.then((r) => {
        if (r === "revert") {
          setFormData(frm, {});
          setFormData(frm, props.originalData || {});
          return;
        }
        if (r === false) return;
        frm.reset();
        setFormData(frm, {});
      });
    } else {
      if (result === "revert") {
        setFormData(frm, {});
        setFormData(frm, props.originalData || {});
        return;
      }
      if (result === false) return;
      frm.reset();
      setFormData(frm, {});
    }
  };
  return (
    <form
      role="form"
      onSubmit={submitFunc}
      className={props.className}
      style={props.style}
      method={props.method}
      action={props.action}
      ref={props.fRef}
    >
      {props.children}
    </form>
  );
}

function recursivelyCompareObjects(obj1: any, obj2: any): boolean {
  if (obj1 instanceof Date && obj2 instanceof Date) {
    return obj1.getTime() === obj2.getTime();
  }
  if (
    typeof obj1 !== "object" ||
    obj1 === null ||
    typeof obj2 !== "object" ||
    obj2 === null
  ) {
    return Object.is(obj1, obj2);
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (!keys2.includes(key)) {
      return false;
    }
    if (!recursivelyCompareObjects(obj1[key], obj2[key])) {
      return false;
    }
  }

  return true;
}

const internalSetFormData = (
  data: Record<string, any>,
  formRef: React.RefObject<HTMLFormElement | null>,
  setOriginalData: (() => void) | null = null,
) => {
  if (data === undefined) return;
  if (!formRef || !formRef.current) return;

  setFormData(formRef.current, data);
  if (setOriginalData) {
    setOriginalData();
  }
};

async function setInitialData(
  formRef: React.RefObject<HTMLFormElement | null>,
  initialData?: Record<string, any>,
  setOriginalData: (() => void) | null = null,
) {
  if (initialData === undefined) return;
  await asyncDelay(0);
  internalSetFormData(initialData, formRef, setOriginalData);
  (formRef.current?.querySelector("[name]") as HTMLInputElement)?.focus();
}

function formInputChangeHandler(ev: any) {
  const val = ev.currentTarget.value;
  (ev.currentTarget as any)._zSetSourceVal(val);
}

interface FormContextType {
  formRef: React.RefObject<HTMLFormElement | null>;
  onSubmit?: FormSubmitHandler;
  validateOnSubmit: boolean;
  initialData?: Record<string, any>;
  originalData?: Record<string, any>;
  formMutation?: UseMutationResult<unknown, Error, void, unknown>;
  setFormData: (data: Record<string, any>) => void;
  getFormData: () => Record<string, any>;
  formDirty: React.RefObject<string | false>;
  setFormDirty: (dirtyField: string | false) => void;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

export const useFormContext = (inputName?: string) => {
  const ctx = useContext(FormContext);
  if (!ctx) return undefined;

  const fieldValue = inputName ? getObjVal(ctx?.initialData, inputName) : null;

  return { ...ctx, fieldValue };
};

const fetchMap = {
  POST: post,
  PATCH: patch,
  PUT: put,
};

function useStandardFormMutation({
  action,
  method = "POST",
  queryKey,
  queryKeyToInvalidate,
  name = "",
  originalData,
  formDirty,
  formRef,
  onSubmit,
}: {
  action: string;
  method: "POST" | "PATCH" | "PUT";
  queryKey?: string[];
  queryKeyToInvalidate?: string[];
  name?: string;
  originalData?: any;
  formDirty: React.RefObject<string | false>;
  formRef: React.RefObject<HTMLFormElement | null>;
  onSubmit?: FormSubmitHandler;
}) {
  return useMutation({
    mutationFn: (data) => {
      const fn = fetchMap[method] as typeof post;

      if (formDirty.current) {
        const inputName = formDirty.current;
        const inputElm = formRef.current?.querySelector(
          `[name="${inputName}"]`,
        ) as HTMLInputElement | undefined;

        if (inputElm && inputElm.dataset.clickToEdit === "true") {
          const singleData = {};
          const val = getObjVal(data, inputName);
          setObjVal(singleData, inputName, val);
          return fn(action, singleData);
        }
      }

      return fn(action, data);
    },

    onMutate: async (newData: any) => {
      const activeElement = document.activeElement as HTMLInputElement;
      const activeName = activeElement?.name;

      // Cancel any outgoing refetches
      // (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      if (queryKey) {
        const prevData = queryClient.getQueryData(queryKey);

        // Optimistically update to the new value
        if (typeof prevData === "object" && typeof newData === "object")
          queryClient.setQueryData(queryKey, { ...prevData, ...newData });

        // Return a context with the previous and new todo
        return { prevData, newData, activeName };
      }

      return { newData, activeName };
    },

    onSuccess: async (data: any, _context, test) => {
      toast.success(`Saved ${name}!`);

      if (queryKeyToInvalidate)
        queryClient.invalidateQueries({ queryKey: queryKeyToInvalidate });

      if (onSubmit) {
        return onSubmit(data, { originalData, dataHasChanged: true });
      }

      setTimeout(() => {
        const inp = document.querySelector(
          `[name="${test.activeName}"]`,
        ) as HTMLInputElement;

        if (inp) {
          inp.focus();
          const len = inp.value.length;
          inp.setSelectionRange(len, len);
        }
      }, 50);
    },

    onError: (err, newData, context) => {
      toast.error(`Failed to save ${name} ... ${err.message}`);
      const prevData: any = context?.prevData ?? {};
      queryClient.setQueryData(queryKey as any, { ...prevData });

      if (onSubmit) {
        onSubmit({ error: err }, { originalData, dataHasChanged: true });
      }

      setTimeout(() => {
        const inp = document.querySelector(
          `[name="${context?.activeName}"]`,
        ) as HTMLInputElement;

        if (inp) {
          inp.focus();
          const len = inp.value.length;
          inp.setSelectionRange(len, len);
        }

        setFormData(formRef.current, newData);
      }, 50);

      console.error("failed to mutate", {
        originalData,
        err,
        name,
        action,
        method,
        queryKey,
        newData,
        context,
      });
    },
  });
}

export function useForm({
  onSubmit,
  action,
  method = "POST",
  queryKey,
  queryKeyToInvalidate,
  name,
  initialData,
  enableSubmitWhenChanged,
  validateOnSubmit = true,
  validateImmediately = false,
  experimental,
}: {
  onSubmit?: FormSubmitHandler;
  action?: string;
  queryKey?: string[];
  queryKeyToInvalidate?: string[];
  name?: string;
  method?: "POST" | "PATCH" | "PUT";
  initialData?: Record<string, any>;
  enableSubmitWhenChanged?: boolean;
  validateOnSubmit?: boolean;
  validateImmediately?: boolean;
  experimental?: {
    setSourceValOnInput?: boolean;
  };
} = {}) {
  const formRef = useRef<HTMLFormElement>(null);

  const [originalData, setOriginalDataState] = useState(initialData);
  const formDirty = useRef<string | false>(false);
  const setFormDirty = (dirtyField: string | false) => {
    formDirty.current = dirtyField;
  };

  const _internalSetFormData = (data: any) => {
    internalSetFormData(data, formRef);
  };

  const mutation = action
    ? useStandardFormMutation({
        action,
        method,
        queryKey,
        queryKeyToInvalidate,
        name,
        originalData,
        formDirty,
        formRef,
        onSubmit,
      })
    : undefined;

  return useMemo(() => {
    const internalGetFormData = () => getFormData(formRef.current);

    const WrappedForm = (props: FormProps) => {
      useEffect(() => {
        if (!formRef.current) return;

        const ref = formRef.current;

        if (experimental?.setSourceValOnInput) {
          ref.addEventListener("input", formInputChangeHandler);

          return () => {
            ref.removeEventListener("input", formInputChangeHandler);
          };
        }
      }, [experimental?.setSourceValOnInput]);

      useEffect(() => {
        if (!formRef.current) return;

        setInitialData(formRef, initialData, () => {
          if (
            !recursivelyCompareObjects(
              getFormData(formRef.current),
              originalData,
            )
          ) {
            setOriginalDataState(getFormData(formRef.current));
            if (validateImmediately) {
              setTimeout(() => {
                if (formRef.current) formRef.current.zwcValidateForm();
              }, 100);
            }
          }
        });

        if (!enableSubmitWhenChanged) return;

        const ref = formRef.current;
        const submitButton =
          ref.querySelector<HTMLButtonElement>('[type="submit"]');
        if (!submitButton) return;

        submitButton.disabled = true;
        const onFormChange = () => {
          const formData = getFormData(formRef.current);
          if (recursivelyCompareObjects(formData, originalData)) {
            submitButton.disabled = true;
          } else {
            submitButton.disabled = false;
          }
        };

        ref.addEventListener("input", onFormChange);

        return () => {
          ref.removeEventListener("input", onFormChange);
        };
      }, []);

      const actionSubmit = (data: any, { dataHasChanged }: any) => {
        if (!dataHasChanged) return false as false;
        if (!mutation) return false as false;
        mutation.mutate(data);

        return false as false;
      };

      return (
        <FormContext.Provider
          value={{
            formRef,
            onSubmit: action ? actionSubmit : onSubmit,
            validateOnSubmit,
            initialData,
            originalData: originalData,
            formMutation: mutation,
            setFormData: _internalSetFormData,
            getFormData: internalGetFormData,
            formDirty,
            setFormDirty,
          }}
        >
          <Form
            fRef={formRef}
            onSubmit={action ? actionSubmit : onSubmit}
            validateOnSubmit={validateOnSubmit}
            originalData={originalData}
            {...props}
          >
            {props.children}
          </Form>
        </FormContext.Provider>
      );
    };
    return [WrappedForm, _internalSetFormData, internalGetFormData] as const;
  }, [enableSubmitWhenChanged, initialData, onSubmit, originalData, mutation]);
}
