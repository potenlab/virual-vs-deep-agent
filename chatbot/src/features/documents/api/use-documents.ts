"use client";

import { useState, useCallback } from "react";

interface DocumentEntry {
  id: string;
  path: string;
  name: string;
  type: string;
  sizeBytes: number | null;
  createdAt: string | null;
}

export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) return;
      const data = await res.json();
      setDocuments(data.documents ?? []);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { documents, isLoading, fetchDocuments };
}
