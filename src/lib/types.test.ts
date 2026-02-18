import { describe, it, expect } from "vitest";
import type { BackupEntry, AppSettings, SyncResult, AgentTree, TreeChild } from "./types";

describe("types", () => {
  it("BackupEntry shape matches expected structure", () => {
    const entry: BackupEntry = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      path: "/Users/nocoo/.zshrc",
      item_type: "file",
      added_at: "2026-02-18T00:00:00Z",
      last_synced: null,
    };
    expect(entry.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(entry.item_type).toBe("file");
    expect(entry.last_synced).toBeNull();
  });

  it("AppSettings shape matches expected structure", () => {
    const settings: AppSettings = {
      gdrive_path: "/mnt/gdrive",
      backup_dir_name: "ShrikeBackup",
      machine_name: "TestMac",
      webhook_port: 7022,
      webhook_token: "test-token",
      show_tray_icon: true,
      show_dock_icon: true,
      autostart: false,
    };
    expect(settings.webhook_port).toBe(7022);
    expect(settings.backup_dir_name).toBe("ShrikeBackup");
    expect(settings.machine_name).toBe("TestMac");
    expect(settings.show_tray_icon).toBe(true);
    expect(settings.show_dock_icon).toBe(true);
    expect(settings.autostart).toBe(false);
  });

  it("SyncResult shape matches expected structure", () => {
    const result: SyncResult = {
      files_transferred: 10,
      dirs_transferred: 3,
      bytes_transferred: 2048,
      stdout: "sent 2048 bytes",
      stderr: "",
      exit_code: 0,
      synced_at: "2026-02-18T12:00:00Z",
    };
    expect(result.exit_code).toBe(0);
    expect(result.files_transferred).toBe(10);
    expect(result.dirs_transferred).toBe(3);
  });

  it("AgentTree shape matches expected structure", () => {
    const child: TreeChild = {
      name: "settings.json",
      path: "/Users/test/.claude/settings.json",
      item_type: "file",
    };
    const sibling: TreeChild = {
      name: ".claude.json",
      path: "/Users/test/.claude.json",
      item_type: "file",
    };
    const tree: AgentTree = {
      agent: "Claude Code",
      path: "/Users/test/.claude",
      item_type: "directory",
      children: [child],
      siblings: [sibling],
    };
    expect(tree.agent).toBe("Claude Code");
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].name).toBe("settings.json");
    expect(tree.siblings).toHaveLength(1);
    expect(tree.siblings[0].name).toBe(".claude.json");
  });
});
