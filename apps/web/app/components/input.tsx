import { type ChangeEventHandler, useEffect, useRef, useState } from "react";

import {
  type ValidatorOptions,
  setupValidatorInput,
} from "~/formLibrary/validator";
import { twMerge } from "tailwind-merge";
import { basedOnLabel, cn } from "~/lib/utils";
import { labelVariants } from "~/components/ui/label";
import { ChevronUp, ChevronDown, Pencil, Save, X } from "lucide-react";
import { useFormContext } from "~/formLibrary/useForm";
import { getObjVal } from "~/formLibrary/objectFromPathString";
import { toast } from "sonner";

interface CustomErrorElm extends HTMLElement {
  errorObj?: Map<string, boolean>;
}

export const defaultInputStyle =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 transition-colors focus-visible:outline-none focus:border-primary";

export const outerDivStylesForClickToEdit = ["relative", "group"];

export const inputHoverStyles = ["hover:border-input"];

export const clickToEditAriaDescription =
  "Click to edit this field, or press the enter key while focussed to enter edit mode";

export interface InputProps extends Omit<ValidatorOptions, "inputElm"> {
  children?: React.ReactNode;
  // variant?: "primary" | "secondary" | "plain";
  onChange?: ChangeEventHandler<HTMLInputElement>;
  onInput?: ChangeEventHandler<HTMLInputElement>;
  onBlur?: ChangeEventHandler<HTMLInputElement>;
  inputRef?: any;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  maskHideSecretOnBlur?: boolean;
  revealedInputType?: string;
  clickToEdit?: boolean;
  clickToViewIfRedacted?: (
    value: string,
  ) => boolean | string | Promise<boolean | string>;
  type?:
    | "button"
    | "checkbox"
    | "color"
    | "date"
    | "datetime-local"
    | "email"
    | "file"
    | "hidden"
    | "image"
    | "month"
    | "number"
    | "password"
    | "radio"
    | "range"
    | "reset"
    | "search"
    | "submit"
    | "tel"
    | "text"
    | "time"
    | "url"
    | "week"
    | (string & {});
  preText?: string | React.ReactNode;
  postText?: string | React.ReactNode;
  label?: string;
  id?: string;
  name?: string;
  step?: number;
  min?: string | number;
  max?: string | number;
  autoComplete?: string;
  required?: boolean | ((value: string) => boolean);
  placeholder?: string;
  defaultValue?: any;
  dataObject?: any;
  value?: any;
  syncToDisabledInput?: string;
  labelClass?: string;
  labelStyle?: React.CSSProperties;
  errorClass?: string;
  errorStyle?: React.CSSProperties;
  inputClass?: string;
  inputStyle?: React.CSSProperties;
  labelProps?: any;
  inputProps?: any;
  errorProps?: any;
  style?: React.CSSProperties;

  autoFocus?: boolean;
  errorElm?: CustomErrorElm;
  minLength?: number;
  maxLength?: number;
  exactLength?: number;
  pattern?: RegExp;
  customValidator?: (value: string) => boolean | string;
  mask?: string;
  maskSlots?: string;
  noMaskTrim?: boolean;
  dataAccept?: RegExp | string;
  allowUnacceptedChars?: boolean;
  unmaskInputValueProp?: boolean;
  showFullMaskWhileTyping?: boolean;
  hideDotSlots?: boolean;
  validateUnMaskedValue?: boolean;
  validateOnInput?: boolean;
  isNumeric?: boolean;
  customErrorMessages?: {
    isRequired?: string;
    inputNotLongEnough?: string;
    inputLengthTooLong?: string;
    patternNotValid?: string;
    customNotValid?: string;
  };
}

function Input(props: InputProps) {
  const inputRef: any = useRef(null);
  const errorRef: any = useRef(null);
  const [inputType, setInputType] = useState(props.type);
  const [editMode, setEditMode] = useState(props.clickToEdit ? false : true);
  const [dirty, setDirty] = useState(false);
  const [formIsDirty, setFormIsDirty] = useState<string | false>(false);
  const normalizedName = props.name || basedOnLabel(props.label || "");

  if (props.inputRef) props.inputRef.current = inputRef.current;

  const ctx = useFormContext(normalizedName);

  if (props.defaultValue && ctx?.initialData)
    throw "Do not use the `defaultValue` prop on inputs that are inside a form that was created with `initialData` using the `useForm` hook.";

  let dataAccept = props.dataAccept;

  if (props.type === "number" || props.formatNumber) {
    dataAccept = "[\\d\\.eE-]";
  }

  const handleIncrement = () => {
    if (!inputRef.current) return;
    const input = inputRef.current;
    input.stepUp();
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const handleDecrement = () => {
    if (!inputRef.current) return;
    const input = inputRef.current;
    input.stepDown();
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const selectAll = () => {
    const prevType = inputRef.current.type;
    inputRef.current.type = "text";
    const maskedLen = inputRef.current?.maskedValue?.length;
    const len = maskedLen ?? inputRef.current.value.length;
    inputRef.current.setSelectionRange(0, len);
    inputRef.current.type = prevType;
  };

  const saveClickToEdit = (ev: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    ev.stopPropagation();
    if (ctx) {
      ctx.formRef.current?.requestSubmit();
    }
  };

  const discardClickToEdit = (
    ev?: React.MouseEvent<SVGSVGElement, MouseEvent>,
  ) => {
    ev?.stopPropagation();
    if (inputRef.current && ctx) {
      const val = getObjVal(ctx.originalData, normalizedName);
      inputRef.current.value = val;

      if (ctx) ctx.setFormDirty(false);
      setDirty(false);
    }
  };

  const setupValidator = () => {
    if (!inputRef.current || !errorRef.current) return;
    const inpRef = inputRef.current;
    const errRef = errorRef.current;
    if (
      props.value !== undefined &&
      props.value !== null &&
      inputRef.current.value !== props.value
    ) {
      inpRef.value = props.value;

      const evtInput = new Event("input", { bubbles: true });
      const evtChange = new Event("change", { bubbles: true });

      inpRef.dispatchEvent(evtInput);
      setTimeout(() => {
        inpRef.dispatchEvent(evtChange);
      }, 0);
    } else {
      inpRef.value = inpRef.value || "";
    }

    setupValidatorInput({
      inputElm: inpRef,
      errorElm: errRef,
      ...props,
      dataAccept,
      setInputType,
    });
  };

  let handleInputClick: (
    ev: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => void;

  useEffect(() => {
    if (!inputRef.current) return;
    const ref = inputRef.current;
    const nativeOnChange = (e: any) => {
      props.onChange?.(e);
    };

    const checkFieldDirty = (onlyForDirtyField: boolean = false) => {
      if (!props.clickToEdit) return;
      if (inputRef.current && ctx) {
        if (onlyForDirtyField && ctx.formDirty.current !== normalizedName)
          return;

        const val = getObjVal(ctx.originalData, normalizedName);
        let inpVal = inputRef.current.value;
        if (inputRef.current.type === "number" || props.formatNumber)
          inpVal = Number(inpVal);
        if (val === inpVal) {
          setDirty(false);
          if (ctx) ctx.setFormDirty(false);
        } else {
          setDirty(true);
          if (ctx) ctx.setFormDirty(normalizedName);
        }
      }
    };

    checkFieldDirty(true);

    const nativeOnInput = (e: any) => {
      checkFieldDirty();
      props.onInput?.(e);
    };

    const nativeOnWheel = (e: any) => {
      if (props.type === "number") {
        e.target.blur();
      }
    };

    const _handleInputClick = (
      ev: React.MouseEvent<HTMLDivElement, MouseEvent>,
    ) => {
      if (ctx?.formDirty.current && !editMode && !dirty) {
        if (
          ev.type === "click" ||
          (ev instanceof KeyboardEvent && !["Shift", "Tab"].includes(ev.key))
        ) {
          toast.error(
            "Please save or discard changes before editing another field",
          );
          inputRef.current.shake();
        }
        return;
      }
      if (ctx?.formMutation?.isPending) return;
      if (!props.clickToEdit) return;

      if (ev.type === "blur" && inputRef.current?.readOnly === false) {
        return setEditMode(false);
      }

      if (
        ev instanceof KeyboardEvent &&
        ev.key === "Escape" &&
        (inputRef.current?.readOnly === false || dirty)
      ) {
        discardClickToEdit();
        return setEditMode(false);
      }

      if (
        ev instanceof KeyboardEvent &&
        ev.key === "Enter" &&
        inputRef.current?.readOnly === false
      ) {
        ctx?.formRef?.current?.requestSubmit();
        return setEditMode(false);
      }

      if (ev instanceof KeyboardEvent && ev.key === "Enter") {
        selectAll();
        setEditMode(true);
      }

      if (ev.type === "click") {
        setEditMode(true);
        inputRef.current?.focus();
      }
    };

    handleInputClick = _handleInputClick;

    ref.addEventListener("change", nativeOnChange);
    ref.addEventListener("input", nativeOnInput);
    ref.addEventListener("wheel", nativeOnWheel, { passive: false });
    ref.addEventListener("click", _handleInputClick);
    ref.addEventListener("blur", _handleInputClick);
    ref.addEventListener("keydown", _handleInputClick);
    return () => {
      ref.removeEventListener("change", nativeOnChange);
      ref.removeEventListener("input", nativeOnInput);
      ref.removeEventListener("wheel", nativeOnWheel, { passive: false });
      ref.removeEventListener("click", _handleInputClick);
      ref.removeEventListener("blur", _handleInputClick);
      ref.removeEventListener("keydown", _handleInputClick);
    };
  }, [props, editMode, dirty, formIsDirty]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(setupValidator, [...Object.values(props)]);

  const checkIfFormDirty = () => {
    const formDirty = ctx?.formDirty.current ?? false;
    if (formDirty !== formIsDirty) setFormIsDirty(formDirty);
  };

  if (props.preText && props.postText)
    return (
      <InputWithPreAndPostText
        {...props}
        normalizedName={normalizedName}
        errorRef={errorRef}
        inputRef={inputRef}
        handleIncrement={handleIncrement}
        handleDecrement={handleDecrement}
        inputType={inputType}
        ctx={ctx}
        editMode={editMode}
        checkIfFormDirty={checkIfFormDirty}
        handleInputClick={(ev) => handleInputClick(ev)}
        saveClickToEdit={saveClickToEdit}
        discardClickToEdit={discardClickToEdit}
        dirty={dirty}
        formIsDirty={formIsDirty}
      />
    );

  if (props.preText)
    return (
      <InputWithPreText
        {...props}
        normalizedName={normalizedName}
        errorRef={errorRef}
        inputRef={inputRef}
        handleIncrement={handleIncrement}
        handleDecrement={handleDecrement}
        inputType={inputType}
        ctx={ctx}
        editMode={editMode}
        checkIfFormDirty={checkIfFormDirty}
        handleInputClick={(ev) => handleInputClick(ev)}
        saveClickToEdit={saveClickToEdit}
        discardClickToEdit={discardClickToEdit}
        dirty={dirty}
        formIsDirty={formIsDirty}
      />
    );
  if (props.postText)
    return (
      <InputWithPostText
        {...props}
        normalizedName={normalizedName}
        errorRef={errorRef}
        inputRef={inputRef}
        handleIncrement={handleIncrement}
        handleDecrement={handleDecrement}
        inputType={inputType}
        ctx={ctx}
        editMode={editMode}
        checkIfFormDirty={checkIfFormDirty}
        handleInputClick={(ev) => handleInputClick(ev)}
        saveClickToEdit={saveClickToEdit}
        discardClickToEdit={discardClickToEdit}
        dirty={dirty}
        formIsDirty={formIsDirty}
      />
    );

  return (
    <div
      onMouseEnter={checkIfFormDirty}
      onFocus={checkIfFormDirty}
      key={`${normalizedName}`}
      onClick={(ev) => handleInputClick(ev)}
      className={twMerge(...outerDivStylesForClickToEdit, props.className)}
      style={props.style}
    >
      {props.label && (
        <label
          htmlFor={normalizedName}
          className={twMerge(labelVariants(), props.labelClass)}
          style={props.labelStyle}
          {...props.labelProps}
        >
          {props.label}
          {props.required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative flex-grow group">
        <input
          defaultValue={
            props.value !== undefined
              ? undefined
              : ctx?.fieldValue || props.defaultValue || undefined
          }
          autoFocus={props.autoFocus}
          ref={(elm) => {
            inputRef.current = elm;
            if (props.inputRef) props.inputRef.current = elm;
          }}
          id={normalizedName}
          name={normalizedName}
          autoComplete={props.autoComplete || basedOnLabel(props.label || "")}
          style={props.inputStyle}
          placeholder={props.placeholder || ""}
          type={inputType}
          className={twMerge(
            defaultInputStyle,
            "w-full px-3 sm:text-sm",
            props.clickToEdit && !editMode
              ? "cursor-pointer hover:bg-muted/5 pr-8"
              : "",
            props.clickToEdit && editMode ? "border-primary" : "",
            props.type === "checkbox" ? "w-5 h-5 rounded-sm" : "",
            props.inputClass,
          )}
          aria-description={props.clickToEdit ? clickToEditAriaDescription : ""}
          tabIndex={props.inputClass?.includes("hidden") ? -1 : undefined}
          data-object={props.dataObject}
          data-click-to-edit={props.clickToEdit}
          data-format-number={props.formatNumber}
          min={props.min}
          max={props.max}
          step={props.step}
          {...props.inputProps}
          readOnly={props.clickToEdit ? !editMode : props.readOnly || false}
          disabled={
            ctx?.formMutation?.isPending ??
            (props.clickToEdit && props.type === "checkbox" ? false : null) ??
            props.disabled ??
            false
          }
        />
        {props.clickToEdit && !editMode && !dirty && !formIsDirty && (
          <Pencil className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 text-muted-foreground cursor-pointer transition-opacity duration-200" />
        )}
        {props.clickToEdit && dirty && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex space-x-1">
            <Save
              className="w-4 h-4 cursor-pointer text-primary hover:text-primary/80 transition-colors"
              onClick={saveClickToEdit}
            />
            <X
              className="w-4 h-4 cursor-pointer text-destructive hover:text-destructive/80 transition-colors"
              onClick={discardClickToEdit}
            />
          </div>
        )}
        {props.type === "number" &&
          editMode &&
          !props.inputClass?.includes("hidden") && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col">
              <button
                type="button"
                onClick={handleIncrement}
                tabIndex={-1}
                className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={handleDecrement}
                tabIndex={-1}
                className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          )}
      </div>
      <div
        ref={errorRef}
        style={{
          height: 0,
          overflow: "hidden",
          transition: "all",
          transitionDuration: "300ms",
          ...props.errorStyle,
        }}
        className={cn(
          props.errorClass,
          "text-sm text-destructive font-medium mt-1",
        )}
        {...props.errorProps}
      />
    </div>
  );
}

interface InputPropsWithRefs extends InputProps {
  errorRef: any;
  inputRef: any;
  handleIncrement: () => void;
  handleDecrement: () => void;
  inputType?: string;
  ctx?: any;
  editMode: boolean;
  normalizedName: string;
  checkIfFormDirty: () => void;
  handleInputClick: (ev: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  dirty: boolean;
  formIsDirty: string | false;
  saveClickToEdit: any;
  discardClickToEdit: any;
}

function InputWithPreText(props: InputPropsWithRefs) {
  return (
    <div
      onMouseEnter={props.checkIfFormDirty}
      onFocus={props.checkIfFormDirty}
      key={`${props.normalizedName}`}
      onClick={(ev) => props.handleInputClick(ev)}
      className={twMerge(...outerDivStylesForClickToEdit, props.className)}
      style={props.style}
    >
      {props.label && (
        <label
          htmlFor={props.normalizedName}
          className={twMerge(labelVariants(), props.labelClass)}
          style={props.labelStyle}
          {...props.labelProps}
        >
          {props.label}
          {props.required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div
        className={twMerge(
          "flex",
          defaultInputStyle,
          props.clickToEdit && !props.editMode ? "cursor-pointer" : "",
          props.clickToEdit && props.editMode ? "border-primary" : "",
          "py-0 px-0 pr-2",
          props.className,
        )}
      >
        <span className="inline-flex items-center h-full rounded-l-md px-3 sm:text-sm text-muted-foreground border-r border-input">
          {props.preText}
        </span>
        <div className="relative flex-grow group">
          <input
            defaultValue={
              props.value !== undefined
                ? undefined
                : props.ctx?.fieldValue || props.defaultValue || undefined
            }
            autoFocus={props.autoFocus}
            ref={(elm) => {
              props.inputRef.current = elm;
            }}
            id={props.normalizedName}
            name={props.normalizedName}
            autoComplete={props.autoComplete || basedOnLabel(props.label || "")}
            style={props.inputStyle}
            placeholder={props.placeholder || ""}
            type={props.inputType}
            className={twMerge(
              `w-full h-full px-3 focus-visible:outline-none border-0 bg-transparent sm:text-sm transition-colors`,
              props.clickToEdit && !props.editMode ? "cursor-pointer pr-8" : "",
            )}
            data-object={props.dataObject}
            data-click-to-edit={props.clickToEdit}
            data-format-number={props.formatNumber}
            min={props.min}
            max={props.max}
            step={props.step}
            aria-description={
              props.clickToEdit ? clickToEditAriaDescription : ""
            }
            {...props.inputProps}
            readOnly={
              props.clickToEdit ? !props.editMode : props.readOnly || false
            }
            disabled={
              props.ctx?.formMutation?.isPending ?? props.disabled ?? false
            }
          />
          {props.clickToEdit &&
            !props.editMode &&
            !props.dirty &&
            !props.formIsDirty && (
              <Pencil className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 text-muted-foreground cursor-pointer transition-opacity duration-200" />
            )}
          {props.clickToEdit && props.dirty && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex space-x-1">
              <Save
                className="w-4 h-4 cursor-pointer text-primary hover:text-primary/80 transition-colors"
                onClick={props.saveClickToEdit}
              />
              <X
                className="w-4 h-4 cursor-pointer text-destructive hover:text-destructive/80 transition-colors"
                onClick={props.discardClickToEdit}
              />
            </div>
          )}
          {props.type === "number" && props.editMode && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col">
              <button
                type="button"
                onClick={props.handleIncrement}
                tabIndex={-1}
                className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={props.handleDecrement}
                tabIndex={-1}
                className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
      <div
        ref={props.errorRef}
        style={{
          height: 0,
          overflow: "hidden",
          transition: "all",
          transitionDuration: "300ms",
          ...props.errorStyle,
        }}
        className={cn(
          props.errorClass,
          "text-sm text-destructive font-medium mt-1",
        )}
        {...props.errorProps}
      />
    </div>
  );
}

function InputWithPostText(props: InputPropsWithRefs) {
  return (
    <div
      onMouseEnter={props.checkIfFormDirty}
      onFocus={props.checkIfFormDirty}
      key={`${props.normalizedName}`}
      onClick={(ev) => props.handleInputClick(ev)}
      className={twMerge(...outerDivStylesForClickToEdit, props.className)}
      style={props.style}
    >
      {props.label && (
        <label
          htmlFor={props.normalizedName}
          className={twMerge(labelVariants(), props.labelClass)}
          style={props.labelStyle}
          {...props.labelProps}
        >
          {props.label}
          {props.required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div
        className={twMerge(
          "flex",
          defaultInputStyle,
          props.clickToEdit && !props.editMode ? "cursor-pointer" : "",
          props.clickToEdit && props.editMode ? "border-primary" : "",
          "py-0 px-0 pr-2",
          props.className,
        )}
      >
        <div className="relative flex-grow group">
          <input
            defaultValue={
              props.value !== undefined
                ? undefined
                : props.ctx?.fieldValue || props.defaultValue || undefined
            }
            autoFocus={props.autoFocus}
            ref={(elm) => {
              props.inputRef.current = elm;
            }}
            id={props.normalizedName}
            name={props.normalizedName}
            autoComplete={props.autoComplete || basedOnLabel(props.label || "")}
            style={props.inputStyle}
            placeholder={props.placeholder || ""}
            type={props.inputType}
            min={props.min}
            max={props.max}
            step={props.step}
            {...props.inputProps}
            className={twMerge(
              `w-full h-full px-3 focus-visible:outline-none border-0 bg-transparent sm:text-sm transition-colors`,
              props.clickToEdit && !props.editMode ? "cursor-pointer pr-8" : "",
            )}
            data-object={props.dataObject}
            data-click-to-edit={props.clickToEdit}
            data-format-number={props.formatNumber}
            aria-description={
              props.clickToEdit ? clickToEditAriaDescription : ""
            }
            readOnly={
              props.clickToEdit ? !props.editMode : props.readOnly || false
            }
            disabled={
              props.ctx?.formMutation?.isPending ?? props.disabled ?? false
            }
          />
          {props.clickToEdit &&
            !props.editMode &&
            !props.dirty &&
            !props.formIsDirty && (
              <Pencil className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 text-muted-foreground cursor-pointer transition-opacity duration-200" />
            )}
          {props.clickToEdit && props.dirty && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex space-x-1">
              <Save
                className="w-4 h-4 cursor-pointer text-primary hover:text-primary/80 transition-colors"
                onClick={props.saveClickToEdit}
              />
              <X
                className="w-4 h-4 cursor-pointer text-destructive hover:text-destructive/80 transition-colors"
                onClick={props.discardClickToEdit}
              />
            </div>
          )}
          {props.type === "number" && props.editMode && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col">
              <button
                type="button"
                onClick={props.handleIncrement}
                tabIndex={-1}
                className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={props.handleDecrement}
                tabIndex={-1}
                className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        <span className="inline-flex items-center rounded-r-md px-3 sm:text-sm text-muted-foreground border-l border-input">
          {props.postText}
        </span>
      </div>
      <div
        ref={props.errorRef}
        style={{
          height: 0,
          overflow: "hidden",
          transition: "all",
          transitionDuration: "300ms",
          ...props.errorStyle,
        }}
        className={cn(
          props.errorClass,
          "text-sm text-destructive font-medium mt-1",
        )}
        {...props.errorProps}
      />
    </div>
  );
}

function InputWithPreAndPostText(props: InputPropsWithRefs) {
  return (
    <div
      onMouseEnter={props.checkIfFormDirty}
      onFocus={props.checkIfFormDirty}
      key={`${props.normalizedName}`}
      onClick={(ev) => props.handleInputClick(ev)}
      className={twMerge(...outerDivStylesForClickToEdit, props.className)}
      style={props.style}
    >
      {props.label && (
        <label
          htmlFor={props.normalizedName}
          className={twMerge(labelVariants(), props.labelClass)}
          style={props.labelStyle}
          {...props.labelProps}
        >
          {props.label}
          {props.required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div
        className={twMerge(
          "flex",
          defaultInputStyle,
          props.clickToEdit && !props.editMode ? "cursor-pointer" : "",
          props.clickToEdit && props.editMode ? "border-primary" : "",
          "py-0 px-0 pr-2",
          props.className,
        )}
      >
        <span className="inline-flex items-center rounded-l-md px-3 sm:text-sm bg-muted/10 text-muted-foreground border-r border-input">
          {props.preText}
        </span>
        <div className="relative flex-grow group">
          <input
            defaultValue={
              props.value !== undefined
                ? undefined
                : props.ctx?.fieldValue || props.defaultValue || undefined
            }
            autoFocus={props.autoFocus}
            ref={(elm) => {
              props.inputRef.current = elm;
            }}
            id={props.normalizedName}
            name={props.normalizedName}
            autoComplete={props.autoComplete || basedOnLabel(props.label || "")}
            style={props.inputStyle}
            placeholder={props.placeholder || ""}
            type={props.inputType}
            min={props.min}
            max={props.max}
            step={props.step}
            {...props.inputProps}
            className={twMerge(
              `w-full h-full px-3 focus-visible:outline-none border-0 bg-transparent sm:text-sm transition-colors`,
              props.clickToEdit && !props.editMode ? "cursor-pointer pr-8" : "",
            )}
            data-object={props.dataObject}
            data-click-to-edit={props.clickToEdit}
            data-format-number={props.formatNumber}
            aria-description={
              props.clickToEdit ? clickToEditAriaDescription : ""
            }
            readOnly={
              props.clickToEdit ? !props.editMode : props.readOnly || false
            }
            disabled={
              props.ctx?.formMutation?.isPending ?? props.disabled ?? false
            }
          />
          {props.clickToEdit &&
            !props.editMode &&
            !props.dirty &&
            !props.formIsDirty && (
              <Pencil className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 text-muted-foreground cursor-pointer transition-opacity duration-200" />
            )}
          {props.clickToEdit && props.dirty && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex space-x-1">
              <Save
                className="w-4 h-4 cursor-pointer text-primary hover:text-primary/80 transition-colors"
                onClick={props.saveClickToEdit}
              />
              <X
                className="w-4 h-4 cursor-pointer text-destructive hover:text-destructive/80 transition-colors"
                onClick={props.discardClickToEdit}
              />
            </div>
          )}
          {props.type === "number" && props.editMode && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col">
              <button
                type="button"
                onClick={props.handleIncrement}
                tabIndex={-1}
                className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={props.handleDecrement}
                tabIndex={-1}
                className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        <span className="inline-flex items-center rounded-r-md px-3 sm:text-sm bg-muted/10 text-muted-foreground border-l border-input">
          {props.postText}
        </span>
      </div>
      <div
        ref={props.errorRef}
        style={{
          height: 0,
          overflow: "hidden",
          transition: "all",
          transitionDuration: "300ms",
          ...props.errorStyle,
        }}
        className={cn(
          props.errorClass,
          "text-sm text-destructive font-medium mt-1",
        )}
        {...props.errorProps}
      />
    </div>
  );
}

export { Input };
