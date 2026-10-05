import { Search } from "lucide-react";
import { AppInput, AppSelect, AppCard, AppViewModeToggle } from "@blynta/ui";

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
    <AppCard
      className="py-0"
      contentClassName="flex-col gap-3 lg:flex-row lg:items-center"
    >
      <AppInput
        prefixIcon={<Search size={16} />}
        aria-label="Search projects"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search your projects"
        wrapperClassName="w-full min-w-0 lg:flex-1"
        className="bg-background/80"
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
        wrapperClassName="w-full sm:w-36"
        className="bg-background/80"
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
        wrapperClassName="w-full sm:w-36"
        className="bg-background/80"
      />
      <AppViewModeToggle
        mode={list ? "list" : "grid"}
        onChange={(mode) => onList(mode === "list")}
      />
    </AppCard>
  );
}
