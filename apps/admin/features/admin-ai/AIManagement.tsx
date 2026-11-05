"use client";
import styles from "./ai-management.module.css";
import {
  AI_ADAPTERS,
  AI_TASKS,
  AI_TASK,
  AI_TASK_LABELS,
  SUBSCRIPTION_PLANS,
  PAGINATION,
  AI_MODEL_POLICY,
} from "@blynta/types/contracts";
import { AppSelect, AppCheckbox, AppRadioGroup } from "@blynta/ui";
import { AppDataTable as AppTable } from "@/components/common/DataTable";
import { AppPageHeader } from "@/components/common/AppPageHeader";
import { AppFilterBar } from "@/components/common/AppFilterBar";
import { AppStatusBadge } from "@/components/common/AppStatusBadge";
import {
  Search,
  MoreHorizontal,
  Pencil,
  Play,
  Power,
  Trash2,
  Star,
  Key,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Usage } from "./api";
import { SelectItem } from "@blynta/ui/primitives/select";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { AppButton as Button, AppInput as Input } from "@blynta/ui";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AppTabs as Tabs,
  AppTabsContent as TabsContent,
  AppTabsList as TabsList,
  AppTabsTrigger as TabsTrigger,
  AppQueryState,
  AppPagination,
} from "@blynta/ui";
import { aiAdminApi } from "./api";
import type { AIModel, Provider, Credential } from "./api";
type Section = "providers" | "models" | "usage";
const name = z.string().trim().min(1).max(100);
const providerForm = z.object({
  name,
  code: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]{1,39}$/),
  adapter: z.enum(AI_ADAPTERS),
  baseUrl: z.string().url().max(512).optional(),
  apiVersion: z.string().max(30).optional(),
  settings: z
    .object({
      timeoutMs: z
        .number()
        .int()
        .min(AI_MODEL_POLICY.TIMEOUT_MS.MIN)
        .max(AI_MODEL_POLICY.TIMEOUT_MS.MAX)
        .optional(),
      maxRetries: z.literal(AI_MODEL_POLICY.MAX_RETRIES),
    })
    .optional(),
  enabled: z.boolean(),
  description: z.string().max(500),
});
const modelForm = z.object({
  providerId: z.string().regex(/^[a-f\d]{24}$/i),
  modelId: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/),
  displayName: name,
  description: z.string().max(500),
  temperature: z
    .number()
    .min(AI_MODEL_POLICY.TEMPERATURE.MIN)
    .max(AI_MODEL_POLICY.TEMPERATURE.MAX)
    .optional(),
  maxOutputTokens: z
    .number()
    .int()
    .min(AI_MODEL_POLICY.OUTPUT_TOKENS.MIN)
    .max(AI_MODEL_POLICY.OUTPUT_TOKENS.MAX),
  timeoutMs: z
    .number()
    .int()
    .min(AI_MODEL_POLICY.TIMEOUT_MS.MIN)
    .max(AI_MODEL_POLICY.TIMEOUT_MS.MAX),
  priority: z
    .number()
    .int()
    .min(AI_MODEL_POLICY.PRIORITY.MIN)
    .max(AI_MODEL_POLICY.PRIORITY.MAX),
});
function Field({
  label,
  name,
  value,
  type = "text",
  required = false,
  hint,
}: {
  label: string;
  name: string;
  value?: string | number;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="grid content-start gap-2 text-sm">
      <Label htmlFor={`ai-field-${name}`}>{label}</Label>
      <Input
        id={`ai-field-${name}`}
        name={name}
        type={type}
        step={type === "number" ? "any" : undefined}
        defaultValue={value}
        required={required}
        aria-describedby={hint ? `ai-hint-${name}` : undefined}
      />
      {hint && (
        <p
          id={`ai-hint-${name}`}
          className="text-xs leading-5 text-muted-foreground"
        >
          {hint}
        </p>
      )}
    </div>
  );
}
function Check({
  name,
  label,
  checked = false,
}: {
  name: string;
  label: string;
  checked?: boolean;
}) {
  return <AppCheckbox name={name} defaultChecked={checked} label={label} />;
}
export function AIManagement({
  initialSection = "providers",
}: {
  initialSection?: Section;
}) {
  const cache = useQueryClient();
  const actionLock = useRef(false);
  const [section, setSection] = useState<Section>(initialSection);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [selectedAdapter, setSelectedAdapter] = useState<string>(
    AI_ADAPTERS[0],
  );
  const adapterOptions = useQuery({
    queryKey: ["admin-ai", "adapters"],
    queryFn: aiAdminApi.adapters,
  });

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDeletion, setConfirmDeletion] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [providerEdit, setProviderEdit] = useState<
    Provider | null | undefined
  >();
  const [modelEdit, setModelEdit] = useState<AIModel | null | undefined>();
  const activeAdapter = adapterOptions.data?.items.find(
    (option) => option.adapter === (providerEdit?.adapter ?? selectedAdapter),
  );
  const [selectedProvider, setSelectedProvider] = useState("");
  const [credentialProvider, setCredentialProvider] = useState<Provider>();
  const [credentialEdit, setCredentialEdit] = useState<Credential>();
  const [validationModelId, setValidationModelId] = useState("");
  const [validationModelPage, setValidationModelPage] = useState(1);
  const params = {
    page,
    ...(search ? { search } : {}),
    ...(filter ? { enabled: filter } : {}),
  };
  const providers = useQuery({
    queryKey: ["admin-ai", "providers", params],
    queryFn: () => aiAdminApi.providers(params),
  });
  const catalog = useQuery({
    queryKey: ["admin-ai", "provider-catalog"],
    queryFn: () => aiAdminApi.providers(),
  });
  const modelProviderId =
    selectedProvider ||
    modelEdit?.providerId ||
    catalog.data?.items.find((p) => p.operationalAdapter)?._id ||
    "";
  const modelCredentials = useQuery({
    queryKey: ["admin-ai", "credentials", modelProviderId],
    queryFn: () => aiAdminApi.credentials(modelProviderId),
    enabled: modelEdit !== undefined && !!modelProviderId,
  });
  const defaultCredentials = useQuery({
    queryKey: ["admin-ai", "credentials", providerEdit?._id],
    queryFn: () => aiAdminApi.credentials(providerEdit!._id),
    enabled: !!providerEdit,
  });
  const models = useQuery({
    queryKey: ["admin-ai", "models", params],
    queryFn: () => aiAdminApi.models(params),
    enabled: section === "models",
  });
  const usage = useQuery({
    queryKey: ["admin-ai", "usage", page],
    queryFn: () => aiAdminApi.usage({ page }),
    enabled: section === "usage",
  });
  const credentials = useQuery({
    queryKey: ["admin-ai", "credentials", credentialProvider?._id],
    queryFn: () => aiAdminApi.credentials(credentialProvider!._id),
    enabled: !!credentialProvider,
  });
  const validationModels = useQuery({
    queryKey: [
      "admin-ai",
      "validation-models",
      credentialProvider?._id,
      validationModelPage,
    ],
    queryFn: () =>
      aiAdminApi.models({
        providerId: credentialProvider!._id,
        enabled: "true",
        page: validationModelPage,
      }),
    enabled: !!credentialProvider,
  });
  const refresh = async () =>
    cache.invalidateQueries({ queryKey: ["admin-ai"] });
  async function action(
    method: "post" | "patch" | "delete",
    path: string,
    payload?: unknown,
    confirmed = false,
  ) {
    if (method === "delete" && !confirmed) {
      setConfirmDeletion(path);
      return false;
    }
    if (actionLock.current) return false;
    actionLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await aiAdminApi.write(method, path, payload);
      await refresh();
      if (result && typeof result === "object" && "valid" in result) {
        if (!result.valid) {
          const message =
            "message" in result && typeof result.message === "string"
              ? result.message
              : "Connection test failed. Check the model and credential.";
          setError(message);
          toast.error(message);
          return false;
        }
        setNotice("Connection test passed.");
      } else setNotice("Saved.");
      toast.success("AI configuration updated.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      toast.error(e instanceof Error ? e.message : "Request failed");
      return false;
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function saveProvider(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = providerForm.safeParse({
      name: form.get("name"),
      code: form.get("code"),
      adapter: providerEdit?.adapter ?? form.get("adapter"),
      description: form.get("description"),
      enabled: form.has("enabled"),
      baseUrl: form.get("baseUrl") || undefined,
      apiVersion: form.get("apiVersion") || undefined,
      settings: form.get("providerTimeoutMs")
        ? { timeoutMs: Number(form.get("providerTimeoutMs")), maxRetries: 0 }
        : undefined,
    });
    if (!parsed.success) {
      setError(
        "Enter a name and a lowercase code of 2–40 characters (letters, numbers or hyphens), then choose an adapter.",
      );
      return;
    }
    if (
      parsed.data.enabled &&
      !adapterOptions.data?.items.find(
        (option) => option.adapter === parsed.data.adapter,
      )?.implemented
    ) {
      setError(
        "This adapter is not available yet. Uncheck Enabled to save its configuration.",
      );
      return;
    }
    const payload = {
      ...parsed.data,
      ...(providerEdit
        ? { defaultCredentialId: form.get("defaultCredentialId") || null }
        : {}),
    };
    if (
      await action(
        providerEdit ? "patch" : "post",
        "providers" + (providerEdit ? "/" + providerEdit._id : ""),
        payload,
      )
    )
      setProviderEdit(undefined);
  }
  async function saveModel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = modelForm.safeParse({
      providerId: form.get("providerId"),
      modelId: form.get("modelId"),
      displayName: form.get("displayName"),
      description: form.get("description"),
      temperature:
        form.get("temperature") === ""
          ? undefined
          : Number(form.get("temperature")),
      maxOutputTokens: Number(form.get("maxOutputTokens")),
      timeoutMs: Number(form.get("timeoutMs")),
      priority: Number(form.get("priority")),
    });
    const allowedPlans = SUBSCRIPTION_PLANS.filter((p) =>
      form.has("plan-" + p),
    );
    const tasks = [
      "highlight_detection",
      "edit_planning",
      "edit_refinement",
    ].filter((task) => form.has("task-" + task));
    if (!tasks.length) {
      setError("Select at least one supported task.");
      return;
    }
    const inputPrice = String(form.get("inputPrice") ?? "").trim();
    const outputPrice = String(form.get("outputPrice") ?? "").trim();
    const pricing =
      inputPrice || outputPrice
        ? {
            inputCostPerMillionTokens: Number(inputPrice),
            outputCostPerMillionTokens: Number(outputPrice),
            currency: "USD" as const,
          }
        : undefined;
    if (
      pricing &&
      (!inputPrice ||
        !outputPrice ||
        ![
          pricing.inputCostPerMillionTokens,
          pricing.outputCostPerMillionTokens,
        ].every(
          (price) =>
            Number.isFinite(price) &&
            price >= 0 &&
            price <= AI_MODEL_POLICY.MAX_TOKEN_PRICE_USD,
        ))
    ) {
      setError(
        "Enter both token prices between 0 and 10,000 USD, or leave both blank.",
      );
      return;
    }
    if (!parsed.success || !allowedPlans.length) {
      setError(
        "Check model settings and select at least one subscription plan.",
      );
      return;
    }
    const { temperature, maxOutputTokens, timeoutMs, ...base } = parsed.data;
    const payload = {
      ...base,
      credentialId: form.get("credentialId") || null,
      enabled: form.has("enabled"),
      tasks,
      capabilities: Object.fromEntries(
        ["text", "vision", "audioInput", "structuredOutput", "toolCalling"].map(
          (k) => [k, form.has(k)],
        ),
      ),
      settings: { temperature, maxOutputTokens, timeoutMs, maxRetries: 0 },
      access: { allowedPlans, selectable: form.has("selectable") },
      ...(pricing ? { pricing } : {}),
    };
    if (
      await action(
        modelEdit ? "patch" : "post",
        "models" + (modelEdit ? "/" + modelEdit._id : ""),
        payload,
      )
    )
      setModelEdit(undefined);
  }
  async function saveCredential(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const secret = String(form.get("secret") || "");
    const label = String(form.get("label") || "").trim();
    if (
      !label ||
      (!credentialEdit && secret.length < 12) ||
      /[•*]/.test(secret)
    ) {
      setError(
        "Enter a label and a new API key; masked placeholders are not accepted.",
      );
      formElement.reset();
      return;
    }
    try {
      if (
        await action(
          credentialEdit ? "patch" : "post",
          credentialEdit
            ? "credentials/" + credentialEdit._id
            : "providers/" + credentialProvider!._id + "/credentials",
          {
            label,
            enabled: form.has("enabled"),
            ...(secret ? { secret } : {}),
          },
        )
      ) {
        setCredentialEdit(undefined);
      }
    } finally {
      formElement.reset();
    }
  }
  const current =
    section === "providers" ? providers : section === "models" ? models : usage;
  return (
    <div className="min-w-0 space-y-6">
      <AppPageHeader
        title="AI management"
        description="Configure providers, editing models and measured API usage."
        action={
          section !== "usage" ? (
            <Button
              disabled={busy}
              onClick={() => {
                toast.dismiss();
                setError("");
                setNotice("");
                if (section === "providers") {
                  setSelectedAdapter(AI_ADAPTERS[0]);
                  setProviderEdit(null);
                } else {
                  setSelectedProvider("");
                  setModelEdit(null);
                }
              }}
            >
              Add {section === "providers" ? "provider" : "model"}
            </Button>
          ) : undefined
        }
      />
      {error && (
        <p role="alert" className="text-destructive">
          {error ||
            "AI management could not be loaded. The service may be offline."}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <Tabs
        value={section}
        onValueChange={(value) => {
          setSection(value as Section);
          setPage(1);
          setSearch("");
          setFilter("");
          setError("");
          setNotice("");
        }}
      >
        <AppFilterBar className="mb-6 justify-between">
          <TabsList>
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
          </TabsList>
          {section !== "usage" && (
            <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto">
              <Input
                wrapperClassName="w-full sm:w-64"
                aria-label="Search"
                placeholder="Search by name"
                prefixIcon={<Search className="size-4" />}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <AppSelect
                aria-label="Enabled filter"
                wrapperClassName="w-full sm:w-40"
                value={filter}
                onValueChange={(e) => {
                  setFilter(e);
                  setPage(1);
                }}
              >
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="true">Enabled</SelectItem>
                <SelectItem value="false">Disabled</SelectItem>
              </AppSelect>
            </div>
          )}
        </AppFilterBar>
        <TabsContent value="providers">
          {providers.isError ? (
            <AppQueryState
              title="AI management unavailable"
              description="The service could not be reached. Retry to load your configuration."
              onRetry={() => void providers.refetch()}
              retrying={providers.isFetching}
            />
          ) : (
            <AppTable<Provider>
              data={providers.data?.items ?? []}
              loading={providers.isPending}
              emptyMessage={
                search || filter
                  ? "No records match your filters."
                  : "No providers yet. Add a provider to configure AI access."
              }
              columns={[
                {
                  key: "provider",
                  header: "Provider",
                  className: "align-middle min-w-[160px]",
                  render: (p) => (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-foreground text-xs sm:text-sm">{p.name}</span>
                      <span className="text-muted-foreground font-mono text-[11px]">{p.code}</span>
                    </div>
                  ),
                },
                {
                  key: "adapter",
                  header: "Adapter",
                  className: "align-middle min-w-[120px]",
                  render: (p) => (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-foreground text-xs capitalize">{p.adapter}</span>
                      {!p.operationalAdapter && (
                        <span className="text-[10px] text-amber-500 font-medium">Adapter pending</span>
                      )}
                    </div>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  className: "align-middle min-w-[100px]",
                  render: (p) => (
                    <AppStatusBadge
                      status={p.enabled ? "enabled" : "disabled"}
                    />
                  ),
                },
                {
                  key: "credential",
                  header: "Credential",
                  className: "align-middle min-w-[220px]",
                  render: (p) => (
                    <div className="flex flex-col gap-1">
                      <div className="font-semibold text-foreground text-xs">
                        {p.credentialConfigured
                          ? `${p.credentialCount} enabled credential(s)`
                          : "Needs credential"}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-tight">
                        {p.configured
                          ? "Credential binding configured"
                          : "Assign a provider default or model credential"}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-tight">
                        {p.validatedCredentialCount ?? 0} validated ·{" "}
                        <span className={p.operational ? "text-primary font-medium" : "text-amber-500"}>
                          {p.operational ? "Ready for tasks" : "No model ready"}
                        </span>
                      </div>
                    </div>
                  ),
                },
                {
                  key: "models",
                  header: "Models",
                  className: "align-middle min-w-[80px]",
                  render: (p) => (
                    <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                      {p.modelCount}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  className: "align-middle text-right min-w-[220px]",
                  render: (p) => (
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      <Button
                        size="xs"
                        variant="outline"
                        className="h-7 px-2.5 text-xs font-semibold shadow-2xs border-border/70 hover:bg-muted/60"
                        onClick={() => setProviderEdit(p)}
                      >
                        <Pencil className="size-3 mr-1 text-muted-foreground" />
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        className="h-7 px-2.5 text-xs font-semibold shadow-2xs border-border/70 hover:bg-muted/60"
                        onClick={() => {
                          setCredentialEdit(undefined);
                          setValidationModelId("");
                          setValidationModelPage(1);
                          setCredentialProvider(p);
                        }}
                      >
                        <Key className="size-3 mr-1 text-muted-foreground" />
                        Credentials
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        className="h-7 px-2.5 text-xs font-semibold shadow-2xs border-border/70 hover:bg-muted/60"
                        disabled={busy || !p.operationalAdapter}
                        onClick={() =>
                          action("patch", "providers/" + p._id, {
                            enabled: !p.enabled,
                          })
                        }
                      >
                        <Power className="size-3 mr-1 text-muted-foreground" />
                        {p.enabled ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </TabsContent>
        <TabsContent value="models">
          {models.isError ? (
            <AppQueryState
              title="AI management unavailable"
              description="The service could not be reached. Retry to load your configuration."
              onRetry={() => void models.refetch()}
              retrying={models.isFetching}
            />
          ) : (
            <AppTable<AIModel>
              data={models.data?.items ?? []}
              loading={models.isPending}
              emptyMessage={
                search || filter
                  ? "No records match your filters."
                  : "No models yet. Add a model to configure editing."
              }
              columns={[
                {
                  key: "model",
                  header: "Model",
                  className: "align-middle min-w-[200px]",
                  render: (m) => (
                    <div className="flex flex-col gap-1 min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-xs sm:text-sm">{m.displayName}</span>
                        {m.isDefault && (
                          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0 h-4">
                            Default
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground text-[11px] font-mono">
                        {m.modelId} ·{" "}
                        {catalog.data?.items.find((p) => p._id === m.providerId)?.name ?? m.providerId}
                      </div>
                      <div className="pt-0.5">
                        <AppStatusBadge status={m.enabled ? "enabled" : "disabled"} />
                      </div>
                    </div>
                  ),
                },
                {
                  key: "access",
                  header: "Access",
                  className: "align-middle min-w-[110px]",
                  render: (m) => (
                    <div className="flex flex-wrap gap-1">
                      {m.access.allowedPlans.map((plan) => (
                        <span
                          key={plan}
                          className="rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                          {plan}
                        </span>
                      ))}
                    </div>
                  ),
                },
                {
                  key: "capabilities",
                  header: "Capabilities",
                  className: "align-middle min-w-[180px]",
                  render: (m) => (
                    <div className="flex flex-wrap gap-1 max-w-[240px]">
                      {Object.entries(m.capabilities)
                        .filter(([, v]) => v)
                        .map(([k]) => {
                          const label =
                            ({
                              text: "Text",
                              vision: "Vision",
                              audioInput: "Audio input",
                              structuredOutput: "Structured output",
                              toolCalling: "Tool calling",
                            })[k] ?? k;
                          return (
                            <span
                              key={k}
                              className="rounded-md border border-border/50 bg-secondary/40 px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground"
                            >
                              {label}
                            </span>
                          );
                        })}
                    </div>
                  ),
                },
                {
                  key: "priority",
                  header: "Priority",
                  className: "align-middle min-w-[80px]",
                  render: (m) => (
                    <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                      {m.priority}
                    </span>
                  ),
                },
                {
                  key: "lastTest",
                  header: "Last test",
                  className: "align-middle min-w-[160px]",
                  render: (m) => (
                    <div className="flex flex-col gap-1 min-w-[150px]">
                      <div>
                        <AppStatusBadge status={m.lastTestStatus ?? "unknown"} />
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-tight">
                        {m.readyForTasks
                          ? "Ready for tasks"
                          : "Not ready with current configuration"}
                      </div>
                      {m.lastTestedAt && (
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {new Date(m.lastTestedAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  className: "align-middle text-right min-w-[180px]",
                  render: (m) => (
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      <Button
                        size="xs"
                        variant="outline"
                        className="h-7 px-2.5 text-xs font-semibold shadow-2xs border-border/70 hover:bg-muted/60"
                        onClick={() => {
                          setSelectedProvider("");
                          setModelEdit(m);
                        }}
                      >
                        <Pencil className="size-3 mr-1 text-muted-foreground" />
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        className="h-7 px-2.5 text-xs font-semibold shadow-2xs border-border/70 hover:bg-muted/60"
                        disabled={busy}
                        onClick={() => action("post", "models/" + m._id + "/test")}
                      >
                        <Play className="size-3 mr-1 text-primary" />
                        Test
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="outline"
                              size="icon-xs"
                              className="h-7 w-7 rounded-md border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/60 shadow-2xs"
                              aria-label="More actions"
                            >
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-44 rounded-xl p-1 shadow-lg">
                          <DropdownMenuItem
                            disabled={busy || m.isDefault}
                            className="rounded-lg text-xs font-medium cursor-pointer"
                            onClick={() => action("post", "models/" + m._id + "/set-default")}
                          >
                            <Star className="size-3.5 mr-2 text-amber-500" />
                            {m.isDefault ? "Default Model" : "Set as default"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={busy}
                            className="rounded-lg text-xs font-medium cursor-pointer"
                            onClick={() =>
                              action("patch", "models/" + m._id, {
                                enabled: !m.enabled,
                              })
                            }
                          >
                            <Power className="size-3.5 mr-2 text-muted-foreground" />
                            {m.enabled ? "Disable model" : "Enable model"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={busy || m.isDefault}
                            className="rounded-lg text-xs font-medium text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                            onClick={() => action("delete", "models/" + m._id)}
                          >
                            <Trash2 className="size-3.5 mr-2 text-destructive" />
                            Archive model
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </TabsContent>
        <TabsContent value="usage">
          <div className="grid gap-4 md:grid-cols-2">
            {usage.data?.summary.map((s) => (
              <Card key={s._id}>
                <CardHeader>
                  <CardTitle className="text-base">{s._id}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm">
                  <p>
                    {s.requests} requests · {s.successes} succeeded ·{" "}
                    {s.failures} failed
                  </p>
                  <p>
                    {s.inputTokens} input tokens · {s.outputTokens} output
                    tokens
                  </p>
                  <p>Average latency: {Math.round(s.averageLatencyMs)} ms</p>
                  <p>
                    Estimated cost:{" "}
                    {s.pricedRequests
                      ? "$" +
                        s.estimatedCostUsd.toFixed(6) +
                        " across " +
                        s.pricedRequests +
                        " priced requests"
                      : "Pricing not available"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          {usage.isError ? (
            <AppQueryState
              title="AI management unavailable"
              description="The service could not be reached. Retry to load your configuration."
              onRetry={() => void usage.refetch()}
              retrying={usage.isFetching}
            />
          ) : (
            <AppTable<Usage>
              data={usage.data?.items ?? []}
              loading={usage.isPending}
              emptyMessage={
                search || filter
                  ? "No records match your filters."
                  : "No API usage recorded yet."
              }
              columns={[
                {
                  key: "model",
                  header: "Model",
                  className: "align-middle min-w-[160px]",
                  render: (u) => (
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {u.modelId}
                    </span>
                  ),
                },
                {
                  key: "outcome",
                  header: "Outcome",
                  className: "align-middle min-w-[100px]",
                  render: (u) => (
                    <AppStatusBadge status={u.status || "unknown"} />
                  ),
                },
                {
                  key: "tokens",
                  header: "Tokens (In / Out)",
                  className: "align-middle min-w-[140px]",
                  render: (u) => (
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {u.inputTokens?.toLocaleString() ?? "—"} / {u.outputTokens?.toLocaleString() ?? "—"}
                    </span>
                  ),
                },
                {
                  key: "latency",
                  header: "Latency",
                  className: "align-middle min-w-[100px]",
                  render: (u) => (
                    <span className="font-mono text-xs tabular-nums text-foreground">
                      {u.latencyMs} ms
                    </span>
                  ),
                },
                {
                  key: "cost",
                  header: "Estimated Cost",
                  className: "align-middle text-right min-w-[120px]",
                  render: (u) => (
                    <span className="font-mono text-xs font-bold tabular-nums text-foreground">
                      {typeof u.estimatedCostUsd === "number" ? `$${u.estimatedCostUsd.toFixed(6)}` : "—"}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </TabsContent>
      </Tabs>
      {(page > 1 || !!current.data?.items.length) && (
        <AppPagination
          page={page}
          hasNext={
            (current.data?.items.length ?? 0) >= PAGINATION.DEFAULT_PAGE_SIZE
          }
          onPageChange={setPage}
          disabled={current.isPending || current.isError}
        />
      )}
      <Dialog
        open={providerEdit !== undefined}
        onOpenChange={(open) => {
          if (!open) setProviderEdit(undefined);
        }}
      >
        <DialogContent className="flex h-[min(860px,90dvh)] max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b px-6 py-5">
            <DialogTitle>
              {providerEdit ? "Edit provider" : "Add provider"}
            </DialogTitle>
          </DialogHeader>
          <form
            key={providerEdit?._id ?? "new-provider"}
            onSubmit={saveProvider}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div
              className={`${styles.scrollbar} grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain px-6 py-5`}
            >
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
              <Field
                label="Name"
                name="name"
                value={providerEdit?.name}
                required
              />
              <Field
                label="Code"
                name="code"
                value={providerEdit?.code}
                hint="A unique lowercase code, for example google-gemini."
                required
              />
              <fieldset className="space-y-2" disabled={!!providerEdit}>
                <legend className="text-sm font-medium">Adapter</legend>
                <AppRadioGroup
                  name="adapter"
                  disabled={!!providerEdit}
                  aria-label="Adapter"
                  defaultValue={providerEdit?.adapter ?? selectedAdapter}
                  onValueChange={setSelectedAdapter}
                  options={
                    adapterOptions.data?.items.map((option) => ({
                      value: option.adapter,
                      label: {
                        google: "Google Gemini",
                        openai: "OpenAI",
                        anthropic: "Anthropic",
                      }[option.adapter],
                      description: option.implemented
                        ? "Available for registered models."
                        : "Adapter pending. Save as disabled.",
                    })) ?? []
                  }
                />
                {providerEdit && (
                  <p className="text-xs text-muted-foreground">
                    The adapter cannot be changed after creation.
                  </p>
                )}
              </fieldset>
              {activeAdapter?.implemented && (
                <div
                  key={providerEdit?.adapter ?? selectedAdapter}
                  className="grid gap-4 sm:grid-cols-2"
                >
                  <Field
                    label="Approved API base URL"
                    name="baseUrl"
                    value={
                      providerEdit?.baseUrl ??
                      activeAdapter.endpointDefaults?.baseUrl ??
                      ""
                    }
                    hint="Only origins approved by this adapter are accepted. Endpoint changes require a new model test."
                  />
                  <Field
                    label="API version"
                    name="apiVersion"
                    value={
                      providerEdit?.apiVersion ??
                      activeAdapter.endpointDefaults?.apiVersion ??
                      ""
                    }
                  />
                  <Field
                    label="Credential check timeout (ms, optional)"
                    name="providerTimeoutMs"
                    type="number"
                    value={providerEdit?.settings?.timeoutMs}
                  />
                </div>
              )}
              <Field
                label="Description"
                name="description"
                value={providerEdit?.description ?? ""}
              />
              {providerEdit && (
                <label className="grid gap-2 text-sm">
                  Default credential
                  <AppSelect
                    aria-label="Default credential"
                    name="defaultCredentialId"
                    defaultValue={providerEdit.defaultCredentialId ?? ""}
                  >
                    <SelectItem value="">No default credential</SelectItem>
                    {defaultCredentials.data?.items.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.label}
                        {c.enabled ? "" : " (disabled)"}
                      </SelectItem>
                    ))}
                  </AppSelect>
                </label>
              )}
              <Check
                name="enabled"
                label="Enabled"
                checked={providerEdit?.enabled ?? true}
              />
            </div>
            <div className="flex shrink-0 justify-end border-t px-6 py-4">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save provider"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!confirmDeletion}
        onOpenChange={(open) => {
          if (!open) setConfirmDeletion(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDeletion?.startsWith("models/")
                ? "Archive this model?"
                : "Remove this credential?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This disables the selected configuration. Existing history is
            retained; the server checks references before making changes.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmDeletion(undefined)}
            >
              Keep configuration
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (
                  confirmDeletion &&
                  (await action("delete", confirmDeletion, undefined, true))
                )
                  setConfirmDeletion(undefined);
              }}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!credentialProvider}
        onOpenChange={(open) => {
          if (!open) {
            setCredentialProvider(undefined);
            setCredentialEdit(undefined);
          }
        }}
      >
        <DialogContent
          className={`${styles.scrollbar} max-h-[85dvh] overflow-y-auto sm:max-w-2xl`}
        >
          <DialogHeader>
            <DialogTitle>{credentialProvider?.name} credentials</DialogTitle>
          </DialogHeader>
          {(error || credentials.error) && (
            <p role="alert" className="text-destructive text-sm">
              {error || credentials.error?.message}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm">
              {notice}
            </p>
          )}
          <p className="text-muted-foreground text-sm">
            Stored secrets are encrypted and cannot be read back. Validation
            makes a fresh request using the credential you choose below. It does
            not assign runtime bindings. For tasks, assign a provider default
            credential or bind the model directly, test the model, enable it,
            then assign the Auto default. Models must support the task.
          </p>
          <label className="grid gap-2 text-sm">
            Validation model
            <AppSelect
              aria-label="Validation model"
              value={validationModelId}
              onValueChange={setValidationModelId}
            >
              <SelectItem value="">
                Auto default or only eligible model
              </SelectItem>
              {validationModels.data?.items
                .filter((m) => m.capabilities.text)
                .map((m) => (
                  <SelectItem key={m._id} value={m._id}>
                    {m.displayName}
                  </SelectItem>
                ))}
            </AppSelect>
            <span className="text-xs text-muted-foreground">
              With multiple eligible models, select one explicitly. A model
              bound to another credential cannot be used.
            </span>
          </label>
          {(validationModelPage > 1 ||
            (validationModels.data?.items.length ?? 0) >=
              PAGINATION.DEFAULT_PAGE_SIZE) && (
            <AppPagination
              page={validationModelPage}
              hasNext={
                (validationModels.data?.items.length ?? 0) >=
                PAGINATION.DEFAULT_PAGE_SIZE
              }
              disabled={validationModels.isPending || validationModels.isError}
              onPageChange={(page) => {
                setValidationModelPage(page);
                setValidationModelId("");
              }}
            />
          )}
          {credentials.data?.items.map((c) => (
            <div key={c._id} className="rounded border p-3 text-sm">
              <div>
                {c.label} · •••••••• · {c.enabled ? "Enabled" : "Disabled"}
              </div>
              <div className="text-muted-foreground text-xs">
                {c._id} · {c.lastValidationStatus ?? "Not validated"}
                {c.lastValidatedAt
                  ? " · " + new Date(c.lastValidatedAt).toLocaleString()
                  : ""}
                {c.lastValidationAttemptStatus
                  ? ` · Latest attempt: ${c.lastValidationAttemptStatus}`
                  : ""}
                {c.lastValidationMessage && (
                  <div>{c.lastValidationMessage}</div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCredentialEdit(c)}
                >
                  Replace / edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !c.enabled}
                  onClick={() =>
                    action(
                      "post",
                      "credentials/" + c._id + "/validate",
                      validationModelId ? { modelId: validationModelId } : {},
                    )
                  }
                >
                  Validate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    action("patch", "credentials/" + c._id, {
                      enabled: !c.enabled,
                    })
                  }
                >
                  {c.enabled ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => action("delete", "credentials/" + c._id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
          <form
            key={credentialEdit?._id ?? "new"}
            onSubmit={saveCredential}
            autoComplete="off"
            className="grid gap-3"
          >
            <Field
              label="Credential label"
              name="label"
              value={credentialEdit?.label}
              required
            />
            <label className="grid gap-2 text-sm">
              {credentialEdit
                ? "Replacement API key (leave blank to keep existing)"
                : "API key"}
              <Input
                name="secret"
                type="password"
                autoComplete="new-password"
                required={!credentialEdit}
              />
            </label>
            <Check
              name="enabled"
              label="Enabled"
              checked={credentialEdit?.enabled ?? true}
            />
            <Button type="submit" disabled={busy}>
              {credentialEdit ? "Save replacement" : "Add credential"}
            </Button>
            {credentialEdit && (
              <Button
                variant="ghost"
                type="button"
                onClick={() => setCredentialEdit(undefined)}
              >
                Add another credential
              </Button>
            )}
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={modelEdit !== undefined}
        onOpenChange={(open) => {
          if (!open) setModelEdit(undefined);
        }}
      >
        <DialogContent className="flex h-[min(860px,90dvh)] max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 border-b px-6 py-5">
            <DialogTitle>{modelEdit ? "Edit model" : "Add model"}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Set model access, supported tasks and generation limits.
            </p>
          </DialogHeader>
          <form
            key={modelEdit?._id ?? "new-model"}
            onSubmit={saveModel}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div
              className={`${styles.scrollbar} min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-5`}
            >
              {(error || modelCredentials.error) && (
                <p role="alert" className="text-destructive text-sm">
                  {error || modelCredentials.error?.message}
                </p>
              )}
              <h3 className="border-b pb-2 text-sm font-semibold">
                Provider and model identity
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  Provider
                  <AppSelect
                    aria-label="Provider"
                    name="providerId"
                    value={modelProviderId}
                    onValueChange={(e) => setSelectedProvider(e)}
                    required
                  >
                    <SelectItem value="">Select provider</SelectItem>
                    {catalog.data?.items
                      .filter((p) => p.operationalAdapter)
                      .map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    {modelProviderId &&
                      !catalog.data?.items.some(
                        (p) => p._id === modelProviderId,
                      ) && (
                        <SelectItem value={modelProviderId}>
                          Current provider
                        </SelectItem>
                      )}
                  </AppSelect>
                </label>
                <label className="grid gap-2 text-sm">
                  Credential
                  <AppSelect
                    aria-label="Credential"
                    key={modelProviderId}
                    name="credentialId"
                    defaultValue={
                      modelEdit?.providerId === modelProviderId
                        ? (modelEdit.credentialId ?? "")
                        : ""
                    }
                  >
                    <SelectItem value="">Use provider default</SelectItem>
                    {modelCredentials.data?.items.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.label}
                        {c.enabled ? "" : " (disabled)"}
                      </SelectItem>
                    ))}
                  </AppSelect>
                </label>
                <Field
                  label="Provider model identifier"
                  name="modelId"
                  value={modelEdit?.modelId}
                  required
                />
                <Field
                  label="Display name"
                  name="displayName"
                  value={modelEdit?.displayName}
                  required
                />
                <Field
                  label="Description"
                  name="description"
                  value={modelEdit?.description ?? ""}
                />
              </div>
              <h3 className="mt-2 border-b pb-2 text-sm font-semibold">
                Generation and pricing
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Temperature (optional)"
                  name="temperature"
                  type="number"
                  value={modelEdit?.settings.temperature ?? ""}
                />
                <Field
                  label="Output token limit"
                  name="maxOutputTokens"
                  type="number"
                  value={
                    modelEdit?.settings.maxOutputTokens ??
                    AI_MODEL_POLICY.OUTPUT_TOKENS.DEFAULT
                  }
                />
                <Field
                  label="Timeout (ms)"
                  name="timeoutMs"
                  type="number"
                  value={
                    modelEdit?.settings.timeoutMs ??
                    AI_MODEL_POLICY.TIMEOUT_MS.DEFAULT
                  }
                />
                <Field
                  label="Priority"
                  name="priority"
                  type="number"
                  value={
                    modelEdit?.priority ?? AI_MODEL_POLICY.PRIORITY.DEFAULT
                  }
                />
                <Field
                  label="Input USD / million tokens"
                  name="inputPrice"
                  type="number"
                  value={modelEdit?.pricing?.inputCostPerMillionTokens ?? ""}
                />
                <Field
                  label="Output USD / million tokens"
                  name="outputPrice"
                  type="number"
                  value={modelEdit?.pricing?.outputCostPerMillionTokens ?? ""}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Provider retries are disabled; proposal correction is bounded
                separately. Pricing is optional and used only for estimates.
              </p>
              <div className="grid gap-6 md:grid-cols-2">
                <fieldset className="min-w-0 space-y-3 rounded-lg border p-4">
                  <legend className="mb-2 text-sm font-medium">
                    Supported tasks
                  </legend>
                  {AI_TASKS.map((task) => (
                    <Check
                      key={task}
                      name={"task-" + task}
                      label={AI_TASK_LABELS[task]}
                      checked={(
                        modelEdit?.tasks ?? [
                          AI_TASK.EDIT_PLANNING,
                          AI_TASK.EDIT_REFINEMENT,
                        ]
                      ).includes(task)}
                    />
                  ))}
                </fieldset>
                <fieldset className="min-w-0 space-y-3 rounded-lg border p-4">
                  <legend className="mb-2 text-sm font-medium">
                    Capabilities
                  </legend>
                  {(
                    [
                      "text",
                      "vision",
                      "audioInput",
                      "structuredOutput",
                      "toolCalling",
                    ] as const
                  ).map((k) => (
                    <Check
                      key={k}
                      name={k}
                      label={
                        {
                          text: "Text",
                          vision: "Vision",
                          audioInput: "Audio input",
                          structuredOutput: "Structured output",
                          toolCalling: "Tool calling",
                        }[k]
                      }
                      checked={
                        modelEdit?.capabilities[k] ??
                        ["text", "structuredOutput", "toolCalling"].includes(k)
                      }
                    />
                  ))}
                </fieldset>
              </div>
              <fieldset className="flex min-w-0 flex-wrap gap-4 rounded-lg border p-4">
                <legend className="mb-2 text-sm font-medium">
                  Allowed plans
                </legend>
                {SUBSCRIPTION_PLANS.map((p) => (
                  <Check
                    key={p}
                    name={"plan-" + p}
                    label={p}
                    checked={modelEdit?.access.allowedPlans.includes(p) ?? true}
                  />
                ))}
              </fieldset>
              <Check
                name="selectable"
                label="Selectable by authorized premium accounts"
                checked={modelEdit?.access.selectable ?? true}
              />
              <Check
                name="enabled"
                label="Enabled (successful test also required)"
                checked={modelEdit?.enabled}
              />
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t bg-popover px-6 py-4">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setModelEdit(undefined)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save model"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
