import { Briefcase } from "lucide-react";
import { SidebarItem } from "./SidebarComponents";

interface WorkUnitsLinkProps {
    onNavigate?: () => void;
}

export function WorkUnitsLink({ onNavigate }: WorkUnitsLinkProps) {
    return (
        <SidebarItem
            to="/work-units"
            icon={<Briefcase className="h-4 w-4" />}
            label="Work Units"
            onClick={() => onNavigate?.()}
        />
    );
}
