"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
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
import { useLocale } from "@/lib/i18n";
import type { AppSettings, Theme, Language } from "@/lib/types";

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const { t, setLanguage } = useLocale();
  const { setTheme } = useTheme();

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => toast.error(t("error.loadFailed")));
  }, [t]);

  // Sync loaded settings to theme/locale providers
  useEffect(() => {
    if (!settings) return;
    // Map our "auto" to next-themes "system"
    setTheme(settings.theme === "auto" ? "system" : settings.theme);
    setLanguage(settings.language);
  }, [settings?.theme, settings?.language, setTheme, setLanguage]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await updateSettings(settings);
      onBack();
    } catch (err) {
      console.error("Failed to save settings:", err);
      toast.error(t("error.saveFailed"));
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
      toast.error(t("error.settingFailed"));
    }
  };

  const handleTrayVisible = async (visible: boolean) => {
    try {
      await setTrayVisible(visible);
      setSettings((s) => (s ? { ...s, show_tray_icon: visible } : s));
    } catch (err) {
      console.error("Failed to set tray visibility:", err);
      toast.error(t("error.settingFailed"));
    }
  };

  const handleDockVisible = async (visible: boolean) => {
    try {
      await setDockVisible(visible);
      setSettings((s) => (s ? { ...s, show_dock_icon: visible } : s));
    } catch (err) {
      console.error("Failed to set dock visibility:", err);
      toast.error(t("error.settingFailed"));
    }
  };

  const handleThemeChange = async (theme: Theme) => {
    if (!settings) return;
    const updated = { ...settings, theme };
    setSettings(updated);
    try {
      await updateSettings(updated);
    } catch (err) {
      console.error("Failed to save theme:", err);
      toast.error(t("error.settingFailed"));
    }
  };

  const handleLanguageChange = async (language: Language) => {
    if (!settings) return;
    const updated = { ...settings, language };
    setSettings(updated);
    try {
      await updateSettings(updated);
    } catch (err) {
      console.error("Failed to save language:", err);
      toast.error(t("error.settingFailed"));
    }
  };

  return (
    <div
      className="flex h-screen flex-col pt-[74px]"
      onContextMenu={(e) => e.preventDefault()}
    >
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
          <h1 className="text-base font-semibold">{t("title.settings")}</h1>
        </div>
      </header>

      {/* Settings content — scrollable area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {settings && (
          <div className="space-y-5">
            {/* General section */}
            <section className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("settings.general")}
              </h2>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("settings.launchAtLogin")}</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {t("settings.launchAtLoginDesc")}
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
                  <Label>{t("settings.showInMenuBar")}</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {t("settings.showInMenuBarDesc")}
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
                  <Label>{t("settings.showInDock")}</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {t("settings.showInDockDesc")}
                  </p>
                </div>
                <Switch
                  checked={settings.show_dock_icon}
                  onCheckedChange={handleDockVisible}
                  size="sm"
                />
              </div>
            </section>

            {/* Appearance section */}
            <section className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("settings.appearance")}
              </h2>

              <div className="space-y-1.5">
                <Label>{t("settings.theme")}</Label>
                <div className="flex gap-1">
                  {(["auto", "light", "dark"] as const).map((value) => (
                    <Button
                      key={value}
                      variant={settings.theme === value ? "default" : "outline"}
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => handleThemeChange(value)}
                    >
                      {t(
                        `settings.theme${value.charAt(0).toUpperCase()}${value.slice(1)}` as Parameters<
                          typeof t
                        >[0]
                      )}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t("settings.language")}</Label>
                <div className="flex gap-1">
                  {[
                    {
                      value: "auto" as const,
                      label: t("settings.languageAuto"),
                    },
                    { value: "zh" as const, label: "中文" },
                    { value: "en" as const, label: "English" },
                  ].map(({ value, label }) => (
                    <Button
                      key={value}
                      variant={
                        settings.language === value ? "default" : "outline"
                      }
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => handleLanguageChange(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </section>

            {/* Sync section */}
            <section className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("settings.sync")}
              </h2>

              <div className="space-y-1.5">
                <Label htmlFor="gdrive-path">{t("settings.gdrivePath")}</Label>
                <Input
                  id="gdrive-path"
                  value={settings.gdrive_path}
                  onChange={(e) =>
                    setSettings({ ...settings, gdrive_path: e.target.value })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("settings.gdrivePathDesc")}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="backup-dir">
                  {t("settings.backupDirName")}
                </Label>
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
                <Label htmlFor="machine-name">
                  {t("settings.machineName")}
                </Label>
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
                  {t("settings.machineNameDesc")}
                </p>
              </div>
            </section>

            {/* Webhook section */}
            <section className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("settings.webhook")}
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="webhook-port">{t("settings.port")}</Label>
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
                    {copied ? t("settings.copied") : t("settings.copyCurl")}
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
            {saving ? t("settings.saving") : t("settings.save")}
          </Button>
        </div>
      )}
    </div>
  );
}
