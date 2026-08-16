"use client";

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/** Lightweight placeholder for Voice Agents sub-routes (dummy frontend). */
export function VoiceAgentsStubPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  useEffect(() => {
    document.title = `${title} · Voice Agents · Kupe`;
  }, [title]);

  return (
    <div className="voice-page voice-page-narrow flex flex-col gap-4">
      <p className="text-caption">Voice Agents</p>
      <h1 className="text-title">{title}</h1>
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <p className="text-sm text-muted-foreground">
        This section uses dummy data for now — wiring to a live API comes next.
      </p>
      <Button asChild variant="outline" className="w-fit rounded-full">
        <Link to="/">Back to Home</Link>
      </Button>
    </div>
  );
}
