"use client";

import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { DeployBreadcrumb } from "@/components/voice-agents/deploy-breadcrumb";
import { getDeployRecipe } from "@/lib/voice-deploy-data";

export default function DeployRecipeDetailPage() {
  const { slug = "" } = useParams();
  const recipe = getDeployRecipe(slug);

  useEffect(() => {
    document.title = recipe
      ? `${recipe.title} · Deploy with code · Kupe`
      : "Recipes · Kupe";
  }, [recipe]);

  if (!recipe) {
    return (
      <div className="voice-page voice-page-narrow text-sm text-muted-foreground">
        Recipe not found.{" "}
        <Link to="/voice-agents/deploy-with-code" className="underline">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="voice-page voice-page-narrow">
      <DeployBreadcrumb
        section="recipes"
        sectionLabel="Recipes & Guides"
        currentSlug={recipe.slug}
        currentTitle={recipe.title}
      />

      <h1 className="text-title mt-6">
        {recipe.title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {recipe.summary}
      </p>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-foreground/90">
        {recipe.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>

      <ol className="mt-10 space-y-8 pb-10">
        {recipe.steps.map((step, i) => (
          <li key={step.title}>
            <div className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                {i + 1}
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold">
                  {i + 1} {step.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
                {step.callout ? (
                  <div className="mt-3 rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                    {step.callout}
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
