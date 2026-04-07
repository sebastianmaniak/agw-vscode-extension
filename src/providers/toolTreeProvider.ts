import * as vscode from 'vscode';
import type { McpTool } from '../types';

export class ToolTreeItem extends vscode.TreeItem {
  constructor(
    public readonly tool: McpTool,
    public enabled: boolean,
  ) {
    super(tool.name, vscode.TreeItemCollapsibleState.None);
    this.description = tool.description;
    this.tooltip = new vscode.MarkdownString(
      `**${tool.name}**\n\n${tool.description}\n\n` +
      '```json\n' + JSON.stringify(tool.inputSchema, null, 2) + '\n```',
    );
    this.iconPath = new vscode.ThemeIcon(
      enabled ? 'check' : 'circle-outline',
    );
    this.contextValue = enabled ? 'tool-enabled' : 'tool-disabled';
  }
}

export class ToolTreeProvider implements vscode.TreeDataProvider<ToolTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ToolTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tools: McpTool[] = [];
  private enabledTools: Set<string> = new Set();
  private items: ToolTreeItem[] = [];

  setTools(tools: McpTool[]): void {
    this.tools = tools;
    for (const tool of tools) {
      if (!this.enabledTools.has(tool.name)) {
        this.enabledTools.add(tool.name);
      }
    }
    this.rebuildItems();
    this._onDidChangeTreeData.fire();
  }

  isToolEnabled(name: string): boolean {
    return this.enabledTools.has(name);
  }

  toggleTool(name: string): void {
    if (this.enabledTools.has(name)) {
      this.enabledTools.delete(name);
    } else {
      this.enabledTools.add(name);
    }
    this.rebuildItems();
    this._onDidChangeTreeData.fire();
  }

  private rebuildItems(): void {
    this.items = this.tools.map(
      (tool) => new ToolTreeItem(tool, this.enabledTools.has(tool.name)),
    );
  }

  getTreeItem(element: ToolTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ToolTreeItem[] {
    return this.items;
  }
}
