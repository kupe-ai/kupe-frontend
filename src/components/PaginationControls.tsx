import { Button } from "@/components/ui/button";

type Props = {
  total: number;
  limit: number;
  offset: number;
  onPageChange: (offset: number) => void;
};

export function PaginationControls({ total, limit, offset, onPageChange }: Props) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
      <p className="text-xs text-muted-foreground">
        {total === 0 ? "No results" : `${from}–${to} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={offset <= 0} onClick={() => onPageChange(Math.max(0, offset - limit))}>
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={offset + limit >= total}
          onClick={() => onPageChange(offset + limit)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
