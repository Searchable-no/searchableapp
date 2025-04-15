"use client";

import React, { useState, useEffect } from "react";
import { Folder, ChevronRight, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  children: FolderNode[];
  documents?: number; // Antall dokumenter i mappen (valgfritt)
}

interface FolderTreeProps {
  folders: FolderNode[];
  selectedFolder: string | null;
  onSelectFolder: (folder: string | null) => void;
  isLoading?: boolean;
}

/**
 * Bygger et mappetre fra en flat liste med mappestier
 * @param paths Liste med mappestier (f.eks ["Dokumenter", "Dokumenter/Rapporter", "Dokumenter/Rapporter/2023"])
 * @returns Hierarkisk trestruktur av mapper
 */
export function buildFolderTree(paths: string[]): FolderNode[] {
  const root: FolderNode[] = [];
  const nodes: { [path: string]: FolderNode } = {};

  // Sorter stier for å sikre at foreldre prosesseres før barn
  const sortedPaths = [...paths].sort((a, b) => a.localeCompare(b));

  sortedPaths.forEach((path) => {
    const parts = path.split("/");
    let currentPath = "";

    parts.forEach((part) => {
      const parentPath = currentPath;

      // Bygg den fulle stien inkrementelt
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      // Hvis noden allerede eksisterer, fortsett
      if (nodes[currentPath]) return;

      // Opprett en ny node
      const newNode: FolderNode = {
        id: currentPath,
        name: part,
        path: currentPath,
        children: [],
      };
      nodes[currentPath] = newNode;

      // Legg til som rot eller som barn
      if (!parentPath) {
        root.push(newNode);
      } else if (nodes[parentPath]) {
        nodes[parentPath].children.push(newNode);
      }
    });
  });

  return root;
}

export const FolderTree: React.FC<FolderTreeProps> = ({
  folders,
  selectedFolder,
  onSelectFolder,
  isLoading = false,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const [searchTerm, setSearchTerm] = useState("");

  // Auto-ekspander første nivå
  useEffect(() => {
    if (folders.length > 0) {
      const initialExpanded = new Set<string>();
      folders.forEach((folder) => initialExpanded.add(folder.id));
      setExpandedFolders(initialExpanded);
    }
  }, [folders]);

  // Auto-ekspander mappe-hierarki når en mappe er valgt
  useEffect(() => {
    if (selectedFolder) {
      const parts = selectedFolder.split("/");
      const newExpanded = new Set(expandedFolders);

      let currentPath = "";
      parts.forEach((part) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        newExpanded.add(currentPath);
      });

      setExpandedFolders(newExpanded);
    }
  }, [selectedFolder]);

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  // Filtrer mappetreet basert på søkeord
  const filterTree = (node: FolderNode, term: string): boolean => {
    if (!term) return true;

    // Sjekk om denne noden matcher
    const nameMatch = node.name.toLowerCase().includes(term.toLowerCase());

    // Sjekk om barn matcher (rekursivt)
    const hasMatchingChild = node.children.some((child) =>
      filterTree(child, term)
    );

    return nameMatch || hasMatchingChild;
  };

  const renderFolderNode = (node: FolderNode, level = 0) => {
    // Skip noder som ikke matcher søket
    if (searchTerm && !filterTree(node, searchTerm)) {
      return null;
    }

    const isExpanded = expandedFolders.has(node.id);
    const isSelected = selectedFolder === node.path;

    return (
      <div key={node.id} className="relative">
        <div
          className={cn(
            "flex items-center py-1 px-1 hover:bg-muted/50 rounded-sm cursor-pointer transition-colors",
            isSelected && "bg-primary/10 font-medium"
          )}
          style={{ paddingLeft: `${level * 16 + 4}px` }}
        >
          {node.children.length > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(node.id);
              }}
              className="p-0.5 mr-1 hover:bg-muted"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <div className="w-5 h-5"></div>
          )}

          <div
            className="flex items-center flex-1 truncate"
            onClick={() => {
              console.log("Selecting folder:", node.path);
              onSelectFolder(node.path);

              // Auto-expand if this folder has children
              if (node.children.length > 0 && !expandedFolders.has(node.id)) {
                toggleFolder(node.id);
              }
            }}
          >
            <Folder className="h-4 w-4 text-amber-500 mr-1.5 flex-shrink-0" />
            <span className="truncate">{node.name}</span>
            {node.documents !== undefined && (
              <span className="text-xs text-muted-foreground ml-1">
                ({node.documents})
              </span>
            )}
          </div>
        </div>

        {isExpanded && node.children.length > 0 && (
          <div className="pl-2">
            {node.children.map((childNode) =>
              renderFolderNode(childNode, level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border rounded-md">
      <div className="p-2 border-b bg-muted/50">
        <div className="font-medium text-sm mb-1">Mapper</div>
        <Input
          placeholder="Søk i mapper..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-8"
        />
      </div>

      {selectedFolder && (
        <div className="px-2 py-1.5 border-b flex gap-1 items-center bg-primary/5">
          <span className="text-xs text-muted-foreground">Valgt mappe:</span>
          <span className="text-xs font-medium truncate flex-1">
            {selectedFolder.split("/").pop()}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={() => onSelectFolder(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <ScrollArea className="h-[500px]">
        <div className="p-2">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Laster mapper...
            </div>
          ) : folders.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Ingen mapper funnet
            </div>
          ) : searchTerm && folders.every((f) => !filterTree(f, searchTerm)) ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Ingen mapper matcher søket
            </div>
          ) : (
            folders.map((folder) => renderFolderNode(folder))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
