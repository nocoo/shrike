"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getSettings,
  updateSettings,
  setAutostart,
  setTrayVisible,
  setDockVisible,
} from "@/lib/commands";
import type { AppSettings } from "@/lib/types";

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await updateSettings(settings);
      onBack();
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyWebhook = useCallback(async () => {
    if (!settings) return;
    const url = `curl -X POST http://localhost:${settings.webhook_port}/sync -H "Authorization: Bearer ${settings.webhook_token}"`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [settings]);

  const handleAutostart = async (enabled: boolean) => {
    try {
      await setAutostart(enabled);
      setSettings((s) => (s ? { ...s, autostart: enabled } : s));
    } catch (err) {
      console.error("Failed to set autostart:", err);
    }
  };

  const handleTrayVisible = async (visible: boolean) => {
    try {
      await setTrayVisible(visible);
      setSettings((s) => (s ? { ...s, show_tray_icon: visible } : s));
    } catch (err) {
      console.error("Failed to set tray visibility:", err);
    }
  };

  const handleDockVisible = async (visible: boolean) => {
    try {
      await setDockVisible(visible);
      setSettings((s) => (s ? { ...s, show_dock_icon: visible } : s));
    } catch (err) {
      console.error("Failed to set dock visibility:", err);
    }
  };

  return (
    <div className="flex h-screen flex-col pt-[74px]" onContextMenu={(e) => e.preventDefault()}>
      {/* Settings header with back button */}
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
          <h1 className="text-base font-semibold">Settings</h1>
        </div>
      </header>

      {/* Settings content — scrollable area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {settings && (
          <div className="space-y-5">
            {/* General section */}
            <section className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                General
              </h2>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Launch at Login</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Start Shrike when you log in
                  </p>
                </div>
                <Switch
                  checked={settings.autostart}
                  onCheckedChange={handleAutostart}
                  size="sm"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show in Menu Bar</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Display tray icon in the menu bar
                  </p>
                </div>
                <Switch
                  checked={settings.show_tray_icon}
                  onCheckedChange={handleTrayVisible}
                  size="sm"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show in Dock</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Display app icon in the macOS Dock
                  </p>
                </div>
                <Switch
                  checked={settings.show_dock_icon}
                  onCheckedChange={handleDockVisible}
                  size="sm"
                />
              </div>
            </section>

            {/* Sync section */}
            <section className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Sync
              </h2>

              <div className="space-y-1.5">
                <Label htmlFor="gdrive-path">Google Drive Path</Label>
                <Input
                  id="gdrive-path"
                  value={settings.gdrive_path}
                  onChange={(e) =>
                    setSettings({ ...settings, gdrive_path: e.target.value })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Path to your Google Drive mount directory
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="backup-dir">Backup Directory Name</Label>
                <Input
                  id="backup-dir"
                  value={settings.backup_dir_name}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      backup_dir_name: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="machine-name">Machine Name</Label>
                <Input
                  id="machine-name"
                  value={settings.machine_name}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      machine_name: e.target.value,
                    })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Subfolder per device for multi-machine backup
                </p>
              </div>
            </section>

            {/* Webhook section */}
            <section className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Webhook
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="webhook-port">Port</Label>
                  <Input
                    id="webhook-port"
                    type="number"
                    value={settings.webhook_port}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        webhook_port: parseInt(e.target.value, 10) || 7022,
                      })
                    }
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={handleCopyWebhook}
                  >
                    {copied ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copied ? "Copied!" : "Copy curl"}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Save button — sticky bottom */}
      {settings && (
        <div className="border-t px-4 py-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="w-full"
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      )}
    </div>
  );
}
