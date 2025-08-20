const express = require('express');
const { Client } = require('@notionhq/client');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY
});

// Database IDs from your Notion setup
const databases = {
  projects_master: "01cfe614924742bbb279fb0867d7bbb3",
  tasks_master: "8409a75733154a03b37c36328b3e51ad",
  people_crm: "55f32e1e9e964fcabba4c5a4131c0dac",
  organizations: "5649c9c52ca24ad0b629cb4b75b7541e",
  documents_library: "5f0241a1c6ff416da0ed1807103124b2",
  events_master: "2093fed156534797af9a767e48253da1",
  categories_master: "710cfb68416841cb990c83ed59fdcd66",
  food_recipes: "f5d8919b9738497f8be93451a4c935de",
  food_meal_plans: "a554f6c6927b480295620f565837c5fe",
  food_grocery_lists: "3238125719d74267ad44e398ffde8263",
  agents_registry: "110dabe7f8cf4cd3b7eb97bd0de7876e",
  permissions_matrix: "0c7bc821d8af4354bc85832b237ede6a",
  activity_log: "697d8bf4d6d94089bc78507c3a252708",
  agent_memory: "625553863c934debac52fe62cab34dd0"
};

// Store processed idempotency keys (in production, use Redis)
const processedKeys = new Set();

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Blair AI v2.0 Router Active',
    version: '2.0.0',
    endpoint: '/api/agent',
    databases: Object.keys(databases).length,
    notion_connected: true,
    timestamp: new Date().toISOString()
  });
});

// Test Notion connection (keep for debugging)
app.get('/api/test', async (req, res) => {
  try {
    const response = await notion.databases.query({
      database_id: databases.tasks_master,
      page_size: 1
    });
    res.json({ 
      status: 'success', 
      message: 'Notion connection successful',
      tasks_found: response.results.length 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// MAIN UNIFIED AGENT ENDPOINT
app.post('/api/agent', async (req, res) => {
  try {
    const { agent, action, idempotency_key, meta } = req.body;
    
    // Validate required fields
    if (!agent || !action || !idempotency_key) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: agent, action, idempotency_key'
      });
    }
    
    // Check idempotency
    if (processedKeys.has(idempotency_key)) {
      return res.json({ 
        status: 'success', 
        message: 'Already processed',
        cached: true 
      });
    }
    
    // Extract request payload based on action type
    let requestPayload = {};
    if (action === 'task.find') {
      // For find, use filters from meta
      requestPayload = meta?.filters || {};
    } else if (action.startsWith('task.')) {
      // For other task actions, require meta.task
      if (!meta?.task) {
        throw new Error(`Missing meta.task for action ${action}`);
      }
      requestPayload = meta.task;
    } else if (meta?.task) {
      // For any other actions that might have task data
      requestPayload = meta.task;
    }
    
    // Log activity
    logActivity(agent, action, requestPayload, meta);
    
    // Route to action handler
    let result;
    switch(action) {
      case 'task.create':
        result = await createTask(requestPayload);
        break;
      case 'task.update':
        if (!requestPayload.record_id && !requestPayload.id) {
          throw new Error('record_id or id required for task update');
        }
        // Handle both record_id and id fields
        requestPayload.record_id = requestPayload.record_id || requestPayload.id;
        result = await updateTask(requestPayload);
        break;
      case 'task.delete':
        if (!requestPayload.record_id && !requestPayload.id) {
          throw new Error('record_id or id required for task deletion');
        }
        requestPayload.record_id = requestPayload.record_id || requestPayload.id;
        result = await deleteTask(requestPayload);
        break;
      case 'task.find':
        result = await findTasks(requestPayload);
        break;
      case 'project.create':
        result = await createProject(requestPayload);
        break;
      case 'project.find':
        result = await findProjects(requestPayload);
        break;
      case 'agent.coordinate':
        result = await coordinateAgent(requestPayload);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    // Mark as processed
    processedKeys.add(idempotency_key);
    
    // Clean up old keys periodically
    if (processedKeys.size > 1000) {
      processedKeys.clear();
    }
    
    // Return standardized response
    res.json({
      status: 'success',
      data: result,
      message: `Action ${action} completed successfully`,
      metadata: {
        agent,
        timestamp: new Date().toISOString(),
        idempotency_key
      }
    });
    
  } catch (error) {
    console.error('Error in agent endpoint:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      action: req.body.action
    });
  }
});

// ACTION HANDLERS

async function createTask(payload) {
  const response = await notion.pages.create({
    parent: { database_id: databases.tasks_master },
    properties: {
      title: { title: [{ text: { content: payload.title || "New Task" } }] },
      status: { select: { name: payload.status || 'not_started' } },
      assignee: payload.assignee ? { 
        rich_text: [{ text: { content: payload.assignee } }] 
      } : undefined,
      priority: { select: { name: payload.priority || 'medium' } },
      due_date: payload.due_date ? { date: { start: payload.due_date } } : undefined,
      notes: payload.notes ? { 
        rich_text: [{ text: { content: payload.notes } }] 
      } : undefined,
      category: payload.category ? {
        rich_text: [{ text: { content: payload.category } }]
      } : undefined,
      cost: payload.cost ? { number: payload.cost } : undefined,
      effort_hours: payload.effort_hours ? { number: payload.effort_hours } : undefined
    }
  });
  
  return {
    record_id: response.id,
    record_url: response.url,
    title: payload.title || "New Task",
    message: `Task "${payload.title || 'New Task'}" created successfully`
  };
}

async function updateTask(payload) {
  const { record_id, ...updates } = payload;
  
  if (!record_id) {
    throw new Error('record_id is required for task update');
  }
  
  const properties = {};
  if (updates.status) {
    properties.status = { select: { name: updates.status } };
  }
  if (updates.assignee) {
    properties.assignee = { rich_text: [{ text: { content: updates.assignee } }] };
  }
  if (updates.priority) {
    properties.priority = { select: { name: updates.priority } };
  }
  if (updates.notes) {
    properties.notes = { rich_text: [{ text: { content: updates.notes } }] };
  }
  if (updates.due_date) {
    properties.due_date = { date: { start: updates.due_date } };
  }
  
  const response = await notion.pages.update({
    page_id: record_id,
    properties
  });
  
  return {
    record_id: response.id,
    updated: true,
    message: 'Task updated successfully'
  };
}

async function deleteTask(payload) {
  if (!payload.record_id) {
    throw new Error('record_id is required for task deletion');
  }
  
  const response = await notion.pages.update({
    page_id: payload.record_id,
    archived: true
  });
  
  return {
    record_id: response.id,
    archived: true,
    message: 'Task archived successfully'
  };
}

async function findTasks(payload) {
  const filters = [];
  
  // Build filter based on payload
  if (payload.status) {
    filters.push({
      property: 'status',
      select: { equals: payload.status }
    });
  }
  
  if (payload.assignee) {
    filters.push({
      property: 'assignee',
      rich_text: { contains: payload.assignee }
    });
  }
  
  if (payload.priority) {
    filters.push({
      property: 'priority',
      select: { equals: payload.priority }
    });
  }
  
  const filter = filters.length > 0 ? 
    (filters.length === 1 ? filters[0] : { and: filters }) : 
    undefined;
  
  const response = await notion.databases.query({
    database_id: databases.tasks_master,
    filter: filter,
    sorts: [
      { property: 'priority', direction: 'descending' },
      { property: 'due_date', direction: 'ascending' }
    ],
    page_size: payload.limit || 100
  });
  
  // Format tasks for readability
  const tasks = response.results.map(page => ({
    id: page.id,
    title: page.properties.title?.title?.[0]?.text?.content || 'Untitled',
    status: page.properties.status?.select?.name || 'not_started',
    assignee: page.properties.assignee?.rich_text?.[0]?.text?.content || 'Unassigned',
    due_date: page.properties.due_date?.date?.start || null,
    priority: page.properties.priority?.select?.name || 'medium',
    notes: page.properties.notes?.rich_text?.[0]?.text?.content || '',
    url: page.url
  }));
  
  return { 
    tasks, 
    count: tasks.length,
    message: `Found ${tasks.length} tasks`
  };
}

async function createProject(payload) {
  const response = await notion.pages.create({
    parent: { database_id: databases.projects_master },
    properties: {
      name: { title: [{ text: { content: payload.name || "New Project" } }] },
      status: { select: { name: payload.status || 'not_started' } },
      owner: payload.owner ? { 
        rich_text: [{ text: { content: payload.owner } }] 
      } : undefined,
      budget: payload.budget ? { number: payload.budget } : undefined,
      priority: payload.priority ? { 
        select: { name: payload.priority || 'medium' } 
      } : undefined,
      due_date: payload.due_date ? { 
        date: { start: payload.due_date } 
      } : undefined
    }
  });
  
  return {
    record_id: response.id,
    record_url: response.url,
    name: payload.name || "New Project",
    message: `Project "${payload.name || 'New Project'}" created successfully`
  };
}

async function findProjects(payload) {
  const response = await notion.databases.query({
    database_id: databases.projects_master,
    sorts: [{ property: 'priority', direction: 'descending' }]
  });
  
  const projects = response.results.map(page => ({
    id: page.id,
    name: page.properties.name?.title?.[0]?.text?.content || 'Untitled',
    status: page.properties.status?.select?.name || 'not_started',
    owner: page.properties.owner?.rich_text?.[0]?.text?.content || 'Unassigned',
    budget: page.properties.budget?.number || 0,
    priority: page.properties.priority?.select?.name || 'medium',
    url: page.url
  }));
  
  return { 
    projects, 
    count: projects.length,
    message: `Found ${projects.length} projects`
  };
}

async function coordinateAgent(payload) {
  // Inter-agent communication logic
  // This will be expanded as we add more agents
  return {
    target_agent: payload.target_agent,
    instruction: payload.instruction,
    status: 'coordination_logged',
    message: `Coordination request sent to ${payload.target_agent}`
  };
}

async function logActivity(agent, action, payload, meta) {
  // Fire and forget activity logging
  try {
    await notion.pages.create({
      parent: { database_id: databases.activity_log },
      properties: {
        timestamp: { date: { start: new Date().toISOString() } },
        agent: { rich_text: [{ text: { content: agent } }] },
        action: { rich_text: [{ text: { content: action } }] },
        request_payload: { rich_text: [{ text: { content: JSON.stringify(payload) } }] },
        status: { select: { name: 'success' } }
      }
    });
  } catch (error) {
    console.error('Activity log error:', error);
    // Don't throw - logging failure shouldn't break the main operation
  }
}

// Keep backward compatibility endpoints temporarily
app.get('/api/tasks', async (req, res) => {
  try {
    const result = await findTasks({});
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const result = await createTask(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Blair AI v2.0 Router running on port ${PORT}`);
  console.log(`Connected to ${Object.keys(databases).length} Notion databases`);
  console.log(`Unified endpoint: POST /api/agent`);
});
