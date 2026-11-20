import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Music } from "lucide-react";
import { useState, type ReactNode } from "react";
import { z } from "zod";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button, buttonVariants } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Switch } from "@/client/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { Textarea } from "@/client/components/ui/textarea";
import { messageOf } from "@/client/lib/errors";
import { createSong, getGeneration, getRemixSource } from "@/serverFunctions/songs";

export const Route = createFileRoute("/create")({
  validateSearch: z.object({
    from: z.string().max(64).optional().catch(undefined),
    kind: z.enum(["cover", "extend"]).optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [generation, source] = await Promise.all([
      getGeneration(),
      deps.from ? getRemixSource({ data: { id: deps.from } }) : Promise.resolve(null),
    ]);
    return { generation, source, kind: deps.from ? (deps.kind ?? "cover") : null };
  },
  head: () => ({ meta: [{ title: "Create · Song Maker" }] }),
  component: CreatePage,
});

const VOICES = [
  { value: "any", label: "Any" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
] as const;

function CreatePage() {
  const { generation, source, kind } = Route.useLoaderData();
  const { from } = Route.useSearch();

  const title = kind === "extend" ? "Extend a song" : kind === "cover" ? "Make a cover" : "Create";

  let body: ReactNode;
  if (!generation.ready) {
    body = (
      <div data-testid="generation-off">
        <EmptyState
          icon={Music}
          title="Song generation is off"
          description={
            generation.admin ? (
              <>
                It needs an ElevenLabs API key on your Gateway. Add one with{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">{generation.command}</code>
                .
              </>
            ) : (
              "It needs an ElevenLabs API key on your Gateway. Ask an admin of your workspace to add one."
            )
          }
        />
      </div>
    );
  } else if (from && !source) {
    body = (
      <EmptyState
        kind="filtered"
        title="Song not found"
        action={
          <Link to="/create" className={buttonVariants({ variant: "outline" })}>
            Start from scratch
          </Link>
        }
      />
    );
  } else {
    body = <SongForm key={`${from ?? ""}-${kind ?? ""}`} source={source} kind={kind} />;
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title={title}
        description={
          source ? (
            <>
              From{" "}
              <Link to="/songs/$songId" params={{ songId: source.id }} className="text-foreground underline underline-offset-2">
                {source.title}
              </Link>
            </>
          ) : null
        }
      />
      {body}
    </AppShell>
  );
}

type Source = NonNullable<Awaited<ReturnType<typeof getRemixSource>>>;

function SongForm({ source, kind }: { source: Source | null; kind: "cover" | "extend" | null }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"simple" | "custom">(source ? "custom" : "simple");
  const [description, setDescription] = useState("");
  const [instrumental, setInstrumental] = useState(source?.instrumental ?? false);
  const [title, setTitle] = useState(
    source ? `${source.title} (${kind === "extend" ? "Extended" : "Cover"})` : "",
  );
  const [lyrics, setLyrics] = useState(kind === "cover" ? (source?.lyrics ?? "") : "");
  const [style, setStyle] = useState(source?.style ?? "");
  const [excludeStyles, setExcludeStyles] = useState(source?.excludeStyles ?? "");
  const [vocalGender, setVocalGender] = useState<"any" | "male" | "female">(source?.vocalGender ?? "any");
  const [length, setLength] = useState(source?.durationSec ? String(source.durationSec) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const custom = mode === "custom";
      const { id } = await createSong({
        data: {
          mode,
          title: custom ? title : "",
          description: custom ? (kind === "extend" ? description : "") : description,
          lyrics: custom ? lyrics : "",
          style: custom ? style : "",
          excludeStyles: custom ? excludeStyles : "",
          vocalGender: custom ? vocalGender : "any",
          instrumental,
          durationSec: custom && length ? Number(length) : null,
          parentSongId: source?.id ?? null,
          remixKind: source ? kind : null,
        },
      });
      await navigate({ to: "/songs/$songId", params: { songId: id } });
    } catch (cause) {
      setError(messageOf(cause));
      setPending(false);
    }
  }

  const instrumentalSwitch = (
    <label className="flex items-center gap-3 text-sm font-medium">
      <Switch aria-label="Instrumental" checked={instrumental} onCheckedChange={setInstrumental} />
      Instrumental
    </label>
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Tabs value={mode} onValueChange={(value) => setMode(value as "simple" | "custom")}>
        {source ? null : (
          <TabsList>
            <TabsTrigger value="simple">From a description</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="simple" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="a slow piano ballad about leaving home"
              rows={4}
              maxLength={1000}
            />
          </div>
          {instrumentalSwitch}
        </TabsContent>
        <TabsContent value="custom" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
          </div>
          {kind === "extend" ? (
            <div className="space-y-2">
              <Label htmlFor="continuation">Continuation</Label>
              <Textarea
                id="continuation"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="builds to a bigger final chorus"
                rows={2}
                maxLength={1000}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="lyrics">Lyrics</Label>
            <Textarea
              id="lyrics"
              value={lyrics}
              onChange={(event) => setLyrics(event.target.value)}
              placeholder={"[Verse]\n…\n\n[Chorus]\n…"}
              rows={10}
              maxLength={5000}
              disabled={instrumental}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="style">Styles</Label>
            <Input
              id="style"
              value={style}
              onChange={(event) => setStyle(event.target.value)}
              placeholder="dream pop, female vocals, 90 bpm"
              maxLength={500}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exclude">Exclude styles</Label>
            <Input
              id="exclude"
              value={excludeStyles}
              onChange={(event) => setExcludeStyles(event.target.value)}
              placeholder="autotune, heavy drums"
              maxLength={500}
            />
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <div className="space-y-2">
              <Label>Voice</Label>
              <Select
                value={vocalGender}
                onValueChange={(value) => value && setVocalGender(value as typeof vocalGender)}
                items={VOICES}
                disabled={instrumental}
              >
                <SelectTrigger aria-label="Voice" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOICES.map((voice) => (
                    <SelectItem key={voice.value} value={voice.value}>
                      {voice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="length">Length</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="length"
                  type="number"
                  min={10}
                  max={300}
                  value={length}
                  onChange={(event) => setLength(event.target.value)}
                  placeholder="120"
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">seconds</span>
              </div>
            </div>
            <div className="pb-2">{instrumentalSwitch}</div>
          </div>
        </TabsContent>
      </Tabs>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" pending={pending}>
        Create song
      </Button>
    </form>
  );
}
