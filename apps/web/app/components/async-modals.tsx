import React, {
  type ReactNode,
  useRef,
  useState,
  createContext,
  useContext,
} from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import ReactDOM from "react-dom/client";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useForm } from "~/formLibrary/useForm";
import { Input } from "~/components/input";
import { queryClient } from "~/providers/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { LoadingSpinner } from "./loading-page";

const ModalContext = createContext<
  | {
      closeModal: () => void;
      dialogRef: React.RefObject<any>;
      submitForm: (data: any) => void;
      setTrap: (trap: boolean) => void;
    }
  | undefined
>(undefined);

export function useModalContext() {
  return (
    (useContext(ModalContext) as {
      closeModal: () => void;
      dialogRef: React.RefObject<any>;
      submitForm: (data: any) => void;
      setTrap: (trap: boolean) => void;
    }) ?? {
      closeModal: () => {},
      dialogRef: { current: null },
      submitForm: () => {},
      setTrap: () => {},
    }
  );
}

interface StyledPromptOptions {
  style?: React.CSSProperties;
  extraClasses?: string;
  formClassName?: string;
  trap?: boolean;
  returnCloseMethod?: boolean;
  showCloseButton?: boolean;
  initialData?: any;
  action?: string;
  queryKey?: string[];
  queryKeyToInvalidate?: string[];
  name?: string;
  method?: "POST" | "PATCH" | "PUT";
}

interface AsyncDialogProps {
  content: ReactNode;
  showCloseButton?: boolean;
  container: any;
  options?: StyledPromptOptions;
}

function hasAriaExpanded(element: HTMLElement): boolean {
  if (!element) return false;
  return element.querySelector("[aria-expanded=true]") !== null;
}

const AsyncDialog: React.FC<AsyncDialogProps> = ({
  content,
  container,
  options = {},
}) => {
  options.style = options.style || {};
  options.extraClasses = options.extraClasses || "";
  options.showCloseButton = options.showCloseButton ?? true;
  options.trap = options.trap ?? false;

  if (options.trap === true && options.showCloseButton !== true) {
    options.showCloseButton = false;
  }

  const [open, setOpen] = useState(true);
  const dialogRef = useRef<any>(null);

  const closeModal = () => {
    setOpen(false);
    setTimeout(() => {
      document.body.style.removeProperty("pointer-events");
      container.remove();
    }, 300);
  };

  container.radixDialogClose = closeModal;

  const handleSubmit = (data: any) => {
    if (options.action && data.error) return;

    container.resolveAsyncModal({ ok: true, data });
    closeModal();
  };

  const closeWithResolve = (ok: boolean = true) => {
    setTimeout(() => {
      container.resolveAsyncModal({ ok });
      closeModal();
    }, 0);
  };

  const setTrap = (trap: boolean) => {
    options.trap = trap;
  };

  const [Form] = useForm({
    onSubmit: handleSubmit,
    initialData: options.initialData,
    action: options.action,
    name: options.name,
    method: options.method,
    queryKey: options.queryKey,
    queryKeyToInvalidate: options.queryKeyToInvalidate,
  });

  return (
    <ModalContext.Provider
      value={{
        closeModal: closeWithResolve,
        dialogRef,
        submitForm: handleSubmit,
        setTrap,
      }}
    >
      <Dialog
        open={open}
        onOpenChange={(state) => {
          if (state === false) {
            container.resolveAsyncModal({ ok: false });
            closeModal();
          }
        }}
      >
        <DialogContent
          ref={dialogRef}
          showCloseButton={options.showCloseButton}
          onPointerDownOutside={(event) => {
            if (hasAriaExpanded(dialogRef.current) || options.trap) {
              event.preventDefault();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (hasAriaExpanded(dialogRef.current) || options.trap) {
              event.preventDefault();
            }
          }}
          style={options.style}
          className={options.extraClasses}
        >
          <Form className={options.formClassName}>{content}</Form>
        </DialogContent>
      </Dialog>
    </ModalContext.Provider>
  );
};

export const AsyncModal = (
  content: ReactNode,
  options: StyledPromptOptions = {},
): Promise<any> => {
  return new Promise((resolve) => {
    const container = document.createElement("div") as any;
    (container as any).resolveAsyncModal = resolve;

    if (options.returnCloseMethod) {
      resolve(() => container.radixDialogClose());
    }

    document.body.appendChild(container);

    ReactDOM.createRoot(container).render(
      <QueryClientProvider client={queryClient}>
        <AsyncDialog
          content={content}
          container={container}
          showCloseButton={options.showCloseButton}
          options={options}
        />
      </QueryClientProvider>,
    );
  });
};

export const AsyncAlert = async (options: {
  title?: string;
  message: string | ReactNode;
  confirmBtnText?: string;
}): Promise<void> => {
  return AsyncModal(
    <>
      {typeof options.message === "string" ? (
        <DialogTitle className="mb-4 text-xl font-bold">
          {options.title ?? "Alert"}
        </DialogTitle>
      ) : null}
      {typeof options.message === "string" ? (
        <DialogDescription className="mb-6">
          {options.message}
        </DialogDescription>
      ) : (
        options.message
      )}

      <Button type="submit" className="w-full">
        {options.confirmBtnText ?? "OK"}
      </Button>
    </>,
  );
};

export const AsyncConfirm = async (options: {
  title?: string;
  message?: string | ReactNode;
  confirmBtnText?: string;
  destructive?: boolean;
  doubleConfirm?: string;
  cancelBtnText?: string;
}): Promise<{ ok: boolean }> => {
  const destructiveClasses = "border-red-500 border-2";

  return AsyncModal(
    <>
      {typeof options.title === "string" ? (
        <DialogTitle className="mb-4 text-xl font-bold">
          {options.title ?? "Confirm"}
        </DialogTitle>
      ) : null}
      {typeof options.message === "string" || options.message === undefined ? (
        <DialogDescription className="mb-6">
          {options.message ?? "Are you sure?"}
        </DialogDescription>
      ) : (
        options.message
      )}

      {options.doubleConfirm ? (
        <div className="text-sm text-muted-foreground mb-6">
          <Input
            label={`Please type "${options.doubleConfirm}" to confirm`}
            name="_double_confirm_"
            required
            customValidator={(value: string) => {
              return value === options.doubleConfirm;
            }}
            customErrorMessages={{
              customNotValid: `Please type "${options.doubleConfirm}" to confirm`,
            }}
            validateOnInput={false}
          />
        </div>
      ) : null}

      <div className=" grid grid-flow-row-dense grid-cols-2 gap-3 bg-bgAccent bg-opacity-80 dark:bg-dbgAccent">
        <DialogClose asChild>
          <Button variant="outline" type="button">
            {options.cancelBtnText ?? "No"}
          </Button>
        </DialogClose>
        <Button
          type="submit"
          variant={options.destructive ? "destructive" : "default"}
        >
          {options.confirmBtnText ?? "Yes"}
        </Button>
      </div>
    </>,
    { extraClasses: options.destructive ? destructiveClasses : "" },
  );
};

export const AsyncPrompt = async (options: {
  title?: string;
  message?: string;
  defaultValue?: string;
  type?: "text" | "number" | "email" | "password" | "textarea";
  dataAccept?: string;
  mask?: string;
  maskSlots?: string;
  noMaskTrim?: boolean;
  showFullMaskWhileTyping?: boolean;
  confirmBtnText?: string;
  cancelBtnText?: string;
}): Promise<{ ok: boolean; data: { results: string } }> => {
  return AsyncModal(
    <>
      {typeof options.title === "string" ? (
        <>
          <DialogTitle className="mb-4 text-xl font-bold">
            {options.title ?? "Prompt"}
          </DialogTitle>
          <VisuallyHidden>
            <DialogDescription>{options.title ?? "Prompt"}</DialogDescription>
          </VisuallyHidden>
        </>
      ) : null}
      <div>
        <Input
          label={options.message ?? "Please enter a value"}
          name="results"
          dataAccept={options.dataAccept}
          className="mb-6"
          required
          type={options.type ?? "text"}
          mask={options.mask}
          maskSlots={options.maskSlots}
          noMaskTrim={options.noMaskTrim}
          showFullMaskWhileTyping={options.showFullMaskWhileTyping}
        />
      </div>
      <div className=" grid grid-flow-row-dense grid-cols-2 gap-3 bg-bgAccent bg-opacity-80 dark:bg-dbgAccent">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {options.cancelBtnText ?? "Cancel"}
          </Button>
        </DialogClose>
        <Button type="submit" variant="default">
          {options.confirmBtnText ?? "Submit"}
        </Button>
      </div>
    </>,
    { initialData: { results: options.defaultValue } },
  );
};

export const ShowFullScreenSpinner = async (
  message: string = "Please wait...",
) => {
  const content = (
    <>
      <div className="pb-3">
        <LoadingSpinner size="default" />
      </div>
      <DialogTitle>{message}</DialogTitle>
      <VisuallyHidden>
        <DialogDescription>{message}</DialogDescription>
      </VisuallyHidden>
    </>
  );

  return AsyncModal(content, {
    showCloseButton: false,
    returnCloseMethod: true,
    trap: false,
  });
};
