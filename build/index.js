#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from "@modelcontextprotocol/sdk/types.js";
class ShortcutAPI {
    config;
    baseUrl;
    constructor(config) {
        this.config = config;
        this.baseUrl = config.baseUrl || 'https://api.app.shortcut.com/api/v3';
    }
    async makeRequest(endpoint, options = {}) {
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
    async getStories(params) {
        const searchParams = new URLSearchParams();
        if (params?.project_id)
            searchParams.append('project_id', params.project_id.toString());
        if (params?.epic_id)
            searchParams.append('epic_id', params.epic_id.toString());
        if (params?.includes_description)
            searchParams.append('includes_description', 'true');
        if (params?.workflow_state_id)
            searchParams.append('workflow_state_id', params.workflow_state_id.toString());
        const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
        return this.makeRequest(`/stories/search${query}`, { method: 'POST', body: JSON.stringify(params || {}) });
    }
    async getStory(id) {
        return this.makeRequest(`/stories/${id}`);
    }
    async createStory(story) {
        return this.makeRequest('/stories', {
            method: 'POST',
            body: JSON.stringify(story),
        });
    }
    async updateStory(id, updates) {
        return this.makeRequest(`/stories/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }
    async deleteStory(id) {
        await this.makeRequest(`/stories/${id}`, { method: 'DELETE' });
    }
    // Epic operations
    async getEpics() {
        return this.makeRequest('/epics');
    }
    async getEpic(id) {
        return this.makeRequest(`/epics/${id}`);
    }
    async createEpic(epic) {
        return this.makeRequest('/epics', {
            method: 'POST',
            body: JSON.stringify(epic),
        });
    }
    async updateEpic(id, updates) {
        return this.makeRequest(`/epics/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }
    // Project operations
    async getProjects() {
        return this.makeRequest('/projects');
    }
    async getProject(id) {
        return this.makeRequest(`/projects/${id}`);
    }
    async createProject(project) {
        return this.makeRequest('/projects', {
            method: 'POST',
            body: JSON.stringify(project),
        });
    }
    async updateProject(id, updates) {
        return this.makeRequest(`/projects/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }
    // Member operations
    async getMembers() {
        return this.makeRequest('/members');
    }
    async getCurrentMember() {
        return this.makeRequest('/member');
    }
    // Label operations
    async getLabels() {
        return this.makeRequest('/labels');
    }
    async createLabel(label) {
        return this.makeRequest('/labels', {
            method: 'POST',
            body: JSON.stringify(label),
        });
    }
    // Iteration operations
    async getIterations() {
        return this.makeRequest('/iterations');
    }
    async getIteration(id) {
        return this.makeRequest(`/iterations/${id}`);
    }
    async createIteration(iteration) {
        return this.makeRequest('/iterations', {
            method: 'POST',
            body: JSON.stringify(iteration),
        });
    }
    // Search operations
    async search(query, detail = 'full') {
        return this.makeRequest(`/search?query=${encodeURIComponent(query)}&detail=${detail}`);
    }
    // Workflow operations
    async getWorkflows() {
        return this.makeRequest('/workflows');
    }
}
class ShortcutMCPServer {
    server;
    shortcutAPI = null;
    constructor() {
        this.server = new Server({
            name: "shortcut-server",
            version: "0.1.0",
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
    }
    setupToolHandlers() {
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
                    throw new McpError(ErrorCode.InvalidRequest, "Shortcut API not configured. Please run shortcut_configure first.");
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
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
                }
            }
            catch (error) {
                if (error instanceof McpError) {
                    throw error;
                }
                throw new McpError(ErrorCode.InternalError, `Error executing ${request.params.name}: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
    async handleConfigure(args) {
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
        }
        catch (error) {
            this.shortcutAPI = null;
            throw new McpError(ErrorCode.InvalidRequest, `Failed to configure Shortcut API: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async handleGetStories(args) {
        const stories = await this.shortcutAPI.getStories(args);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(stories, null, 2)
                }
            ]
        };
    }
    async handleGetStory(args) {
        const { id } = args;
        const story = await this.shortcutAPI.getStory(id);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(story, null, 2)
                }
            ]
        };
    }
    async handleCreateStory(args) {
        const story = await this.shortcutAPI.createStory(args);
        return {
            content: [
                {
                    type: "text",
                    text: `Story created successfully!\n${JSON.stringify(story, null, 2)}`
                }
            ]
        };
    }
    async handleUpdateStory(args) {
        const { id, ...updates } = args;
        const story = await this.shortcutAPI.updateStory(id, updates);
        return {
            content: [
                {
                    type: "text",
                    text: `Story updated successfully!\n${JSON.stringify(story, null, 2)}`
                }
            ]
        };
    }
    async handleDeleteStory(args) {
        const { id } = args;
        await this.shortcutAPI.deleteStory(id);
        return {
            content: [
                {
                    type: "text",
                    text: `Story ${id} deleted successfully!`
                }
            ]
        };
    }
    async handleGetEpics() {
        const epics = await this.shortcutAPI.getEpics();
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(epics, null, 2)
                }
            ]
        };
    }
    async handleGetEpic(args) {
        const { id } = args;
        const epic = await this.shortcutAPI.getEpic(id);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(epic, null, 2)
                }
            ]
        };
    }
    async handleCreateEpic(args) {
        const epic = await this.shortcutAPI.createEpic(args);
        return {
            content: [
                {
                    type: "text",
                    text: `Epic created successfully!\n${JSON.stringify(epic, null, 2)}`
                }
            ]
        };
    }
    async handleUpdateEpic(args) {
        const { id, ...updates } = args;
        const epic = await this.shortcutAPI.updateEpic(id, updates);
        return {
            content: [
                {
                    type: "text",
                    text: `Epic updated successfully!\n${JSON.stringify(epic, null, 2)}`
                }
            ]
        };
    }
    async handleGetProjects() {
        const projects = await this.shortcutAPI.getProjects();
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(projects, null, 2)
                }
            ]
        };
    }
    async handleGetProject(args) {
        const { id } = args;
        const project = await this.shortcutAPI.getProject(id);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(project, null, 2)
                }
            ]
        };
    }
    async handleCreateProject(args) {
        const project = await this.shortcutAPI.createProject(args);
        return {
            content: [
                {
                    type: "text",
                    text: `Project created successfully!\n${JSON.stringify(project, null, 2)}`
                }
            ]
        };
    }
    async handleGetMembers() {
        const members = await this.shortcutAPI.getMembers();
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(members, null, 2)
                }
            ]
        };
    }
    async handleGetCurrentMember() {
        const member = await this.shortcutAPI.getCurrentMember();
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(member, null, 2)
                }
            ]
        };
    }
    async handleGetLabels() {
        const labels = await this.shortcutAPI.getLabels();
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(labels, null, 2)
                }
            ]
        };
    }
    async handleCreateLabel(args) {
        const label = await this.shortcutAPI.createLabel(args);
        return {
            content: [
                {
                    type: "text",
                    text: `Label created successfully!\n${JSON.stringify(label, null, 2)}`
                }
            ]
        };
    }
    async handleGetIterations() {
        const iterations = await this.shortcutAPI.getIterations();
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(iterations, null, 2)
                }
            ]
        };
    }
    async handleGetIteration(args) {
        const { id } = args;
        const iteration = await this.shortcutAPI.getIteration(id);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(iteration, null, 2)
                }
            ]
        };
    }
    async handleCreateIteration(args) {
        const iteration = await this.shortcutAPI.createIteration(args);
        return {
            content: [
                {
                    type: "text",
                    text: `Iteration created successfully!\n${JSON.stringify(iteration, null, 2)}`
                }
            ]
        };
    }
    async handleSearch(args) {
        const { query, detail = 'full' } = args;
        const results = await this.shortcutAPI.search(query, detail);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(results, null, 2)
                }
            ]
        };
    }
    async handleGetWorkflows() {
        const workflows = await this.shortcutAPI.getWorkflows();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUVBLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUNuRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUNqRixPQUFPLEVBQ0wscUJBQXFCLEVBQ3JCLFNBQVMsRUFDVCxzQkFBc0IsRUFDdEIsUUFBUSxHQUNULE1BQU0sb0NBQW9DLENBQUM7QUE4RDVDLE1BQU0sV0FBVztJQUNQLE1BQU0sQ0FBaUI7SUFDdkIsT0FBTyxDQUFTO0lBRXhCLFlBQVksTUFBc0I7UUFDaEMsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDckIsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsT0FBTyxJQUFJLHFDQUFxQyxDQUFDO0lBQ3pFLENBQUM7SUFFTyxLQUFLLENBQUMsV0FBVyxDQUFDLFFBQWdCLEVBQUUsVUFBdUIsRUFBRTtRQUNuRSxNQUFNLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLEdBQUcsUUFBUSxFQUFFLENBQUM7UUFDekMsTUFBTSxPQUFPLEdBQUc7WUFDZCxjQUFjLEVBQUUsa0JBQWtCO1lBQ2xDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUTtZQUN0QyxHQUFHLE9BQU8sQ0FBQyxPQUFPO1NBQ25CLENBQUM7UUFFRixNQUFNLFFBQVEsR0FBRyxNQUFNLEtBQUssQ0FBQyxHQUFHLEVBQUU7WUFDaEMsR0FBRyxPQUFPO1lBQ1YsT0FBTztTQUNSLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDakIsTUFBTSxTQUFTLEdBQUcsTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDeEMsTUFBTSxJQUFJLEtBQUssQ0FBQyx1QkFBdUIsUUFBUSxDQUFDLE1BQU0sTUFBTSxT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