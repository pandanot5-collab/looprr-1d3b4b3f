import { Hammer } from "lucide-react";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { cn } from "@/lib/utils";

interface Props {
  userId: string | null | undefined;
  username: string | null | undefined;
  className?: string;
  iconSize?: number;
  showAt?: boolean;
}

export const UsernameDisplay = ({
  userId,
  username,
  className,
  iconSize = 14,
  showAt = true,
}: Props) => {
  const admins = useAdminUsers();
  const isAdmin = !!userId && admins.has(userId);

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className={cn(isAdmin && "text-gradient-admin font-semibold")}>
        {showAt ? "@" : ""}{username ?? "?"}
      </span>
      {isAdmin && (
        <Hammer
          className="text-accent shrink-0"
          style={{ width: iconSize, height: iconSize }}
          aria-label="Admin"
        />
      )}
    </span>
  );
};
