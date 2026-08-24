"use client";

import { useEffect } from "react";
import { DOCS_URL } from "@/config";

/** Legacy in-app docs route — send users to the public docs site. */
export default function VoiceAgentsDocsPage() {
  useEffect(() => {
    window.location.replace(DOCS_URL);
  }, []);

  return (
    <div className="voice-page voice-page-narrow flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">
        Opening{" "}
        <a href={DOCS_URL} className="underline underline-offset-2">
          {DOCS_URL}
        </a>
        …
      </p>
    </div>
  );
}
