import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X, LayoutDashboard, Users, Calendar } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
      className,
    )}
    ref={ref}
    {...props}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  "fixed z-50 bg-background shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        left: "inset-y-0 left-0 h-full w-3/4 sm:max-w-xs border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        right: "inset-y-0 right-0 h-full w-3/4 sm:max-w-xs border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
      },
    },
    defaultVariants: {
      side: "left",
    },
  }
);

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "left", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        sheetVariants({ side }),
        // Padding ajustado: menos padding no topo, mais espaçamento controlado
        "flex flex-col px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] text-foreground",
        className
      )}
      {...props}
    >
      {/* Botão de fechar posicionado corretamente */}
      <SheetPrimitive.Close
        className={cn(
          "absolute rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
          // Posicionamento fixo no canto superior direito
          "right-4 top-[calc(env(safe-area-inset-top)+1rem)]",
          "z-10"
        )}
      >
        <X className="h-5 w-5" />
        <span className="sr-only">Fechar</span>
      </SheetPrimitive.Close>

      {/* Conteúdo com margem superior adequada */}
      <div className="flex flex-col h-full mt-4">
        {children}
      </div>
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

// Header
const SheetHeader = () => (
  <div className="flex items-center gap-3 mb-8 pr-8">
    <div className="bg-primary rounded-lg h-10 w-10 flex items-center justify-center">
      <span className="text-white text-xl font-bold">M</span>
    </div>
    <div className="flex flex-col">
      <h2 className="text-lg font-semibold">MedSys</h2>
      <p className="text-sm text-muted-foreground -mt-1">Gestão Cirúrgica</p>
    </div>
  </div>
);

// Itens do menu
const MenuItem = ({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors w-full",
      active
        ? "bg-primary text-primary-foreground"
        : "hover:bg-accent hover:text-accent-foreground"
    )}
  >
    <Icon className="h-5 w-5" />
    {label}
  </button>
);

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export function AppSidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="p-2">
          <span className="sr-only">Abrir menu</span>
          <LayoutDashboard className="h-6 w-6" />
        </button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader />
        <nav className="flex flex-col gap-2">
          <MenuItem icon={LayoutDashboard} label="Dashboard" />
          <MenuItem icon={Users} label="Pacientes" active />
          <MenuItem icon={Calendar} label="Agenda" />
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetClose,
  SheetHeader,
  SheetFooter,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetDescription,
  MenuItem,
};