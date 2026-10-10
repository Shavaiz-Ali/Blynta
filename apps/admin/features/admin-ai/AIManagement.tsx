"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { aiAdminApi } from "./api";
import type { AIModel, Provider, Credential } from "./api";
type Section = "providers" | "models" | "usage";
const name = z.string().trim().min(1).max(100);
const providerForm = z.object({
  name,
  code: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/),
  adapter: z.enum(["google", "openai", "anthropic"]),
  enabled: z.boolean(),
  description: z.string().max(500),
});
const modelForm = z.object({
  providerId: z.string().regex(/^[a-f\d]{24}$/i),
  modelId: z.string().regex(/^gemini-[a-zA-Z0-9.-]{1,100}$/),
  displayName: name,
  description: z.string().max(500),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().min(128).max(8192),
  timeoutMs: z.number().int().min(1000).max(60000),
  priority: z.number().int().min(0).max(1000),
});
function Field({
  label,
  name,
  value,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  value?: string | number;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <Label>{label}</Label>
      <Input
        name={name}
        type={type}
        step={type === "number" ? "any" : undefined}
        defaultValue={value}
        required={required}
      />
    </label>
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
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} />
      {label}
    </label>
  );
}
export function AIManagement({
  initialSection = "providers",
}: {
  initialSection?: Section;
}) {
  const cache = useQueryClient();
  const [section, setSection] = useState<Section>(initialSection);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDeletion, setConfirmDeletion] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [providerEdit, setProviderEdit] = useState<
    Provider | null | undefined
  >();
  const [modelEdit, setModelEdit] = useState<AIModel | null | undefined>();
  const [selectedProvider, setSelectedProvider] = useState("");
  const [credentialProvider, setCredentialProvider] = useState<Provider>();
  const [credentialEdit, setCredentialEdit] = useState<Credential>();
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
    catalog.data?.items.find((p) => p.adapter === "google")?._id ||
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
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await aiAdminApi.write(method, path, payload);
      await refresh();
      if (result && typeof result === "object" && "valid" in result)
        setNotice(
          result.valid
            ? "Connection test passed."
            : "Connection test failed. Check the model and credential.",
        );
      else setNotice("Saved.");
      toast.success("AI configuration updated.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      toast.error(e instanceof Error ? e.message : "Request failed");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saveProvider(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = providerForm.safeParse({
      name: form.get("name"),
      code: form.get("code"),
      adapter: form.get("adapter"),
      description: form.get("description"),
      enabled: form.has("enabled"),
    });
    if (!parsed.success) {
      setError("Check the provider name, code and adapter.");
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
    const allowedPlans = ["free", "pro", "business"].filter((p) =>
      form.has("plan-" + p),
    );
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
      tasks: ["highlight_detection", "edit_planning", "edit_refinement"].filter(
        (task) => form.has("task-" + task),
      ),
      capabilities: Object.fromEntries(
        ["text", "vision", "audioInput", "structuredOutput", "toolCalling"].map(
          (k) => [k, form.has(k)],
        ),
      ),
      settings: { temperature, maxOutputTokens, timeoutMs, maxRetries: 0 },
      access: { allowedPlans, selectable: form.has("selectable") },
      ...(form.get("inputPrice") !== "" && form.get("outputPrice") !== ""
        ? {
            pricing: {
              inputCostPerMillionTokens: Number(form.get("inputPrice")),
              outputCostPerMillionTokens: Number(form.get("outputPrice")),
              currency: "USD",
            },
          }
        : {}),
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
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">AI management</h1>
        <p className="text-muted-foreground mt-1">
          Manage providers, model access and measured API usage.
        </p>
      </div>
      {(error || current.error) && (
        <p role="alert" className="text-destructive">
          {error || current.error?.message}
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
        }}
      >
        <TabsList>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>
        {section !== "usage" && (
          <div className="my-4 flex flex-wrap items-center gap-3">
            <Input
              className="max-w-sm"
              aria-label="Search"
              placeholder="Search by name"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              aria-label="Enabled filter"
              className="rounded border bg-background p-2 text-sm"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
            <Button
              onClick={() =>
                section === "providers"
                  ? setProviderEdit(null)
                  : (setSelectedProvider(""), setModelEdit(null))
              }
            >
              Add {section === "providers" ? "provider" : "model"}
            </Button>
          </div>
        )}
        <TabsContent value="providers">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Adapter</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Credential</TableHead>
                    <TableHead>Models</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.data?.items.map((p) => (
                    <TableRow key={p._id}>
                      <TableCell>
                        {p.name}
                        <div className="text-muted-foreground text-xs">
                          {p.code}
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.adapter}
                        {p.adapter !== "google" && (
                          <div className="text-xs">Adapter pending</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {p.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {p.configured ? "Configured" : "Needs credential"}
                      </TableCell>
                      <TableCell>{p.modelCount}</TableCell>
                      <TableCell className="space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setProviderEdit(p)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setCredentialEdit(undefined);
                            setCredentialProvider(p);
                          }}
                        >
                          Credentials
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy || p.adapter !== "google"}
                          onClick={() =>
                            action("patch", "providers/" + p._id, {
                              enabled: !p.enabled,
                            })
                          }
                        >
                          {p.enabled ? "Disable" : "Enable"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="models">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Capabilities</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Last test</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.data?.items.map((m) => (
                    <TableRow key={m._id}>
                      <TableCell>
                        {m.displayName}
                        {m.isDefault && <Badge className="ml-2">Default</Badge>}
                        <div className="text-muted-foreground text-xs">
                          {m.modelId} ·{" "}
                          {catalog.data?.items.find(
                            (p) => p._id === m.providerId,
                          )?.name ?? m.providerId}
                        </div>
                        <Badge variant="outline">
                          {m.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell>{m.access.allowedPlans.join(", ")}</TableCell>
                      <TableCell>
                        {Object.entries(m.capabilities)
                          .filter(([, v]) => v)
                          .map(([k]) => k)
                          .join(", ")}
                      </TableCell>
                      <TableCell>{m.priority}</TableCell>
                      <TableCell>
                        {m.lastTestStatus ?? "Not tested"}
                        {m.lastTestedAt && (
                          <div className="text-xs">
                            {new Date(m.lastTestedAt).toLocaleString()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedProvider("");
                              setModelEdit(m);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              action("post", "models/" + m._id + "/test")
                            }
                          >
                            Test
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              action("patch", "models/" + m._id, {
                                enabled: !m.enabled,
                              })
                            }
                          >
                            {m.enabled ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy || m.isDefault}
                            onClick={() =>
                              action("post", "models/" + m._id + "/set-default")
                            }
                          >
                            Set default
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy || m.isDefault}
                            onClick={() => action("delete", "models/" + m._id)}
                          >
                            Archive
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
          <Card className="mt-4">
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Tokens in/out</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Estimated USD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.data?.items.map((u) => (
                    <TableRow key={u._id}>
                      <TableCell>{u.modelId}</TableCell>
                      <TableCell>{u.status}</TableCell>
                      <TableCell>
                        {u.inputTokens ?? "Unknown"} /{" "}
                        {u.outputTokens ?? "Unknown"}
                      </TableCell>
                      <TableCell>{u.latencyMs} ms</TableCell>
                      <TableCell>
                        {u.estimatedCostUsd?.toFixed(6) ?? "Unknown"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {current.isPending ? (
        <div role="status" aria-label="Loading AI management">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="mt-3 h-12 w-full" />
          <Skeleton className="mt-3 h-12 w-full" />
        </div>
      ) : (
        !current.data?.items.length && (
          <p className="text-muted-foreground">No records found.</p>
        )
      )}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <span className="text-sm">Page {page}</span>
        <Button
          variant="outline"
          disabled={current.isPending || (current.data?.items.length ?? 0) < 25}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
      <Dialog
        open={providerEdit !== undefined}
        onOpenChange={(open) => {
          if (!open) setProviderEdit(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {providerEdit ? "Edit provider" : "Add provider"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={saveProvider} className="grid gap-4">
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
              required
            />
            <label className="grid gap-2 text-sm">
              Adapter
              <select
                name="adapter"
                defaultValue={providerEdit?.adapter ?? "google"}
                className="rounded border bg-background p-2"
              >
                <option value="google">Google Gemini</option>
                <option value="openai">OpenAI (adapter pending)</option>
                <option value="anthropic">Anthropic (adapter pending)</option>
              </select>
            </label>
            <Field
              label="Description"
              name="description"
              value={providerEdit?.description ?? ""}
            />
            {providerEdit && (
              <label className="grid gap-2 text-sm">
                Default credential
                <select
                  name="defaultCredentialId"
                  defaultValue={providerEdit.defaultCredentialId ?? ""}
                  className="rounded border bg-background p-2"
                >
                  <option value="">No default credential</option>
                  {defaultCredentials.data?.items.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.label}
                      {c.enabled ? "" : " (disabled)"}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Check
              name="enabled"
              label="Enabled"
              checked={providerEdit?.enabled}
            />
            <Button disabled={busy}>Save provider</Button>
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
          key={credentialProvider?._id}
          className="max-h-[85vh] overflow-y-auto"
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
            Stored secrets are encrypted and cannot be read back. Set the
            default credential ID in the provider form after adding it.
          </p>
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
                    action("post", "credentials/" + c._id + "/validate")
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
            <Button disabled={busy}>
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
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modelEdit ? "Edit model" : "Add model"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveModel} className="grid gap-4">
            {(error || modelCredentials.error) && (
              <p role="alert" className="text-destructive text-sm">
                {error || modelCredentials.error?.message}
              </p>
            )}
            <label className="grid gap-2 text-sm">
              Provider
              <select
                name="providerId"
                value={modelProviderId}
                onChange={(e) => setSelectedProvider(e.target.value)}
                required
                className="rounded border bg-background p-2"
              >
                <option value="">Select provider</option>
                {catalog.data?.items
                  .filter((p) => p.adapter === "google")
                  .map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                {modelProviderId &&
                  !catalog.data?.items.some(
                    (p) => p._id === modelProviderId,
                  ) && (
                    <option value={modelProviderId}>Current provider</option>
                  )}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              Credential
              <select
                key={modelProviderId}
                name="credentialId"
                defaultValue={
                  modelEdit?.providerId === modelProviderId
                    ? (modelEdit.credentialId ?? "")
                    : ""
                }
                className="rounded border bg-background p-2"
              >
                <option value="">Use provider default</option>
                {modelCredentials.data?.items.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.label}
                    {c.enabled ? "" : " (disabled)"}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Gemini model identifier"
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
            <div className="grid grid-cols-2 gap-3">
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
                value={modelEdit?.settings.maxOutputTokens ?? 4096}
              />
              <Field
                label="Timeout (ms)"
                name="timeoutMs"
                type="number"
                value={modelEdit?.settings.timeoutMs ?? 30000}
              />
              <Field
                label="Priority"
                name="priority"
                type="number"
                value={modelEdit?.priority ?? 100}
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
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">
                Supported tasks
              </legend>
              {(
                [
                  "highlight_detection",
                  "edit_planning",
                  "edit_refinement",
                ] as const
              ).map((task) => (
                <Check
                  key={task}
                  name={"task-" + task}
                  label={task.replaceAll("_", " ")}
                  checked={(
                    modelEdit?.tasks ?? ["edit_planning", "edit_refinement"]
                  ).includes(task)}
                />
              ))}
            </fieldset>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">Capabilities</legend>
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
                  label={k}
                  checked={
                    modelEdit?.capabilities[k] ??
                    ["text", "structuredOutput", "toolCalling"].includes(k)
                  }
                />
              ))}
            </fieldset>
            <fieldset className="flex gap-4">
              <legend className="mb-2 text-sm font-medium">
                Allowed plans
              </legend>
              {(["free", "pro", "business"] as const).map((p) => (
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
            <Button disabled={busy}>Save model</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
