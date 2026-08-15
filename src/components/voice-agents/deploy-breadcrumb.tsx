"use client";

import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, ChevronLeft, ChevronUp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DEPLOY_API_CARDS,
  DEPLOY_RECIPES,
} from "@/lib/voice-deploy-data";

export function DeployBreadcrumb({
  section,
  sectionLabel,
  currentSlug,
  currentTitle,
}: {
  section: "apis" | "recipes";
  sectionLabel: string;
  currentSlug: string;
  currentTitle: string;
}) {
  const [openSection, setOpenSection] = useState(false);
  const [openItem, setOpenItem] = useState(false);
  const items =
    section === "apis"
      ? DEPLOY_API_CARDS.map((c) => ({
          slug: c.slug,
          title: c.title,
          href: `/voice-agents/deploy-with-code/apis/${c.slug}`,
        }))
      : DEPLOY_RECIPES.map((r) => ({
          slug: r.slug,
          title: r.title,
          href: `/voice-agents/deploy-with-code/recipes/${r.slug}`,
        }));

  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      <Link
        to="/voice-agents/deploy-with-code"
        className="inline-flex items-center gap-0.5 hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Deploy with Code
      </Link>
      <span>/</span>

      <DropdownMenu open={openSection} onOpenChange={setOpenSection}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            {sectionLabel}
            {openSection ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem asChild>
            <Link to="/voice-agents/deploy-with-code">
              APIs
              {section === "apis" ? <Check className="ml-auto size-3.5" /> : null}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/voice-agents/deploy-with-code/recipes/moengage">
              Recipes & Guides
              {section === "recipes" ? (
                <Check className="ml-auto size-3.5" />
              ) : null}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <span>/</span>

      <DropdownMenu open={openItem} onOpenChange={setOpenItem}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex max-w-[min(100%,28rem)] items-center gap-1 truncate hover:text-foreground"
          >
            <span className="truncate">{currentTitle}</span>
            {openItem ? (
              <ChevronUp className="size-3.5 shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 shrink-0" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-64 w-[min(100vw-2rem,22rem)] overflow-y-auto"
        >
          {items.map((item) => (
            <DropdownMenuItem key={item.slug} asChild>
              <Link to={item.href} className="flex w-full items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                {item.slug === currentSlug ? (
                  <Check className="size-3.5 shrink-0" />
                ) : null}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
