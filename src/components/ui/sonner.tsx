import { isIOS } from "@/lib/platform";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      // Segue o modo claro/escuro do sistema
      theme="system"
      // iOS: banner no topo; Android: snackbar embaixo (acima da barra de abas)
      position={isIOS ? "top-center" : "bottom-center"}
      offset={isIOS ? "calc(env(safe-area-inset-top) + 8px)" : "calc(env(safe-area-inset-bottom) + 76px)"}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
