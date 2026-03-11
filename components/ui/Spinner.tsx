import { cn } from "@/lib/utils";
import { RiLoaderLine } from "react-icons/ri";

export function Spinner({ className }: { className?: string }) {
  return <RiLoaderLine className={cn("animate-spin", className)} />;
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64 w-full">
      <RiLoaderLine className="animate-spin w-6 h-6 text-gray-600" />
    </div>
  );
}
