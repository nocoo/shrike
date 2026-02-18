"use client";

import Image from "next/image";
import { ArrowLeft, Github } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AboutPageProps {
  onBack: () => void;
}

export function AboutPage({ onBack }: AboutPageProps) {
  return (
    <div className="flex h-screen flex-col pt-[74px]" onContextMenu={(e) => e.preventDefault()}>
      {/* About header with back button */}
      <header
        data-tauri-drag-region
        className="fixed top-0 right-0 left-0 z-50 border-b bg-background"
      >
        <div data-tauri-drag-region className="h-[38px]" />
        <div
          data-tauri-drag-region
          className="flex items-center gap-2 px-4 pb-3"
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-base font-semibold">About</h1>
        </div>
      </header>

      {/* About content — centered */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Image
          src="/logo-512.png"
          alt="Shrike"
          width={80}
          height={80}
          className="rounded-lg"
        />
        <div className="text-center">
          <p className="text-base font-semibold">Shrike</p>
          <p className="text-sm text-muted-foreground">v0.1.0</p>
        </div>
        <a
          href="https://github.com/nocoo/shrike"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="GitHub"
        >
          <Github className="h-5 w-5" />
        </a>
      </div>
    </div>
  );
}
