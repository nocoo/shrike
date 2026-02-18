"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSettings, updateSettings } from "@/lib/commands";
import type { AppSettings } from "@/lib/types";

interface SettingsDialogProps {
  children: ReactNode;
}

export function SettingsDialog({ children }: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      getSettings().then(setSettings).catch(console.error);
      setCopied(false);
    }
  }, [open]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await updateSettings(settings);
      setOpen(false);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        {settings && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gdrive-path">Google Drive Path</Label>
              <Input
                id="gdrive-path"
                value={settings.gdrive_path}
                onChange={(e) =>
                  setSettings({ ...settings, gdrive_path: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Path to your Google Drive mount directory
              </p>
            </div>

            <div className="space-y-2">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="webhook-port">Webhook Port</Label>
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
                  className="w-full gap-2"
                  onClick={handleCopyWebhook}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Copied!" : "Copy Webhook"}
                </Button>
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full"
            >
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
