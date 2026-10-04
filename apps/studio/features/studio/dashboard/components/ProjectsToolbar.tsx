import { Search, Grid2X2, List } from "lucide-react";
import { AppInput, AppSelect, AppButton } from "@blynta/ui";
import { AppTooltip } from "@/components/common/AppTooltip";

export function ProjectsToolbar({
  search,
  onSearch,
  filter,
  onFilter,
  sort,
  onSort,
  list,
  onList,
}: {
  search: string;
  onSearch: (value: string) => void;
  filter: string;
  onFilter: (value: string) => void;
  sort: string;
  onSort: (value: string) => void;
  list: boolean;
  onList: (value: boolean) => void;
}) {
  return (
    <div className="projects-toolbar">
      <AppInput
        prefixIcon={<Search size={16} />}
        aria-label="Search projects"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search your projects"
        wrapperClassName="project-search"
      />
      <AppSelect
        label="Filter by project source"
        labelClassName="sr-only"
        value={filter}
        onValueChange={onFilter}
        options={[
          { value: "all", label: "All sources" },
          { value: "blynta", label: "From Blynta" },
          ...["Studio", "Blynta Clip", "Blynta Job", "Imported"].map(
            (value) => ({ value, label: value }),
          ),
        ]}
        wrapperClassName="project-filter"
      />
      <AppSelect
        label="Sort projects"
        labelClassName="sr-only"
        value={sort}
        onValueChange={onSort}
        options={[
          { value: "recent", label: "Last edited" },
          { value: "name", label: "Name A–Z" },
          { value: "oldest", label: "Oldest first" },
        ]}
        wrapperClassName="project-filter"
      />
      <div
        className="project-view-switch"
        role="group"
        aria-label="Project display"
      >
        {[
          { label: "Grid view", value: false, icon: Grid2X2 },
          { label: "List view", value: true, icon: List },
        ].map(({ label, value, icon: Icon }) => (
          <AppTooltip key={label} content={label}>
            <AppButton
              aria-label={label}
              aria-pressed={list === value}
              variant={list === value ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => onList(value)}
            >
              <Icon />
            </AppButton>
          </AppTooltip>
        ))}
      </div>
    </div>
  );
}
