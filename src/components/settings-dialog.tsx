"use client";

import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
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

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      getSettings().then(setSettings).catch(console.error);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
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
                      webhook_port: parseInt(e.target.value, 10) || 18888,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-token">Webhook Token</Label>
                <Input
                  id="webhook-token"
                  value={settings.webhook_token}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      webhook_token: e.target.value,
                    })
                  }
                />
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
