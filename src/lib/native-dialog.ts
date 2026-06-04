const isNative = (): boolean => {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
};

type PromptOptions = {
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  okText?: string;
  cancelText?: string;
};

type PromptResult = {
  cancelled: boolean;
  value: string;
};

export const showNativeAlert = async (title: string, message: string) => {
  if (isNative()) {
    try {
      const mod: any = await import("@capacitor/dialog");
      await mod.Dialog.alert({ title, message });
      return;
    } catch {
      /* fallback below */
    }
  }

  window.alert(message);
};

export const showNativeConfirm = async (
  title: string,
  message: string,
  okText = "OK",
  cancelText = "Cancel",
) => {
  if (isNative()) {
    try {
      const mod: any = await import("@capacitor/dialog");
      const result = await mod.Dialog.confirm({
        title,
        message,
        okButtonTitle: okText,
        cancelButtonTitle: cancelText,
      });
      return !!result?.value;
    } catch {
      /* fallback below */
    }
  }

  return window.confirm(message);
};

export const showNativePrompt = async ({
  title,
  message,
  placeholder,
  initialValue,
  okText = "Save",
  cancelText = "Cancel",
}: PromptOptions): Promise<PromptResult> => {
  if (isNative()) {
    try {
      const mod: any = await import("@capacitor/dialog");
      const result = await mod.Dialog.prompt({
        title,
        message,
        inputPlaceholder: placeholder,
        inputText: initialValue,
        okButtonTitle: okText,
        cancelButtonTitle: cancelText,
      });

      return {
        cancelled: !!result?.cancelled,
        value: result?.value ?? "",
      };
    } catch {
      /* fallback below */
    }
  }

  const result = window.prompt(message || title, initialValue || "");
  return {
    cancelled: result === null,
    value: result ?? "",
  };
};