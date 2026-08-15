"use client";

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AsciiEmptyState } from "@/components/voice-agents/ascii-icons";
import { Button } from "@/components/ui/button";

export default function VoiceAgentsDocsPage() {
  useEffect(() => {
    document.title = "Documentation · Voice Agents · Kupe";
  }, []);

  return (
    <div className="voice-page voice-page-narrow">
      <p className="text-caption">Documentation</p>
      <AsciiEmptyState
        kind="docs"
        tone="sky"
        title="Build, test, and deploy voice agents"
        description="Guides for voice agents and campaigns."
        actions={
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/voice-agents">Back to Home</Link>
          </Button>
        }
      />
    </div>
  );
}
