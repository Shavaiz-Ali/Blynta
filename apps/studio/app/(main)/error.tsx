"use client";
import { Button } from "@/components/ui/button";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="p-12">
      <h1 className="text-xl font-semibold">We couldn’t load this workspace</h1>
      <p className="my-4 text-muted-foreground">
        Your browser project is still saved. Try opening it again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
