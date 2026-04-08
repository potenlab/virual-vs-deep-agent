"use client";

import { FileText, FolderOpen, Upload, Loader2 } from "lucide-react";
import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface DocumentEntry {
  id: string;
  path: string;
  name: string;
  type: string;
  sizeBytes: number | null;
}

interface DocumentListProps {
  documents: DocumentEntry[];
  projectId: string;
  isLoading: boolean;
  onUploadComplete: () => void;
}

export function DocumentList({
  documents,
  projectId,
  isLoading,
  onUploadComplete,
}: DocumentListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("project_id", projectId);
        formData.append("path", "/uploads");

        const res = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Upload failed");
        }

        const data = await res.json();
        toast.success(`Uploaded: ${data.document.name}`);
        onUploadComplete();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [projectId, onUploadComplete],
  );

  const files = documents.filter((d) => d.type === "file");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Documents
        </span>
        <span className="text-xs text-muted-foreground">{files.length}</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".txt,.md,.ts,.tsx,.js,.jsx,.json,.csv,.html,.css,.py,.yaml,.yml,.toml,.xml,.sql,.sh,.log"
        onChange={handleUpload}
      />

      <div className="px-3 pb-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-xs"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-3" />
          Upload File
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : files.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4 px-3">
            No documents yet. Upload a file to get started.
          </p>
        ) : (
          <div className="flex flex-col gap-0.5 px-2 pb-2">
            {files.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
                title={doc.path}
              >
                <FileText className="size-3 flex-shrink-0" />
                <span className="truncate">{doc.name}</span>
                {doc.sizeBytes != null && (
                  <span className="ml-auto text-[10px] opacity-60 flex-shrink-0">
                    {formatSize(doc.sizeBytes)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
