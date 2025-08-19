const express = require('express');
const { Client } = require('@notionhq/client');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY || "ntn_q6114035264a9G5f3vNW7dNDEWuaudZP6i4BbWaMBvxaYm"
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

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Blair AI v2.0 Router Active',
    version: '2.0.0',
    databases: Object.keys(databases).length,
    notion_connected: true,
    timestamp: new Date().toISOString()
  });
});

// Test Notion connection
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

// Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const response = await notion.databases.query({
      database_id: databases.tasks_master,
      sorts: [{ property: 'priority', direction: 'descending' }]
    });
    res.json({ 
      status: 'success',
      count: response.results.length,
      tasks: response.results
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// Create a task
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, priority, notes, status } = req.body;
    
    const response = await notion.pages.create({
      parent: { database_id: databases.tasks_master },
      properties: {
        title: { title: [{ text: { content: title || "New Task" } }] },
        priority: { select: { name: priority || "medium" } },
        status: { select: { name: status || "not_started" } },
        notes: { rich_text: [{ text: { content: notes || "" } }] }
      }
    });
    
    res.json({ 
      status: 'success',
      message: 'Task created',
      task_id: response.id
    });
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
});
