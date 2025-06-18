#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

// Shortcut API types
interface ShortcutConfig {
  apiToken: string;
  baseUrl?: string;
}

interface Story {
  id: number;
  name: string;
  description?: string;
  story_type: 'feature' | 'bug' | 'chore';
  workflow_state_id?: number;
  project_id?: number;
  epic_id?: number;
  estimate?: number;
  owner_ids?: string[];
  labels?: Label[];
  [key: string]: any;
}

interface Epic {
  id: number;
  name: string;
  description?: string;
  state?: string;
  [key: string]: any;
}

interface Project {
  id: number;
  name: string;
  description?: string;
  [key: string]: any;
}

interface Label {
  id: number;
  name: string;
  color?: string;
  [key: string]: any;
}

interface Member {
  id: string;
  profile: {
    name: string;
    mention_name: string;
    email_address: string;
  };
  [key: string]: any;
}

interface Iteration {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  [key: string]: any;
}

class ShortcutAPI {
  private config: ShortcutConfig;
  private baseUrl: string;

  constructor(config: ShortcutConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.app.shortcut.com/api/v3';
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Shortcut-Token': this.config.apiToken,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shortcut API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  // Story operations
  async getStories(params?: { 
    project_id?: number; 
    epic_id?: number; 
    includes_description?: boolean;
    workflow_state_id?: number;
  }): Promise<Story[]> {
    const searchParams = new URLSearchParams();
    if (params?.project_id) searchParams.append('project_id', params.project_id.toString());
    if (params?.epic_id) searchParams.append('epic_id', params.epic_id.toString());
    if (params?.includes_description) searchParams.append('includes_description', 'true');
    if (params?.workflow_state_id) searchParams.append('workflow_state_id', params.workflow_state_id.toString());
    
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.makeRequest(`/stories/search${query}`, { method: 'POST', body: JSON.stringify(params || {}) });
  }

  async getStory(id: number): Promise<Story> {
    return this.makeRequest(`/stories/${id}`);
  }

  async createStory(story: Partial<Story>): Promise<Story> {
    return this.makeRequest('/stories', {
      method: 'POST',
      body: JSON.stringify(story),
    });
  }

  async updateStory(id: number, updates: Partial<Story>): Promise<Story> {
    return this.makeRequest(`/stories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteStory(id: number): Promise<void> {
    await this.makeRequest(`/stories/${id}`, { method: 'DELETE' });
  }

  // Epic operations
  async getEpics(): Promise<Epic[]> {
    return this.makeRequest('/epics');
  }

  async getEpic(id: number): Promise<Epic> {
    return this.makeRequest(`/epics/${id}`);
  }

  async createEpic(epic: Partial<Epic>): Promise<Epic> {
    return this.makeRequest('/epics', {
      method: 'POST',
      body: JSON.stringify(epic),
    });
  }

  async updateEpic(id: number, updates: Partial<Epic>): Promise<Epic> {
    return this.makeRequest(`/epics/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Project operations
  async getProjects(): Promise<Project[]> {
    return this.makeRequest('/projects');
  }

  async getProject(id: number): Promise<Project> {
    return this.makeRequest(`/projects/${id}`);
  }

  async createProject(project: Partial<Project>): Promise<Project> {
    return this.makeRequest('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  async updateProject(id: number, updates: Partial<Project>): Promise<Project> {
    return this.makeRequest(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Member operations
  async getMembers(): Promise<Member[]> {
    return this.makeRequest('/members');
  }

  async getCurrentMember(): Promise<Member> {
    return this.makeRequest('/member');
  }

  // Label operations
  async getLabels(): Promise<Label[]> {
    return this.makeRequest('/labels');
  }

  async createLabel(label: Partial<Label>): Promise<Label> {
    return this.makeRequest('/labels', {
      method: 'POST',
      body: JSON.stringify(label),
    });
  }

  // Iteration operations
  async getIterations(): Promise<Iteration[]> {
    return this.makeRequest('/iterations');
  }

  async getIteration(id: number): Promise<Iteration> {
    return this.makeRequest(`/iterations/${id}`);
  }

  async createIteration(iteration: Partial<Iteration>): Promise<Iteration> {
    return this.makeRequest('/iterations', {
      method: 'POST',
      body: JSON.stringify(iteration),
    });
  }

  // Search operations
  async search(query: string, detail: 'full' | 'slim' = 'full'): Promise<any> {
    return this.makeRequest(`/search?query=${encodeURIComponent(query)}&detail=${detail}`);
  }

  // Workflow operations
  async getWorkflows(): Promise<any[]> {
    return this.makeRequest('/workflows');
  }
}

class ShortcutMCPServer {
  private server: Server;
  private shortcutAPI: ShortcutAPI | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "shortcut-server",
        version: "0.1.0",
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "shortcut_configure",
            description: "Configure Shortcut API connection with API token",
            inputSchema: {
              type: "object",
              properties: {
                apiToken: {
                  type: "string",
                  description: "Shortcut API token"
                },
                baseUrl: {
                  type: "string",
                  description: "Base URL for Shortcut API (optional)",
                  default: "https://api.app.shortcut.com/api/v3"
                }
              },
              required: ["apiToken"]
            }
          },
          {
            name: "shortcut_get_stories",
            description: "Get stories with optional filtering",
            inputSchema: {
              type: "object",
              properties: {
                project_id: {
                  type: "number",
                  description: "Filter by project ID"
                },
                epic_id: {
                  type: "number", 
                  description: "Filter by epic ID"
                },
                workflow_state_id: {
                  type: "number",
                  description: "Filter by workflow state ID"
                },
                includes_description: {
                  type: "boolean",
                  description: "Include story descriptions"
                }
              }
            }
          },
          {
            name: "shortcut_get_story",
            description: "Get a specific story by ID",
            inputSchema: {
              type: "object",
              properties: {
                id: {
                  type: "number",
                  description: "Story ID"
                }
              },
              required: ["id"]
            }
          },
          {
            name: "shortcut_create_story",
            description: "Create a new story",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Story name"
                },
                description: {
                  type: "string",
                  description: "Story description"
                },
                story_type: {
                  type: "string",
                  enum: ["feature", "bug", "chore"],
                  description: "Type of story"
                },
                project_id: {
                  type: "number",
                  description: "Project ID"
                },
                epic_id: {
                  type: "number",
                  description: "Epic ID"
                },
                estimate: {
                  type: "number",
                  description: "Story point estimate"
                },
                workflow_state_id: {
                  type: "number",
                  description: "Workflow state ID"
                },
                owner_ids: {
                  type: "array",
                  items: { type: "string" },
                  description: "Array of owner IDs"
                }
              },
              required: ["name"]
            }
          },
          {
            name: "shortcut_update_story",
            description: "Update an existing story",
            inputSchema: {
              type: "object",
              properties: {
                id: {
                  type: "number",
                  description: "Story ID"
                },
                name: {
                  type: "string",
                  description: "Story name"
                },
                description: {
                  type: "string",
                  description: "Story description"
                },
                story_type: {
                  type: "string",
                  enum: ["feature", "bug", "chore"],
                  description: "Type of story"
                },
                workflow_state_id: {
                  type: "number",
                  description: "Workflow state ID"
                },
                estimate: {
                  type: "number",
                  description: "Story point estimate"
                },
                owner_ids: {
                  type: "array",
                  items: { type: "string" },
                  description: "Array of owner IDs"
                }
              },
              required: ["id"]
            }
          },
          {
            name: "shortcut_delete_story",
            description: "Delete a story",
            inputSchema: {
              type: "object",
              properties: {
                id: {
                  type: "number",
                  description: "Story ID"
                }
              },
              required: ["id"]
            }
          },
          {
            name: "shortcut_get_epics",
            description: "Get all epics",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "shortcut_get_epic",
            description: "Get a specific epic by ID",
            inputSchema: {
              type: "object",
              properties: {
                id: {
                  type: "number",
                  description: "Epic ID"
                }
              },
              required: ["id"]
            }
          },
          {
            name: "shortcut_create_epic",
            description: "Create a new epic",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Epic name"
                },
                description: {
                  type: "string",
                  description: "Epic description"
                },
                state: {
                  type: "string",
                  description: "Epic state"
                }
              },
              required: ["name"]
            }
          },
          {
            name: "shortcut_update_epic",
            description: "Update an existing epic",
            inputSchema: {
              type: "object",
              properties: {
                id: {
                  type: "number",
                  description: "Epic ID"
                },
                name: {
                  type: "string",
                  description: "Epic name"
                },
                description: {
                  type: "string",
                  description: "Epic description"
                },
                state: {
                  type: "string",
                  description: "Epic state"
                }
              },
              required: ["id"]
            }
          },
          {
            name: "shortcut_get_projects",
            description: "Get all projects",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "shortcut_get_project",
            description: "Get a specific project by ID",
            inputSchema: {
              type: "object",
              properties: {
                id: {
                  type: "number",
                  description: "Project ID"
                }
              },
              required: ["id"]
            }
          },
          {
            name: "shortcut_create_project",
            description: "Create a new project",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Project name"
                },
                description: {
                  type: "string",
                  description: "Project description"
                },
                team_id: {
                  type: "number",
                  description: "Team ID"
                }
              },
              required: ["name", "team_id"]
            }
          },
          {
            name: "shortcut_get_members",
            description: "Get all workspace members",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "shortcut_get_current_member",
            description: "Get current authenticated member info",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "shortcut_get_labels",
            description: "Get all labels",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "shortcut_create_label",
            description: "Create a new label",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Label name"
                },
                color: {
                  type: "string",
                  description: "Label color (hex format)"
                },
                description: {
                  type: "string",
                  description: "Label description"
                }
              },
              required: ["name"]
            }
          },
          {
            name: "shortcut_get_iterations",
            description: "Get all iterations",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "shortcut_get_iteration",
            description: "Get a specific iteration by ID",
            inputSchema: {
              type: "object",
              properties: {
                id: {
                  type: "number",
                  description: "Iteration ID"
                }
              },
              required: ["id"]
            }
          },
          {
            name: "shortcut_create_iteration",
            description: "Create a new iteration",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Iteration name"
                },
                start_date: {
                  type: "string",
                  description: "Start date (YYYY-MM-DD)"
                },
                end_date: {
                  type: "string",
                  description: "End date (YYYY-MM-DD)"
                },
                description: {
                  type: "string",
                  description: "Iteration description"
                }
              },
              required: ["name", "start_date", "end_date"]
            }
          },
          {
            name: "shortcut_search",
            description: "Search across Shortcut entities",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query"
                },
                detail: {
                  type: "string",
                  enum: ["full", "slim"],
                  description: "Level of detail in results",
                  default: "full"
                }
              },
              required: ["query"]
            }
          },
          {
            name: "shortcut_get_workflows",
            description: "Get all workflows",
            inputSchema: {
              type: "object",
              properties: {}
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        if (!this.shortcutAPI && request.params.name !== "shortcut_configure") {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "Shortcut API not configured. Please run shortcut_configure first."
          );
        }

        switch (request.params.name) {
          case "shortcut_configure":
            return await this.handleConfigure(request.params.arguments);

          case "shortcut_get_stories":
            return await this.handleGetStories(request.params.arguments);

          case "shortcut_get_story":
            return await this.handleGetStory(request.params.arguments);

          case "shortcut_create_story":
            return await this.handleCreateStory(request.params.arguments);

          case "shortcut_update_story":
            return await this.handleUpdateStory(request.params.arguments);

          case "shortcut_delete_story":
            return await this.handleDeleteStory(request.params.arguments);

          case "shortcut_get_epics":
            return await this.handleGetEpics();

          case "shortcut_get_epic":
            return await this.handleGetEpic(request.params.arguments);

          case "shortcut_create_epic":
            return await this.handleCreateEpic(request.params.arguments);

          case "shortcut_update_epic":
            return await this.handleUpdateEpic(request.params.arguments);

          case "shortcut_get_projects":
            return await this.handleGetProjects();

          case "shortcut_get_project":
            return await this.handleGetProject(request.params.arguments);

          case "shortcut_create_project":
            return await this.handleCreateProject(request.params.arguments);

          case "shortcut_get_members":
            return await this.handleGetMembers();

          case "shortcut_get_current_member":
            return await this.handleGetCurrentMember();

          case "shortcut_get_labels":
            return await this.handleGetLabels();

          case "shortcut_create_label":
            return await this.handleCreateLabel(request.params.arguments);

          case "shortcut_get_iterations":
            return await this.handleGetIterations();

          case "shortcut_get_iteration":
            return await this.handleGetIteration(request.params.arguments);

          case "shortcut_create_iteration":
            return await this.handleCreateIteration(request.params.arguments);

          case "shortcut_search":
            return await this.handleSearch(request.params.arguments);

          case "shortcut_get_workflows":
            return await this.handleGetWorkflows();

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing ${request.params.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async handleConfigure(args: any) {
    const { apiToken, baseUrl } = args;
    this.shortcutAPI = new ShortcutAPI({ apiToken, baseUrl });
    
    // Test the connection
    try {
      await this.shortcutAPI.getCurrentMember();
      return {
        content: [
          {
            type: "text",
            text: "Shortcut API configured successfully!"
          }
        ]
      };
    } catch (error) {
      this.shortcutAPI = null;
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Failed to configure Shortcut API: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleGetStories(args: any) {
    const stories = await this.shortcutAPI!.getStories(args);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(stories, null, 2)
        }
      ]
    };
  }

  private async handleGetStory(args: any) {
    const { id } = args;
    const story = await this.shortcutAPI!.getStory(id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(story, null, 2)
        }
      ]
    };
  }

  private async handleCreateStory(args: any) {
    const story = await this.shortcutAPI!.createStory(args);
    return {
      content: [
        {
          type: "text",
          text: `Story created successfully!\n${JSON.stringify(story, null, 2)}`
        }
      ]
    };
  }

  private async handleUpdateStory(args: any) {
    const { id, ...updates } = args;
    const story = await this.shortcutAPI!.updateStory(id, updates);
    return {
      content: [
        {
          type: "text",
          text: `Story updated successfully!\n${JSON.stringify(story, null, 2)}`
        }
      ]
    };
  }

  private async handleDeleteStory(args: any) {
    const { id } = args;
    await this.shortcutAPI!.deleteStory(id);
    return {
      content: [
        {
          type: "text",
          text: `Story ${id} deleted successfully!`
        }
      ]
    };
  }

  private async handleGetEpics() {
    const epics = await this.shortcutAPI!.getEpics();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(epics, null, 2)
        }
      ]
    };
  }

  private async handleGetEpic(args: any) {
    const { id } = args;
    const epic = await this.shortcutAPI!.getEpic(id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(epic, null, 2)
        }
      ]
    };
  }

  private async handleCreateEpic(args: any) {
    const epic = await this.shortcutAPI!.createEpic(args);
    return {
      content: [
        {
          type: "text",
          text: `Epic created successfully!\n${JSON.stringify(epic, null, 2)}`
        }
      ]
    };
  }

  private async handleUpdateEpic(args: any) {
    const { id, ...updates } = args;
    const epic = await this.shortcutAPI!.updateEpic(id, updates);
    return {
      content: [
        {
          type: "text",
          text: `Epic updated successfully!\n${JSON.stringify(epic, null, 2)}`
        }
      ]
    };
  }

  private async handleGetProjects() {
    const projects = await this.shortcutAPI!.getProjects();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(projects, null, 2)
        }
      ]
    };
  }

  private async handleGetProject(args: any) {
    const { id } = args;
    const project = await this.shortcutAPI!.getProject(id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(project, null, 2)
        }
      ]
    };
  }

  private async handleCreateProject(args: any) {
    const project = await this.shortcutAPI!.createProject(args);
    return {
      content: [
        {
          type: "text",
          text: `Project created successfully!\n${JSON.stringify(project, null, 2)}`
        }
      ]
    };
  }

  private async handleGetMembers() {
    const members = await this.shortcutAPI!.getMembers();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(members, null, 2)
        }
      ]
    };
  }

  private async handleGetCurrentMember() {
    const member = await this.shortcutAPI!.getCurrentMember();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(member, null, 2)
        }
      ]
    };
  }

  private async handleGetLabels() {
    const labels = await this.shortcutAPI!.getLabels();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(labels, null, 2)
        }
      ]
    };
  }

  private async handleCreateLabel(args: any) {
    const label = await this.shortcutAPI!.createLabel(args);
    return {
      content: [
        {
          type: "text",
          text: `Label created successfully!\n${JSON.stringify(label, null, 2)}`
        }
      ]
    };
  }

  private async handleGetIterations() {
    const iterations = await this.shortcutAPI!.getIterations();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(iterations, null, 2)
        }
      ]
    };
  }

  private async handleGetIteration(args: any) {
    const { id } = args;
    const iteration = await this.shortcutAPI!.getIteration(id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(iteration, null, 2)
        }
      ]
    };
  }

  private async handleCreateIteration(args: any) {
    const iteration = await this.shortcutAPI!.createIteration(args);
    return {
      content: [
        {
          type: "text",
          text: `Iteration created successfully!\n${JSON.stringify(iteration, null, 2)}`
        }
      ]
    };
  }

  private async handleSearch(args: any) {
    const { query, detail = 'full' } = args;
    const results = await this.shortcutAPI!.search(query, detail);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2)
        }
      ]
    };
  }

  private async handleGetWorkflows() {
    const workflows = await this.shortcutAPI!.getWorkflows();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(workflows, null, 2)
        }
      ]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Shortcut MCP server running on stdio");
  }
}

const server = new ShortcutMCPServer();
server.run().catch(console.error);